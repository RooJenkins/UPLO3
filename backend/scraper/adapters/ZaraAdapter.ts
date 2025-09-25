import { Page } from 'playwright';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import * as cheerio from 'cheerio';

/**
 * Zara-specific scraping adapter
 * Handles Zara's React-based SPA with JSON-LD data and AJAX loading
 */
export class ZaraAdapter extends BaseAdapter {
  constructor() {
    super({
      baseUrl: 'https://zara.com',
      selectors: {
        productName: '[data-testid="product-name"], .product-name, h1.product-detail-info__header-name',
        price: '[data-testid="price-current"], .price-current, .product-detail-info__price .price-current, .money-amount__main',
        salePrice: '[data-testid="price-old"], .price-old, .product-detail-info__price .price-old',
        description: '[data-testid="product-description"], .product-detail-description, .product-detail-info__description',
        images: '.media-image__image img, .product-media img, [data-testid="product-image"]',
        variants: {
          colors: '[data-testid="product-color-selector"] button, .product-detail-color-selector__color',
          sizes: '[data-testid="product-size-selector"] button, .product-detail-size-info__main-label'
        },
        availability: '[data-testid="product-availability"], .product-availability, .product-detail-availability',
        breadcrumbs: '.breadcrumb-item, .layout-breadcrumb__item a',
        sku: '[data-testid="product-id"], .product-reference'
      },
      apiEndpoints: {
        productData: '/api/catalog/spa/product/{productId}',
        variants: '/api/catalog/spa/product/{productId}/variants',
        inventory: '/api/catalog/spa/product/{productId}/stock'
      },
      features: {
        hasAjaxLoading: true,
        requiresScrolling: true,
        hasLazyImages: true,
        usesJsonLd: true,
        hasSizeChart: true
      }
    });
  }

  protected getBrandName(): string {
    return 'Zara';
  }

  /**
   * Enhanced extraction for Zara's React-based architecture
   */
  async extractProduct(page: Page): Promise<any | null> {
    try {
      console.log('[ZARA] 🔍 Starting Zara product extraction...');

      // Wait for React app to load
      await this.waitForZaraContent(page);

      // Try multiple extraction strategies specific to Zara
      let productData = await this.extractFromZaraJson(page);
      if (!productData) {
        productData = await this.extractFromJsonLd(page);
      }
      if (!productData) {
        productData = await this.extractFromHtml(page);
      }

      if (productData) {
        // Enhance with Zara-specific data
        productData = await this.enhanceWithZaraData(page, productData);
        return this.validateAndCleanData(productData, page.url());
      }

      return null;
    } catch (error) {
      console.error('[ZARA] ❌ Error extracting Zara product:', error);
      return null;
    }
  }

