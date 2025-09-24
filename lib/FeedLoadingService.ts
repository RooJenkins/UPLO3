import { Image } from 'react-native';

export interface LoadingJob {
  id: string;
  prompt: string;
  priority: 'critical' | 'preload' | 'cache';
  position: number; // Feed position
  userImageBase64: string;
  retries: number;
  timestamp: number;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  position: number;
  cached: boolean;
  timestamp: number;
}

export interface WorkerStats {
  id: string;
  busy: boolean;
  processed: number;
  errors: number;
  avgDuration: number;
}

export class FeedLoadingService {
  private workers: Set<string> = new Set();
  private jobQueue: LoadingJob[] = [];
  private processing: Map<string, LoadingJob> = new Map();
  private imageCache: Map<number, GeneratedImage> = new Map();
  private preloadedImages: Set<string> = new Set();
  private workerStats: Map<string, WorkerStats> = new Map();

  // Configuration
  private readonly MAX_WORKERS = 10;
  private readonly PRELOAD_AHEAD = 20;
  private readonly CACHE_BEHIND = 10;
  private readonly MAX_RETRIES = 2;
  private readonly CACHE_SIZE_LIMIT = 100; // Total images to keep in memory (increased for better UX)

  // Scroll prediction
  private scrollVelocity = 0;
  private lastScrollPosition = 0;
  private scrollDirection: 'up' | 'down' = 'down';

  constructor() {
    this.initializeWorkers();
  }

  private initializeWorkers() {
    console.log('[LOADING] Initializing', this.MAX_WORKERS, 'parallel workers');

    for (let i = 0; i < this.MAX_WORKERS; i++) {
      const workerId = `worker_${i}`;
      this.workers.add(workerId);
      this.workerStats.set(workerId, {
        id: workerId,
        busy: false,
        processed: 0,
        errors: 0,
        avgDuration: 0
      });
    }
  }

  /**
   * Update scroll position for intelligent preloading
   */
  updateScrollPosition(currentIndex: number, velocity: number) {
    this.scrollVelocity = velocity;
    this.scrollDirection = currentIndex > this.lastScrollPosition ? 'down' : 'up';
    this.lastScrollPosition = currentIndex;

    // Trigger intelligent preloading based on scroll
    this.scheduleIntelligentPreload(currentIndex);
  }

