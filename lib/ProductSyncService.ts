/**
 * 🚨 ULTRATHINK: Real-Time Product Synchronization Service
 *
 * Advanced service for real-time synchronization of product data across
 * multiple fashion retailers with intelligent caching, rate limiting,
 * and webhook-based updates.
 */

import { Product } from './VirtualTryOnService';

export interface ProductUpdate {
  productId: string;
  retailerId: string;
  updateType: 'price' | 'availability' | 'inventory' | 'metadata' | 'full';
  timestamp: number;
  oldData?: Partial<Product>;
  newData: Partial<Product>;
  confidence: number; // How confident we are in this update (0-1)
}

export interface RetailerWebhook {
  retailerId: string;
  endpoint: string;
  secret: string;
  lastPing: number;
  isActive: boolean;
  failureCount: number;
}

export interface SyncMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  averageLatency: number;
  lastSyncTime: number;
  retailerMetrics: Map<string, {
    updates: number;
    failures: number;
    avgLatency: number;
    rateLimit: number;
    lastUpdate: number;
  }>;
}

export class ProductSyncService {
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly CRITICAL_SYNC_INTERVAL = 30 * 1000; // 30 seconds for critical updates
  private readonly MAX_CACHE_SIZE = 10000;
  private readonly WEBHOOK_TIMEOUT = 5000; // 5 seconds

  // Real-time sync infrastructure
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private criticalSyncTimer: ReturnType<typeof setInterval> | null = null;
  private productUpdates: Map<string, ProductUpdate[]> = new Map();
  private lastSyncTimestamps: Map<string, number> = new Map();
  private syncMetrics: SyncMetrics;

  // Advanced caching system
  private productCache: Map<string, Product & { lastSync: number; syncCount: number }> = new Map();
  private pendingUpdates: Map<string, ProductUpdate> = new Map();
  private priorityQueue: ProductUpdate[] = [];

  // Webhook system for instant updates
  private webhooks: Map<string, RetailerWebhook> = new Map();
  private webhookHistory: Map<string, ProductUpdate[]> = new Map();

  // Rate limiting and API management
  private apiLimits: Map<string, {
    requestsPerMinute: number;
    currentRequests: number;
    resetTime: number;
    burst: number;
  }> = new Map();

  // Retailer configurations with enhanced settings
  private readonly RETAILER_CONFIG = {
    asos: {
      apiKey: process.env.ASOS_API_KEY,
      syncEndpoint: 'https://api.asos.com/v4/products/sync',
      webhookEndpoint: 'https://api.asos.com/v4/webhooks',
      rateLimit: 1000, // requests per minute
      priority: 'high',
      syncFields: ['price', 'availability', 'inventory', 'discount'],
      realTimeEnabled: true
    },
    zara: {
      apiKey: process.env.ZARA_API_KEY,
      syncEndpoint: 'https://api.zara.com/v1/catalog/sync',
      webhookEndpoint: 'https://api.zara.com/v1/webhooks',
      rateLimit: 500,
      priority: 'high',
      syncFields: ['price', 'availability'],
      realTimeEnabled: true
    },
    hm: {
      apiKey: process.env.HM_API_KEY,
      syncEndpoint: 'https://api.hm.com/v2/products/sync',
      webhookEndpoint: 'https://api.hm.com/v2/webhooks',
      rateLimit: 800,
      priority: 'medium',
      syncFields: ['price', 'availability', 'inventory'],
      realTimeEnabled: true
    },
    nike: {
      apiKey: process.env.NIKE_API_KEY,
      syncEndpoint: 'https://api.nike.com/product_feed/v2/sync',
      webhookEndpoint: 'https://api.nike.com/webhooks/v1',
      rateLimit: 300,
      priority: 'high',
      syncFields: ['price', 'availability', 'metadata'],
      realTimeEnabled: true
    },
    uniqlo: {
      apiKey: process.env.UNIQLO_API_KEY,
      syncEndpoint: 'https://api.uniqlo.com/v1/products/sync',
      rateLimit: 400,
      priority: 'medium',
      syncFields: ['price', 'availability'],
      realTimeEnabled: false
    }
  };

  constructor() {
    console.log('[PRODUCT-SYNC] 🔄 Initializing real-time product synchronization service...');

    this.syncMetrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageLatency: 0,
      lastSyncTime: 0,
      retailerMetrics: new Map()
    };

