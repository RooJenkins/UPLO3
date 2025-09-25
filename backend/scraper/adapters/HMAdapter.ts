import { Page } from 'playwright';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ScrapedProduct } from '../core/ScraperEngine';
import * as cheerio from 'cheerio';

export class HMAdapter extends BaseAdapter {
  constructor() {
    const config: AdapterConfig = {
      baseUrl: 'https://www2.hm.com',
      selectors: {
        productName: 'h1.primary.product-item-headline, h1[data-testid="product-title"]',
        price: '.price .price-value, .price__value, [data-testid="price-current"]',
        salePrice: '.price .price-before, .price__previous, [data-testid="price-previous"]',
        description: '.product-description-text, [data-testid="product-description"]',
        images: '.product-detail-main-image-container img, .product-images img',
        variants: {
          colors: '.color-picker .color-option, .product-colors button',
          sizes: '.size-picker .size-option, .product-sizes button'
        },
        availability: '.availability-text, [data-testid="availability"]',
        sku: '[data-productcode], [data-product-id]',
        breadcrumbs: '.breadcrumb a, .breadcrumbs a'
      },
      apiEndpoints: {
        productData: '/product-detail',
        variants: '/variant-availability',
        inventory: '/stock-check'
      },
      features: {
        hasAjaxLoading: true,
        requiresScrolling: false,
        hasLazyImages: true,
        usesJsonLd: true,
        hasSizeChart: true
      }
    };

    super(config);
  }

  protected getBrandName(): string {
    return 'H&M';
  }

  /**
   * H&M-specific external ID extraction
   */
  protected generateExternalId(url: string): string {
    // H&M URLs typically have format: https://www2.hm.com/en_us/productpage.0123456789.html
    const matches = url.match(/productpage\.(\d+)\.html/) ||
                   url.match(/\/(\d{10,})\.html/) ||
                   url.match(/product\/([^\/\?]+)/);

    return matches ? matches[1] : `hm_${Date.now()}`;
  }

  /**
   * Override to handle H&M's specific product data extraction
   */
  async extractProduct(page: Page): Promise<ScrapedProduct | null> {
    try {
      // Wait for H&M-specific content to load
      await this.waitForContent(page);

      // Try H&M-specific API extraction first
      let productData = await this.extractFromHMApi(page);

      // Fall back to standard methods
      if (!productData) {
        productData = await this.extractFromJsonLd(page);
      }
      if (!productData) {
        productData = await this.extractFromHtml(page);
      }

      if (productData) {
        return this.validateAndCleanData(productData, page.url());
      }

      return null;
    } catch (error) {
      console.error('[H&M ADAPTER] Error extracting product:', error);
      return null;
    }
  }

  /**
   * Extract product data from H&M's internal API/JSON
   */
  protected async extractFromHMApi(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      console.log('[H&M ADAPTER] 🔍 Extracting from H&M API data...');

      // Look for H&M's product data in window object
      const hmData = await page.evaluate(() => {
        // H&M often stores product data in these global variables
        return (window as any).productArticles ||
               (window as any).productData ||
               (window as any).__INITIAL_STATE__ ||
               null;
      });

      if (hmData) {
        console.log('[H&M ADAPTER] 📦 Found H&M API data');
        return this.parseHMProductData(hmData);
      }

      // Try to intercept network requests for product data
      const apiData = await page.evaluate(() => {
        // Look for JSON data in script tags
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent && script.textContent.includes('productArticles')) {
            try {
              const match = script.textContent.match(/productArticles["\']?\s*:\s*(\[.*?\])/);
              if (match) {
                return JSON.parse(match[1]);
              }
            } catch (e) {
              continue;
            }
          }
        }
        return null;
      });

      if (apiData) {
        return this.parseHMProductData(apiData);
      }

    } catch (error) {
      console.warn('[H&M ADAPTER] Error extracting from API:', error);
    }