  /**
   * Add jobs to queue with priority system
   */
  queueJobs(jobs: Omit<LoadingJob, 'retries' | 'timestamp'>[], userImageBase64: string) {
    const newJobs: LoadingJob[] = jobs.map(job => ({
      ...job,
      userImageBase64,
      retries: 0,
      timestamp: Date.now()
    }));

    // Sort by priority: critical > preload > cache
    const priorityOrder = { critical: 0, preload: 1, cache: 2 };
    newJobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.position - b.position; // Secondary sort by position
    });

    this.jobQueue.push(...newJobs);
    console.log('[LOADING] Queued', newJobs.length, 'jobs. Queue size:', this.jobQueue.length);

    // Start processing
    this.processQueue();
  }

  /**
   * Get available images from cache
   */
  getImage(position: number): GeneratedImage | null {
    return this.imageCache.get(position) || null;
  }

  /**
   * Check if image is preloaded
   */
  isPreloaded(imageUrl: string): boolean {
    return this.preloadedImages.has(imageUrl);
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): WorkerStats[] {
    return Array.from(this.workerStats.values());
  }

  /**
   * Process the job queue with parallel workers
   */
  private async processQueue() {
    // Find available workers
    const availableWorkers = Array.from(this.workers).filter(workerId => {
      const stats = this.workerStats.get(workerId);
      return stats && !stats.busy;
    });

    if (availableWorkers.length === 0 || this.jobQueue.length === 0) {
      return;
    }

    // Assign jobs to workers
    const jobsToProcess = this.jobQueue.splice(0, availableWorkers.length);

    jobsToProcess.forEach((job, index) => {
      const workerId = availableWorkers[index];
      this.assignJobToWorker(job, workerId);
    });
  }

  /**
   * Assign a job to a specific worker
   */
  private async assignJobToWorker(job: LoadingJob, workerId: string) {
    const stats = this.workerStats.get(workerId)!;
    stats.busy = true;
    this.processing.set(job.id, job);

    const startTime = Date.now();

    try {
      console.log(`[WORKER-${workerId}] Processing job ${job.id} (${job.priority})`);

      const result = await this.generateImage(job);

      // Cache the result
      this.imageCache.set(job.position, result);

      // Preload the image for instant display
      await this.preloadImage(result.imageUrl);

      // Update stats
      const duration = Date.now() - startTime;
      stats.processed++;
      stats.avgDuration = (stats.avgDuration * (stats.processed - 1) + duration) / stats.processed;

      console.log(`[WORKER-${workerId}] Completed job ${job.id} in ${duration}ms`);

    } catch (error) {
      console.error(`[WORKER-${workerId}] Failed job ${job.id}:`, error);

      stats.errors++;

      // Retry logic
      if (job.retries < this.MAX_RETRIES) {
        job.retries++;
        this.jobQueue.unshift(job); // Re-queue with higher priority
        console.log(`[WORKER-${workerId}] Retrying job ${job.id} (attempt ${job.retries + 1})`);
      }
    } finally {
      stats.busy = false;
      this.processing.delete(job.id);

      // Clean up cache if needed
      this.cleanupCache();

      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Generate image using Rork Toolkit API
   */
  private async generateImage(job: LoadingJob): Promise<GeneratedImage> {
    const response = await fetch('https://toolkit.rork.com/images/edit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Change the person's outfit to: ${job.prompt}. Keep the person's face and pose. Full body.`,
        images: [{ type: 'image', image: job.userImageBase64 }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const image = data?.image;
    const imageUrl = image?.base64Data && image?.mimeType
      ? `data:${image.mimeType};base64,${image.base64Data}`
      : `https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=${encodeURIComponent('Fallback')}`;

    return {
      id: job.id,
      imageUrl,
      prompt: job.prompt,
      position: job.position,
      cached: true,
      timestamp: Date.now()
    };
  }

  /**
   * Preload image for instant display
   */
  private async preloadImage(imageUrl: string): Promise<void> {
    try {
      await Image.prefetch(imageUrl);
      this.preloadedImages.add(imageUrl);
      console.log('[PRELOAD] Successfully preloaded image');
    } catch (error) {
      console.warn('[PRELOAD] Failed to preload image:', error);
    }
  }

  /**
   * Intelligent preloading based on scroll patterns
   */
  private scheduleIntelligentPreload(currentIndex: number) {
    // Calculate adaptive preload distance based on scroll velocity
    const velocityMultiplier = Math.min(Math.abs(this.scrollVelocity) * 2, 10);
    const adaptivePreload = Math.max(this.PRELOAD_AHEAD + velocityMultiplier, 25);

    const jobs: Omit<LoadingJob, 'retries' | 'timestamp'>[] = [];

    // Preload ahead
    const preloadStart = this.scrollDirection === 'down' ? currentIndex + 3 : Math.max(0, currentIndex - adaptivePreload);
    const preloadEnd = this.scrollDirection === 'down' ? currentIndex + adaptivePreload : currentIndex - 3;

    for (let pos = preloadStart; pos <= preloadEnd; pos++) {
      if (pos >= 0 && !this.imageCache.has(pos)) {
        jobs.push({
          id: `preload_${pos}`,
          prompt: this.getPromptForPosition(pos),
          priority: pos <= currentIndex + 5 ? 'critical' : 'preload',
          position: pos
        });
      }
    }

    // Cache behind (lower priority)
    for (let pos = Math.max(0, currentIndex - this.CACHE_BEHIND); pos < currentIndex; pos++) {
      if (!this.imageCache.has(pos)) {
        jobs.push({
          id: `cache_${pos}`,
          prompt: this.getPromptForPosition(pos),
          priority: 'cache',
          position: pos
        });
      }
    }

    if (jobs.length > 0) {
      // We need userImageBase64 - this should be passed from the component
      console.log('[PRELOAD] Scheduling', jobs.length, 'intelligent preload jobs');
      // Note: We'll need to get userImageBase64 from the calling component
    }
  }

  /**
   * Get prompt for feed position
   */
  private getPromptForPosition(position: number): string {
    const prompts = [
      'casual summer outfit', 'business professional attire', 'trendy streetwear look',
      'elegant evening wear', 'cozy weekend outfit', 'vintage inspired outfit',
      'athletic wear ensemble', 'minimalist chic style', 'bohemian fashion look',
      'smart casual attire', 'formal dinner outfit', 'beach vacation style',
      'urban explorer look', 'romantic date night', 'creative artist vibe',
      'power lunch ensemble', 'festival fashion', 'winter cozy layers',
      'spring fresh style', 'autumn earth tones'
    ];

    return prompts[position % prompts.length];
  }

  /**
   * Smart cache cleanup - prioritizes keeping images near user's current position
   */
  private cleanupCache() {
    if (this.imageCache.size <= this.CACHE_SIZE_LIMIT) return;

    // Get all cache entries
    const entries = Array.from(this.imageCache.entries());

    // Calculate distance from current scroll position for each cached image
    const entriesWithDistance = entries.map(([position, image]) => ({
      position,
      image,
      distance: Math.abs(position - this.lastScrollPosition),
      timestamp: image.timestamp
    }));

    // Sort by distance (keep images closest to current position)
    // Secondary sort by timestamp (prefer newer images if distance is same)
    entriesWithDistance.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return b.timestamp - a.timestamp; // Newer first as tiebreaker
    });

    // Keep images up to the limit (keep closest ones)
    const toKeep = entriesWithDistance.slice(0, this.CACHE_SIZE_LIMIT);
    const toRemove = entriesWithDistance.slice(this.CACHE_SIZE_LIMIT);

    // Remove the furthest images
    toRemove.forEach(({ position, image }) => {
      this.imageCache.delete(position);
      this.preloadedImages.delete(image.imageUrl);
    });

    console.log('[CLEANUP] Smart cleanup: removed', toRemove.length, 'distant images, kept', toKeep.length, 'near position', this.lastScrollPosition);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const busyWorkers = Array.from(this.workerStats.values()).filter(w => w.busy).length;

    return {
      queueLength: this.jobQueue.length,
      processing: this.processing.size,
      cached: this.imageCache.size,
      preloaded: this.preloadedImages.size,
      busyWorkers,
      totalWorkers: this.MAX_WORKERS,
      efficiency: busyWorkers / this.MAX_WORKERS
    };
  }
}