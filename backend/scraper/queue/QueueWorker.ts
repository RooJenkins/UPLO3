import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import ScraperEngine, { ScrapingJob, ScrapedProduct } from '../core/ScraperEngine';

export interface WorkerConfig {
  redisUrl?: string;
  concurrency?: number;
  maxStalledCount?: number;
  stalledInterval?: number;
  maxMemoryUsage?: number;
}

/**
 * BullMQ worker that processes scraping jobs
 * Manages multiple scraper engines for parallel processing
 */
export class QueueWorker {
  private worker: Worker;
  private scraperEngine: ScraperEngine;
  private redis: Redis;
  private isRunning: boolean = false;
  private processedJobs: number = 0;
  private failedJobs: number = 0;
  private startTime: number = Date.now();

  constructor(config: WorkerConfig = {}) {
    this.redis = new Redis(config.redisUrl || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });

    this.scraperEngine = new ScraperEngine();

    // Initialize the worker
    this.worker = new Worker(
      'scraper-jobs',
      this.processJob.bind(this),
      {
        connection: this.redis,
        concurrency: config.concurrency || 3,
        maxStalledCount: config.maxStalledCount || 1,
        stalledInterval: config.stalledInterval || 30000, // 30 seconds
        settings: {
          stalledInterval: config.stalledInterval || 30000,
          maxStalledCount: config.maxStalledCount || 1
        }
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job, result: ScrapedProduct) => {
      this.processedJobs++;
      console.log(`[WORKER] ✅ Job ${job.id} completed successfully`);
      if (result?.name) {
        console.log(`[WORKER] 📦 Scraped: ${result.name} (${result.brand})`);
      }
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.failedJobs++;
      if (job) {
        console.error(`[WORKER] ❌ Job ${job.id} failed:`, err.message);
        console.error(`[WORKER] 🔍 Job data:`, JSON.stringify(job.data, null, 2));
      } else {
        console.error(`[WORKER] ❌ Unknown job failed:`, err.message);
      }
    });

    this.worker.on('progress', (job: Job, progress: number | object) => {
      console.log(`[WORKER] 🔄 Job ${job.id} progress:`, progress);
    });