    return null;
  }

  /**
   * Parse H&M's product data structure
   */
  private parseHMProductData(data: any): Partial<ScrapedProduct> | null {
    try {
      // H&M data might be an array or object
      const product = Array.isArray(data) ? data[0] : data;

      if (!product) return null;

      const images = this.parseHMImages(product.images || product.galleryImages || []);
      const variants = this.parseHMVariants(product.variants || product.articlesList || []);

      return {
        name: product.name || product.title,
        description: product.description || product.descriptiveLength,
        basePrice: this.parsePrice(product.price?.value || product.whitePrice?.value),
        salePrice: this.parsePrice(product.redPrice?.value || product.salePrice?.value),
        currency: product.price?.currency || product.whitePrice?.currency || 'USD',
        images,
        variants,
        category: product.categoryName || product.category,
        materials: product.compositions?.map((c: any) => c.materials).flat(),
        careInstructions: product.careInstructions,
        url: product.link || undefined
      };
    } catch (error) {
      console.error('[H&M ADAPTER] Error parsing H&M data:', error);
      return null;
    }
  }

  /**
   * Parse H&M image data
   */
  private parseHMImages(imageData: any[]): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    imageData.forEach(img => {
      let url = img.url || img.src || img.baseUrl;

      if (url) {
        // H&M images often need protocol
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }

        images.push({
          url,
          alt: img.alt || img.altText
        });
      }
    });

    return images;
  }

  /**
   * Parse H&M variant data (colors, sizes)
   */
  private parseHMVariants(variantData: any[]): Array<{
    color: string;
    size: string;
    sku: string;
    available: boolean;
    stockQuantity: number;
  }> {
    const variants: Array<{
      color: string;
      size: string;
      sku: string;
      available: boolean;
      stockQuantity: number;
    }> = [];

    variantData.forEach(variant => {
      const sizes = variant.sizes || variant.variantSizes || [];
      const color = variant.color || variant.colorName || 'Unknown';

      sizes.forEach((size: any) => {
        variants.push({
          color,
          size: size.name || size.sizeName || size.code,
          sku: variant.code || variant.articleCode || variant.id,
          available: size.stock?.stockLevel > 0 || size.availability === 'available',
          stockQuantity: size.stock?.stockLevel || 0
        });
      });
    });

    return variants;
  }

  /**
   * Enhanced HTML extraction for H&M-specific elements
   */
  protected async extractFromHtml(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      const content = await page.content();
      const $ = cheerio.load(content);

      console.log('[H&M ADAPTER] 🔍 Extracting H&M product data from HTML');

      const name = this.extractText($, this.config.selectors.productName);
      const price = this.extractPrice($, this.config.selectors.price);
      const salePrice = this.config.selectors.salePrice
        ? this.extractPrice($, this.config.selectors.salePrice)
        : undefined;

      // H&M-specific description extraction
      const description = this.extractText($, this.config.selectors.description) ||
                         this.extractText($, '.product-description p') ||
                         this.extractText($, '.pdp-description-text');

      const images = this.extractImages($, this.config.selectors.images);
      const variants = await this.extractHMVariants(page, $);

      // Extract H&M-specific data
      const materials = this.extractMaterials($);
      const careInstructions = this.extractCareInstructions($);
      const category = this.extractCategoryFromBreadcrumbs($, this.config.selectors.breadcrumbs!);

      if (name && price !== null) {
        return {
          name,
          basePrice: price,
          salePrice: salePrice || undefined,
          description,
          images,
          variants: variants || [],
          materials,
          careInstructions,
          category,
          url: page.url()
        };
      }

      return null;
    } catch (error) {
      console.error('[H&M ADAPTER] Error extracting from HTML:', error);
      return null;
    }
  }

  /**
   * Extract H&M variants from HTML
   */
  private async extractHMVariants(page: Page, $: cheerio.CheerioAPI): Promise<Array<{
    color: string;
    size: string;
    sku: string;
    available: boolean;
    stockQuantity: number;
  }>> {
    const variants: Array<{
      color: string;
      size: string;
      sku: string;
      available: boolean;
      stockQuantity: number;
    }> = [];

    try {
      // Extract colors
      const colors: string[] = [];
      $(this.config.selectors.variants?.colors || '').each((i, el) => {
        const colorName = $(el).attr('data-color') ||
                         $(el).attr('title') ||
                         $(el).text().trim();
        if (colorName) colors.push(colorName);
      });

      // Extract sizes
      const sizes: Array<{name: string, available: boolean}> = [];
      $(this.config.selectors.variants?.sizes || '').each((i, el) => {
        const sizeName = $(el).text().trim() || $(el).attr('data-size');
        const available = !$(el).hasClass('disabled') && !$(el).hasClass('out-of-stock');

        if (sizeName) {
          sizes.push({ name: sizeName, available });
        }
      });

      // Generate combinations
      const colorToUse = colors.length > 0 ? colors[0] : 'Default';
      sizes.forEach(size => {
        variants.push({
          color: colorToUse,
          size: size.name,
          sku: `hm_${Date.now()}_${size.name}`,
          available: size.available,
          stockQuantity: size.available ? 1 : 0
        });
      });

    } catch (error) {
      console.warn('[H&M ADAPTER] Error extracting variants:', error);
    }

    return variants;
  }

  /**
   * Extract materials from H&M product page
   */
  private extractMaterials($: cheerio.CheerioAPI): string[] | undefined {
    const materials: string[] = [];

    // H&M material selectors
    $('.product-details .material, .composition-list li, [data-testid="composition"]').each((i, el) => {
      const material = $(el).text().trim();
      if (material) materials.push(material);
    });

    return materials.length > 0 ? materials : undefined;
  }

  /**
   * Extract care instructions from H&M product page
   */
  private extractCareInstructions($: cheerio.CheerioAPI): string[] | undefined {
    const instructions: string[] = [];

    $('.care-instructions li, .product-care li, [data-testid="care-instructions"] li').each((i, el) => {
      const instruction = $(el).text().trim();
      if (instruction) instructions.push(instruction);
    });

    return instructions.length > 0 ? instructions : undefined;
  }
}

export default HMAdapter;