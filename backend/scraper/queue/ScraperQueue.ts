import { Queue, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';
import { ScrapingJob } from '../core/ScraperEngine';

export interface ScraperQueueConfig {
  redisUrl?: string;
  concurrency?: number;
  maxAttempts?: number;
  backoffSettings?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

/**
 * Distributed scraping queue using BullMQ and Redis
 * Manages job distribution, retry logic, and worker coordination
 */
export class ScraperQueue {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private redis: Redis;

  constructor(config: ScraperQueueConfig = {}) {
    // Initialize Redis connection
    this.redis = new Redis(config.redisUrl || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });

    // Initialize the queue
    this.queue = new Queue('scraper-jobs', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50, // Keep last 50 completed jobs
        removeOnFail: 20,     // Keep last 20 failed jobs
        attempts: config.maxAttempts || 3,
        backoff: config.backoffSettings || {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents('scraper-jobs', {
      connection: this.redis
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for monitoring and logging
   */
  private setupEventHandlers(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[QUEUE] ✅ Job ${jobId} completed successfully`);
      if (returnvalue?.name) {
        console.log(`[QUEUE] 📦 Scraped product: ${returnvalue.name}`);
      }
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[QUEUE] ❌ Job ${jobId} failed: ${failedReason}`);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[QUEUE] 🔄 Job ${jobId} progress: ${JSON.stringify(data)}`);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`[QUEUE] ⚠️ Job ${jobId} stalled`);
    });

    this.queueEvents.on('retrying', ({ jobId, attemptsMade }) => {
      console.log(`[QUEUE] 🔄 Job ${jobId} retrying (attempt ${attemptsMade})`);
    });
  }

  /**
   * Add a single scraping job to the queue
   */
  async addJob(scrapingJob: ScrapingJob): Promise<Job> {
    console.log(`[QUEUE] 📝 Adding job: ${scrapingJob.id} (${scrapingJob.brand})`);

    const job = await this.queue.add(
      'scrape-product',
      scrapingJob,
      {
        jobId: scrapingJob.id,
        priority: scrapingJob.priority || 0,
        delay: this.calculateDelay(scrapingJob.brand),
        attempts: scrapingJob.maxRetries || 3
      }
    );

    return job;
  }

  /**
   * Add multiple scraping jobs in bulk
   */
  async addBulkJobs(scrapingJobs: ScrapingJob[]): Promise<Job[]> {
    console.log(`[QUEUE] 📋 Adding ${scrapingJobs.length} jobs in bulk`);

    const bulkJobs = scrapingJobs.map(job => ({
      name: 'scrape-product',
      data: job,
      opts: {
        jobId: job.id,
        priority: job.priority || 0,
        delay: this.calculateDelay(job.brand),
        attempts: job.maxRetries || 3
      }
    }));

    const jobs = await this.queue.addBulk(bulkJobs);
    console.log(`[QUEUE] ✅ Added ${jobs.length} jobs successfully`);

    return jobs;
  }

  /**
   * Calculate delay based on brand to avoid overwhelming specific sites
   */
  private calculateDelay(brand: string): number {
    // Different brands might have different rate limiting requirements
    const brandDelays: Record<string, number> = {
      'zara': 5000,     // 5 seconds between Zara requests
      'hm': 3000,       // 3 seconds between H&M requests
      'nike': 4000,     // 4 seconds between Nike requests
      'asos': 2000,     // 2 seconds between ASOS requests
      'uniqlo': 3000    // 3 seconds between Uniqlo requests
    };

    const baseDelay = brandDelays[brand.toLowerCase()] || 2000;
    // Add some randomization to avoid predictable patterns
    return baseDelay + Math.random() * 2000;
  }

  /**
   * Schedule jobs for a specific brand's product catalog
   */
  async scheduleBrandCatalog(brand: string, productUrls: string[], priority: number = 0): Promise<void> {
    console.log(`[QUEUE] 🏷️ Scheduling catalog scrape for ${brand}: ${productUrls.length} products`);

    const jobs: ScrapingJob[] = productUrls.map((url, index) => ({
      id: `${brand}-${Date.now()}-${index}`,
      url,
      brand,
      adapter: brand.toLowerCase(),
      priority,
      maxRetries: 3,
      metadata: {
        catalogScrape: true,
        scheduledAt: new Date().toISOString()
      }
    }));

    await this.addBulkJobs(jobs);
  }

  /**
   * Schedule periodic rescraping for existing products
   */
  async scheduleRescraping(productIds: string[], intervalHours: number = 24): Promise<void> {
    console.log(`[QUEUE] 🔄 Scheduling rescraping for ${productIds.length} products every ${intervalHours}h`);

    // This would typically fetch product URLs from database based on IDs
    // For now, we'll create a simple recurring job structure
    const jobs: ScrapingJob[] = productIds.map(productId => ({
      id: `rescrape-${productId}-${Date.now()}`,
      url: `https://example.com/product/${productId}`, // Would be retrieved from DB
      brand: 'unknown', // Would be retrieved from DB
      adapter: 'generic',
      priority: -1, // Lower priority for rescraped items
      maxRetries: 2,
      metadata: {
        rescrape: true,
        originalProductId: productId,
        intervalHours
      }
    }));

    // Add with delay to spread out rescraping
    const delay = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
    for (const job of jobs) {
      await this.queue.add('scrape-product', job, {
        jobId: job.id,
        delay,
        repeat: { every: delay } // Repeat every X hours
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const [active, waiting, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getActive(),
      this.queue.getWaiting(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
      this.queue.getPaused()
    ]);

    return {
      active: active.length,
      waiting: waiting.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length
    };
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed', limit: number = 10): Promise<Job[]> {
    switch (status) {
      case 'active':
        return this.queue.getActive(0, limit);
      case 'waiting':
        return this.queue.getWaiting(0, limit);
      case 'completed':
        return this.queue.getCompleted(0, limit);
      case 'failed':
        return this.queue.getFailed(0, limit);
      case 'delayed':
        return this.queue.getDelayed(0, limit);
      default:
        return [];
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(limit: number = 10): Promise<void> {
    const failedJobs = await this.queue.getFailed(0, limit);
    console.log(`[QUEUE] 🔄 Retrying ${failedJobs.length} failed jobs`);

    for (const job of failedJobs) {
      await job.retry();
    }
  }

  /**
   * Clear all jobs of specific status
   */
  async clearJobs(status: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' = 'completed'): Promise<void> {
    console.log(`[QUEUE] 🧹 Clearing ${status} jobs`);

    switch (status) {
      case 'completed':
        await this.queue.clean(0, 0, 'completed');
        break;
      case 'failed':
        await this.queue.clean(0, 0, 'failed');
        break;
      case 'active':
        await this.queue.clean(0, 0, 'active');
        break;
      case 'waiting':
        await this.queue.clean(0, 0, 'waiting');
        break;
      case 'delayed':
        await this.queue.clean(0, 0, 'delayed');
        break;
    }
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    console.log('[QUEUE] ⏸️ Pausing queue');
    await this.queue.pause();
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    console.log('[QUEUE] ▶️ Resuming queue');
    await this.queue.resume();
  }

  /**
   * Get specific job by ID
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    return this.queue.getJob(jobId);
  }

  /**
   * Remove specific job by ID
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[QUEUE] 🗑️ Removed job ${jobId}`);
    }
  }

  /**
   * Add priority job that jumps to front of queue
   */
  async addPriorityJob(scrapingJob: ScrapingJob): Promise<Job> {
    console.log(`[QUEUE] 🚀 Adding priority job: ${scrapingJob.id}`);

    return this.queue.add(
      'scrape-product',
      scrapingJob,
      {
        jobId: scrapingJob.id,
        priority: 100, // High priority
        attempts: scrapingJob.maxRetries || 3
      }
    );
  }

  /**
   * Health check for queue and Redis connection
   */
  async healthCheck(): Promise<{
    queueHealthy: boolean;
    redisHealthy: boolean;
    stats: any;
    error?: string;
  }> {
    try {
      // Test Redis connection
      await this.redis.ping();

      // Get queue stats
      const stats = await this.getStats();

      return {
        queueHealthy: true,
        redisHealthy: true,
        stats
      };
    } catch (error) {
      return {
        queueHealthy: false,
        redisHealthy: false,
        stats: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    console.log('[QUEUE] 🔚 Closing scraper queue');

    await this.queueEvents.close();
    await this.queue.close();
    await this.redis.disconnect();

    console.log('[QUEUE] ✅ Scraper queue closed successfully');
  }
}

export default ScraperQueue;