import { Page } from 'playwright';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import * as cheerio from 'cheerio';

/**
 * Generic adapter for unknown/unsupported websites
 * Uses common CSS selectors and heuristics to extract product data
 */
export class GenericAdapter extends BaseAdapter {
  constructor() {
    super({
      baseUrl: '',
      selectors: {
        productName: 'h1, [class*="title"], [class*="name"], [class*="product"][class*="name"], .product-title',
        price: '[class*="price"]:not([class*="old"]):not([class*="original"]), .price, .amount, [class*="current-price"]',
        salePrice: '[class*="old-price"], [class*="original-price"], [class*="was-price"], .old-price, .original-price',
        description: '[class*="description"], .description, .product-description, [class*="detail"]',
        images: 'img[src*="product"], img[alt*="product"], .product-image img, [class*="gallery"] img, [class*="media"] img',
        variants: {
          colors: '[class*="color"] button, [class*="color"] .swatch, [class*="color-option"]',
          sizes: '[class*="size"] button, [class*="size"] .option, [class*="size-option"]'
        },
        availability: '[class*="availability"], [class*="stock"], .in-stock, .out-of-stock',
        breadcrumbs: '.breadcrumb a, [class*="breadcrumb"] a, nav a',
        sku: '[class*="sku"], [class*="product-id"], .product-code, .item-number'
      },
      features: {
        hasAjaxLoading: false,
        requiresScrolling: false,
        hasLazyImages: true,
        usesJsonLd: true,
        hasSizeChart: false
      }
    });
  }

  protected getBrandName(): string {
    return 'Unknown';
  }

  /**
   * Enhanced generic extraction with multiple fallback strategies
   */
  async extractProduct(page: Page): Promise<any | null> {
    try {
      console.log('[GENERIC] 🔍 Starting generic product extraction...');
      console.log('[GENERIC] 📍 URL:', page.url());

      // Wait for content
      await this.waitForGenericContent(page);

      // Try extraction methods in order of reliability
      let productData = await this.extractFromJsonLd(page);
      if (!productData) {
        productData = await this.extractFromMicrodata(page);
      }
      if (!productData) {
        productData = await this.extractFromOpenGraph(page);
      }
      if (!productData) {
        productData = await this.extractFromHtml(page);
      }
      if (!productData) {
        productData = await this.extractWithHeuristics(page);
      }

      if (productData) {
        // Enhance with generic heuristics
        productData = await this.enhanceWithHeuristics(page, productData);
        return this.validateAndCleanData(productData, page.url());
      }

      console.warn('[GENERIC] ⚠️ No product data could be extracted');
      return null;
    } catch (error) {
      console.error('[GENERIC] ❌ Error extracting generic product:', error);
      return null;
    }
  }

  /**
   * Wait for generic content to load
   */
  private async waitForGenericContent(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded');

    // Wait for common product page elements
    try {
      await page.waitForFunction(() => {
        const title = document.querySelector('h1, [class*="title"], [class*="name"]');
        const price = document.querySelector('[class*="price"], .price, .amount');
        return title && price;
      }, { timeout: 10000 });
    } catch (error) {
      console.warn('[GENERIC] ⚠️ Standard elements not found, using heuristics...');
    }

    // Wait a bit more for dynamic content
    await page.waitForTimeout(2000);
  }

  /**
   * Extract from microdata (schema.org markup)
   */
  private async extractFromMicrodata(page: Page): Promise<any | null> {
    try {
      const microdataProduct = await page.evaluate(() => {
        const productEl = document.querySelector('[itemtype*="schema.org/Product"]');
        if (!productEl) return null;

        const extract = (prop: string) => {
          const el = productEl.querySelector(`[itemprop="${prop}"]`);
          return el?.textContent?.trim() || el?.getAttribute('content') || null;
        };

        const priceEl = productEl.querySelector('[itemprop="price"]');
        const price = priceEl?.textContent?.trim() || priceEl?.getAttribute('content');

        return {
          name: extract('name'),
          description: extract('description'),
          price: price,
          brand: extract('brand'),
          sku: extract('sku'),
          image: extract('image')
        };
      });

      if (microdataProduct && microdataProduct.name) {
        console.log('[GENERIC] 📊 Found microdata product info');
        return {
          name: microdataProduct.name,
          description: microdataProduct.description,
          basePrice: this.parsePrice(microdataProduct.price),
          brand: microdataProduct.brand || this.getBrandName(),
          externalId: microdataProduct.sku,
          images: microdataProduct.image ? [{ url: microdataProduct.image }] : []
        };
      }
    } catch (error) {
      console.warn('[GENERIC] ⚠️ Error extracting microdata:', error);
    }

    return null;
  }

