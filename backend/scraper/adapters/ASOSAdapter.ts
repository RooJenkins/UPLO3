import { Page } from 'playwright';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ScrapedProduct } from '../core/ScraperEngine';
import * as cheerio from 'cheerio';

export class ASOSAdapter extends BaseAdapter {
  constructor() {
    const config: AdapterConfig = {
      baseUrl: 'https://www.asos.com',
      selectors: {
        productName: 'h1[data-testid="product-name"], h1.product-hero-heading, h1.product-name',
        price: '[data-testid="current-price"], .current-price, .product-price .price',
        salePrice: '[data-testid="previous-price"], .previous-price, .product-price .was-price',
        description: '[data-testid="product-description"], .product-description-text, .product-info',
        images: '.product-image img, .media-gallery img, [data-testid="product-image"]',
        variants: {
          colors: '.colour-picker button, .color-swatches button',
          sizes: '.size-picker button, .size-list button'
        },
        availability: '.availability-msg, [data-testid="availability"]',
        sku: '[data-testid="product-code"], .product-code',
        breadcrumbs: '.breadcrumb a, .breadcrumbs a'
      },
      apiEndpoints: {
        productData: '/api/product',
        variants: '/api/variants',
        inventory: '/api/stock'
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
    return 'ASOS';
  }

  /**
   * ASOS-specific external ID extraction
   */
  protected generateExternalId(url: string): string {
    // ASOS URLs typically have format: https://www.asos.com/product-name/prd/12345678
    const matches = url.match(/\/prd\/(\d+)/) ||
                   url.match(/\/(\d{7,10})(?:\/|$)/) ||
                   url.match(/product\/([^\/\?]+)/);

    return matches ? matches[1] : `asos_${Date.now()}`;
  }

  /**
   * Override to handle ASOS's specific product data extraction
   */
  async extractProduct(page: Page): Promise<ScrapedProduct | null> {
    try {
      // Wait for ASOS-specific content to load
      await this.waitForContent(page);

      // Try ASOS-specific API extraction first
      let productData = await this.extractFromASOSApi(page);

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
      console.error('[ASOS ADAPTER] Error extracting product:', error);
      return null;
    }
  }

  /**
   * Extract product data from ASOS's internal API/JSON
   */
  protected async extractFromASOSApi(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      console.log('[ASOS ADAPTER] 🔍 Extracting from ASOS API data...');

      // Look for ASOS's product data in window object
      const asosData = await page.evaluate(() => {
        // ASOS stores product data in these global variables
        return (window as any).asos ||
               (window as any).productData ||
               (window as any).__NEXT_DATA__ ||
               (window as any).initialState ||
               null;
      });

      if (asosData) {
        console.log('[ASOS ADAPTER] 📦 Found ASOS API data');
        return this.parseASOSProductData(asosData);
      }

      // Try to find product data in script tags
      const scriptData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent) {
            // Look for ASOS product data patterns
            if (script.textContent.includes('product') &&
                (script.textContent.includes('price') || script.textContent.includes('colour'))) {
              try {
                // Find JSON objects containing product data
                const jsonMatches = script.textContent.match(/\{[^{}]*"product"[^{}]*:[\s\S]*?\}[\s\S]*?\}/g);
                if (jsonMatches) {
                  for (const match of jsonMatches) {
                    try {
                      return JSON.parse(match);
                    } catch (e) {
                      continue;
                    }
                  }
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
        return this.parseASOSProductData(scriptData);
      }

    } catch (error) {
      console.warn('[ASOS ADAPTER] Error extracting from API:', error);
    }

    return null;
  }

  /**
   * Parse ASOS's product data structure
   */
  private parseASOSProductData(data: any): Partial<ScrapedProduct> | null {
    try {
      // Navigate ASOS's data structure
      const product = data.product ||
                     data.props?.pageProps?.product ||
                     data.pageProps?.initialState?.product ||
                     data;

      if (!product) return null;

      const images = this.parseASOSImages(product.images || product.media || product.imageUrls || []);
      const variants = this.parseASOSVariants(product.variants || product.colours || product.skus || []);

      return {
        name: product.name || product.title || product.displayName,
        description: product.description || product.productDescription || product.info,
        basePrice: this.parsePrice(product.price?.current || product.currentPrice || product.price),
        salePrice: this.parsePrice(product.price?.rrp || product.originalPrice || product.rrp),
        currency: product.price?.currency || product.currency || 'USD',
        images,
        variants,
        category: product.categoryName || product.category || product.productType,
        subcategory: product.subCategory || product.productSubType,
        gender: product.gender || product.genderName,
        materials: product.aboutMe || product.careInfo || product.composition,
        careInstructions: product.careInstructions || product.care,
        tags: product.keywords?.split(',') || [],
        url: product.url || undefined
      };
    } catch (error) {
      console.error('[ASOS ADAPTER] Error parsing ASOS data:', error);
      return null;
    }
  }

  /**
   * Parse ASOS image data
   */
  private parseASOSImages(imageData: any[]): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];

    // Handle different ASOS image formats
    if (Array.isArray(imageData)) {
      imageData.forEach(img => {
        let url = img.url || img.src || img.imageUrl || img;

        if (typeof url === 'string' && url) {
          // ASOS images often need protocol
          if (url.startsWith('//')) {
            url = 'https:' + url;
          }

          images.push({
            url,
            alt: img.altText || img.alt
          });
        }
      });
    } else if (typeof imageData === 'object' && imageData !== null) {
      // Handle single image object
      Object.values(imageData).forEach(img => {
        if (typeof img === 'string') {
          images.push({ url: img.startsWith('//') ? 'https:' + img : img });
        }
      });
    }

    return images;
  }

