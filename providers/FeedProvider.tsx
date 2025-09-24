import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { FeedLoadingService, GeneratedImage } from '@/lib/FeedLoadingService';
import { useUser } from '@/providers/UserProvider';

export interface OutfitItem {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  buyUrl?: string;
}

export interface FeedEntry {
  id: string;
  imageUrl: string;
  prompt: string;
  outfitId: string;
  items: OutfitItem[];
  metadata: {
    style: string;
    occasion: string;
    season: string;
    colors: string[];
  };
  timestamp: number;
}

// Simple mock data for immediate display
// Reliable embedded base64 mock images - always load successfully
const MOCK_IMAGE_1 = 'data:image/svg+xml;base64,' + btoa(`
<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#grad1)"/>
  <text x="200" y="280" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">Casual Outfit</text>
  <text x="200" y="320" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" opacity="0.8">Loading AI...</text>
</svg>
`);

const MOCK_IMAGE_2 = 'data:image/svg+xml;base64,' + btoa(`
<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4ecdc4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#44a08d;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#grad2)"/>
  <text x="200" y="280" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">Business Outfit</text>
  <text x="200" y="320" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" opacity="0.8">Loading AI...</text>
</svg>
`);

const INITIAL_FEED: FeedEntry[] = [
  {
    id: 'mock-1',
    imageUrl: MOCK_IMAGE_1,
    prompt: 'Casual everyday outfit',
    outfitId: 'mock-outfit-1',
    items: [
      { id: '1', name: 'White T-Shirt', brand: 'Uniqlo', price: '$19.90', category: 'tops' },
      { id: '2', name: 'Blue Jeans', brand: 'Levi\'s', price: '$89.50', category: 'bottoms' },
    ],
    metadata: {
      style: 'casual',
      occasion: 'everyday',
      season: 'all',
      colors: ['white', 'blue'],
    },
    timestamp: Date.now() - 1000,
  },
  {
    id: 'mock-2',
    imageUrl: MOCK_IMAGE_2,
    prompt: 'Business casual outfit',
    outfitId: 'mock-outfit-2',
    items: [
      { id: '3', name: 'Blazer', brand: 'Zara', price: '$129.00', category: 'outerwear' },
      { id: '4', name: 'Dress Shirt', brand: 'H&M', price: '$39.99', category: 'tops' },
    ],
    metadata: {
      style: 'business',
      occasion: 'work',
      season: 'all',
      colors: ['navy', 'white'],
    },
    timestamp: Date.now() - 2000,
  },
];

