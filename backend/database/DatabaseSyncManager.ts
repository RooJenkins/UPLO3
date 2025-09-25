/**
 * Database Sync Manager
 *
 * Coordinates scraper results with database synchronization
 * Handles product updates, image caching, and data consistency
 */

import DatabaseService, { DatabaseSyncOptions } from './DatabaseService';
import ImageCacheService from './ImageCacheService';
import { ScrapedProduct } from '../scraper/core/ScraperEngine';
import ScraperQueue from '../scraper/queue/ScraperQueue';
import QueueWorker from '../scraper/queue/QueueWorker';

export interface SyncManagerConfig {
  database: {
    upsertMode: 'merge' | 'replace';
    enableDeduplication: boolean;
    batchSize: number;
  };
  imageCache: {
    enabled: boolean;
    cdnProvider: 'cloudinary' | 'imagekit' | 'local' | 'rork';
    maxImageSize: number;
    enableResize: boolean;
  };
  sync: {
    autoSyncInterval: number; // milliseconds
    maxRetries: number;
    enableHealthCheck: boolean;
    healthCheckInterval: number;
  };
  notifications: {
    enableWebhooks: boolean;
    webhookUrl?: string;
    enableEmail: boolean;
    emailRecipients?: string[];
  };
}

export interface SyncResult {
  success: boolean;
  productsSynced: number;
  imagesCached: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export class DatabaseSyncManager {
  private databaseService: DatabaseService;
  private imageCacheService?: ImageCacheService;
  private config: SyncManagerConfig;
  private syncQueue: Array<ScrapedProduct> = [];
  private isProcessing = false;
  private autoSyncTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private syncHistory: SyncResult[] = [];
  private maxHistorySize = 100;

  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = {
      database: {
        upsertMode: 'merge',
        enableDeduplication: true,
        batchSize: 20
      },
      imageCache: {
        enabled: true,
        cdnProvider: 'rork',
        maxImageSize: 10 * 1024 * 1024,
        enableResize: true
      },
      sync: {
        autoSyncInterval: 30000, // 30 seconds
        maxRetries: 3,
        enableHealthCheck: true,
        healthCheckInterval: 300000 // 5 minutes
      },
      notifications: {
        enableWebhooks: false,
        enableEmail: false
      },
      ...config
    };

    // Initialize services
    if (this.config.imageCache.enabled) {
      this.imageCacheService = new ImageCacheService({
        cdnProvider: this.config.imageCache.cdnProvider,
        maxImageSize: this.config.imageCache.maxImageSize,
        enableResize: this.config.imageCache.enableResize
      });
    }

    this.databaseService = new DatabaseService(this.imageCacheService);

    console.log('[SYNC MANAGER] 🔄 Database sync manager initialized');
  }