  /**
   * Parse ASOS variant data (colors, sizes)
   */
  private parseASOSVariants(variantData: any[]): Array<{
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

    if (Array.isArray(variantData)) {
      variantData.forEach(variant => {
        const color = variant.colour || variant.color || variant.colourName || 'Default';
        const sizes = variant.sizes || variant.variants || [];

        if (Array.isArray(sizes)) {
          sizes.forEach((size: any) => {
            variants.push({
              color,
              size: size.size || size.name || size.displayName || size.value,
              sku: variant.id || variant.variantId || variant.sku || size.id,
              available: size.isInStock !== false && size.available !== false,
              stockQuantity: size.stockQuantity || (size.isInStock ? 1 : 0)
            });
          });
        } else {
          // Handle simple variant without size breakdown
          variants.push({
            color,
            size: 'One Size',
            sku: variant.id || variant.variantId || variant.sku,
            available: variant.isInStock !== false && variant.available !== false,
            stockQuantity: variant.stockQuantity || (variant.isInStock ? 1 : 0)
          });
        }
      });
    }

    return variants;
  }

  /**
   * Enhanced HTML extraction for ASOS-specific elements
   */
  protected async extractFromHtml(page: Page): Promise<Partial<ScrapedProduct> | null> {
    try {
      const content = await page.content();
      const $ = cheerio.load(content);

      console.log('[ASOS ADAPTER] 🔍 Extracting ASOS product data from HTML');

      const name = this.extractText($, this.config.selectors.productName);
      const price = this.extractPrice($, this.config.selectors.price);
      const salePrice = this.config.selectors.salePrice
        ? this.extractPrice($, this.config.selectors.salePrice)
        : undefined;

      // ASOS-specific description extraction
      const description = this.extractText($, this.config.selectors.description) ||
                         this.extractText($, '.product-description') ||
                         this.extractText($, '.product-details-content');

      const images = this.extractImages($, this.config.selectors.images);
      const variants = await this.extractASOSVariants(page, $);

      // Extract ASOS-specific data
      const gender = this.extractGender($);
      const category = this.extractCategoryFromBreadcrumbs($, this.config.selectors.breadcrumbs!);
      const materials = this.extractMaterials($);
      const careInstructions = this.extractCareInstructions($);

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
          materials,
          careInstructions,
          url: page.url()
        };
      }

      return null;
    } catch (error) {
      console.error('[ASOS ADAPTER] Error extracting from HTML:', error);
      return null;
    }
  }

  /**
   * Extract ASOS variants from HTML
   */
  private async extractASOSVariants(page: Page, $: cheerio.CheerioAPI): Promise<Array<{
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
        const colorName = $(el).attr('aria-label') ||
                         $(el).attr('data-colour') ||
                         $(el).attr('title') ||
                         $(el).text().trim();
        if (colorName) colors.push(colorName);
      });

      // Extract sizes
      const sizes: Array<{name: string, available: boolean}> = [];
      $(this.config.selectors.variants?.sizes || '').each((i, el) => {
        const sizeName = $(el).text().trim() || $(el).attr('data-size');
        const available = !$(el).hasClass('is-disabled') &&
                         !$(el).hasClass('out-of-stock') &&
                         !$(el).hasClass('unavailable') &&
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
          sku: `asos_${Date.now()}_${size.name}`,
          available: size.available,
          stockQuantity: size.available ? 1 : 0
        });
      });

    } catch (error) {
      console.warn('[ASOS ADAPTER] Error extracting variants:', error);
    }

    return variants;
  }

  /**
   * Extract gender from ASOS product page
   */
  private extractGender($: cheerio.CheerioAPI): string | undefined {
    // Look for gender in breadcrumbs or URL
    const breadcrumbs = $('.breadcrumb, .breadcrumbs').text().toLowerCase();
    if (breadcrumbs.includes('women')) return 'Women';
    if (breadcrumbs.includes('men')) return 'Men';

    // Check page content for gender indicators
    const pageText = $('body').text().toLowerCase();
    if (pageText.includes("women's") || pageText.includes('womenswear')) return 'Women';
    if (pageText.includes("men's") || pageText.includes('menswear')) return 'Men';

    return undefined;
  }

  /**
   * Extract materials from ASOS product page
   */
  private extractMaterials($: cheerio.CheerioAPI): string[] | undefined {
    const materials: string[] = [];

    // ASOS material selectors
    $('.product-details .about-me, .composition, [data-testid="product-details"]').each((i, el) => {
      const text = $(el).text();
      // Look for material percentages
      const materialMatches = text.match(/\d+%\s*[A-Za-z]+/g);
      if (materialMatches) {
        materials.push(...materialMatches);
      }
    });

    return materials.length > 0 ? materials : undefined;
  }

  /**
   * Extract care instructions from ASOS product page
   */
  private extractCareInstructions($: cheerio.CheerioAPI): string[] | undefined {
    const instructions: string[] = [];

    $('.care-info, .product-care, [data-testid="care-instructions"]').each((i, el) => {
      const instruction = $(el).text().trim();
      if (instruction) instructions.push(instruction);
    });

    return instructions.length > 0 ? instructions : undefined;
  }

  /**
   * Enhanced wait for ASOS-specific content loading
   */
  protected async waitForContent(page: Page): Promise<void> {
    await super.waitForContent(page);

    try {
      // Wait for ASOS-specific dynamic content
      await page.waitForSelector('[data-testid="product-name"]', { timeout: 10000 });

      // Wait for price to load
      await page.waitForSelector('[data-testid="current-price"]', { timeout: 5000 });

      // Allow time for variant options to load
      await page.waitForTimeout(2000);

    } catch (error) {
      console.warn('[ASOS ADAPTER] Some ASOS elements not found, continuing...');
    }
  }
}

export default ASOSAdapter;