  /**
   * Extract from Open Graph meta tags
   */
  private async extractFromOpenGraph(page: Page): Promise<any | null> {
    try {
      const ogData = await page.evaluate(() => {
        const getMeta = (property: string) => {
          const el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
          return el?.getAttribute('content') || null;
        };

        return {
          title: getMeta('og:title') || getMeta('twitter:title'),
          description: getMeta('og:description') || getMeta('twitter:description'),
          image: getMeta('og:image') || getMeta('twitter:image'),
          price: getMeta('product:price:amount'),
          brand: getMeta('product:brand')
        };
      });

      if (ogData.title) {
        console.log('[GENERIC] 📊 Found Open Graph product info');
        return {
          name: ogData.title,
          description: ogData.description,
          basePrice: this.parsePrice(ogData.price),
          brand: ogData.brand || this.getBrandName(),
          images: ogData.image ? [{ url: ogData.image }] : []
        };
      }
    } catch (error) {
      console.warn('[GENERIC] ⚠️ Error extracting Open Graph:', error);
    }

    return null;
  }

  /**
   * Extract using heuristic approach when standard methods fail
   */
  private async extractWithHeuristics(page: Page): Promise<any | null> {
    try {
      console.log('[GENERIC] 🧠 Using heuristic extraction...');

      const content = await page.content();
      const $ = cheerio.load(content);

      // Find product name using broader heuristics
      const name = this.findProductNameHeuristic($);
      if (!name) return null;

      // Find price using broader heuristics
      const price = this.findPriceHeuristic($);
      if (!price) return null;

      // Find images
      const images = this.findImagesHeuristic($, page.url());

      // Try to find brand from various places
      const brand = this.findBrandHeuristic($, page.url());

      // Find description
      const description = this.findDescriptionHeuristic($);

      return {
        name,
        basePrice: price,
        brand: brand || this.getBrandFromUrl(page.url()),
        description,
        images,
        category: 'Unknown'
      };
    } catch (error) {
      console.error('[GENERIC] ❌ Error in heuristic extraction:', error);
      return null;
    }
  }

  /**
   * Find product name using heuristics
   */
  private findProductNameHeuristic($: cheerio.CheerioAPI): string | null {
    // Try multiple selectors in order of preference
    const selectors = [
      'h1',
      '[class*="product-title"]',
      '[class*="product-name"]',
      '[class*="item-title"]',
      '[class*="title"]:first',
      'title'
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 3 && text.length < 200) {
        console.log(`[GENERIC] 📝 Found name via selector "${selector}": ${text.substring(0, 50)}`);
        return text;
      }
    }