  /**
   * Start the sync manager
   */
  async start(): Promise<void> {
    console.log('[SYNC MANAGER] ▶️ Starting sync manager...');

    // Start auto-sync timer
    if (this.config.sync.autoSyncInterval > 0) {
      this.autoSyncTimer = setInterval(() => {
        this.processSyncQueue().catch(error => {
          console.error('[SYNC MANAGER] ❌ Auto-sync error:', error);
        });
      }, this.config.sync.autoSyncInterval);
    }

    // Start health check timer
    if (this.config.sync.enableHealthCheck && this.config.sync.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck().catch(error => {
          console.error('[SYNC MANAGER] ❌ Health check error:', error);
        });
      }, this.config.sync.healthCheckInterval);
    }

    console.log('[SYNC MANAGER] ✅ Sync manager started');
  }

  /**
   * Stop the sync manager
   */
  async stop(): Promise<void> {
    console.log('[SYNC MANAGER] ⏹️ Stopping sync manager...');

    // Clear timers
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Process remaining queue
    if (this.syncQueue.length > 0) {
      console.log('[SYNC MANAGER] 📦 Processing remaining sync queue...');
      await this.processSyncQueue();
    }

    console.log('[SYNC MANAGER] ✅ Sync manager stopped');
  }

  /**
   * Add product to sync queue
   */
  async queueProductSync(product: ScrapedProduct): Promise<void> {
    this.syncQueue.push(product);
    console.log(`[SYNC MANAGER] 📝 Queued product: ${product.name} (queue size: ${this.syncQueue.length})`);

    // If queue is getting large, process immediately
    if (this.syncQueue.length >= this.config.database.batchSize && !this.isProcessing) {
      setImmediate(() => this.processSyncQueue());
    }
  }

  /**
   * Sync product immediately
   */
  async syncProductImmediate(product: ScrapedProduct): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      productsSynced: 0,
      imagesCached: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      console.log(`[SYNC MANAGER] ⚡ Immediate sync: ${product.name}`);

      const syncOptions: Partial<DatabaseSyncOptions> = {
        upsertMode: this.config.database.upsertMode,
        enableDeduplication: this.config.database.enableDeduplication,
        skipImageCaching: !this.config.imageCache.enabled,
        batchSize: 1
      };

      const dbResult = await this.databaseService.syncProduct(product, syncOptions);

      if (dbResult.success) {
        result.productsSynced = 1;
        result.success = true;

        // Count cached images
        if (product.images && this.imageCacheService) {
          result.imagesCached = product.images.length;
        }

        await this.sendNotification({
          type: 'product_synced',
          product: product.name,
          brand: product.brand,
          success: true
        });

      } else {
        result.errors.push(dbResult.error || 'Unknown sync error');

        await this.sendNotification({
          type: 'product_sync_failed',
          product: product.name,
          brand: product.brand,
          error: dbResult.error
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      console.error('[SYNC MANAGER] ❌ Immediate sync failed:', error);

      await this.sendNotification({
        type: 'sync_error',
        error: errorMessage,
        product: product.name
      });

    } finally {
      result.duration = Date.now() - startTime;
      this.addToSyncHistory(result);
    }

    return result;
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<SyncResult> {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return {
        success: true,
        productsSynced: 0,
        imagesCached: 0,
        errors: [],
        duration: 0,
        timestamp: new Date()
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      productsSynced: 0,
      imagesCached: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      const batchSize = Math.min(this.syncQueue.length, this.config.database.batchSize);
      const batch = this.syncQueue.splice(0, batchSize);

      console.log(`[SYNC MANAGER] 📦 Processing batch of ${batch.length} products`);

      const syncOptions: Partial<DatabaseSyncOptions> = {
        upsertMode: this.config.database.upsertMode,
        enableDeduplication: this.config.database.enableDeduplication,
        skipImageCaching: !this.config.imageCache.enabled,
        batchSize: this.config.database.batchSize
      };

      const bulkResult = await this.databaseService.syncProducts(batch, syncOptions);

      result.success = bulkResult.success;
      result.productsSynced = bulkResult.results.filter(r => r.productId).length;
      result.errors = bulkResult.results
        .filter(r => r.error)
        .map(r => r.error!)
        .slice(0, 10); // Limit error messages

      // Count cached images
      if (this.imageCacheService) {
        result.imagesCached = batch.reduce((total, product) =>
          total + (product.images?.length || 0), 0
        );
      }

      // Send notification for batch completion
      await this.sendNotification({
        type: 'batch_synced',
        batchSize: batch.length,
        successfulSyncs: result.productsSynced,
        failedSyncs: result.errors.length,
        remainingQueue: this.syncQueue.length
      });

      console.log(`[SYNC MANAGER] ✅ Batch processed: ${result.productsSynced}/${batch.length} successful`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown batch sync error';
      result.errors.push(errorMessage);
      console.error('[SYNC MANAGER] ❌ Batch sync failed:', error);

      await this.sendNotification({
        type: 'batch_sync_failed',
        error: errorMessage,
        queueSize: this.syncQueue.length
      });

    } finally {
      result.duration = Date.now() - startTime;
      this.addToSyncHistory(result);
      this.isProcessing = false;
    }

    return result;
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    console.log('[SYNC MANAGER] 🏥 Performing health check...');

    const issues: string[] = [];

    // Check database health
    try {
      const dbStats = this.databaseService.getStats();
      const syncFailureRate = dbStats.sync.failedSyncs /
        (dbStats.sync.successfulSyncs + dbStats.sync.failedSyncs);

      if (syncFailureRate > 0.1) {
        issues.push(`High database sync failure rate: ${(syncFailureRate * 100).toFixed(1)}%`);
      }

      // Check queue size
      if (this.syncQueue.length > 1000) {
        issues.push(`Large sync queue: ${this.syncQueue.length} items`);
      }

      // Check image cache health
      if (this.imageCacheService) {
        const cacheHealth = await this.imageCacheService.healthCheck();
        if (!cacheHealth.healthy) {
          issues.push(`Image cache issues: ${cacheHealth.issues.join(', ')}`);
        }
      }

      // Check recent sync history
      const recentSyncs = this.syncHistory.slice(-10);
      const recentFailures = recentSyncs.filter(s => !s.success).length;
      if (recentFailures > 5) {
        issues.push(`Multiple recent sync failures: ${recentFailures}/10`);
      }

    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Send health notification if issues found
    if (issues.length > 0) {
      console.warn('[SYNC MANAGER] ⚠️ Health check found issues:', issues);

      await this.sendNotification({
        type: 'health_check_warning',
        issues,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('[SYNC MANAGER] ✅ Health check passed');
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(data: Record<string, any>): Promise<void> {
    try {
      // Webhook notification
      if (this.config.notifications.enableWebhooks && this.config.notifications.webhookUrl) {
        await this.sendWebhook(data);
      }

      // Email notification (placeholder)
      if (this.config.notifications.enableEmail && this.config.notifications.emailRecipients) {
        await this.sendEmail(data);
      }

    } catch (error) {
      console.warn('[SYNC MANAGER] ⚠️ Failed to send notification:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(data: Record<string, any>): Promise<void> {
    if (!this.config.notifications.webhookUrl) return;

    try {
      const response = await fetch(this.config.notifications.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UPLO3-SyncManager/1.0'
        },
        body: JSON.stringify({
          source: 'database-sync-manager',
          timestamp: new Date().toISOString(),
          ...data
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      console.log('[SYNC MANAGER] 📤 Webhook notification sent');

    } catch (error) {
      console.warn('[SYNC MANAGER] ⚠️ Webhook failed:', error);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmail(data: Record<string, any>): Promise<void> {
    // Placeholder for email integration
    console.log('[SYNC MANAGER] 📧 Email notification (simulated):', data);
  }

  /**
   * Add result to sync history
   */
  private addToSyncHistory(result: SyncResult): void {
    this.syncHistory.push(result);

    // Maintain history size limit
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory = this.syncHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get sync manager statistics
   */
  getStats() {
    const recentSyncs = this.syncHistory.slice(-20);
    const successfulSyncs = recentSyncs.filter(s => s.success).length;
    const totalProductsSynced = recentSyncs.reduce((sum, s) => sum + s.productsSynced, 0);
    const totalImagesCached = recentSyncs.reduce((sum, s) => sum + s.imagesCached, 0);
    const avgDuration = recentSyncs.length > 0
      ? recentSyncs.reduce((sum, s) => sum + s.duration, 0) / recentSyncs.length
      : 0;

    return {
      queueSize: this.syncQueue.length,
      isProcessing: this.isProcessing,
      recentSyncs: {
        total: recentSyncs.length,
        successful: successfulSyncs,
        failed: recentSyncs.length - successfulSyncs,
        successRate: recentSyncs.length > 0 ? (successfulSyncs / recentSyncs.length) : 1
      },
      performance: {
        totalProductsSynced,
        totalImagesCached,
        avgDurationMs: Math.round(avgDuration)
      },
      database: this.databaseService.getStats(),
      imageCache: this.imageCacheService?.getStats(),
      config: this.config,
      lastUpdate: new Date()
    };
  }

  /**
   * Get recent sync history
   */
  getSyncHistory(limit: number = 50): SyncResult[] {
    return this.syncHistory.slice(-limit);
  }

  /**
   * Clear sync queue and history
   */
  clear(): void {
    this.syncQueue = [];
    this.syncHistory = [];
    this.databaseService.clear();
    console.log('[SYNC MANAGER] 🧹 Sync manager cleared');
  }
}

export default DatabaseSyncManager;