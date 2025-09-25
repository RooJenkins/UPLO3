import { z } from 'zod';
import { publicProcedure } from '../context';
import ScraperQueue from '../../scraper/queue/ScraperQueue';
import QueueWorker from '../../scraper/queue/QueueWorker';

// Initialize global instances (in production, these would be managed differently)
let scraperQueue: ScraperQueue | null = null;
let queueWorker: QueueWorker | null = null;

// Initialize queue and worker
const initializeScrapingSystem = async () => {
  if (!scraperQueue) {
    scraperQueue = new ScraperQueue({
      concurrency: 3,
      maxAttempts: 3
    });
  }

  if (!queueWorker) {
    queueWorker = new QueueWorker({
      concurrency: 2 // Start with 2 concurrent workers
    });
  }
};

export const scraperProcedures = {
  // Add a single scraping job
  addJob: publicProcedure
    .input(z.object({
      url: z.string().url(),
      brand: z.string().min(1),
      priority: z.number().min(0).max(100).default(0),
      maxRetries: z.number().min(1).max(5).default(3)
    }))
    .mutation(async ({ input }) => {
      console.log('[SCRAPER API] 📝 Adding scraping job:', input.url);

      try {
        await initializeScrapingSystem();

        const job = await scraperQueue!.addJob({
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: input.url,
          brand: input.brand,
          adapter: input.brand.toLowerCase(),
          priority: input.priority,
          maxRetries: input.maxRetries,
          metadata: {
            addedAt: new Date().toISOString(),
            source: 'api'
          }
        });

        return {
          success: true,
          jobId: job.id,
          message: 'Scraping job added successfully',
          estimatedCompletion: new Date(Date.now() + 30000).toISOString() // Rough estimate
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error adding job:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Add multiple jobs for bulk scraping
  addBulkJobs: publicProcedure
    .input(z.object({
      urls: z.array(z.string().url()).min(1).max(50), // Limit to 50 URLs at once
      brand: z.string().min(1),
      priority: z.number().min(0).max(100).default(0),
      maxRetries: z.number().min(1).max(5).default(3)
    }))
    .mutation(async ({ input }) => {
      console.log(`[SCRAPER API] 📋 Adding ${input.urls.length} bulk jobs for ${input.brand}`);

      try {
        await initializeScrapingSystem();

        const jobs = input.urls.map((url, index) => ({
          id: `bulk_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          brand: input.brand,
          adapter: input.brand.toLowerCase(),
          priority: input.priority,
          maxRetries: input.maxRetries,
          metadata: {
            addedAt: new Date().toISOString(),
            source: 'bulk_api',
            batchIndex: index
          }
        }));

        const addedJobs = await scraperQueue!.addBulkJobs(jobs);

        return {
          success: true,
          jobsAdded: addedJobs.length,
          jobIds: addedJobs.map(job => job.id),
          message: `${addedJobs.length} scraping jobs added successfully`,
          estimatedCompletion: new Date(Date.now() + (addedJobs.length * 30000)).toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error adding bulk jobs:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Schedule brand catalog scraping
  scheduleBrandCatalog: publicProcedure
    .input(z.object({
      brand: z.string().min(1),
      productUrls: z.array(z.string().url()).min(1).max(100),
      priority: z.number().min(0).max(100).default(10)
    }))
    .mutation(async ({ input }) => {
      console.log(`[SCRAPER API] 🏷️ Scheduling catalog scrape for ${input.brand}: ${input.productUrls.length} products`);

      try {
        await initializeScrapingSystem();

        await scraperQueue!.scheduleBrandCatalog(
          input.brand,
          input.productUrls,
          input.priority
        );

        return {
          success: true,
          message: `Scheduled scraping for ${input.productUrls.length} ${input.brand} products`,
          brand: input.brand,
          productCount: input.productUrls.length
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error scheduling brand catalog:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Get queue statistics
  getQueueStats: publicProcedure
    .query(async () => {
      try {
        if (!scraperQueue) {
          return {
            success: false,
            error: 'Scraper queue not initialized'
          };
        }

        const stats = await scraperQueue.getStats();

        return {
          success: true,
          stats,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error getting queue stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Get worker statistics
  getWorkerStats: publicProcedure
    .query(async () => {
      try {
        if (!queueWorker) {
          return {
            success: false,
            error: 'Queue worker not initialized'
          };
        }

        const stats = queueWorker.getStats();

        return {
          success: true,
          stats,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error getting worker stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Get jobs by status
  getJobsByStatus: publicProcedure
    .input(z.object({
      status: z.enum(['active', 'waiting', 'completed', 'failed', 'delayed']),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(async ({ input }) => {
      try {
        if (!scraperQueue) {
          return {
            success: false,
            error: 'Scraper queue not initialized'
          };
        }

        const jobs = await scraperQueue.getJobsByStatus(input.status, input.limit);

        return {
          success: true,
          jobs: jobs.map(job => ({
            id: job.id,
            data: job.data,
            progress: job.progress,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue
          })),
          status: input.status,
          count: jobs.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error getting jobs by status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Get specific job details
  getJob: publicProcedure
    .input(z.object({
      jobId: z.string().min(1)
    }))
    .query(async ({ input }) => {
      try {
        if (!scraperQueue) {
          return {
            success: false,
            error: 'Scraper queue not initialized'
          };
        }

        const job = await scraperQueue.getJob(input.jobId);

        if (!job) {
          return {
            success: false,
            error: 'Job not found'
          };
        }

        return {
          success: true,
          job: {
            id: job.id,
            data: job.data,
            progress: job.progress,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue,
            opts: job.opts
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error getting job:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Retry failed jobs
  retryFailedJobs: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10)
    }))
    .mutation(async ({ input }) => {
      try {
        if (!scraperQueue) {
          return {
            success: false,
            error: 'Scraper queue not initialized'
          };
        }

        await scraperQueue.retryFailedJobs(input.limit);

        return {
          success: true,
          message: `Retried up to ${input.limit} failed jobs`,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error retrying failed jobs:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Health check for scraping system
  healthCheck: publicProcedure
    .query(async () => {
      try {
        const queueHealth = scraperQueue ? await scraperQueue.healthCheck() : null;
        const workerHealth = queueWorker ? await queueWorker.healthCheck() : null;

        const overallHealthy = Boolean(
          queueHealth?.queueHealthy &&
          queueHealth?.redisHealthy &&
          workerHealth?.healthy
        );

        return {
          success: true,
          healthy: overallHealthy,
          components: {
            queue: queueHealth,
            worker: workerHealth
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Health check error:', error);
        return {
          success: false,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
      }
    }),

  // Start/Stop worker
  controlWorker: publicProcedure
    .input(z.object({
      action: z.enum(['start', 'stop', 'restart']),
    }))
    .mutation(async ({ input }) => {
      console.log(`[SCRAPER API] 🎛️ Worker control: ${input.action}`);

      try {
        await initializeScrapingSystem();

        switch (input.action) {
          case 'start':
            if (!queueWorker) {
              queueWorker = new QueueWorker();
            }
            await queueWorker.start();
            break;

          case 'stop':
            if (queueWorker) {
              await queueWorker.stop();
            }
            break;

          case 'restart':
            if (queueWorker) {
              await queueWorker.stop();
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              await queueWorker.start();
            }
            break;
        }

        return {
          success: true,
          message: `Worker ${input.action} completed successfully`,
          action: input.action,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error(`[SCRAPER API] ❌ Error with worker ${input.action}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: input.action
        };
      }
    }),

  // Test scraping with a sample URL
  testScrape: publicProcedure
    .input(z.object({
      url: z.string().url(),
      brand: z.string().default('generic')
    }))
    .mutation(async ({ input }) => {
      console.log(`[SCRAPER API] 🧪 Test scraping: ${input.url}`);

      try {
        await initializeScrapingSystem();

        const job = await scraperQueue!.addPriorityJob({
          id: `test_${Date.now()}`,
          url: input.url,
          brand: input.brand,
          adapter: input.brand.toLowerCase(),
          priority: 100, // High priority for test jobs
          maxRetries: 1,
          metadata: {
            test: true,
            addedAt: new Date().toISOString()
          }
        });

        return {
          success: true,
          message: 'Test scraping job added with high priority',
          jobId: job.id,
          url: input.url,
          brand: input.brand,
          note: 'Check job status using getJob endpoint',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[SCRAPER API] ❌ Error with test scrape:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
};

export { scraperProcedures };