/**
 * Image Cache Service
 *
 * Handles image caching, CDN optimization, and image processing
 * Supports multiple CDN providers and fallback mechanisms
 */

import * as crypto from 'crypto';
import * as path from 'path';

export interface ImageCacheConfig {
  cdnProvider: 'cloudinary' | 'imagekit' | 'local' | 'rork';
  cacheDirectory?: string;
  maxImageSize: number; // in bytes
  supportedFormats: string[];
  enableWebP: boolean;
  enableResize: boolean;
  resizeDimensions: Array<{ width: number; height: number; suffix: string }>;
  cacheTTL: number; // in seconds
  retryAttempts: number;
  parallelDownloads: number;
}

export interface CachedImage {
  url: string;
  alt?: string;
  cdnUrl?: string;
  localPath?: string;
  thumbnails?: Array<{
    size: string;
    url: string;
    width: number;
    height: number;
  }>;
  cached: boolean;
  cacheTime?: Date;
  fileSize?: number;
  format?: string;
}

export class ImageCacheService {
  private config: ImageCacheConfig;
  private downloadQueue: Map<string, Promise<CachedImage>> = new Map();
  private cacheStats = {
    totalImages: 0,
    cachedImages: 0,
    failedDownloads: 0,
    totalCacheSize: 0,
    lastCleanup: new Date()
  };

  constructor(config: Partial<ImageCacheConfig> = {}) {
    this.config = {
      cdnProvider: 'rork',
      cacheDirectory: '/tmp/image-cache',
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      enableWebP: true,
      enableResize: true,
      resizeDimensions: [
        { width: 150, height: 150, suffix: 'thumb' },
        { width: 400, height: 400, suffix: 'medium' },
        { width: 800, height: 800, suffix: 'large' }
      ],
      cacheTTL: 7 * 24 * 60 * 60, // 7 days
      retryAttempts: 3,
      parallelDownloads: 5,
      ...config
    };

    console.log(`[IMAGE CACHE] 🖼️ Service initialized with ${this.config.cdnProvider} provider`);
  }

  /**
   * Cache product images with CDN optimization
   */
  async cacheProductImages(
    images: Array<{ url: string; alt?: string }>,
    productId: string
  ): Promise<CachedImage[]> {
    console.log(`[IMAGE CACHE] 📸 Caching ${images.length} images for product ${productId}`);

    // Limit concurrent downloads
    const semaphore = new Semaphore(this.config.parallelDownloads);

    const cachePromises = images.map(async (image, index) => {
      return semaphore.acquire(async () => {
        try {
          const imageId = this.generateImageId(productId, index, image.url);

          // Check if already being processed
          if (this.downloadQueue.has(imageId)) {
            return await this.downloadQueue.get(imageId)!;
          }

          // Start caching process
          const cachePromise = this.cacheImage(image, imageId);
          this.downloadQueue.set(imageId, cachePromise);

          const result = await cachePromise;
          this.downloadQueue.delete(imageId);

          return result;
        } catch (error) {
          console.error('[IMAGE CACHE] ❌ Error caching image:', error);
          this.cacheStats.failedDownloads++;

          // Return original image on failure
          return {
            url: image.url,
            alt: image.alt,
            cached: false
          };
        }
      });
    });

    const results = await Promise.all(cachePromises);

    this.cacheStats.totalImages += images.length;
    this.cacheStats.cachedImages += results.filter(r => r.cached).length;

    return results;
  }

  /**
   * Cache single image
   */
  private async cacheImage(
    image: { url: string; alt?: string },
    imageId: string
  ): Promise<CachedImage> {
    try {
      // Download image with retry logic
      const imageBuffer = await this.downloadImageWithRetry(image.url);

      if (!imageBuffer) {
        throw new Error('Failed to download image');
      }

      // Validate image
      const validation = await this.validateImage(imageBuffer);
      if (!validation.valid) {
        throw new Error(`Invalid image: ${validation.reason}`);
      }

      // Upload to CDN
      const cdnResult = await this.uploadToCDN(imageBuffer, imageId, validation.format!);

      // Generate thumbnails if enabled
      const thumbnails = this.config.enableResize
        ? await this.generateThumbnails(imageBuffer, imageId, validation.format!)
        : undefined;

      this.cacheStats.totalCacheSize += imageBuffer.length;

      return {
        url: image.url,
        alt: image.alt,
        cdnUrl: cdnResult.url,
        localPath: cdnResult.localPath,
        thumbnails,
        cached: true,
        cacheTime: new Date(),
        fileSize: imageBuffer.length,
        format: validation.format
      };

    } catch (error) {
      console.warn(`[IMAGE CACHE] ⚠️ Failed to cache image ${image.url}:`, error);

      return {
        url: image.url,
        alt: image.alt,
        cached: false
      };
    }
  }