    this.initializeRetailerMetrics();
    this.setupWebhooks();
    this.startSyncTimers();

    console.log('[PRODUCT-SYNC] ✅ Real-time sync service initialized with', Object.keys(this.RETAILER_CONFIG).length, 'retailers');
  }

  /**
   * 🚀 Initialize the service (async initialization)
   */
  async initialize(): Promise<void> {
    console.log('[PRODUCT-SYNC] 🚀 Running async initialization...');
    // Initial sync to populate product cache
    await this.performFullSync();
    console.log('[PRODUCT-SYNC] ✅ Async initialization complete');
  }

  /**
   * 📦 Get all cached products
   */
  async getAllProducts(): Promise<Product[]> {
    const allProducts: Product[] = [];
    this.productCache.forEach(categoryProducts => {
      allProducts.push(...categoryProducts);
    });
    return allProducts;
  }

  /**
   * 🔍 Get specific product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    const allProducts = await this.getAllProducts();
    return allProducts.find(p => p.id === productId) || null;
  }

  /**
   * 📂 Get products by category
   */
  async getProductsByCategory(category: string): Promise<Product[]> {
    const categoryKey = category.toLowerCase();
    return this.productCache.get(categoryKey) || [];
  }

  /**
   * 🔄 Start real-time synchronization with all configured retailers
   */
  async startRealTimeSync(): Promise<void> {
    console.log('[PRODUCT-SYNC] 🚀 Starting real-time product synchronization...');

    // Initial full sync
    await this.performFullSync();

    // Start periodic syncs
    this.startSyncTimers();

    // Register webhooks for instant updates
    await this.registerWebhooks();

    console.log('[PRODUCT-SYNC] ✅ Real-time sync active');
  }

  /**
   * 📊 Get real-time sync metrics and health status
   */
  getSyncMetrics(): SyncMetrics & { health: 'excellent' | 'good' | 'poor' | 'critical' } {
    const successRate = this.syncMetrics.totalUpdates > 0
      ? this.syncMetrics.successfulUpdates / this.syncMetrics.totalUpdates
      : 1;

    const avgLatency = this.syncMetrics.averageLatency;
    const timeSinceLastSync = Date.now() - this.syncMetrics.lastSyncTime;

    let health: 'excellent' | 'good' | 'poor' | 'critical' = 'excellent';

    if (successRate < 0.9 || avgLatency > 5000 || timeSinceLastSync > 300000) {
      health = 'critical';
    } else if (successRate < 0.95 || avgLatency > 3000 || timeSinceLastSync > 120000) {
      health = 'poor';
    } else if (successRate < 0.98 || avgLatency > 1500) {
      health = 'good';
    }

    return {
      ...this.syncMetrics,
      health
    };
  }

  /**
   * 🎯 Force sync specific product across all retailers
   */
  async forceSyncProduct(productId: string, retailerId?: string): Promise<ProductUpdate[]> {
    console.log(`[PRODUCT-SYNC] 🎯 Force syncing product ${productId}${retailerId ? ` from ${retailerId}` : ' across all retailers'}`);

    const updates: ProductUpdate[] = [];
    const retailers = retailerId ? [retailerId] : Object.keys(this.RETAILER_CONFIG);

    for (const retId of retailers) {
      try {
        const update = await this.syncSingleProduct(productId, retId);
        if (update) {
          updates.push(update);
          await this.processProductUpdate(update);
        }
      } catch (error) {
        console.error(`[PRODUCT-SYNC] ❌ Failed to sync ${productId} from ${retId}:`, error);
      }
    }

    return updates;
  }

  /**
   * 📡 Handle incoming webhook from retailer
   */
  async handleWebhook(retailerId: string, payload: any, signature: string): Promise<boolean> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(retailerId, payload, signature)) {
        console.warn(`[PRODUCT-SYNC] 🔒 Invalid webhook signature from ${retailerId}`);
        return false;
      }

      // Process webhook payload
      const updates = await this.parseWebhookPayload(retailerId, payload);

      // Apply updates immediately
      for (const update of updates) {
        await this.processProductUpdate(update);
        this.recordWebhookUpdate(retailerId, update);
      }

      console.log(`[PRODUCT-SYNC] 📡 Processed ${updates.length} webhook updates from ${retailerId}`);
      return true;

    } catch (error) {
      console.error(`[PRODUCT-SYNC] ❌ Webhook processing failed for ${retailerId}:`, error);
      return false;
    }
  }

  /**
   * 🧠 Get smart product recommendations based on sync data
   */
  getRecommendedProducts(category?: string, maxPrice?: number, inStockOnly = true): Product[] {
    const recommendations: (Product & { score: number })[] = [];

    for (const [productId, cachedProduct] of this.productCache.entries()) {
      // Apply filters
      if (category && !cachedProduct.category.toLowerCase().includes(category.toLowerCase())) continue;
      if (maxPrice && cachedProduct.price > maxPrice) continue;
      if (inStockOnly && !cachedProduct.inStock) continue;

      // Calculate recommendation score
      let score = 0;

      // Recency bonus (more recently synced = better)
      const recencyScore = Math.max(0, 1 - (Date.now() - cachedProduct.lastSync) / (24 * 60 * 60 * 1000));
      score += recencyScore * 0.3;

      // Rating score
      score += (cachedProduct.rating / 5) * 0.2;

      // Stock availability bonus
      if (cachedProduct.inStock) score += 0.2;

      // Sale bonus
      if (cachedProduct.isOnSale) score += 0.1;

      // Sync frequency bonus (frequently updated = more reliable)
      const syncFrequencyScore = Math.min(1, cachedProduct.syncCount / 10);
      score += syncFrequencyScore * 0.2;

      recommendations.push({ ...cachedProduct, score });
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ score, lastSync, syncCount, ...product }) => product);
  }

  // ==================== PRIVATE METHODS ====================

  private initializeRetailerMetrics(): void {
    for (const retailerId of Object.keys(this.RETAILER_CONFIG)) {
      this.syncMetrics.retailerMetrics.set(retailerId, {
        updates: 0,
        failures: 0,
        avgLatency: 0,
        rateLimit: 0,
        lastUpdate: 0
      });

      this.apiLimits.set(retailerId, {
        requestsPerMinute: this.RETAILER_CONFIG[retailerId as keyof typeof this.RETAILER_CONFIG].rateLimit,
        currentRequests: 0,
        resetTime: Date.now() + 60000,
        burst: 0
      });
    }
  }

  private startSyncTimers(): void {
    // Regular sync timer
    this.syncTimer = setInterval(async () => {
      await this.performIncrementalSync();
    }, this.SYNC_INTERVAL);

    // Critical updates timer (price changes, out-of-stock alerts)
    this.criticalSyncTimer = setInterval(async () => {
      await this.processCriticalUpdates();
    }, this.CRITICAL_SYNC_INTERVAL);
  }

  private async performFullSync(): Promise<void> {
    console.log('[PRODUCT-SYNC] 🔄 Performing full product sync...');
    const startTime = Date.now();

    const syncPromises = Object.keys(this.RETAILER_CONFIG).map(retailerId =>
      this.syncRetailerProducts(retailerId, 'full')
    );

    const results = await Promise.allSettled(syncPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    console.log(`[PRODUCT-SYNC] ✅ Full sync completed: ${successful}/${results.length} retailers synced in ${Date.now() - startTime}ms`);
  }

  private async performIncrementalSync(): Promise<void> {
    console.log('[PRODUCT-SYNC] 🔄 Performing incremental sync...');

    for (const retailerId of Object.keys(this.RETAILER_CONFIG)) {
      try {
        await this.syncRetailerProducts(retailerId, 'incremental');
        await this.delay(1000); // Stagger requests to avoid rate limits
      } catch (error) {
        console.error(`[PRODUCT-SYNC] ❌ Incremental sync failed for ${retailerId}:`, error);
      }
    }
  }

  private async syncRetailerProducts(retailerId: string, syncType: 'full' | 'incremental'): Promise<void> {
    const config = this.RETAILER_CONFIG[retailerId as keyof typeof this.RETAILER_CONFIG];
    if (!config) return;

    // Skip sync if API key is not configured
    if (!config.apiKey) {
      console.log(`[PRODUCT-SYNC] ⚠️ Skipping ${retailerId} - API key not configured`);
      return;
    }

    // Check rate limits
    if (!this.checkRateLimit(retailerId)) {
      console.warn(`[PRODUCT-SYNC] ⏳ Rate limit reached for ${retailerId}, skipping sync`);
      return;
    }

    const lastSync = this.lastSyncTimestamps.get(retailerId) || 0;
    const endpoint = `${config.syncEndpoint}?since=${lastSync}&type=${syncType}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-Sync-Type': syncType
        },
        timeout: 5000 // 5 second timeout
      } as any);

      if (!response.ok) {
        console.warn(`[PRODUCT-SYNC] ⚠️ ${retailerId} API returned ${response.status}, skipping`);
        return;
      }

      const data = await response.json();
      await this.processRetailerSyncData(retailerId, data);

      this.lastSyncTimestamps.set(retailerId, Date.now());
      this.updateRetailerMetrics(retailerId, true, Date.now() - Date.now());

    } catch (error) {
      this.updateRetailerMetrics(retailerId, false, 0);
      // Don't throw - just log and continue
      console.log(`[PRODUCT-SYNC] ℹ️ ${retailerId} sync skipped (API unavailable)`);
    }
  }

  private async syncSingleProduct(productId: string, retailerId: string): Promise<ProductUpdate | null> {
    const config = this.RETAILER_CONFIG[retailerId as keyof typeof this.RETAILER_CONFIG];
    if (!config) return null;

    try {
      const response = await fetch(`${config.syncEndpoint}/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return null;

      const productData = await response.json();
      return this.createProductUpdate(retailerId, productData);

    } catch (error) {
      console.error(`[PRODUCT-SYNC] ❌ Single product sync failed:`, error);
      return null;
    }
  }

  private async processRetailerSyncData(retailerId: string, data: any): Promise<void> {
    if (!data.products || !Array.isArray(data.products)) return;

    for (const productData of data.products) {
      const update = this.createProductUpdate(retailerId, productData);
      if (update) {
        await this.processProductUpdate(update);
      }
    }
  }

  private createProductUpdate(retailerId: string, productData: any): ProductUpdate | null {
    try {
      const productId = `${retailerId}_${productData.id}`;
      const existingProduct = this.productCache.get(productId);

      const newData: Partial<Product> = {
        id: productId,
        name: productData.name,
        price: productData.price || productData.current_price,
        originalPrice: productData.original_price,
        isOnSale: Boolean(productData.sale_price || productData.discount),
        inStock: Boolean(productData.in_stock),
        // ... other fields
      };

      // Determine update type
      let updateType: ProductUpdate['updateType'] = 'metadata';
      if (!existingProduct) {
        updateType = 'full';
      } else if (existingProduct.price !== newData.price) {
        updateType = 'price';
      } else if (existingProduct.inStock !== newData.inStock) {
        updateType = 'availability';
      }

      return {
        productId,
        retailerId,
        updateType,
        timestamp: Date.now(),
        oldData: existingProduct,
        newData,
        confidence: 0.95
      };

    } catch (error) {
      console.error(`[PRODUCT-SYNC] ❌ Failed to create product update:`, error);
      return null;
    }
  }

  private async processProductUpdate(update: ProductUpdate): Promise<void> {
    try {
      // Update cache
      const existing = this.productCache.get(update.productId);
      const updated = {
        ...(existing || {}),
        ...update.newData,
        lastSync: update.timestamp,
        syncCount: (existing?.syncCount || 0) + 1
      } as Product & { lastSync: number; syncCount: number };

      this.productCache.set(update.productId, updated);

      // Record update
      if (!this.productUpdates.has(update.productId)) {
        this.productUpdates.set(update.productId, []);
      }
      this.productUpdates.get(update.productId)!.push(update);

      // Keep only last 50 updates per product
      const updates = this.productUpdates.get(update.productId)!;
      if (updates.length > 50) {
        this.productUpdates.set(update.productId, updates.slice(-50));
      }

      // Update metrics
      this.syncMetrics.totalUpdates++;
      this.syncMetrics.successfulUpdates++;
      this.syncMetrics.lastSyncTime = update.timestamp;

      // Trigger critical update processing if needed
      if (update.updateType === 'price' || update.updateType === 'availability') {
        this.priorityQueue.push(update);
      }

    } catch (error) {
      this.syncMetrics.failedUpdates++;
      console.error(`[PRODUCT-SYNC] ❌ Failed to process update:`, error);
    }
  }

  private async processCriticalUpdates(): Promise<void> {
    if (this.priorityQueue.length === 0) return;

    const criticalUpdates = this.priorityQueue.splice(0, 10); // Process up to 10 at a time

    for (const update of criticalUpdates) {
      // Notify connected clients about critical updates
      await this.broadcastCriticalUpdate(update);
    }
  }

  private async broadcastCriticalUpdate(update: ProductUpdate): Promise<void> {
    // Implementation would broadcast to connected WebSocket clients
    // For now, just log the critical update
    console.log(`[PRODUCT-SYNC] 🚨 Critical update: ${update.updateType} for ${update.productId}`);
  }

  private checkRateLimit(retailerId: string): boolean {
    const limits = this.apiLimits.get(retailerId);
    if (!limits) return true;

    const now = Date.now();

    // Reset counter if minute has passed
    if (now > limits.resetTime) {
      limits.currentRequests = 0;
      limits.resetTime = now + 60000;
    }

    // Check if we can make another request
    if (limits.currentRequests >= limits.requestsPerMinute) {
      return false;
    }

    limits.currentRequests++;
    return true;
  }

  private updateRetailerMetrics(retailerId: string, success: boolean, latency: number): void {
    const metrics = this.syncMetrics.retailerMetrics.get(retailerId);
    if (!metrics) return;

    if (success) {
      metrics.updates++;
      metrics.avgLatency = (metrics.avgLatency + latency) / 2;
    } else {
      metrics.failures++;
    }

    metrics.lastUpdate = Date.now();
  }

  private async setupWebhooks(): Promise<void> {
    for (const [retailerId, config] of Object.entries(this.RETAILER_CONFIG)) {
      if (config.realTimeEnabled && config.webhookEndpoint) {
        this.webhooks.set(retailerId, {
          retailerId,
          endpoint: config.webhookEndpoint,
          secret: process.env[`${retailerId.toUpperCase()}_WEBHOOK_SECRET`] || 'default-secret',
          lastPing: 0,
          isActive: false,
          failureCount: 0
        });
      }
    }
  }

  private async registerWebhooks(): Promise<void> {
    for (const [retailerId, webhook] of this.webhooks.entries()) {
      // registerSingleWebhook now handles its own errors gracefully
      await this.registerSingleWebhook(retailerId, webhook);
    }
  }

  private async registerSingleWebhook(retailerId: string, webhook: RetailerWebhook): Promise<void> {
    const config = this.RETAILER_CONFIG[retailerId as keyof typeof this.RETAILER_CONFIG];
    if (!config || !config.apiKey) return;

    const payload = {
      url: `${process.env.WEBHOOK_BASE_URL}/api/webhooks/${retailerId}`,
      events: ['product.updated', 'product.price_changed', 'product.stock_changed'],
      secret: webhook.secret
    };

    try {
      const response = await fetch(webhook.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        webhook.isActive = true;
        webhook.lastPing = Date.now();
        console.log(`[PRODUCT-SYNC] ✅ Webhook registered for ${retailerId}`);
      }
    } catch (error) {
      // Silently skip webhook registration if API is unavailable
      console.log(`[PRODUCT-SYNC] ℹ️ ${retailerId} webhook skipped (API unavailable)`);
    }
  }

  private verifyWebhookSignature(retailerId: string, payload: any, signature: string): boolean {
    // Implementation would verify HMAC signature
    // For now, just basic validation
    return signature && signature.length > 0;
  }

  private async parseWebhookPayload(retailerId: string, payload: any): Promise<ProductUpdate[]> {
    const updates: ProductUpdate[] = [];

    // Parse different webhook formats based on retailer
    if (payload.events && Array.isArray(payload.events)) {
      for (const event of payload.events) {
        const update = this.createProductUpdate(retailerId, event.product || event.data);
        if (update) {
          updates.push(update);
        }
      }
    }

    return updates;
  }

  private recordWebhookUpdate(retailerId: string, update: ProductUpdate): void {
    if (!this.webhookHistory.has(retailerId)) {
      this.webhookHistory.set(retailerId, []);
    }

    const history = this.webhookHistory.get(retailerId)!;
    history.push(update);

    // Keep only last 100 webhook updates per retailer
    if (history.length > 100) {
      this.webhookHistory.set(retailerId, history.slice(-100));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🧹 Clean up and stop all sync timers
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.criticalSyncTimer) {
      clearInterval(this.criticalSyncTimer);
      this.criticalSyncTimer = null;
    }

    console.log('[PRODUCT-SYNC] 🛑 Product sync service stopped');
  }
}