    this.worker.on('active', (job: Job) => {
      console.log(`[WORKER] 🚀 Job ${job.id} started processing`);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`[WORKER] ⚠️ Job ${jobId} stalled`);
    });

    this.worker.on('error', (err: Error) => {
      console.error('[WORKER] ❌ Worker error:', err);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  /**
   * Process a single scraping job
   */
  private async processJob(job: Job<ScrapingJob>): Promise<ScrapedProduct | null> {
    const { id, url, brand, adapter, metadata } = job.data;

    try {
      console.log(`[WORKER] 🔍 Processing job ${id}: ${url}`);

      // Update job progress
      await job.updateProgress({ status: 'initializing', step: 1, total: 4 });

      // Initialize scraper engine if not already done
      if (!this.scraperEngine) {
        this.scraperEngine = new ScraperEngine();
      }

      // Initialize browser if needed
      await job.updateProgress({ status: 'starting_browser', step: 2, total: 4 });

      // Process the scraping job using the engine
      await job.updateProgress({ status: 'scraping', step: 3, total: 4 });

      const scrapedProduct = await this.scraperEngine.scrapePage(
        url,
        await this.loadAdapter(adapter)
      );

      if (scrapedProduct) {
        // Enhance with job metadata
        scrapedProduct.externalId = scrapedProduct.externalId || id;
        if (metadata) {
          Object.assign(scrapedProduct, {
            scrapedAt: new Date().toISOString(),
            jobId: id,
            ...metadata
          });
        }

        await job.updateProgress({ status: 'completed', step: 4, total: 4 });

        // TODO: Save to database here
        console.log(`[WORKER] 💾 Product ready for database: ${scrapedProduct.name}`);

        return scrapedProduct;
      } else {
        throw new Error('No product data extracted');
      }

    } catch (error) {
      console.error(`[WORKER] ❌ Error processing job ${id}:`, error);

      // Add detailed error info to job
      await job.updateProgress({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 4,
        total: 4
      });

      throw error;
    }
  }

  /**
   * Load adapter dynamically
   */
  private async loadAdapter(adapterName: string): Promise<any> {
    try {
      let AdapterClass;

      switch (adapterName.toLowerCase()) {
        case 'zara':
          const ZaraAdapter = await import('../adapters/ZaraAdapter');
          AdapterClass = ZaraAdapter.default || ZaraAdapter.ZaraAdapter;
          break;
        case 'hm':
        case 'h&m':
          // TODO: Implement HMAdapter
          const GenericAdapter = await import('../adapters/GenericAdapter');
          AdapterClass = GenericAdapter.default;
          break;
        default:
          const GenericAdapterDefault = await import('../adapters/GenericAdapter');
          AdapterClass = GenericAdapterDefault.default;
      }

      return new AdapterClass();
    } catch (error) {
      console.warn(`[WORKER] ⚠️ Error loading adapter ${adapterName}, using generic:`, error);
      const GenericAdapter = await import('../adapters/GenericAdapter');
      return new GenericAdapter.default();
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[WORKER] ⚠️ Worker is already running');
      return;
    }

    try {
      console.log('[WORKER] 🚀 Starting queue worker...');

      // Initialize scraper engine
      await this.scraperEngine.initialize();

      this.isRunning = true;
      this.startTime = Date.now();
      console.log('[WORKER] ✅ Queue worker started successfully');
    } catch (error) {
      console.error('[WORKER] ❌ Failed to start worker:', error);
      throw error;
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[WORKER] 🛑 Stopping queue worker...');

    try {
      // Stop accepting new jobs
      await this.worker.close();

      // Shutdown scraper engine
      if (this.scraperEngine) {
        await this.scraperEngine.shutdown();
      }

      // Close Redis connection
      await this.redis.disconnect();

      this.isRunning = false;
      console.log('[WORKER] ✅ Queue worker stopped successfully');
    } catch (error) {
      console.error('[WORKER] ❌ Error stopping worker:', error);
    }
  }

  /**
   * Graceful shutdown handler
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`[WORKER] 📡 Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop accepting new jobs but finish current ones
      await this.worker.close(false);

      // Give current jobs time to complete (max 30 seconds)
      const shutdownTimeout = setTimeout(() => {
        console.warn('[WORKER] ⚠️ Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);

      await this.stop();
      clearTimeout(shutdownTimeout);

      console.log('[WORKER] ✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('[WORKER] ❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    isRunning: boolean;
    processedJobs: number;
    failedJobs: number;
    uptime: number;
    successRate: number;
  } {
    const uptime = Date.now() - this.startTime;
    const totalJobs = this.processedJobs + this.failedJobs;
    const successRate = totalJobs > 0 ? (this.processedJobs / totalJobs) * 100 : 0;

    return {
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      uptime,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Health check for the worker
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    stats: any;
    scraperEngine: any;
    redis: boolean;
    error?: string;
  }> {
    try {
      // Check Redis connection
      await this.redis.ping();

      // Get worker stats
      const stats = this.getStats();

      // Get scraper engine stats
      const scraperStats = this.scraperEngine ? this.scraperEngine.getStats() : null;

      return {
        healthy: this.isRunning,
        stats,
        scraperEngine: scraperStats,
        redis: true
      };
    } catch (error) {
      return {
        healthy: false,
        stats: this.getStats(),
        scraperEngine: null,
        redis: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reset worker statistics
   */
  resetStats(): void {
    this.processedJobs = 0;
    this.failedJobs = 0;
    this.startTime = Date.now();
    console.log('[WORKER] 📊 Worker statistics reset');
  }
}

export default QueueWorker;