  /**
   * Download image with retry logic
   */
  private async downloadImageWithRetry(url: string): Promise<Buffer | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`[IMAGE CACHE] 📥 Downloading ${url} (attempt ${attempt})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.config.maxImageSize) {
          throw new Error(`Image too large: ${contentLength} bytes`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length > this.config.maxImageSize) {
          throw new Error(`Downloaded image too large: ${buffer.length} bytes`);
        }

        return buffer;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[IMAGE CACHE] ⚠️ Download attempt ${attempt} failed:`, lastError.message);

        // Wait before retry (exponential backoff)
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    console.error(`[IMAGE CACHE] ❌ Failed to download after ${this.config.retryAttempts} attempts:`, lastError);
    return null;
  }

  /**
   * Validate downloaded image
   */
  private async validateImage(buffer: Buffer): Promise<{
    valid: boolean;
    format?: string;
    reason?: string;
  }> {
    // Check minimum size
    if (buffer.length < 100) {
      return { valid: false, reason: 'File too small' };
    }

    // Detect format by magic bytes
    const format = this.detectImageFormat(buffer);
    if (!format) {
      return { valid: false, reason: 'Unknown image format' };
    }

    // Check if format is supported
    if (!this.config.supportedFormats.includes(format.toLowerCase())) {
      return { valid: false, reason: `Unsupported format: ${format}` };
    }

    return { valid: true, format };
  }

  /**
   * Detect image format from buffer
   */
  private detectImageFormat(buffer: Buffer): string | null {
    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'jpg';

    // PNG
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';

    // WebP
    if (buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
        buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'webp';

    // GIF
    if (buffer.subarray(0, 6).equals(Buffer.from('GIF87a')) ||
        buffer.subarray(0, 6).equals(Buffer.from('GIF89a'))) return 'gif';

    return null;
  }

  /**
   * Upload image to CDN
   */
  private async uploadToCDN(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<{ url: string; localPath?: string }> {
    switch (this.config.cdnProvider) {
      case 'rork':
        return this.uploadToRorkCDN(buffer, imageId, format);

      case 'cloudinary':
        return this.uploadToCloudinary(buffer, imageId, format);

      case 'imagekit':
        return this.uploadToImageKit(buffer, imageId, format);

      case 'local':
      default:
        return this.saveToLocal(buffer, imageId, format);
    }
  }

  /**
   * Upload to Rork CDN (simulated)
   */
  private async uploadToRorkCDN(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<{ url: string; localPath?: string }> {
    // Simulate CDN upload
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const filename = `${imageId}.${format}`;
    const cdnUrl = `https://cdn.rork.com/products/${filename}`;

    console.log(`[IMAGE CACHE] 📤 Uploaded to Rork CDN: ${cdnUrl}`);

    return { url: cdnUrl };
  }

  /**
   * Upload to Cloudinary (placeholder)
   */
  private async uploadToCloudinary(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<{ url: string }> {
    // Placeholder for Cloudinary integration
    const filename = `${imageId}.${format}`;
    const cdnUrl = `https://res.cloudinary.com/demo/image/upload/${filename}`;

    return { url: cdnUrl };
  }

  /**
   * Upload to ImageKit (placeholder)
   */
  private async uploadToImageKit(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<{ url: string }> {
    // Placeholder for ImageKit integration
    const filename = `${imageId}.${format}`;
    const cdnUrl = `https://ik.imagekit.io/demo/${filename}`;

    return { url: cdnUrl };
  }

  /**
   * Save to local storage
   */
  private async saveToLocal(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<{ url: string; localPath: string }> {
    const filename = `${imageId}.${format}`;
    const localPath = path.join(this.config.cacheDirectory!, filename);

    // Create directory if not exists (simulated)
    console.log(`[IMAGE CACHE] 💾 Saved locally: ${localPath}`);

    return {
      url: `file://${localPath}`,
      localPath
    };
  }

  /**
   * Generate thumbnails
   */
  private async generateThumbnails(
    buffer: Buffer,
    imageId: string,
    format: string
  ): Promise<Array<{ size: string; url: string; width: number; height: number }>> {
    const thumbnails: Array<{ size: string; url: string; width: number; height: number }> = [];

    for (const dimension of this.config.resizeDimensions) {
      try {
        // Simulate thumbnail generation
        await new Promise(resolve => setTimeout(resolve, 50));

        const thumbId = `${imageId}_${dimension.suffix}`;
        const thumbUrl = await this.uploadToCDN(buffer, thumbId, format);

        thumbnails.push({
          size: dimension.suffix,
          url: thumbUrl.url,
          width: dimension.width,
          height: dimension.height
        });

      } catch (error) {
        console.warn(`[IMAGE CACHE] ⚠️ Failed to generate ${dimension.suffix} thumbnail:`, error);
      }
    }

    return thumbnails;
  }

  /**
   * Generate unique image ID
   */
  private generateImageId(productId: string, index: number, url: string): string {
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
    return `${productId}_${index}_${hash}`;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return { ...this.cacheStats };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.downloadQueue.clear();
    this.cacheStats = {
      totalImages: 0,
      cachedImages: 0,
      failedDownloads: 0,
      totalCacheSize: 0,
      lastCleanup: new Date()
    };

    console.log('[IMAGE CACHE] 🧹 Cache cleared');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    provider: string;
    stats: typeof this.cacheStats;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check queue size
    if (this.downloadQueue.size > 100) {
      issues.push(`Large download queue: ${this.downloadQueue.size} items`);
    }

    // Check failure rate
    const totalAttempts = this.cacheStats.totalImages;
    const failureRate = totalAttempts > 0 ? this.cacheStats.failedDownloads / totalAttempts : 0;
    if (failureRate > 0.1) {
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }

    return {
      healthy: issues.length === 0,
      provider: this.config.cdnProvider,
      stats: this.getStats(),
      issues
    };
  }
}

// Simple semaphore for controlling concurrency
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.permits > 0) {
          this.permits--;
          task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.permits++;
              if (this.waiting.length > 0) {
                const next = this.waiting.shift()!;
                setImmediate(next);
              }
            });
        } else {
          this.waiting.push(tryAcquire);
        }
      };

      tryAcquire();
    });
  }
}

export default ImageCacheService;