import { Page } from 'playwright';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ScrapedProduct } from '../core/ScraperEngine';
import * as cheerio from 'cheerio';

export class NikeAdapter extends BaseAdapter {
  constructor() {
    const config: AdapterConfig = {
      baseUrl: 'https://www.nike.com',
      selectors: {
        productName: 'h1[data-automation-id="product-title"], h1.headline-1',
        price: '[data-automation-id="product-price"], .current-price, .product-price',
        salePrice: '[data-automation-id="product-price-reduced"], .sale-price, .was-price',
        description: '[data-automation-id="product-description"], .description-text',
        images: '.product-image img, .media-wrapper img, [data-automation-id="product-image"]',
        variants: {
          colors: '.color-chip, [data-automation-id="color-picker"] button',
          sizes: '.size-picker button, [data-automation-id="size-picker"] button'
        },
        availability: '.availability, [data-automation-id="availability"]',
        sku: '[data-automation-id="product-style"], .product-code',
        breadcrumbs: '.breadcrumbs a, .breadcrumb a'
      },
      apiEndpoints: {
        productData: '/product-data',
        variants: '/variant-data',
        inventory: '/availability'
      },
      features: {
        hasAjaxLoading: true,
        requiresScrolling: true,
        hasLazyImages: true,
        usesJsonLd: true,
        hasSizeChart: true
      }
    };

    super(config);
  }

  protected getBrandName(): string {
    return 'Nike';
  }

  /**
   * Nike-specific external ID extraction
   */
  protected generateExternalId(url: string): string {
    // Nike URLs typically have format: https://www.nike.com/t/product-name/STYLE-CODE
    const matches = url.match(/\/t\/[^\/]+\/([A-Z0-9-]+)/) ||
                   url.match(/\/([A-Z0-9]{6,12})(?:\/|$)/) ||
                   url.match(/product\/([^\/\?]+)/);

    return matches ? matches[1] : `nike_${Date.now()}`;
  }

  /**
   * Override to handle Nike's specific product data extraction
   */
  async extractProduct(page: Page): Promise<ScrapedProduct | null> {
    try {
      // Wait for Nike-specific content to load
      await this.waitForContent(page);

      // Try Nike-specific API extraction first
      let productData = await this.extractFromNikeApi(page);

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
      console.error('[NIKE ADAPTER] Error extracting product:', error);
      return null;
    }
  }

