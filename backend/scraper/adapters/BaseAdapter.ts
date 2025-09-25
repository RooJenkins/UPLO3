import { Page } from 'playwright';
import { ScrapedProduct } from '../core/ScraperEngine';
import * as cheerio from 'cheerio';

export interface AdapterConfig {
  baseUrl: string;
  selectors: {
    productName: string;
    price: string;
    salePrice?: string;
    description?: string;
    images: string;
    variants?: {
      colors?: string;
      sizes?: string;
    };
    availability?: string;
    sku?: string;
    breadcrumbs?: string;
  };
  apiEndpoints?: {
    productData?: string;
    variants?: string;
    inventory?: string;
  };
  features: {
    hasAjaxLoading: boolean;
    requiresScrolling: boolean;
    hasLazyImages: boolean;
    usesJsonLd: boolean;
    hasSizeChart: boolean;
  };
}

export abstract class BaseAdapter {
  protected config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Main method to extract product data from a page
   */
  async extractProduct(page: Page): Promise<ScrapedProduct | null> {
    try {
      // Wait for page to load completely
      await this.waitForContent(page);

      // Try multiple extraction strategies
      let productData = await this.extractFromJsonLd(page);
      if (!productData) {
        productData = await this.extractFromHtml(page);
      }
      if (!productData) {
        productData = await this.extractFromApi(page);
      }

      if (productData) {
        // Post-process and validate data
        return this.validateAndCleanData(productData, page.url());
      }

      return null;
    } catch (error) {
      console.error('[ADAPTER] Error extracting product:', error);
      return null;
    }
  }

  /**
   * Wait for content to load based on adapter configuration
   */
  protected async waitForContent(page: Page): Promise<void> {
    // Wait for basic content
    await page.waitForLoadState('domcontentloaded');

    // Handle AJAX loading
    if (this.config.features.hasAjaxLoading) {
      await page.waitForTimeout(2000);
      // Wait for specific elements to appear
      try {
        await page.waitForSelector(this.config.selectors.productName, { timeout: 10000 });
      } catch (error) {
        console.warn('[ADAPTER] Product name selector not found, continuing...');
      }
    }

    // Handle scrolling for lazy loading
    if (this.config.features.requiresScrolling) {
      await this.scrollToLoadContent(page);
    }

    // Handle lazy loaded images
    if (this.config.features.hasLazyImages) {
      await this.loadLazyImages(page);
    }
  }

