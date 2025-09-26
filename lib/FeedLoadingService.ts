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
  // 🚨 ULTRATHINK: Enhanced deduplication tracking
  private processingPositions: Set<number> = new Set(); // Track positions being processed
  private positionLocks: Map<number, string> = new Map(); // Track which worker owns which position
  private imageCache: Map<number, GeneratedImage> = new Map();
  private preloadedImages: Set<string> = new Set();
  private workerStats: Map<string, WorkerStats> = new Map();

  // Configuration
  private readonly MAX_WORKERS = 30;
  private readonly PRELOAD_AHEAD = 20;
  private readonly CACHE_BEHIND = 10;
  private readonly MAX_RETRIES = 3;
  private readonly CACHE_SIZE_LIMIT = 100; // Total images to keep in memory (increased for better UX)

  // 🚨 EMERGENCY SYSTEM PROTECTION
  private readonly EMERGENCY_MAX_QUEUE_SIZE = 50; // HARD LIMIT - prevents overflow
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 0.7; // 70% failure rate triggers circuit breaker
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds before retry
  private readonly CIRCUIT_BREAKER_MIN_REQUESTS = 10; // Minimum requests to calculate failure rate

  // Circuit Breaker State
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerLastFailureTime = 0;
  private recentApiRequests: { timestamp: number; success: boolean }[] = [];

  // Continuous Generation Configuration (OPTIMIZED)
  private readonly BUFFER_TARGET = 30; // Reduced from 100 - more reasonable buffer
  private readonly GENERATION_TRIGGER_DISTANCE = 15; // Reduced from 50 - generate only when closer
  private readonly BATCH_SIZE = 5; // Reduced from 20 - smaller batches
  private readonly CONTINUOUS_CHECK_INTERVAL = 15000; // Increased from 5s to 15s - less frequent checks

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
    // Don't start continuous generation immediately - wait for user image
    // this.startContinuousGeneration(); // Disabled to prevent excessive initial loads
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
   * Add jobs to queue with priority system + EMERGENCY OVERFLOW PROTECTION
   */
  queueJobs(jobs: Omit<LoadingJob, 'retries' | 'timestamp'>[], userImageBase64: string) {
    // 🚨 EMERGENCY QUEUE SIZE PROTECTION
    if (this.jobQueue.length >= this.EMERGENCY_MAX_QUEUE_SIZE) {
      console.warn('[LOADING] 🚨 EMERGENCY: Queue overflow detected!', {
        currentSize: this.jobQueue.length,
        maxSize: this.EMERGENCY_MAX_QUEUE_SIZE,
        newJobs: jobs.length
      });

      // Emergency cleanup - keep only critical jobs
      this.emergencyQueueCleanup();

      // Only accept critical jobs during overflow
      jobs = jobs.filter(job => job.priority === 'critical');

      if (jobs.length === 0) {
        console.warn('[LOADING] 🚫 Rejecting non-critical jobs during queue overflow');
        return;
      }
    }

    // 🚨 ULTRATHINK: Enhanced atomic position deduplication with worker-level tracking
    const filteredJobs = jobs.filter(job => {
      // Skip if position already cached
      if (this.imageCache.has(job.position)) {
        console.log(`[DEDUP] ⏭️ Skipping position ${job.position} - already cached`);
        return false;
      }

      // Skip if position is being processed by any worker
      if (this.processingPositions.has(job.position)) {
        const lockingWorker = this.positionLocks.get(job.position);
        console.log(`[DEDUP] ⏭️ Skipping position ${job.position} - being processed by ${lockingWorker || 'unknown worker'}`);
        return false;
      }

      // Skip if position already in queue (fallback check)
      if (this.isPositionInQueue(job.position)) {
        console.log(`[DEDUP] ⏭️ Skipping position ${job.position} - already queued`);
        return false;
      }

      return true;
    });

    if (filteredJobs.length === 0) {
      console.log('[LOADING] ⏭️ All jobs skipped - positions already cached/queued/processing');
      return;
    }

    // 🚨 ULTRATHINK: Enhanced job ID generation with position tracking
    const newJobs: LoadingJob[] = filteredJobs.map((job, index) => {
      const timestamp = Date.now();
      const uniqueId = this.generateEnhancedJobId(job.position, job.priority, timestamp, index);

      return {
        ...job,
        id: uniqueId,
        userImageBase64,
        retries: 0,
        timestamp
      };
    });

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
   * 🚨 ULTRATHINK: Enhanced job ID generation with position and worker tracking
   */
  private generateEnhancedJobId(position: number, priority: 'critical' | 'preload' | 'cache', timestamp: number, batchIndex: number): string {
    // Create ultra-unique ID with multiple entropy sources
    const sessionId = Math.random().toString(36).substring(2, 10); // 8 chars
    const processId = Math.floor(Math.random() * 10000); // 4 digits
    const microTime = performance.now().toString().replace('.', ''); // High-precision timing
    const positionHash = ((position * 37) + (batchIndex * 13)) % 10000; // Position-based uniqueness

    // Format: priority_position_timestamp_session_process_micro_hash
    const jobId = `${priority.charAt(0)}${position}_${timestamp}_${sessionId}_${processId}_${microTime.substring(0, 10)}_${positionHash}`;

    console.log(`[DEDUP] 🆔 Generated enhanced job ID: ${jobId.substring(0, 30)}... for position ${position}`);
    return jobId;
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
   * 🚨 ULTRATHINK: Enhanced worker assignment with position locking
   */
  private async assignJobToWorker(job: LoadingJob, workerId: string) {
    const stats = this.workerStats.get(workerId)!;

    // 🚨 CRITICAL: Lock position before processing to prevent race conditions
    if (this.processingPositions.has(job.position)) {
      const existingWorker = this.positionLocks.get(job.position);
      console.warn(`[DEDUP] ⚠️ Race condition detected! Position ${job.position} already locked by ${existingWorker}, abandoning job ${job.id}`);
      return; // Abandon this job - another worker got there first
    }

    // Acquire position lock
    this.processingPositions.add(job.position);
    this.positionLocks.set(job.position, workerId);

    stats.busy = true;
    this.processing.set(job.id, job);

    const startTime = Date.now();

    console.log(`[WORKER-${workerId}] 🔒 Locked position ${job.position} and processing job ${job.id.substring(0, 20)}... (${job.priority})`);

    try {
      const result = await this.generateImage(job);

      // 🚨 ULTRATHINK: Atomic position check and cache to prevent race conditions
      if (this.imageCache.has(job.position)) {
        const existingImage = this.imageCache.get(job.position)!;
        console.warn('[WORKER] ⚠️ Position already cached by another worker, discarding duplicate:', {
          workerId,
          position: job.position,
          existingId: existingImage.id?.substring(0, 12) || 'undefined',
          newId: result.id?.substring(0, 12) || 'undefined',
          existingTimestamp: existingImage.timestamp,
          newTimestamp: result.timestamp
        });

        // Don't overwrite - first worker wins
        return;
      }

      // Cache the result only if position is still free
      this.imageCache.set(job.position, result);
      console.log('[WORKER] ✅ Cached image at position', job.position, 'ID:', result.id?.substring(0, 12) || 'undefined');

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

      // 🚨 ENHANCED RETRY LOGIC with EXPONENTIAL BACKOFF
      if (job.retries < this.MAX_RETRIES && this.circuitBreakerState !== 'OPEN') {
        job.retries++;

        // Exponential backoff delay: 1s, 2s, 4s, 8s...
        const backoffDelay = Math.min(1000 * Math.pow(2, job.retries - 1), 10000);

        setTimeout(() => {
          this.jobQueue.unshift(job); // Re-queue with higher priority
          console.log(`[WORKER-${workerId}] Retrying job ${job.id} (attempt ${job.retries + 1}) after ${backoffDelay}ms delay`);
        }, backoffDelay);
      } else if (this.circuitBreakerState === 'OPEN') {
        // Generate fallback image when circuit breaker is open
        try {
          const fallbackResult = await this.generateFallbackImage(job);
          this.imageCache.set(job.position, fallbackResult);
          console.log(`[WORKER-${workerId}] Generated fallback for position ${job.position} due to circuit breaker`);
        } catch (fallbackError) {
          console.error(`[WORKER-${workerId}] Failed to generate fallback:`, fallbackError);
        }
      } else {
        console.error(`[WORKER-${workerId}] Max retries exceeded for job ${job.id}`);
      }
    } finally {
      // 🚨 ULTRATHINK: Release position lock when worker finishes (success or failure)
      this.processingPositions.delete(job.position);
      this.positionLocks.delete(job.position);

      stats.busy = false;
      this.processing.delete(job.id);

      console.log(`[WORKER-${workerId}] 🔓 Released position lock ${job.position} and completed job ${job.id.substring(0, 20)}...`);

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
   * Generate image using Rork Toolkit API + CIRCUIT BREAKER PROTECTION
   */
  private async generateImage(job: LoadingJob): Promise<GeneratedImage> {
    // 🚨 CIRCUIT BREAKER CHECK
    if (this.circuitBreakerState === 'OPEN') {
      // Check if we can retry
      if (Date.now() - this.circuitBreakerLastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
        this.circuitBreakerState = 'HALF_OPEN';
        console.log('[CIRCUIT-BREAKER] 🔄 Switching to HALF_OPEN - testing API');
      } else {
        console.warn('[CIRCUIT-BREAKER] 🚫 API blocked - using graceful fallback');
        return this.generateFallbackImage(job);
      }
    }

    const startTime = Date.now();

    try {
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Change the person's outfit to: ${job.prompt}. Keep the person's face and pose. Professional photoshoot setting with clean white or neutral background, studio lighting, full body photo, fashion photography style.`,
          images: [{ type: 'image', image: job.userImageBase64 }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const image = data?.image;

      // Enhanced base64 validation to prevent decoding errors
      let imageUrl: string;
      if (image?.base64Data && image?.mimeType) {
        // Validate base64 data before creating data URI
        try {
          // Check if base64 data is valid by testing first few chars
          const base64Data = image.base64Data.trim();
          if (base64Data.length > 10 && /^[A-Za-z0-9+/=]+$/.test(base64Data)) {
            imageUrl = `data:${image.mimeType};base64,${base64Data}`;
            console.log('[WORKER] ✅ Generated valid base64 image for position', job.position);
          } else {
            throw new Error('Invalid base64 format');
          }
        } catch (error) {
          console.warn('[WORKER] ⚠️ Invalid base64 data received, using placeholder for position', job.position);
          imageUrl = `https://picsum.photos/400/600?random=${Date.now()}`;
        }
      } else {
        console.warn('[WORKER] ⚠️ No image data received, using placeholder for position', job.position);
        imageUrl = `https://picsum.photos/400/600?random=${Date.now()}`;
      }

      // Record successful API call
      this.recordApiRequest(true);

      // If we were in HALF_OPEN, switch back to CLOSED
      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED';
        console.log('[CIRCUIT-BREAKER] ✅ Switched to CLOSED - API recovered');
      }

      return {
        id: job.id,
        imageUrl,
        prompt: job.prompt,
        position: job.position,
        cached: true,
        timestamp: Date.now()
      };

    } catch (error) {
      // Record failed API call
      this.recordApiRequest(false);

      // Check if we should open the circuit breaker
      this.evaluateCircuitBreaker();

      throw error; // Re-throw for retry logic
    }
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

  // 🚨 THROTTLING: Prevent rapid-fire preload triggers (BALANCED)
  private lastPreloadTime = 0;
  private readonly PRELOAD_THROTTLE_MS = 500; // Reduced to 500ms - more responsive for scrolling

  /**
   * Enhanced intelligent preloading with continuous generation awareness + ANTI-OVERFLOW PROTECTION
   */
  private scheduleIntelligentPreload(currentIndex: number) {
    if (!this.userImageBase64) return;

    // 🚨 THROTTLING: Prevent rapid-fire preload triggers that cause overflow
    const now = Date.now();
    if (now - this.lastPreloadTime < this.PRELOAD_THROTTLE_MS) {
      console.log('[PRELOAD] 🚫 Throttled - too soon since last preload');
      return;
    }

    // 🚨 QUEUE PROTECTION: Don't add more jobs if queue is getting full (BALANCED)
    if (this.jobQueue.length > this.EMERGENCY_MAX_QUEUE_SIZE * 0.8) { // Increased to 80% - less restrictive
      console.log('[PRELOAD] 🚫 Skipped - queue too full:', this.jobQueue.length);
      return;
    }

    this.lastPreloadTime = now;

    // Calculate adaptive preload distance based on scroll velocity (REDUCED)
    const velocityMultiplier = Math.min(Math.abs(this.scrollVelocity) * 1.5, 8); // Reduced from 2, 10
    const adaptivePreload = Math.max(this.PRELOAD_AHEAD + velocityMultiplier, 15); // Reduced from 25

    const jobs: Omit<LoadingJob, 'retries' | 'timestamp'>[] = [];

    // Preload ahead (REDUCED RANGE)
    const preloadStart = this.scrollDirection === 'down' ? currentIndex + 2 : Math.max(0, currentIndex - adaptivePreload);
    const preloadEnd = this.scrollDirection === 'down' ? currentIndex + Math.min(adaptivePreload, 15) : currentIndex - 2; // Capped at 15

    for (let pos = preloadStart; pos <= preloadEnd; pos++) {
      if (pos >= 0 && !this.imageCache.has(pos) && !this.isPositionInQueue(pos)) {
        jobs.push({
          id: `preload_${pos}_${now}`,
          prompt: this.getPromptForPosition(pos),
          priority: pos <= currentIndex + 3 ? 'critical' : 'preload', // Reduced critical range from 5 to 3
          position: pos
        });

        // 🚨 HARD LIMIT: Max 12 jobs per preload trigger (balanced for responsiveness)
        if (jobs.length >= 12) break;
      }
    }

    // Cache behind (REDUCED RANGE, lower priority)
    const maxBehindJobs = Math.max(0, 5 - jobs.length); // Max 5 behind jobs, and only if we have room
    for (let pos = Math.max(0, currentIndex - Math.min(this.CACHE_BEHIND, 5)); pos < currentIndex && jobs.length < maxBehindJobs + 8; pos++) {
      if (!this.imageCache.has(pos) && !this.isPositionInQueue(pos)) {
        jobs.push({
          id: `cache_${pos}_${now}`,
          prompt: this.getPromptForPosition(pos),
          priority: 'cache',
          position: pos
        });
      }
    }

    if (jobs.length > 0) {
      console.log('[PRELOAD] 🧠 Scheduling', jobs.length, 'intelligent preload jobs (throttled)');
      this.queueJobs(jobs, this.userImageBase64);
    }

    // Trigger continuous generation check (LESS FREQUENT)
    if (this.continuousGenerationEnabled) {
      setTimeout(() => this.maintainBuffer(), 2000); // Increased from 1000ms to 2000ms
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
   * Enable continuous background generation (OPTIMIZED)
   */
  enableContinuousGeneration(userImageBase64: string) {
    console.log('[LOADING] 🔄 Enabling continuous generation with 30-image buffer (optimized)');
    this.userImageBase64 = userImageBase64;
    this.continuousGenerationEnabled = true;
    // Only start if not already running
    if (!this.backgroundGenerationTimer) {
      this.startContinuousGeneration();
    }
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
   * 🚨 ULTRATHINK: Fixed buffer maintenance with intelligent position management
   */
  private maintainBuffer() {
    const currentMaxPosition = Math.max(...Array.from(this.imageCache.keys()), 0);
    const distanceFromEnd = currentMaxPosition - this.lastScrollPosition;

    // 🚨 CRITICAL: Only generate ahead by reasonable amount
    const reasonableAhead = this.lastScrollPosition + this.BUFFER_TARGET; // Only generate 30 positions ahead
    const actualMaxNeeded = Math.min(this.maxGeneratedPosition, reasonableAhead);

    // Count actual gaps in our cache that need filling
    const gapsNeedingFill = this.countCacheGaps(this.lastScrollPosition, actualMaxNeeded);

    // 🚨 THROTTLE: Don't generate if queue is busy or we have enough ahead
    const queueIsBusy = this.jobQueue.length > 10; // Reduced from 20 - stricter limit
    const hasEnoughAhead = distanceFromEnd > 10; // Reduced from 20 - user has 10+ images ahead
    const hasActiveWorkers = this.processing.size > 5; // Limit active workers

    if (queueIsBusy || (hasEnoughAhead && gapsNeedingFill < 10)) {
      console.log('[LOADING] ⏸️ Skipping buffer maintenance - sufficient content:', {
        distanceFromEnd,
        queueLength: this.jobQueue.length,
        gapsNeedingFill,
        reasonableAhead,
        hasEnoughAhead,
        queueIsBusy
      });
      return;
    }

    // Only generate if we actually need more images
    if (gapsNeedingFill > 0 || distanceFromEnd <= this.GENERATION_TRIGGER_DISTANCE) {
      console.log('[LOADING] 🚀 Buffer maintenance triggered (controlled):', {
        distanceFromEnd,
        bufferSize: this.imageCache.size,
        queueLength: this.jobQueue.length,
        userPosition: this.lastScrollPosition,
        gapsNeedingFill,
        actualMaxNeeded
      });

      this.generateBufferBatch();
    }
  }

  /**
   * Count how many positions between start and end are missing from cache
   */
  private countCacheGaps(startPos: number, endPos: number): number {
    let gaps = 0;
    for (let pos = startPos; pos <= endPos; pos++) {
      if (!this.imageCache.has(pos)) {
        gaps++;
      }
    }
    return gaps;
  }

  /**
   * 🚨 ULTRATHINK: Fixed buffer batch generation with intelligent gap-filling + OVERFLOW PROTECTION
   */
  private generateBufferBatch() {
    if (!this.userImageBase64) return;

    // 🚨 ADDITIONAL QUEUE PROTECTION: Skip if queue is getting full (BALANCED)
    if (this.jobQueue.length > this.EMERGENCY_MAX_QUEUE_SIZE * 0.85) { // Increased to 85% - less restrictive
      console.log('[BUFFER] 🚫 Skipped buffer generation - queue too full:', this.jobQueue.length);
      return;
    }

    const jobs = [];

    // 🚨 PRIORITY: Fill gaps near user first, then generate ahead (REDUCED SCOPE)
    const userPosition = this.lastScrollPosition;
    // 🚨 CRITICAL FIX: Skip positions 0 and 1 - they're reserved for mock images
    const scanStart = Math.max(2, userPosition - 3); // Start from position 2 to preserve mock images
    const scanEnd = userPosition + Math.min(this.BUFFER_TARGET, 20); // Capped at 20

    // First pass: Fill critical gaps near user (STRICTER LIMITS)
    for (let pos = scanStart; pos <= userPosition + 10; pos++) { // Reduced from 20
      if (!this.imageCache.has(pos) && !this.isPositionInQueue(pos)) {
        const uniqueId = `critical_gap_${pos}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const prompt = this.getPromptForPosition(pos);

        jobs.push({
          id: uniqueId,
          prompt,
          priority: 'critical' as const,
          position: pos
        });

        console.log(`[BUFFER] 🚨 Queuing critical gap at position ${pos}`);

        // Much stricter limit to prevent overflow
        if (jobs.length >= 5) break; // Reduced from 10
      }
    }

    // Second pass: Generate ahead (MUCH SMALLER, lower priority)
    if (jobs.length < 2) { // Reduced from 3
      const currentMax = Math.max(...Array.from(this.imageCache.keys()), userPosition);
      const aheadStart = Math.max(currentMax + 1, userPosition + 3); // Reduced from 5
      const aheadEnd = Math.min(aheadStart + 3, scanEnd); // Reduced from 5 - tiny ahead generation

      for (let pos = aheadStart; pos <= aheadEnd; pos++) {
        if (!this.imageCache.has(pos) && !this.isPositionInQueue(pos)) {
          const uniqueId = `buffer_ahead_${pos}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const prompt = this.getPromptForPosition(pos);

          jobs.push({
            id: uniqueId,
            prompt,
            priority: 'cache' as const,
            position: pos
          });

          console.log(`[BUFFER] 📦 Queuing ahead position ${pos}`);

          // Very strict total limit to prevent queue overflow
          if (jobs.length >= 5) break; // Reduced from 8
        }
      }
    }

    if (jobs.length > 0) {
      console.log('[LOADING] 🚀 Generating controlled buffer batch:', jobs.length, 'images (gaps + ahead) - OVERFLOW PROTECTED');
      this.queueJobs(jobs, this.userImageBase64);

      // Update maxGenerated more conservatively
      const maxJobPosition = Math.max(...jobs.map(j => j.position));
      this.maxGeneratedPosition = Math.max(this.maxGeneratedPosition, maxJobPosition);
    } else {
      console.log('[BUFFER] ✅ No gaps found, buffer is sufficient');
    }
  }

  /**
   * 🚨 ULTRATHINK: Enhanced position checking with fast lookup
   */
  private isPositionInQueue(position: number): boolean {
    // Fast check using position tracking sets
    if (this.processingPositions.has(position)) {
      return true; // Position is being processed
    }

    // Fallback: check job queue (should be rare due to enhanced filtering)
    return this.jobQueue.some(job => job.position === position);
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
   * 🚨 ULTRATHINK: Enhanced cache clearing with deduplication tracking reset
   */
  clearAllCaches() {
    console.log('[LOADING] 🧼 Clearing all caches and resetting deduplication state');

    // Clear all caches
    this.imageCache.clear();
    this.preloadedImages.clear();
    this.jobQueue.length = 0;
    this.processing.clear();

    // 🚨 ULTRATHINK: Clear enhanced deduplication tracking
    this.processingPositions.clear();
    this.positionLocks.clear();

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

    console.log('[LOADING] ✨ Cache and deduplication system cleared, ready for fresh generation');
  }

  /**
   * 🚨 ULTRATHINK: Enhanced cache stats with deduplication tracking
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
      // 🚨 ULTRATHINK: Deduplication system stats
      positionsProcessing: this.processingPositions.size,
      positionLocksActive: this.positionLocks.size,
      lockedPositions: Array.from(this.processingPositions),
      workerPositions: Object.fromEntries(this.positionLocks),
      // Debug info
      cacheKeys: Array.from(this.imageCache.keys()),
      processingIds: Array.from(this.processing.keys())
    };
  }

  // ========================================
  // 🚨 EMERGENCY SYSTEM PROTECTION METHODS
  // ========================================

  /**
   * Emergency queue cleanup - removes non-critical jobs when overflowing
   */
  private emergencyQueueCleanup() {
    const originalSize = this.jobQueue.length;

    // Keep only critical jobs
    this.jobQueue = this.jobQueue.filter(job => job.priority === 'critical');

    // If still too many, keep only the most recent critical jobs
    if (this.jobQueue.length > this.EMERGENCY_MAX_QUEUE_SIZE / 2) {
      this.jobQueue = this.jobQueue
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, Math.floor(this.EMERGENCY_MAX_QUEUE_SIZE / 2));
    }

    const removedJobs = originalSize - this.jobQueue.length;
    console.warn('[EMERGENCY] 🧹 Cleaned queue:', {
      originalSize,
      newSize: this.jobQueue.length,
      removedJobs
    });
  }

  /**
   * Record API request result for circuit breaker evaluation
   */
  private recordApiRequest(success: boolean) {
    const now = Date.now();

    // Add the new request
    this.recentApiRequests.push({ timestamp: now, success });

    // Remove old requests (keep last 5 minutes)
    this.recentApiRequests = this.recentApiRequests.filter(
      req => now - req.timestamp < 300000 // 5 minutes
    );
  }

  /**
   * Evaluate if circuit breaker should be opened
   */
  private evaluateCircuitBreaker() {
    if (this.recentApiRequests.length < this.CIRCUIT_BREAKER_MIN_REQUESTS) {
      return; // Not enough data
    }

    const failures = this.recentApiRequests.filter(req => !req.success).length;
    const failureRate = failures / this.recentApiRequests.length;

    if (failureRate >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      this.circuitBreakerState = 'OPEN';
      this.circuitBreakerLastFailureTime = Date.now();

      console.error('[CIRCUIT-BREAKER] 🚨 OPENED - API failure rate:', {
        failureRate: `${(failureRate * 100).toFixed(1)}%`,
        failures,
        total: this.recentApiRequests.length,
        threshold: `${(this.CIRCUIT_BREAKER_FAILURE_THRESHOLD * 100).toFixed(1)}%`
      });

      // Emergency queue cleanup when circuit breaker opens
      this.emergencyQueueCleanup();
    }
  }

  /**
   * Generate fallback image when API is unavailable
   * Creates both outfit and product fallbacks for hybrid feed
   */
  private generateFallbackImage(job: LoadingJob): GeneratedImage | any {
    // Determine if this position should be a product based on hybrid feed pattern
    // Products are injected every 3-4 positions starting at position 4
    const isProductPosition = this.shouldBeProductPosition(job.position);

    if (isProductPosition) {
      return this.generateProductFallback(job);
    } else {
      return this.generateOutfitFallback(job);
    }
  }

  /**
   * Determine if position should show a product (matches FeedProvider logic)
   */
  private shouldBeProductPosition(position: number): boolean {
    if (position < 4) return false; // First 4 are always outfits

    // Check if position matches the product injection pattern (every 3-4 items after position 4)
    for (let pos = 4; pos <= position; pos += (3 + Math.floor(Math.random() * 2))) {
      if (Math.abs(pos - position) <= 1) { // Allow 1 position variance
        return true;
      }
    }

    // Alternative pattern: every 3-4 positions starting from 4
    const distanceFromStart = position - 4;
    if (distanceFromStart >= 0) {
      const cyclePosition = distanceFromStart % 4;
      return cyclePosition === 0 || (cyclePosition === 1 && Math.random() < 0.5);
    }

    return false;
  }

  /**
   * Generate outfit fallback with reliable data URI images
   */
  private generateOutfitFallback(job: LoadingJob): GeneratedImage {
    // Create reliable data URI fallback images instead of picsum.photos
    const fallbackImages = [
      // Gradient outfit placeholder - casual style
      'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22grad1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%23667eea%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%23764ba2%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23grad1)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3ECasual%20Outfit%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EGenerated%20by%20AI%3C/text%3E%3C/svg%3E',
      // Gradient outfit placeholder - business style
      'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22grad2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%234ecdc4%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%2344a08d%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23grad2)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3EBusiness%20Look%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EGenerated%20by%20AI%3C/text%3E%3C/svg%3E',
      // Gradient outfit placeholder - elegant style
      'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22grad3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%23ff7b7b%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%23d63384%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23grad3)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3EEvening%20Wear%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EGenerated%20by%20AI%3C/text%3E%3C/svg%3E',
      // Gradient outfit placeholder - trendy style
      'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22grad4%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%23ffeaa7%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%23fab1a0%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23grad4)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3ETrendy%20Style%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EGenerated%20by%20AI%3C/text%3E%3C/svg%3E'
    ];

    // Select fallback based on position for variety
    const fallbackIndex = job.position % fallbackImages.length;
    const imageUrl = fallbackImages[fallbackIndex];

    console.log('[FALLBACK] 🎨 Generated reliable outfit fallback for position', job.position, 'style:', fallbackIndex);

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
   * Generate reliable product fallback images using data URIs
   */
  private getProductFallbackImage(productId: number, brand: string, category: string, color: string): string {
    // Create SVG-based product images that won't fail to load
    const colorMap: { [key: string]: string } = {
      'Black': '#2d3436',
      'White': '#ddd',
      'Navy': '#2980b9',
      'Grey': '#636e72',
      'Blue': '#3498db',
      'Red': '#e74c3c',
      'Pink': '#fd79a8',
      'Green': '#27ae60'
    };

    const bgColor = colorMap[color] || '#74b9ff';
    const textColor = ['White', 'Grey'].includes(color) ? '#2d3436' : '#ffffff';

    return `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22${encodeURIComponent(bgColor)}%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22240%22%20text-anchor%3D%22middle%22%20fill%3D%22${encodeURIComponent(textColor)}%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%3E${encodeURIComponent(brand)}%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22${encodeURIComponent(textColor)}%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3E${encodeURIComponent(color)}%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22${encodeURIComponent(textColor)}%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3E${encodeURIComponent(category)}%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22380%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(${textColor === '#ffffff' ? '255,255,255' : '45,52,54'},0.7)%22%20font-size%3D%2216%22%3EProduct%20%23${productId}%3C/text%3E%3C/svg%3E`;
  }

  /**
   * Generate product fallback for hybrid feed shopping experience
   */
  private generateProductFallback(job: LoadingJob): any {
    // Generate unique product data
    const productId = Math.abs(job.position * 23 + 47) % 10000;
    const imageId = Math.abs(job.position * 41 + 73) % 1000;

    // Fashion brand names for fallback
    const brands = ['Nike', 'Zara', 'H&M', 'ASOS', 'Uniqlo', 'Forever 21', 'Urban Outfitters', 'Gap'];
    const categories = ['T-Shirts', 'Jeans', 'Sneakers', 'Dresses', 'Jackets', 'Hoodies', 'Tops', 'Pants'];
    const colors = ['Black', 'White', 'Navy', 'Grey', 'Blue', 'Red', 'Pink', 'Green'];
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];

    const brandIndex = productId % brands.length;
    const categoryIndex = (productId + 1) % categories.length;
    const colorIndex = (productId + 2) % colors.length;

    const brand = brands[brandIndex];
    const category = categories[categoryIndex];
    const color = colors[colorIndex];

    // Generate price (in cents)
    const basePrice = (2000 + (productId % 8000)); // $20-100 range
    const isOnSale = (productId % 4) === 0; // 25% on sale
    const salePrice = isOnSale ? Math.floor(basePrice * 0.7) : null;

    console.log('[FALLBACK] 🛍️ Generated product fallback for position', job.position, `(${brand} ${category})`);

    return {
      id: job.id,
      type: 'product', // Critical: marks this as a product entry
      product: {
        id: productId,
        name: `${color} ${category}`,
        description: `Stylish ${color.toLowerCase()} ${category.toLowerCase()} from ${brand}`,
        brand: {
          name: brand,
          logo_url: `https://ui-avatars.com/api/?name=${brand}&size=128&background=667eea&color=ffffff`
        },
        category: {
          name: category,
          slug: category.toLowerCase().replace(/\s+/g, '-')
        },
        base_price: basePrice,
        sale_price: salePrice,
        currency: 'USD',
        mainImage: this.getProductFallbackImage(productId, brand, category, color),
        images: [
          {
            id: 1,
            original_url: this.getProductFallbackImage(productId, brand, category, color),
            alt: `${brand} ${color} ${category}`
          }
        ],
        variants: [
          {
            id: 1,
            color: color,
            size: sizes[productId % sizes.length],
            current_price: basePrice,
            sale_price: salePrice,
            stock_quantity: 10 + (productId % 20),
            is_available: true
          }
        ],
        availableSizes: sizes,
        availableColors: [color],
        tags: ['trendy', 'popular', 'fallback'],
        isOnSale: isOnSale,
        popularity_score: 50 + (productId % 50),
        url: `https://example.com/products/${productId}`
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get circuit breaker status for debugging
   */
  getSystemHealth() {
    const recentRequests = this.recentApiRequests.length;
    const recentFailures = this.recentApiRequests.filter(req => !req.success).length;
    const failureRate = recentRequests > 0 ? (recentFailures / recentRequests) : 0;

    return {
      circuitBreakerState: this.circuitBreakerState,
      queueSize: this.jobQueue.length,
      maxQueueSize: this.EMERGENCY_MAX_QUEUE_SIZE,
      queueHealth: `${((1 - (this.jobQueue.length / this.EMERGENCY_MAX_QUEUE_SIZE)) * 100).toFixed(1)}%`,
      apiFailureRate: `${(failureRate * 100).toFixed(1)}%`,
      recentRequests,
      recentFailures,
      lastFailureTime: this.circuitBreakerLastFailureTime ? new Date(this.circuitBreakerLastFailureTime).toISOString() : null
    };
  }
}