export const [FeedProvider, useFeed] = createContextHook(() => {
  // Advanced loading service
  const loadingService = useRef<FeedLoadingService>(new FeedLoadingService()).current;

  // Get user image from UserProvider
  const { userImage } = useUser();

  // State management
  const [feed, setFeed] = useState<FeedEntry[]>(INITIAL_FEED);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [loadingStats, setLoadingStats] = useState<any>({});
  const [scrollVelocity, setScrollVelocity] = useState(0);

  // Scroll tracking for intelligent preloading
  const lastScrollTime = useRef<number>(Date.now());
  const lastScrollIndex = useRef<number>(0);

  // Enhanced feed update with infinite scroll support
  const updateFeedFromCache = useCallback(() => {
    setFeed(currentFeed => {
      const stats = loadingService.getCacheStats();
      setLoadingStats(stats);

      // Start with existing feed - NEVER replace existing entries
      const updatedFeed = [...currentFeed];
      let hasNewImages = false;

      // Get actual cached positions to avoid duplicates
      const cacheStats = loadingService.getCacheStats();
      const actualCachedPositions = [];
      for (let pos = 2; pos < 200; pos++) { // Scan more positions
        if (loadingService.getImage(pos)) {
          actualCachedPositions.push(pos);
        }
      }

      const maxAvailablePosition = actualCachedPositions.length > 0 ? Math.max(...actualCachedPositions) : 2;
      const scanLimit = Math.max(100, maxAvailablePosition + 30); // Larger scan range for infinite scroll

      console.log('[FEED] 🔍 Cache scan:', {
        cachedPositions: actualCachedPositions.length,
        maxPosition: maxAvailablePosition,
        scanLimit,
        statsReported: cacheStats.cached
      });

      // Only add new cached images to empty positions
      for (let i = 2; i < scanLimit; i++) { // Start after initial mock images
        const cachedImage = loadingService.getImage(i);

        // Only add if we don't already have an image at this position AND it's a valid cached image
        if (cachedImage && (i >= updatedFeed.length || !updatedFeed[i])) {
          // Validate the cached image is unique
          const isDuplicate = updatedFeed.some(entry =>
            entry && entry.imageUrl === cachedImage.imageUrl
          );

          if (isDuplicate) {
            console.warn('[FEED] ⚠️ Skipping duplicate image at position', i, 'ID:', cachedImage.id.substring(0, 12));
            continue;
          }
          const feedEntry: FeedEntry = {
            id: cachedImage.id,
            imageUrl: cachedImage.imageUrl,
            prompt: cachedImage.prompt,
            outfitId: `outfit_${cachedImage.id}`,
            items: [
              { id: '1', name: 'AI Generated Top', brand: 'AI Fashion', price: '$29.99', category: 'tops' },
              { id: '2', name: 'AI Generated Bottom', brand: 'AI Fashion', price: '$59.99', category: 'bottoms' },
            ],
            metadata: {
              style: 'generated',
              occasion: 'ai-created',
              season: 'all',
              colors: ['auto']
            },
            timestamp: cachedImage.timestamp,
          };

          // Extend array if needed
          while (updatedFeed.length <= i) {
            updatedFeed.push(undefined as any);
          }
          updatedFeed[i] = feedEntry;
          hasNewImages = true;
        }
      }

      // Only return new array if we actually added images (prevents unnecessary re-renders)
      if (hasNewImages) {
        const filteredFeed = updatedFeed.filter(Boolean);

        // Validate no duplicate images in feed
        const imageUrls = new Set();
        let duplicateCount = 0;
        filteredFeed.forEach((entry, index) => {
          if (entry && imageUrls.has(entry.imageUrl)) {
            duplicateCount++;
            console.warn(`[FEED] 😱 Duplicate detected at index ${index}:`, entry.id?.substring(0, 12));
          }
          if (entry) imageUrls.add(entry.imageUrl);
        });

        console.log('[FEED] 📦 Feed updated:', {
          totalImages: filteredFeed.length,
          uniqueImages: imageUrls.size,
          duplicatesRemoved: duplicateCount,
          bufferHealth: stats.bufferHealth?.toFixed(1) + '%',
          newImagesAdded: hasNewImages
        });
        return filteredFeed;
      }
      return currentFeed;
    });
  }, [loadingService]);

  // Enhanced scroll tracking with velocity calculation
  const updateScrollPosition = useCallback((newIndex: number) => {
    const now = Date.now();
    const timeDelta = now - lastScrollTime.current;
    const indexDelta = newIndex - lastScrollIndex.current;

    // Calculate scroll velocity (items per second)
    const velocity = timeDelta > 0 ? (indexDelta / timeDelta) * 1000 : 0;
    setScrollVelocity(velocity);

    // Update loading service with scroll data
    loadingService.updateScrollPosition(newIndex, velocity);

    // Update tracking refs
    lastScrollTime.current = now;
    lastScrollIndex.current = newIndex;

    setCurrentIndex(newIndex);

    // Update feed from cache
    setTimeout(updateFeedFromCache, 100);
  }, [loadingService, updateFeedFromCache]);

  // Initialize with intelligent preloading and continuous generation
  const initializeIntelligentFeed = useCallback((userImageBase64: string) => {
    if (hasInitialized) return;

    console.log('[FEED] 🚀 Initializing intelligent loading with 10 parallel workers + continuous generation');
    setHasInitialized(true);

    // Enable continuous generation for 100-image buffer
    loadingService.enableContinuousGeneration(userImageBase64);

    const timestamp = Date.now();
    const sessionId = Math.random().toString(36).substring(2, 9);

    // Create initial jobs with unique IDs and varied prompts
    const initialJobs = [
      // Critical - immediately visible
      { id: `init_${timestamp}_${sessionId}_0`, prompt: getSmartPrompt(2), priority: 'critical' as const, position: 2 },
      { id: `init_${timestamp}_${sessionId}_1`, prompt: getSmartPrompt(3), priority: 'critical' as const, position: 3 },
      { id: `init_${timestamp}_${sessionId}_2`, prompt: getSmartPrompt(4), priority: 'critical' as const, position: 4 },

      // High priority preload
      { id: `init_${timestamp}_${sessionId}_3`, prompt: getSmartPrompt(5), priority: 'preload' as const, position: 5 },
      { id: `init_${timestamp}_${sessionId}_4`, prompt: getSmartPrompt(6), priority: 'preload' as const, position: 6 },
      { id: `init_${timestamp}_${sessionId}_5`, prompt: getSmartPrompt(7), priority: 'preload' as const, position: 7 },
      { id: `init_${timestamp}_${sessionId}_6`, prompt: getSmartPrompt(8), priority: 'preload' as const, position: 8 },
      { id: `init_${timestamp}_${sessionId}_7`, prompt: getSmartPrompt(9), priority: 'preload' as const, position: 9 },

      // Background cache
      { id: `init_${timestamp}_${sessionId}_8`, prompt: getSmartPrompt(10), priority: 'cache' as const, position: 10 },
      { id: `init_${timestamp}_${sessionId}_9`, prompt: getSmartPrompt(11), priority: 'cache' as const, position: 11 },
      { id: `init_${timestamp}_${sessionId}_10`, prompt: getSmartPrompt(12), priority: 'cache' as const, position: 12 },
      { id: `init_${timestamp}_${sessionId}_11`, prompt: getSmartPrompt(13), priority: 'cache' as const, position: 13 },
      { id: `init_${timestamp}_${sessionId}_12`, prompt: getSmartPrompt(14), priority: 'cache' as const, position: 14 },
      { id: `init_${timestamp}_${sessionId}_13`, prompt: getSmartPrompt(15), priority: 'cache' as const, position: 15 },
      { id: `init_${timestamp}_${sessionId}_14`, prompt: getSmartPrompt(16), priority: 'cache' as const, position: 16 },
    ];

    console.log('[FEED] 🎯 Generated', initialJobs.length, 'unique initialization jobs with session ID:', sessionId);

    // Queue all jobs for parallel processing
    loadingService.queueJobs(initialJobs, userImageBase64);

    // Set up enhanced continuous cache updating for infinite scroll
    const updateInterval = setInterval(() => {
      updateFeedFromCache();
    }, 2000); // Longer interval since we have continuous generation

    // Don't clean up interval - keep running for infinite scroll
    // The continuous generation system will handle buffer maintenance
  }, [hasInitialized, loadingService, updateFeedFromCache]);

  // Enhanced smart preloading with continuous generation
  const triggerSmartPreload = useCallback((userImageBase64: string) => {
    if (!hasInitialized) return;

    const currentStats = loadingService.getCacheStats();

    console.log('[FEED] 🧠 Smart preload triggered:', {
      scrollVelocity: scrollVelocity.toFixed(2),
      bufferHealth: currentStats.bufferHealth?.toFixed(1) + '%',
      distanceFromEnd: currentStats.distanceFromEnd,
      cached: currentStats.cached
    });

    // Generate unique critical jobs for immediate positions
    const jobs = [];
    const timestamp = Date.now();
    const batchId = Math.random().toString(36).substring(2, 9);

    for (let i = currentIndex + 1; i <= currentIndex + 5; i++) {
      if (!loadingService.getImage(i)) {
        const uniqueId = `critical_${timestamp}_${batchId}_${i}`;
        jobs.push({
          id: uniqueId,
          prompt: getSmartPrompt(i),
          priority: 'critical' as const,
          position: i
        });
        console.log(`[FEED] ⚡ Queuing critical position ${i} with ID: ${uniqueId.substring(0, 25)}...`);
      }
    }

    if (jobs.length > 0) {
      console.log('[FEED] ⚡ Queueing', jobs.length, 'critical positions for immediate processing');
      loadingService.queueJobs(jobs, userImageBase64);
    }

    // Trigger buffer maintenance
    setTimeout(updateFeedFromCache, 500);
  }, [hasInitialized, loadingService, currentIndex, scrollVelocity, updateFeedFromCache]);

  // Get smart prompt based on position and user patterns
  const getSmartPrompt = useCallback((position: number): string => {
    const prompts = [
      'casual summer outfit', 'business professional attire', 'trendy streetwear look',
      'elegant evening wear', 'cozy weekend outfit', 'vintage inspired outfit',
      'athletic wear ensemble', 'minimalist chic style', 'bohemian fashion look',
      'smart casual attire', 'formal dinner outfit', 'beach vacation style',
      'urban explorer look', 'romantic date night', 'creative artist vibe',
      'power lunch ensemble', 'festival fashion', 'winter cozy layers',
      'spring fresh style', 'autumn earth tones', 'gothic alternative',
      'preppy collegiate', 'edgy punk rock', 'sophisticated luxury',
      'comfort loungewear', 'adventure outdoor', 'artistic bohemian',
      'retro vintage', 'futuristic modern', 'classic timeless'
    ];

    return prompts[position % prompts.length];
  }, []);

  // Initialize loading when user image becomes available
  useEffect(() => {
    console.log('[FEED] 🔍 useEffect triggered:', {
      hasUserImage: !!userImage,
      hasBase64: !!userImage?.base64,
      feedLength: feed.length,
      userImageId: userImage?.id,
      hasInitialized
    });

    if (userImage?.base64) {
      console.log('[FEED] ✅ UserImage with base64 available, initializing feed...');
      if (!hasInitialized) {
        console.log('[FEED] 🚀 Starting initial feed generation');
        initializeIntelligentFeed(userImage.base64);
      } else {
        console.log('[FEED] 🔄 Processing queue for existing feed');
        triggerSmartPreload(userImage.base64);
      }
    } else {
      console.log('[FEED] ❌ UserImage or base64 not available:', {
        userImage: !!userImage,
        base64: userImage?.base64 ? 'exists' : 'missing'
      });
    }
  }, [userImage, hasInitialized, initializeIntelligentFeed, triggerSmartPreload]);

  // Performance monitoring
  useEffect(() => {
    const monitoringInterval = setInterval(() => {
      const stats = loadingService.getCacheStats();
      setLoadingStats(stats);

      if (stats.efficiency > 0.8) {
        console.log('[FEED] ⚡ High efficiency:', (stats.efficiency * 100).toFixed(1) + '%');
      }
    }, 2000);

    return () => clearInterval(monitoringInterval);
  }, [loadingService]);

  return {
    feed,
    currentIndex,
    setCurrentIndex: updateScrollPosition,
    isLoading: false,
    isGenerating: loadingStats.processing > 0,
    generateOutfit: () => {}, // Deprecated - using advanced system
    queueGeneration: () => {}, // Deprecated
    processQueue: triggerSmartPreload,
    generateInitialFeed: initializeIntelligentFeed,
    preloadNextOutfits: triggerSmartPreload,
    generationQueue: [],
    preloadedUrls: new Set(),
    cloudSyncStatus: {
      isLoading: loadingStats.processing > 0,
      isError: false,
      error: null,
    },
    // Advanced features with continuous generation
    loadingStats,
    scrollVelocity,
    workerStats: loadingService.getWorkerStats(),

    // Continuous generation status
    bufferHealth: loadingStats?.bufferHealth || 0,
    distanceFromEnd: loadingStats?.distanceFromEnd || 0,
    continuousEnabled: loadingStats?.continuousEnabled || false,

    // Debug and reset functions
    resetLoadingService: () => {
      console.log('[FEED] 🔄 Resetting loading service and clearing all caches');
      loadingService.clearAllCaches();
      setFeed(INITIAL_FEED); // Reset to initial mock data
      setCurrentIndex(0);
      setHasInitialized(false);
      console.log('[FEED] ✨ Ready for fresh start');
    },
  };
});