  /**
   * Scroll page to trigger lazy loading
   */
  protected async scrollToLoadContent(page: Page): Promise<void> {
    const scrollSteps = 5;
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);
    }
  }

  /**
   * Trigger lazy image loading
   */
  protected async loadLazyImages(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Scroll to each image to trigger loading
      const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
      images.forEach(img => {
        (img as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    await page.waitForTimeout(2000);
  }

  /**
   * Extract product data from JSON-LD structured data
   */
  protected async extractFromJsonLd(page: Page): Promise<Partial<ScrapedProduct> | null> {
    if (!this.config.features.usesJsonLd) {
      return null;
    }

    try {
      const jsonLdData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@type'] === 'Product' || data.product) {
              return data;
            }
          } catch (e) {
            continue;
          }
        }
        return null;
      });

      if (jsonLdData) {
        console.log('[ADAPTER] 📄 Found JSON-LD product data');
        return this.parseJsonLdProduct(jsonLdData);
      }
    } catch (error) {
      console.warn('[ADAPTER] Error extracting JSON-LD:', error);
    }

    return null;
  }

  /**
   * Extract product data from HTML using selectors
   */
  protected async extractFromHtml(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      const content = await page.content();
      const $ = cheerio.load(content);

      console.log('[ADAPTER] 🔍 Extracting product data from HTML selectors');

      // Extract basic product information
      const name = this.extractText($, this.config.selectors.productName);
      const price = this.extractPrice($, this.config.selectors.price);
      const salePrice = this.config.selectors.salePrice
        ? this.extractPrice($, this.config.selectors.salePrice)
        : undefined;
      const description = this.config.selectors.description
        ? this.extractText($, this.config.selectors.description)
        : undefined;

      // Extract images
      const images = this.extractImages($, this.config.selectors.images);

      // Extract variants (colors, sizes)
      const variants = await this.extractVariants(page, $);

      // Extract category from breadcrumbs if available
      const category = this.config.selectors.breadcrumbs
        ? this.extractCategoryFromBreadcrumbs($, this.config.selectors.breadcrumbs)
        : 'Unknown';

      if (name && price !== null) {
        return {
          name,
          basePrice: price,
          salePrice: salePrice || undefined,
          description,
          images,
          variants: variants || [],
          category,
          url: page.url()
        };
      }

      return null;
    } catch (error) {
      console.error('[ADAPTER] Error extracting from HTML:', error);
      return null;
    }
  }

  /**
   * Extract product data from API endpoints
   */
  protected async extractFromApi(page: Page): Promise<Partial<ScrapedProduct> | null> {
    // This method should be overridden by specific adapters that use API calls
    return null;
  }

  /**
   * Parse JSON-LD product data
   */
  protected parseJsonLdProduct(data: any): Partial<ScrapedProduct> {
    const product = data['@type'] === 'Product' ? data : data.product;

    return {
      name: product.name,
      description: product.description,
      basePrice: this.parsePrice(product.offers?.price || product.price),
      salePrice: this.parsePrice(product.offers?.salePrice),
      images: this.parseJsonLdImages(product.image),
      category: product.category || 'Unknown'
    };
  }

  /**
   * Extract text content from selector
   */
  protected extractText($: cheerio.CheerioAPI, selector: string): string | undefined {
    const element = $(selector).first();
    return element.length ? element.text().trim() : undefined;
  }

  /**
   * Extract price from selector
   */
  protected extractPrice($: cheerio.CheerioAPI, selector: string): number | null {
    const priceText = this.extractText($, selector);
    return priceText ? this.parsePrice(priceText) : null;
  }

  /**
   * Parse price string to number (in cents)
   */
  protected parsePrice(priceStr: string | undefined): number | null {
    if (!priceStr) return null;

    // Remove currency symbols and extract number
    const cleaned = priceStr.replace(/[^0-9.,]/g, '');
    const price = parseFloat(cleaned.replace(',', '.'));

    return isNaN(price) ? null : Math.round(price * 100); // Convert to cents
  }

  /**
   * Extract images from page
   */
  protected extractImages($: cheerio.CheerioAPI, selector: string): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    $(selector).each((i, el) => {
      const $el = $(el);
      let url = $el.attr('src') || $el.attr('data-src') || $el.attr('srcset')?.split(' ')[0];

      if (url && !url.startsWith('data:') && url.length > 10) {
        // Convert relative URLs to absolute
        if (url.startsWith('//')) {
          url = 'https:' + url;
        } else if (url.startsWith('/')) {
          url = this.config.baseUrl + url;
        }

        images.push({
          url,
          alt: $el.attr('alt') || undefined
        });
      }
    });

    return images;
  }

  /**
   * Parse images from JSON-LD data
   */
  protected parseJsonLdImages(imageData: any): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    if (typeof imageData === 'string') {
      images.push({ url: imageData });
    } else if (Array.isArray(imageData)) {
      imageData.forEach(img => {
        if (typeof img === 'string') {
          images.push({ url: img });
        } else if (img.url) {
          images.push({ url: img.url, alt: img.description });
        }
      });
    }

    return images;
  }

  /**
   * Extract variants (sizes, colors) - to be implemented by specific adapters
   */
  protected async extractVariants(page: Page, $: cheerio.CheerioAPI): Promise<Array<{
    color: string;
    size: string;
    sku: string;
    available: boolean;
    stockQuantity: number;
  }> | null> {
    // Default implementation - override in specific adapters
    return [];
  }

  /**
   * Extract category from breadcrumbs
   */
  protected extractCategoryFromBreadcrumbs($: cheerio.CheerioAPI, selector: string): string {
    const breadcrumbs: string[] = [];
    $(selector).each((i, el) => {
      const text = $(el).text().trim();
      if (text && !text.toLowerCase().includes('home')) {
        breadcrumbs.push(text);
      }
    });
    return breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : 'Unknown';
  }

  /**
   * Validate and clean extracted data
   */
  protected validateAndCleanData(data: Partial<ScrapedProduct>, url: string): ScrapedProduct | null {
    if (!data.name || data.basePrice === null) {
      console.warn('[ADAPTER] Invalid product data - missing name or price');
      return null;
    }

    return {
      externalId: this.generateExternalId(url),
      name: data.name,
      description: data.description || '',
      brand: this.getBrandName(),
      category: data.category || 'Unknown',
      subcategory: data.subcategory,
      basePrice: data.basePrice,
      salePrice: data.salePrice,
      currency: data.currency || 'USD',
      images: data.images || [],
      variants: data.variants || [],
      materials: data.materials,
      careInstructions: data.careInstructions,
      tags: data.tags || [],
      gender: data.gender,
      season: data.season,
      url
    };
  }

  /**
   * Generate external ID from URL
   */
  protected generateExternalId(url: string): string {
    // Extract product ID from URL - implement specific logic per brand
    const matches = url.match(/\/(\d+)\.html$/) || url.match(/\/p\/([^\/]+)/) || url.match(/product\/([^\/\?]+)/);
    return matches ? matches[1] : url.split('/').pop() || Date.now().toString();
  }

  /**
   * Get brand name - to be implemented by specific adapters
   */
  protected abstract getBrandName(): string;
}

export default BaseAdapter;