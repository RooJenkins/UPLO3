/**
 * Database Service for Product Catalog
 *
 * Handles product data storage, synchronization, and retrieval
 * Implements efficient caching and duplicate prevention
 */

import { ScrapedProduct } from '../scraper/core/ScraperEngine';

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  available: boolean;
  stockQuantity: number;
  price?: number;
  images?: string[];
}

export interface DatabaseProduct {
  id: string;
  externalId: string;
  name: string;
  description?: string;
  brand: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  salePrice?: number;
  currency: string;
  images: Array<{
    url: string;
    cdnUrl?: string;
    alt?: string;
    cached: boolean;
  }>;
  variants: ProductVariant[];
  materials?: string[];
  careInstructions?: string[];
  tags: string[];
  gender?: string;
  season?: string;
  url: string;
  lastScraped: Date;
  lastUpdated: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface DatabaseSyncOptions {
  upsertMode: 'merge' | 'replace';
  skipImageCaching: boolean;
  batchSize: number;
  enableDeduplication: boolean;
}

export class DatabaseService {
  private products: Map<string, DatabaseProduct> = new Map();
  private brandIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private priceIndex: Map<string, Set<string>> = new Map();
  private syncStats = {
    totalProducts: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    duplicatesSkipped: 0,
    lastSyncTime: new Date()
  };

  constructor(private imageCacheService?: ImageCacheService) {
    console.log('[DATABASE] 🗄️ Database service initialized');
  }

