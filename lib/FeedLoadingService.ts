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
  private readonly MAX_WORKERS = 30;
  private readonly PRELOAD_AHEAD = 20;
  private readonly CACHE_BEHIND = 10;
  private readonly MAX_RETRIES = 2;
  private readonly CACHE_SIZE_LIMIT = 100; // Total images to keep in memory (increased for better UX)

  // Continuous Generation Configuration
  private readonly BUFFER_TARGET = 100; // Always aim to have 100 images ready
  private readonly GENERATION_TRIGGER_DISTANCE = 50; // Start generating when 50 images from end
  private readonly BATCH_SIZE = 20; // Generate in batches of 20
  private readonly CONTINUOUS_CHECK_INTERVAL = 5000; // Check every 5 seconds

  // Scroll prediction
  private scrollVelocity = 0;
  private lastScrollPosition = 0;
  private scrollDirection: 'up' | 'down' = 'down';

  // Continuous generation state
  private maxGeneratedPosition = 0;
  private continuousGenerationEnabled = false;
  private backgroundGenerationTimer: NodeJS.Timeout | null = null;
  private userImageBase64: string | null = null;

  constructor() {
    console.log('[LOADING] 🚀 FRESH FeedLoadingService initialization with', this.MAX_WORKERS, 'parallel workers');
    this.initializeWorkers();
    this.startContinuousGeneration();
  }

  private initializeWorkers() {
    console.log('[LOADING] 🔧 Initializing', this.MAX_WORKERS, 'parallel workers for maximum throughput');

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

      // Cache the result with validation to prevent duplicates
      if (this.imageCache.has(job.position)) {
        console.warn('[WORKER] ⚠️ Position already cached, potential duplicate:', {
          workerId,
          position: job.position,
          existingId: this.imageCache.get(job.position)?.id,
          newId: result.id
        });
      }

      this.imageCache.set(job.position, result);
      console.log('[WORKER] ✅ Cached image at position', job.position, 'ID:', result.id.substring(0, 12));

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

      // Update max generated position
      if (job.position > this.maxGeneratedPosition) {
        this.maxGeneratedPosition = job.position;
      }
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
   * Enhanced intelligent preloading with continuous generation awareness
   */
  private scheduleIntelligentPreload(currentIndex: number) {
    if (!this.userImageBase64) return;

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
      console.log('[PRELOAD] 🧠 Scheduling', jobs.length, 'intelligent preload jobs');
      this.queueJobs(jobs, this.userImageBase64);
    }

    // Trigger continuous generation check
    if (this.continuousGenerationEnabled) {
      setTimeout(() => this.maintainBuffer(), 1000);
    }
  }

  /**
   * Get highly varied prompt for feed position to ensure unique images
   */
  private getPromptForPosition(position: number): string {
    const baseStyles = [
      'casual summer outfit', 'business professional attire', 'trendy streetwear look',
      'elegant evening wear', 'cozy weekend outfit', 'vintage inspired outfit',
      'athletic wear ensemble', 'minimalist chic style', 'bohemian fashion look',
      'smart casual attire', 'formal dinner outfit', 'beach vacation style',
      'urban explorer look', 'romantic date night', 'creative artist vibe',
      'power lunch ensemble', 'festival fashion', 'winter cozy layers',
      'spring fresh style', 'autumn earth tones', 'gothic alternative',
      'preppy collegiate', 'edgy punk rock', 'sophisticated luxury',
      'comfort loungewear', 'adventure outdoor', 'artistic bohemian',
      'retro vintage', 'futuristic modern', 'classic timeless',
      'sporty casual', 'elegant cocktail', 'boho chic', 'minimalist modern',
      'romantic feminine', 'edgy contemporary', 'professional casual',
      'vacation resort', 'city night out', 'weekend relaxed',
      'formal business', 'trendy fashion forward', 'comfortable stylish',
      // Additional styles for more variation
      'grunge aesthetic', 'cottagecore charm', 'dark academia', 'soft girl style',
      'academia chic', 'tomboy casual', 'ethereal fairy', 'cyberpunk futuristic',
      'prairie dress vintage', 'mod 60s style', 'disco 70s glam', '80s power suit',
      '90s grunge revival', 'y2k nostalgic', 'indie sleaze', 'clean girl minimal',
      'maximalist bold', 'scandinavian simple', 'french girl chic', 'italian luxury'
    ];

    const colors = [
      'black', 'white', 'navy', 'red', 'pink', 'green', 'blue', 'purple', 'yellow', 'orange', 'gray', 'brown', 'beige',
      'cream', 'ivory', 'charcoal', 'burgundy', 'emerald', 'sapphire', 'coral', 'mint', 'lavender', 'peach', 'sage',
      'terracotta', 'mustard', 'forest', 'plum', 'rose', 'taupe', 'khaki', 'camel', 'rust', 'teal', 'mauve'
    ];
    const modifiers = [
      'modern', 'vintage', 'stylish', 'comfortable', 'elegant', 'casual', 'edgy', 'feminine', 'minimalist', 'bold',
      'sophisticated', 'playful', 'dramatic', 'understated', 'striking', 'refined', 'relaxed', 'polished', 'trendy', 'timeless',
      'chic', 'effortless', 'sleek', 'cozy', 'glamorous', 'artistic', 'classic', 'contemporary', 'romantic', 'powerful'
    ];
    const accessories = [
      'with belt', 'with hat', 'with jacket', 'with scarf', 'with jewelry', 'with sunglasses', 'with bag', 'with boots',
      'with heels', 'with sneakers', 'with watch', 'with earrings', 'with necklace', 'with bracelet', 'with ring',
      'with cardigan', 'with blazer', 'with vest', 'with shawl', 'with gloves', 'with headband', 'with brooch', ''
    ];

    // Create highly unique combinations using position for deterministic but varied results
    const baseIndex = position % baseStyles.length;
    const colorIndex = Math.floor(position / baseStyles.length) % colors.length;
    const modifierIndex = Math.floor(position / (baseStyles.length * colors.length)) % modifiers.length;
    const accessoryIndex = Math.floor(position / (baseStyles.length * colors.length * modifiers.length)) % accessories.length;

    const baseStyle = baseStyles[baseIndex];
    const color = colors[colorIndex];
    const modifier = modifiers[modifierIndex];
    const accessory = accessories[accessoryIndex];

    // Generate unique prompt with position identifier for debugging
    let prompt = `${modifier} ${color} ${baseStyle}`;
    if (accessory) {
      prompt += ` ${accessory}`;
    }

    // Add position-based uniqueness for maximum variety
    const uniqueElements = [
      'with unique styling', 'trendy fashion', 'designer look', 'street style', 'fashion forward',
      'contemporary design', 'modern aesthetic', 'stylish appearance', 'runway inspired', 'haute couture',
      'ready-to-wear', 'sustainable fashion', 'ethical clothing', 'artisan crafted', 'handmade details',
      'custom tailored', 'bespoke design', 'limited edition', 'signature style', 'iconic look'
    ];

    const textureElements = [
      'silky smooth', 'textured fabric', 'soft material', 'structured design', 'flowing fabric',
      'crisp cotton', 'luxe material', 'comfortable fit', 'breathable fabric', 'premium quality',
      'organic cotton', 'sustainable fabric', 'recycled material', 'natural fiber', 'high-tech fabric'
    ];

    const seasonalElements = [
      'perfect for the season', 'weather-appropriate', 'climate-conscious', 'seasonal transition',
      'all-season versatile', 'layering piece', 'temperature-perfect', 'season-appropriate'
    ];

    // Layer multiple uniqueness elements
    const unique1 = uniqueElements[position % uniqueElements.length];
    const texture = textureElements[Math.floor(position / uniqueElements.length) % textureElements.length];
    const seasonal = seasonalElements[Math.floor(position / (uniqueElements.length * textureElements.length)) % seasonalElements.length];

    prompt += `, ${unique1}, ${texture}, ${seasonal}`;

    // Add position hash for ultimate uniqueness
    const positionHash = (position * 37 + 13) % 1000;
    prompt += `, style variation ${positionHash}`;

    console.log(`[PROMPT] Position ${position}: "${prompt.substring(0, 100)}..."`);
    return prompt;
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
   * Enable continuous background generation
   */
  enableContinuousGeneration(userImageBase64: string) {
    console.log('[LOADING] 🔄 Enabling continuous generation with 100-image buffer');
    this.userImageBase64 = userImageBase64;
    this.continuousGenerationEnabled = true;
    this.scheduleBackgroundGeneration();
  }

  /**
   * Start continuous generation system
   */
  private startContinuousGeneration() {
    if (this.backgroundGenerationTimer) {
      clearInterval(this.backgroundGenerationTimer);
    }

    this.backgroundGenerationTimer = setInterval(() => {
      if (this.continuousGenerationEnabled && this.userImageBase64) {
        this.maintainBuffer();
      }
    }, this.CONTINUOUS_CHECK_INTERVAL);
  }

  /**
   * Maintain the 100-image buffer continuously
   */
  private maintainBuffer() {
    const currentMaxPosition = Math.max(...Array.from(this.imageCache.keys()), 0);
    const distanceFromEnd = currentMaxPosition - this.lastScrollPosition;

    // Update max generated position
    this.maxGeneratedPosition = Math.max(this.maxGeneratedPosition, currentMaxPosition);

    const needsMoreImages = (
      distanceFromEnd <= this.GENERATION_TRIGGER_DISTANCE || // User approaching end
      this.imageCache.size < this.BUFFER_TARGET || // Buffer not full
      this.jobQueue.length === 0 // No jobs queued
    );

    if (needsMoreImages) {
      console.log('[LOADING] 🚀 Buffer maintenance triggered:', {
        distanceFromEnd,
        bufferSize: this.imageCache.size,
        queueLength: this.jobQueue.length,
        userPosition: this.lastScrollPosition
      });

      this.generateBufferBatch();
    }
  }

  /**
   * Generate a batch of images for the buffer with duplicate prevention
   */
  private generateBufferBatch() {
    if (!this.userImageBase64) return;

    const jobs = [];
    const startPosition = this.maxGeneratedPosition + 1;

    for (let i = 0; i < this.BATCH_SIZE; i++) {
      const position = startPosition + i;

      if (!this.imageCache.has(position)) {
        const uniqueId = `buffer_${position}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const prompt = this.getPromptForPosition(position);

        jobs.push({
          id: uniqueId,
          prompt,
          priority: 'cache' as const,
          position
        });

        console.log(`[BUFFER] 📦 Queuing position ${position} with unique ID: ${uniqueId.substring(0, 20)}...`);
      } else {
        console.log(`[BUFFER] ⏭️ Skipping position ${position} - already cached`);
      }
    }

    if (jobs.length > 0) {
      console.log('[LOADING] 🚀 Generating buffer batch:', jobs.length, 'unique images from position', startPosition);
      this.queueJobs(jobs, this.userImageBase64);
      this.maxGeneratedPosition = startPosition + this.BATCH_SIZE - 1;
    } else {
      console.log('[BUFFER] ✅ All positions already cached, no new jobs needed');
    }
  }

  /**
   * Enhanced background generation scheduling
   */
  private scheduleBackgroundGeneration() {
    // Immediate buffer fill
    this.maintainBuffer();

    // Schedule periodic buffer maintenance
    setTimeout(() => {
      if (this.continuousGenerationEnabled) {
        this.scheduleBackgroundGeneration();
      }
    }, this.CONTINUOUS_CHECK_INTERVAL / 2); // More frequent checks
  }

  /**
   * Clear all caches and reset service state
   */
  clearAllCaches() {
    console.log('[LOADING] 🧼 Clearing all caches and resetting state');

    // Clear all caches
    this.imageCache.clear();
    this.preloadedImages.clear();
    this.jobQueue.length = 0;
    this.processing.clear();

    // Reset state
    this.maxGeneratedPosition = 0;
    this.lastScrollPosition = 0;
    this.scrollVelocity = 0;
    this.scrollDirection = 'down';

    // Reset worker stats (keep workers active)
    this.workerStats.forEach(stat => {
      stat.busy = false;
      stat.processed = 0;
      stat.errors = 0;
      stat.avgDuration = 0;
    });

    console.log('[LOADING] ✨ Cache cleared, ready for fresh generation');
  }

  /**
   * Get cache statistics with enhanced buffer info
   */
  getCacheStats() {
    const busyWorkers = Array.from(this.workerStats.values()).filter(w => w.busy).length;
    const currentMaxPosition = Math.max(...Array.from(this.imageCache.keys()), 0);
    const distanceFromEnd = currentMaxPosition - this.lastScrollPosition;

    return {
      queueLength: this.jobQueue.length,
      processing: this.processing.size,
      cached: this.imageCache.size,
      preloaded: this.preloadedImages.size,
      busyWorkers,
      totalWorkers: this.MAX_WORKERS,
      efficiency: busyWorkers / this.MAX_WORKERS,
      // Enhanced buffer stats
      bufferHealth: Math.min(100, (this.imageCache.size / this.BUFFER_TARGET) * 100),
      distanceFromEnd,
      maxGeneratedPosition: this.maxGeneratedPosition,
      continuousEnabled: this.continuousGenerationEnabled,
      // Debug info
      cacheKeys: Array.from(this.imageCache.keys()),
      processingIds: Array.from(this.processing.keys())
    };
  }
}