  /**
   * Wait for Zara's React content to fully load
   */
  private async waitForZaraContent(page: Page): Promise<void> {
    console.log('[ZARA] ⏳ Waiting for Zara content to load...');

    // Wait for initial page load
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to render product content
    try {
      await page.waitForFunction(() => {
        const productName = document.querySelector('[data-testid="product-name"], .product-name, h1');
        const price = document.querySelector('[data-testid="price-current"], .price-current, .money-amount__main');
        return productName && price;
      }, { timeout: 15000 });
    } catch (error) {
      console.warn('[ZARA] ⚠️ Timeout waiting for product elements, continuing...');
    }

    // Additional wait for AJAX loading
    await page.waitForTimeout(3000);

    // Wait for images to load
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('.media-image__image img, .product-media img');
      return images.length > 0 && Array.from(images).some(img => img.getAttribute('src'));
    }, { timeout: 10000 }).catch(() => {
      console.warn('[ZARA] ⚠️ Images not loaded, continuing...');
    });
  }

  /**
   * Extract data from Zara's internal JSON data
   */
  private async extractFromZaraJson(page: Page): Promise<any | null> {
    try {
      console.log('[ZARA] 📊 Attempting to extract from Zara JSON data...');

      const zaraData = await page.evaluate(() => {
        // Try to find Zara's product data in various locations
        const scripts = Array.from(document.querySelectorAll('script'));

        for (const script of scripts) {
          const content = script.textContent || '';

          // Look for product data patterns
          if (content.includes('window.__PRELOADED_STATE__')) {
            try {
              const match = content.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/);
              if (match) {
                return JSON.parse(match[1]);
              }
            } catch (e) {
              continue;
            }
          }

          if (content.includes('window.__INITIAL_STATE__')) {
            try {
              const match = content.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
              if (match) {
                return JSON.parse(match[1]);
              }
            } catch (e) {
              continue;
            }
          }

          // Look for product-specific JSON
          if (content.includes('"id":') && content.includes('"name":') && content.includes('"price":')) {
            try {
              const jsonMatch = content.match(/({[^}]*"id"[^}]*"name"[^}]*"price"[^}]*})/);
              if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
              }
            } catch (e) {
              continue;
            }
          }
        }

        return null;
      });

      if (zaraData) {
        console.log('[ZARA] ✅ Found Zara JSON data');
        return this.parseZaraJsonData(zaraData);
      }

      return null;
    } catch (error) {
      console.warn('[ZARA] ⚠️ Error extracting from Zara JSON:', error);
      return null;
    }
  }

  /**
   * Parse Zara's internal JSON data structure
   */
  private parseZaraJsonData(data: any): any {
    // Navigate through Zara's complex data structure
    let product = null;

    // Try different paths where product data might be stored
    if (data.product) {
      product = data.product;
    } else if (data.catalog && data.catalog.product) {
      product = data.catalog.product;
    } else if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      product = data.products[0];
    } else if (data.detail && data.detail.product) {
      product = data.detail.product;
    }

    if (!product) {
      return null;
    }

    return {
      externalId: product.id || product.productId || product.reference,
      name: product.name || product.title,
      description: product.description || product.detail || product.shortDescription,
      basePrice: this.parseZaraPrice(product.price),
      salePrice: this.parseZaraPrice(product.oldPrice || product.originalPrice),
      images: this.parseZaraImages(product.images || product.media || product.photos),
      variants: this.parseZaraVariants(product.variants || product.colors || product.sizes),
      category: this.parseZaraCategory(product),
      materials: product.composition || product.materials,
      careInstructions: product.care || product.careInstructions,
      tags: this.parseZaraTags(product)
    };
  }

  /**
   * Parse Zara price data
   */
  private parseZaraPrice(priceData: any): number | null {
    if (!priceData) return null;

    if (typeof priceData === 'number') {
      return Math.round(priceData * 100); // Convert to cents
    }

    if (typeof priceData === 'string') {
      return this.parsePrice(priceData);
    }

    if (priceData.amount || priceData.value) {
      return Math.round((priceData.amount || priceData.value) * 100);
    }

    return null;
  }

  /**
   * Parse Zara images
   */
  private parseZaraImages(imageData: any): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    if (!imageData) return images;

    const processImage = (img: any) => {
      let url = img.url || img.src || img.path;
      if (url) {
        // Ensure full URL
        if (url.startsWith('//')) {
          url = 'https:' + url;
        } else if (url.startsWith('/')) {
          url = 'https://static.zara.net' + url;
        }

        images.push({
          url,
          alt: img.alt || img.description || undefined
        });
      }
    };

    if (Array.isArray(imageData)) {
      imageData.forEach(processImage);
    } else if (typeof imageData === 'object') {
      if (imageData.url || imageData.src) {
        processImage(imageData);
      } else {
        // Check nested image objects
        Object.values(imageData).forEach((img: any) => {
          if (img && (img.url || img.src)) {
            processImage(img);
          }
        });
      }
    }

    return images;
  }

  /**
   * Parse Zara variants (colors and sizes)
   */
  private parseZaraVariants(variantData: any): Array<{
    color: string;
    size: string;
    sku: string;
    available: boolean;
    stockQuantity: number;
  }> {
    const variants: any[] = [];

    if (!variantData) return variants;

    // Handle different variant data structures
    if (Array.isArray(variantData)) {
      variantData.forEach(variant => {
        variants.push({
          color: variant.color || variant.colorName || 'Unknown',
          size: variant.size || variant.sizeName || 'One Size',
          sku: variant.sku || variant.id || variant.reference,
          available: variant.available !== false && (variant.stock || 0) > 0,
          stockQuantity: variant.stock || variant.quantity || (variant.available ? 1 : 0)
        });
      });
    }

    return variants;
  }

  /**
   * Parse Zara category information
   */
  private parseZaraCategory(product: any): string {
    if (product.category) {
      return Array.isArray(product.category)
        ? product.category[product.category.length - 1]
        : product.category;
    }

    if (product.section) {
      return product.section;
    }

    if (product.family) {
      return product.family;
    }

    return 'Unknown';
  }

  /**
   * Parse Zara product tags
   */
  private parseZaraTags(product: any): string[] {
    const tags: string[] = [];

    if (product.tags && Array.isArray(product.tags)) {
      tags.push(...product.tags);
    }

    if (product.style) {
      tags.push(product.style);
    }

    if (product.season) {
      tags.push(product.season);
    }

    if (product.gender) {
      tags.push(product.gender);
    }

    // Add Zara-specific tags
    tags.push('zara', 'fast-fashion', 'trendy');

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Enhance product data with additional Zara-specific information
   */
  private async enhanceWithZaraData(page: Page, productData: any): Promise<any> {
    try {
      // Extract additional data from the page if not already present
      const content = await page.content();
      const $ = cheerio.load(content);

      // Try to get better variant information
      if (!productData.variants || productData.variants.length === 0) {
        productData.variants = await this.extractZaraVariants(page, $);
      }

      // Extract size chart if available
      if (this.config.features.hasSizeChart) {
        productData.sizeChart = await this.extractSizeChart(page);
      }

      // Get product reference/SKU
      if (!productData.externalId) {
        const reference = $('[data-testid="product-reference"], .product-reference').first().text().trim();
        if (reference) {
          productData.externalId = reference;
        }
      }

      return productData;
    } catch (error) {
      console.warn('[ZARA] ⚠️ Error enhancing with additional data:', error);
      return productData;
    }
  }

  /**
   * Extract Zara variants from HTML
   */
  private async extractZaraVariants(page: Page, $: cheerio.CheerioAPI): Promise<any[]> {
    const variants: any[] = [];

    try {
      // Get available colors
      const colors = await page.evaluate(() => {
        const colorElements = document.querySelectorAll('[data-testid="product-color-selector"] button, .product-detail-color-selector__color');
        return Array.from(colorElements).map((el: any) => ({
          name: el.getAttribute('title') || el.getAttribute('aria-label') || 'Unknown',
          available: !el.disabled && !el.classList.contains('disabled')
        }));
      });

      // Get available sizes
      const sizes = await page.evaluate(() => {
        const sizeElements = document.querySelectorAll('[data-testid="product-size-selector"] button, .size-selector button');
        return Array.from(sizeElements).map((el: any) => ({
          name: el.textContent?.trim() || 'Unknown',
          available: !el.disabled && !el.classList.contains('disabled')
        }));
      });

      // Create variants from color/size combinations
      const colorsList = colors.length > 0 ? colors : [{ name: 'One Color', available: true }];
      const sizesList = sizes.length > 0 ? sizes : [{ name: 'One Size', available: true }];

      for (const color of colorsList) {
        for (const size of sizesList) {
          variants.push({
            color: color.name,
            size: size.name,
            sku: `${color.name}-${size.name}`.toLowerCase().replace(/\s+/g, '-'),
            available: color.available && size.available,
            stockQuantity: color.available && size.available ? 5 : 0 // Default stock
          });
        }
      }
    } catch (error) {
      console.warn('[ZARA] ⚠️ Error extracting variants:', error);
    }

    return variants;
  }

  /**
   * Extract size chart information
   */
  private async extractSizeChart(page: Page): Promise<any | null> {
    try {
      // Look for size chart modal or data
      const sizeChartData = await page.evaluate(() => {
        const sizeChartBtn = document.querySelector('[data-testid="size-chart"], .size-chart-btn');
        if (sizeChartBtn) {
          // Try to click and extract size chart data
          // This would need more complex implementation for actual size chart extraction
          return { hasSizeChart: true };
        }
        return null;
      });

      return sizeChartData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Override external ID generation for Zara URLs
   */
  protected generateExternalId(url: string): string {
    // Zara URLs typically have format: /product-name-p{productId}.html
    const match = url.match(/p(\d+)\.html$/);
    if (match) {
      return match[1];
    }

    // Fallback to base implementation
    return super.generateExternalId(url);
  }
}

export default ZaraAdapter;