  /**
   * Extract product data from Nike's internal API/JSON
   */
  protected async extractFromNikeApi(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      console.log('[NIKE ADAPTER] 🔍 Extracting from Nike API data...');

      // Look for Nike's product data in window object or script tags
      const nikeData = await page.evaluate(() => {
        // Nike often stores product data in these global variables
        return (window as any).__NEXT_DATA__ ||
               (window as any).initialState ||
               (window as any).product ||
               null;
      });

      if (nikeData) {
        console.log('[NIKE ADAPTER] 📦 Found Nike API data');
        return this.parseNikeProductData(nikeData);
      }

      // Try to find JSON data in script tags
      const scriptData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent) {
            // Look for product data patterns
            if (script.textContent.includes('product') &&
                script.textContent.includes('price') &&
                script.textContent.includes('"title"')) {
              try {
                // Try to extract JSON objects
                const jsonMatch = script.textContent.match(/\{[^{}]*"product"[^{}]*\{[\s\S]*?\}[\s\S]*?\}/);
                if (jsonMatch) {
                  return JSON.parse(jsonMatch[0]);
                }
              } catch (e) {
                continue;
              }
            }
          }
        }
        return null;
      });

      if (scriptData) {
        return this.parseNikeProductData(scriptData);
      }

    } catch (error) {
      console.warn('[NIKE ADAPTER] Error extracting from API:', error);
    }

    return null;
  }

  /**
   * Parse Nike's product data structure
   */
  private parseNikeProductData(data: any): Partial<ScrapedProduct> | null {
    try {
      // Navigate Nike's nested data structure
      const product = data.props?.pageProps?.initialState?.product ||
                     data.product ||
                     data;

      if (!product) return null;

      const images = this.parseNikeImages(product.images || product.media || []);
      const variants = this.parseNikeVariants(product.skus || product.variants || []);

      return {
        name: product.title || product.displayName || product.name,
        description: product.description || product.shortDescription,
        basePrice: this.parsePrice(product.currentPrice || product.price?.current),
        salePrice: this.parsePrice(product.msrp || product.price?.full),
        currency: product.currency || 'USD',
        images,
        variants,
        category: product.productType || product.category,
        subcategory: product.subType || product.subcategory,
        gender: product.gender,
        season: product.season,
        tags: product.keywords?.split(',') || [],
        url: product.url || undefined
      };
    } catch (error) {
      console.error('[NIKE ADAPTER] Error parsing Nike data:', error);
      return null;
    }
  }

  /**
   * Parse Nike image data
   */
  private parseNikeImages(imageData: any[]): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    imageData.forEach(img => {
      let url = img.portrayalUrl || img.url || img.src || img.imageUrl;

      if (url) {
        // Nike images often need protocol
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }

        images.push({
          url,
          alt: img.altText || img.alt
        });
      }
    });

    return images;
  }

  /**
   * Parse Nike variant data (colors, sizes)
   */
  private parseNikeVariants(variantData: any[]): Array<{
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
      const color = variant.colorDescription || variant.color || 'Default';
      const size = variant.nikeSize || variant.size || variant.localizedSize;
      const sku = variant.skuId || variant.sku || variant.id;

      if (size) {
        variants.push({
          color,
          size: size.toString(),
          sku: sku || `nike_${Date.now()}_${size}`,
          available: variant.available || variant.available !== false,
          stockQuantity: variant.level || (variant.available ? 1 : 0)
        });
      }
    });

    return variants;
  }

  /**
   * Enhanced HTML extraction for Nike-specific elements
   */
  protected async extractFromHtml(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      const content = await page.content();
      const $ = cheerio.load(content);

      console.log('[NIKE ADAPTER] 🔍 Extracting Nike product data from HTML');

      const name = this.extractText($, this.config.selectors.productName);
      const price = this.extractPrice($, this.config.selectors.price);
      const salePrice = this.config.selectors.salePrice
        ? this.extractPrice($, this.config.selectors.salePrice)
        : undefined;

      // Nike-specific description extraction
      const description = this.extractText($, this.config.selectors.description) ||
                         this.extractText($, '.pi-pdpmainbody .pi-description') ||
                         this.extractText($, '.description-content');

      const images = this.extractImages($, this.config.selectors.images);
      const variants = await this.extractNikeVariants(page, $);

      // Extract Nike-specific data
      const gender = this.extractGender($);
      const category = this.extractCategoryFromBreadcrumbs($, this.config.selectors.breadcrumbs!);
      const tags = this.extractTags($);

      if (name && price !== null) {
        return {
          name,
          basePrice: price,
          salePrice: salePrice || undefined,
          description,
          images,
          variants: variants || [],
          category,
          gender,
          tags,
          url: page.url()
        };
      }

      return null;
    } catch (error) {
      console.error('[NIKE ADAPTER] Error extracting from HTML:', error);
      return null;
    }
  }

  /**
   * Extract Nike variants from HTML
   */
  private async extractNikeVariants(page: Page, $: cheerio.CheerioAPI): Promise<Array<{
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
      // Extract colors from Nike color picker
      const colors: string[] = [];
      $(this.config.selectors.variants?.colors || '').each((i, el) => {
        const colorName = $(el).attr('aria-label') ||
                         $(el).attr('data-color-name') ||
                         $(el).attr('title') ||
                         $(el).text().trim();
        if (colorName) colors.push(colorName);
      });

      // Extract sizes from Nike size picker
      const sizes: Array<{name: string, available: boolean}> = [];
      $(this.config.selectors.variants?.sizes || '').each((i, el) => {
        const sizeName = $(el).text().trim() || $(el).attr('data-size');
        const available = !$(el).hasClass('disabled') &&
                         !$(el).hasClass('sold-out') &&
                         !$(el).attr('disabled');

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
          sku: `nike_${Date.now()}_${size.name}`,
          available: size.available,
          stockQuantity: size.available ? 1 : 0
        });
      });

    } catch (error) {
      console.warn('[NIKE ADAPTER] Error extracting variants:', error);
    }

    return variants;
  }

  /**
   * Extract gender from Nike product page
   */
  private extractGender($: cheerio.CheerioAPI): string | undefined {
    // Look for gender indicators in various places
    const genderText = this.extractText($, '.gender') ||
                      this.extractText($, '[data-automation-id="gender"]') ||
                      this.extractText($, '.product-gender');

    if (genderText) {
      const text = genderText.toLowerCase();
      if (text.includes('men')) return 'Men';
      if (text.includes('women')) return 'Women';
      if (text.includes('kid') || text.includes('child')) return 'Kids';
      if (text.includes('unisex')) return 'Unisex';
    }

    // Check breadcrumbs for gender
    const breadcrumbs = $('.breadcrumbs, .breadcrumb').text().toLowerCase();
    if (breadcrumbs.includes("men's") || breadcrumbs.includes('men/')) return 'Men';
    if (breadcrumbs.includes("women's") || breadcrumbs.includes('women/')) return 'Women';
    if (breadcrumbs.includes('kids') || breadcrumbs.includes('children')) return 'Kids';

    return undefined;
  }

  /**
   * Extract tags from Nike product page
   */
  private extractTags($: cheerio.CheerioAPI): string[] | undefined {
    const tags: string[] = [];

    // Extract from various tag sources
    $('[data-automation-id="product-tags"] span, .product-tags .tag, .keywords').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });

    // Extract from meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      tags.push(...metaKeywords.split(',').map(tag => tag.trim()));
    }

    return tags.length > 0 ? [...new Set(tags)] : undefined; // Remove duplicates
  }

  /**
   * Enhanced wait for Nike-specific content loading
   */
  protected async waitForContent(page: Page): Promise<void> {
    await super.waitForContent(page);

    try {
      // Wait for Nike-specific dynamic content
      await page.waitForSelector('[data-automation-id="product-title"]', { timeout: 10000 });

      // Wait for price to load (Nike prices are often loaded async)
      await page.waitForSelector('[data-automation-id="product-price"]', { timeout: 5000 });

      // Allow time for size picker to load
      await page.waitForTimeout(2000);

    } catch (error) {
      console.warn('[NIKE ADAPTER] Some Nike elements not found, continuing...');
    }
  }
}

export default NikeAdapter;