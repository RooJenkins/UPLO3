/**
 * Database Module Index
 *
 * Centralized exports for database services
 */

import DatabaseService from './DatabaseService';
import ImageCacheService from './ImageCacheService';
import DatabaseSyncManager from './DatabaseSyncManager';

export {
  DatabaseService,
  ImageCacheService,
  DatabaseSyncManager
};

export * from './DatabaseService';
export * from './ImageCacheService';
export * from './DatabaseSyncManager';

// Global instances (will be initialized in tRPC procedures)
let globalDatabaseService: DatabaseService | null = null;
let globalImageCacheService: ImageCacheService | null = null;
let globalSyncManager: DatabaseSyncManager | null = null;

/**
 * Get or create global database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!globalDatabaseService) {
    globalDatabaseService = new DatabaseService(getImageCacheService());
  }
  return globalDatabaseService;
}

/**
 * Get or create global image cache service instance
 */
export function getImageCacheService(): ImageCacheService {
  if (!globalImageCacheService) {
    globalImageCacheService = new ImageCacheService({
      cdnProvider: 'rork',
      enableWebP: true,
      enableResize: true
    });
  }
  return globalImageCacheService;
}

/**
 * Get or create global sync manager instance
 */
export function getSyncManager(): DatabaseSyncManager {
  if (!globalSyncManager) {
    globalSyncManager = new DatabaseSyncManager({
      database: {
        upsertMode: 'merge',
        enableDeduplication: true,
        batchSize: 20
      },
      imageCache: {
        enabled: true,
        cdnProvider: 'rork'
      },
      sync: {
        autoSyncInterval: 30000,
        enableHealthCheck: true
      },
      notifications: {
        enableWebhooks: false // Can be enabled via environment variable
      }
    });
  }
  return globalSyncManager;
}

/**
 * Initialize database services
 */
export async function initializeDatabaseServices(): Promise<void> {
  console.log('[DATABASE MODULE] 🚀 Initializing database services...');

  // Initialize services
  getDatabaseService();
  getImageCacheService();
  const syncManager = getSyncManager();

  // Start sync manager
  await syncManager.start();

  console.log('[DATABASE MODULE] ✅ Database services initialized');
}

/**
 * Shutdown database services
 */
export async function shutdownDatabaseServices(): Promise<void> {
  console.log('[DATABASE MODULE] 🛑 Shutting down database services...');

  if (globalSyncManager) {
    await globalSyncManager.stop();
  }

  if (globalImageCacheService) {
    await globalImageCacheService.clearCache();
  }

  console.log('[DATABASE MODULE] ✅ Database services shut down');
}

export default {
  DatabaseService,
  ImageCacheService,
  DatabaseSyncManager,
  getDatabaseService,
  getImageCacheService,
  getSyncManager,
  initializeDatabaseServices,
  shutdownDatabaseServices
};