    return null;
  }

  /**
   * Find price using heuristics
   */
  private findPriceHeuristic($: cheerio.CheerioAPI): number | null {
    const priceSelectors = [
      '[class*="price"]:not([class*="old"]):not([class*="original"])',
      '.price',
      '[class*="amount"]',
      '[class*="cost"]',
      '[data-price]'
    ];

    for (const selector of priceSelectors) {
      const priceElements = $(selector);

      for (let i = 0; i < priceElements.length; i++) {
        const priceText = $(priceElements[i]).text().trim();
        const priceValue = this.parsePrice(priceText);

        if (priceValue !== null && priceValue > 0) {
          console.log(`[GENERIC] 💰 Found price via selector "${selector}": ${priceText}`);
          return priceValue;
        }
      }
    }

    // Try to find price patterns in text content
    const allText = $('body').text();
    const pricePatterns = [
      /\$\d+\.?\d*/g,
      /USD?\s*\d+\.?\d*/gi,
      /€\d+\.?\d*/g,
      /£\d+\.?\d*/g,
      /\d+\.?\d*\s*USD/gi
    ];

    for (const pattern of pricePatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        for (const match of matches) {
          const price = this.parsePrice(match);
          if (price !== null && price > 50) { // Minimum reasonable price
            console.log(`[GENERIC] 💰 Found price via pattern: ${match}`);
            return price;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find images using heuristics
   */
  private findImagesHeuristic($: cheerio.CheerioAPI, baseUrl: string): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];
    const seenUrls = new Set<string>();

    const imageSelectors = [
      '.product-image img',
      '[class*="gallery"] img',
      '[class*="media"] img',
      'img[alt*="product" i]',
      'img[src*="product" i]',
      'main img',
      'article img'
    ];

    for (const selector of imageSelectors) {
      $(selector).each((i, el) => {
        const $img = $(el);
        let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

        if (src && !src.startsWith('data:') && src.length > 10) {
          // Convert to absolute URL
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            const base = new URL(baseUrl);
            src = base.origin + src;
          }

          if (!seenUrls.has(src)) {
            seenUrls.add(src);
            images.push({
              url: src,
              alt: $img.attr('alt') || undefined
            });
          }
        }
      });

      if (images.length >= 5) break; // Limit to prevent too many images
    }

    return images;
  }

  /**
   * Find brand using heuristics
   */
  private findBrandHeuristic($: cheerio.CheerioAPI, url: string): string | null {
    // Try brand-specific selectors
    const brandSelectors = [
      '[class*="brand"]',
      '[class*="manufacturer"]',
      '[class*="vendor"]',
      '.logo',
      'header img[alt]'
    ];

    for (const selector of brandSelectors) {
      const brand = $(selector).first().text().trim() || $(selector).first().attr('alt');
      if (brand && brand.length > 1 && brand.length < 50) {
        return brand;
      }
    }

    return this.getBrandFromUrl(url);
  }

  /**
   * Extract brand from URL domain
   */
  private getBrandFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const brandName = domain.split('.')[0];
      return brandName.charAt(0).toUpperCase() + brandName.slice(1);
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Find description using heuristics
   */
  private findDescriptionHeuristic($: cheerio.CheerioAPI): string | null {
    const descSelectors = [
      '[class*="description"]',
      '[class*="detail"]',
      '[class*="content"]',
      '.product-content',
      'article p'
    ];

    for (const selector of descSelectors) {
      const desc = $(selector).first().text().trim();
      if (desc && desc.length > 20 && desc.length < 1000) {
        return desc;
      }
    }

    return null;
  }

  /**
   * Enhance product data with additional heuristics
   */
  private async enhanceWithHeuristics(page: Page, productData: any): Promise<any> {
    try {
      // Try to determine category from URL or breadcrumbs
      if (!productData.category || productData.category === 'Unknown') {
        productData.category = await this.guessCategoryFromUrl(page.url());
      }

      // Add generic tags
      productData.tags = ['generic-extraction', 'fashion'];

      return productData;
    } catch (error) {
      console.warn('[GENERIC] ⚠️ Error enhancing with heuristics:', error);
      return productData;
    }
  }

  /**
   * Guess category from URL path
   */
  private async guessCategoryFromUrl(url: string): Promise<string> {
    const path = url.toLowerCase();

    const categoryMap: Record<string, string> = {
      'shirt': 'Shirts',
      'tshirt': 'T-Shirts',
      't-shirt': 'T-Shirts',
      'dress': 'Dresses',
      'jean': 'Jeans',
      'pant': 'Pants',
      'trouser': 'Pants',
      'shoe': 'Shoes',
      'sneaker': 'Sneakers',
      'boot': 'Boots',
      'jacket': 'Jackets',
      'coat': 'Coats',
      'skirt': 'Skirts',
      'short': 'Shorts',
      'bag': 'Bags',
      'accessory': 'Accessories'
    };

    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (path.includes(keyword)) {
        return category;
      }
    }

    return 'Unknown';
  }
}

export default GenericAdapter;