  /**
   * Sync scraped product to database
   */
  async syncProduct(
    scrapedProduct: ScrapedProduct,
    options: Partial<DatabaseSyncOptions> = {}
  ): Promise<{ success: boolean; productId?: string; error?: string }> {
    try {
      const opts: DatabaseSyncOptions = {
        upsertMode: 'merge',
        skipImageCaching: false,
        batchSize: 10,
        enableDeduplication: true,
        ...options
      };

      // Check for duplicates if enabled
      if (opts.enableDeduplication) {
        const existing = this.findDuplicateProduct(scrapedProduct);
        if (existing) {
          console.log(`[DATABASE] 🔍 Duplicate found for ${scrapedProduct.name}, updating existing`);
          return this.updateExistingProduct(existing, scrapedProduct, opts);
        }
      }

      // Create new database product
      const productId = this.generateProductId(scrapedProduct);
      const dbProduct = await this.transformScrapedToDb(scrapedProduct, productId, opts);

      // Store product
      this.products.set(productId, dbProduct);
      this.updateIndexes(dbProduct);

      this.syncStats.successfulSyncs++;
      this.syncStats.totalProducts = this.products.size;

      console.log(`[DATABASE] ✅ Synced product: ${dbProduct.name} (${dbProduct.brand})`);

      return {
        success: true,
        productId: productId
      };

    } catch (error) {
      this.syncStats.failedSyncs++;
      console.error('[DATABASE] ❌ Error syncing product:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  /**
   * Bulk sync multiple products
   */
  async syncProducts(
    scrapedProducts: ScrapedProduct[],
    options: Partial<DatabaseSyncOptions> = {}
  ): Promise<{
    success: boolean;
    results: Array<{ productId?: string; error?: string }>;
    stats: typeof this.syncStats;
  }> {
    const opts: DatabaseSyncOptions = {
      upsertMode: 'merge',
      skipImageCaching: false,
      batchSize: 10,
      enableDeduplication: true,
      ...options
    };

    console.log(`[DATABASE] 📦 Bulk syncing ${scrapedProducts.length} products...`);

    const results: Array<{ productId?: string; error?: string }> = [];

    // Process in batches
    for (let i = 0; i < scrapedProducts.length; i += opts.batchSize) {
      const batch = scrapedProducts.slice(i, i + opts.batchSize);

      const batchPromises = batch.map(product => this.syncProduct(product, opts));
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // Add small delay between batches to prevent overwhelming
      if (i + opts.batchSize < scrapedProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.syncStats.lastSyncTime = new Date();

    return {
      success: results.every(r => r.success),
      results,
      stats: { ...this.syncStats }
    };
  }

  /**
   * Find product by various criteria
   */
  findProduct(criteria: {
    id?: string;
    externalId?: string;
    brand?: string;
    name?: string;
    url?: string;
  }): DatabaseProduct | null {
    if (criteria.id) {
      return this.products.get(criteria.id) || null;
    }

    // Search by other criteria
    for (const product of this.products.values()) {
      if (criteria.externalId && product.externalId === criteria.externalId) return product;
      if (criteria.url && product.url === criteria.url) return product;
      if (criteria.brand && criteria.name &&
          product.brand.toLowerCase() === criteria.brand.toLowerCase() &&
          product.name.toLowerCase() === criteria.name.toLowerCase()) return product;
    }

    return null;
  }

  /**
   * Search products with filters
   */
  searchProducts(filters: {
    brand?: string;
    category?: string;
    priceRange?: { min: number; max: number };
    gender?: string;
    tags?: string[];
    inStock?: boolean;
    limit?: number;
    offset?: number;
  }): {
    products: DatabaseProduct[];
    total: number;
  } {
    let results = Array.from(this.products.values());

    // Apply filters
    if (filters.brand) {
      const brandProducts = this.brandIndex.get(filters.brand.toLowerCase());
      if (brandProducts) {
        results = results.filter(p => brandProducts.has(p.id));
      } else {
        results = [];
      }
    }

    if (filters.category) {
      const categoryProducts = this.categoryIndex.get(filters.category.toLowerCase());
      if (categoryProducts) {
        results = results.filter(p => categoryProducts.has(p.id));
      } else {
        results = [];
      }
    }

    if (filters.priceRange) {
      results = results.filter(p =>
        p.basePrice >= filters.priceRange!.min &&
        p.basePrice <= filters.priceRange!.max
      );
    }

    if (filters.gender) {
      results = results.filter(p =>
        p.gender?.toLowerCase() === filters.gender!.toLowerCase()
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(p =>
        filters.tags!.some(tag =>
          p.tags.some(pTag => pTag.toLowerCase().includes(tag.toLowerCase()))
        )
      );
    }

    if (filters.inStock !== undefined) {
      results = results.filter(p => {
        const hasStock = p.variants.some(v => v.available && v.stockQuantity > 0);
        return filters.inStock ? hasStock : !hasStock;
      });
    }

    const total = results.length;

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    results = results.slice(offset, offset + limit);

    return { products: results, total };
  }

  /**
   * Get database statistics
   */
  getStats() {
    const brandCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    let totalVariants = 0;
    let inStockProducts = 0;

    for (const product of this.products.values()) {
      // Brand counts
      const count = brandCounts.get(product.brand) || 0;
      brandCounts.set(product.brand, count + 1);

      // Category counts
      const catCount = categoryCounts.get(product.category) || 0;
      categoryCounts.set(product.category, catCount + 1);

      // Variant counts
      totalVariants += product.variants.length;

      // Stock status
      if (product.variants.some(v => v.available && v.stockQuantity > 0)) {
        inStockProducts++;
      }
    }

    return {
      totalProducts: this.products.size,
      totalVariants,
      inStockProducts,
      outOfStockProducts: this.products.size - inStockProducts,
      brands: Object.fromEntries(brandCounts),
      categories: Object.fromEntries(categoryCounts),
      sync: { ...this.syncStats },
      lastUpdated: new Date()
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.products.clear();
    this.brandIndex.clear();
    this.categoryIndex.clear();
    this.priceIndex.clear();
    this.syncStats = {
      totalProducts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      duplicatesSkipped: 0,
      lastSyncTime: new Date()
    };
    console.log('[DATABASE] 🧹 Database cleared');
  }

  // Private methods

  private async transformScrapedToDb(
    scraped: ScrapedProduct,
    productId: string,
    options: DatabaseSyncOptions
  ): Promise<DatabaseProduct> {
    // Cache images if service available and not skipped
    let cachedImages = scraped.images;
    if (this.imageCacheService && !options.skipImageCaching) {
      try {
        cachedImages = await this.imageCacheService.cacheProductImages(scraped.images, productId);
      } catch (error) {
        console.warn('[DATABASE] ⚠️ Image caching failed, using original URLs:', error);
      }
    }

    // Transform variants
    const variants: ProductVariant[] = (scraped.variants || []).map((v, index) => ({
      id: `${productId}_variant_${index}`,
      color: v.color,
      size: v.size,
      sku: v.sku,
      available: v.available,
      stockQuantity: v.stockQuantity
    }));

    return {
      id: productId,
      externalId: scraped.externalId,
      name: scraped.name,
      description: scraped.description,
      brand: scraped.brand,
      category: scraped.category,
      subcategory: scraped.subcategory,
      basePrice: scraped.basePrice,
      salePrice: scraped.salePrice,
      currency: scraped.currency || 'USD',
      images: cachedImages.map(img => ({
        url: img.url,
        alt: img.alt,
        cached: !!img.cdnUrl,
        cdnUrl: img.cdnUrl
      })),
      variants,
      materials: scraped.materials,
      careInstructions: scraped.careInstructions,
      tags: scraped.tags || [],
      gender: scraped.gender,
      season: scraped.season,
      url: scraped.url,
      lastScraped: new Date(),
      lastUpdated: new Date(),
      isActive: true,
      metadata: {}
    };
  }

  private generateProductId(scraped: ScrapedProduct): string {
    return `${scraped.brand.toLowerCase()}_${scraped.externalId}_${Date.now()}`;
  }

  private findDuplicateProduct(scraped: ScrapedProduct): DatabaseProduct | null {
    // Check by external ID and brand first
    for (const product of this.products.values()) {
      if (product.brand.toLowerCase() === scraped.brand.toLowerCase() &&
          product.externalId === scraped.externalId) {
        return product;
      }
    }

    // Check by URL
    for (const product of this.products.values()) {
      if (product.url === scraped.url) {
        return product;
      }
    }

    // Check by name similarity (for potential duplicates)
    const scrapedNameLower = scraped.name.toLowerCase();
    for (const product of this.products.values()) {
      if (product.brand.toLowerCase() === scraped.brand.toLowerCase()) {
        const similarity = this.calculateStringSimilarity(
          scrapedNameLower,
          product.name.toLowerCase()
        );
        if (similarity > 0.85) {
          return product;
        }
      }
    }

    return null;
  }

  private async updateExistingProduct(
    existing: DatabaseProduct,
    scraped: ScrapedProduct,
    options: DatabaseSyncOptions
  ): Promise<{ success: boolean; productId?: string; error?: string }> {
    try {
      if (options.upsertMode === 'replace') {
        // Replace entirely
        const updated = await this.transformScrapedToDb(scraped, existing.id, options);
        this.products.set(existing.id, updated);
      } else {
        // Merge mode - update specific fields
        existing.name = scraped.name;
        existing.description = scraped.description || existing.description;
        existing.basePrice = scraped.basePrice;
        existing.salePrice = scraped.salePrice || existing.salePrice;
        existing.lastScraped = new Date();
        existing.lastUpdated = new Date();

        // Update images if provided
        if (scraped.images && scraped.images.length > 0) {
          if (this.imageCacheService && !options.skipImageCaching) {
            const cachedImages = await this.imageCacheService.cacheProductImages(
              scraped.images,
              existing.id
            );
            existing.images = cachedImages.map(img => ({
              url: img.url,
              alt: img.alt,
              cached: !!img.cdnUrl,
              cdnUrl: img.cdnUrl
            }));
          }
        }

        // Merge variants
        if (scraped.variants && scraped.variants.length > 0) {
          const newVariants: ProductVariant[] = scraped.variants.map((v, index) => ({
            id: `${existing.id}_variant_${Date.now()}_${index}`,
            color: v.color,
            size: v.size,
            sku: v.sku,
            available: v.available,
            stockQuantity: v.stockQuantity
          }));
          existing.variants = newVariants;
        }
      }

      this.syncStats.duplicatesSkipped++;
      return { success: true, productId: existing.id };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  private updateIndexes(product: DatabaseProduct): void {
    // Brand index
    const brandKey = product.brand.toLowerCase();
    if (!this.brandIndex.has(brandKey)) {
      this.brandIndex.set(brandKey, new Set());
    }
    this.brandIndex.get(brandKey)!.add(product.id);

    // Category index
    const categoryKey = product.category.toLowerCase();
    if (!this.categoryIndex.has(categoryKey)) {
      this.categoryIndex.set(categoryKey, new Set());
    }
    this.categoryIndex.get(categoryKey)!.add(product.id);

    // Price index (by range)
    const priceRange = this.getPriceRange(product.basePrice);
    if (!this.priceIndex.has(priceRange)) {
      this.priceIndex.set(priceRange, new Set());
    }
    this.priceIndex.get(priceRange)!.add(product.id);
  }

  private getPriceRange(price: number): string {
    if (price < 2500) return '0-25';
    if (price < 5000) return '25-50';
    if (price < 10000) return '50-100';
    if (price < 20000) return '100-200';
    return '200+';
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,        // deletion
          matrix[j - 1][i] + 1,        // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Image Cache Service interface
export interface ImageCacheService {
  cacheProductImages(
    images: Array<{ url: string; alt?: string }>,
    productId: string
  ): Promise<Array<{ url: string; alt?: string; cdnUrl?: string }>>;
}

export default DatabaseService;