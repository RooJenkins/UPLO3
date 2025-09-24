import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { FeedLoadingService, GeneratedImage } from '@/lib/FeedLoadingService';

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
const INITIAL_FEED: FeedEntry[] = [
  {
    id: 'mock-1',
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=600&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
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

  // State management
  const [feed, setFeed] = useState<FeedEntry[]>(INITIAL_FEED);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [loadingStats, setLoadingStats] = useState<any>({});
  const [scrollVelocity, setScrollVelocity] = useState(0);

  // Scroll tracking for intelligent preloading
  const lastScrollTime = useRef<number>(Date.now());
  const lastScrollIndex = useRef<number>(0);

  // Update feed with cached images
  const updateFeedFromCache = useCallback(() => {
    const newFeed = [...INITIAL_FEED];
    const stats = loadingService.getCacheStats();

    // Add cached images to feed
    for (let i = 2; i < 50; i++) { // Start after initial mock images
      const cachedImage = loadingService.getImage(i);
      if (cachedImage) {
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
        newFeed[i] = feedEntry;
      }
    }

    setFeed(newFeed);
    setLoadingStats(stats);
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

  // Initialize with intelligent preloading
  const initializeIntelligentFeed = useCallback((userImageBase64: string) => {
    if (hasInitialized) return;

    console.log('[FEED] 🚀 Initializing intelligent loading with 10 parallel workers');
    setHasInitialized(true);

    // Create initial jobs with priority system
    const initialJobs = [
      // Critical - immediately visible
      { id: 'init_0', prompt: 'casual summer outfit', priority: 'critical' as const, position: 2 },
      { id: 'init_1', prompt: 'business professional attire', priority: 'critical' as const, position: 3 },
      { id: 'init_2', prompt: 'trendy streetwear look', priority: 'critical' as const, position: 4 },

      // High priority preload
      { id: 'init_3', prompt: 'elegant evening wear', priority: 'preload' as const, position: 5 },
      { id: 'init_4', prompt: 'cozy weekend outfit', priority: 'preload' as const, position: 6 },
      { id: 'init_5', prompt: 'vintage inspired outfit', priority: 'preload' as const, position: 7 },
      { id: 'init_6', prompt: 'athletic wear ensemble', priority: 'preload' as const, position: 8 },
      { id: 'init_7', prompt: 'minimalist chic style', priority: 'preload' as const, position: 9 },

      // Background cache
      { id: 'init_8', prompt: 'bohemian fashion look', priority: 'cache' as const, position: 10 },
      { id: 'init_9', prompt: 'smart casual attire', priority: 'cache' as const, position: 11 },
      { id: 'init_10', prompt: 'formal dinner outfit', priority: 'cache' as const, position: 12 },
      { id: 'init_11', prompt: 'beach vacation style', priority: 'cache' as const, position: 13 },
      { id: 'init_12', prompt: 'urban explorer look', priority: 'cache' as const, position: 14 },
      { id: 'init_13', prompt: 'romantic date night', priority: 'cache' as const, position: 15 },
      { id: 'init_14', prompt: 'creative artist vibe', priority: 'cache' as const, position: 16 },
    ];

    // Queue all jobs for parallel processing
    loadingService.queueJobs(initialJobs, userImageBase64);

    // Set up continuous cache updating
    const updateInterval = setInterval(() => {
      updateFeedFromCache();
    }, 1000);

    // Cleanup interval after initialization
    setTimeout(() => clearInterval(updateInterval), 30000);
  }, [hasInitialized, loadingService, updateFeedFromCache]);

  // Smart preloading based on scroll patterns
  const triggerSmartPreload = useCallback((userImageBase64: string) => {
    if (!hasInitialized) return;

    // Generate jobs for positions that aren't cached yet
    const jobs = [];
    const currentStats = loadingService.getCacheStats();

    // Adaptive preloading based on scroll velocity
    const velocityMultiplier = Math.min(Math.abs(scrollVelocity) * 2, 10);
    const preloadDistance = 20 + velocityMultiplier;

    for (let i = currentIndex + 5; i < currentIndex + preloadDistance; i++) {
      if (!loadingService.getImage(i)) {
        jobs.push({
          id: `smart_${i}`,
          prompt: getSmartPrompt(i),
          priority: i < currentIndex + 10 ? 'preload' as const : 'cache' as const,
          position: i
        });
      }
    }

    if (jobs.length > 0) {
      console.log('[FEED] 🧠 Smart preloading', jobs.length, 'images based on scroll velocity:', scrollVelocity.toFixed(2));
      loadingService.queueJobs(jobs, userImageBase64);
    }
  }, [hasInitialized, loadingService, currentIndex, scrollVelocity]);

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
    // Advanced features
    loadingStats,
    scrollVelocity,
    workerStats: loadingService.getWorkerStats(),
  };
});