import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { FeedLoadingService, GeneratedImage } from '@/lib/FeedLoadingService';
import { useUser } from '@/providers/UserProvider';
import { ProductFeedEntry } from '@/components/ProductFeedCard';

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
  type?: 'outfit'; // Default type for AI outfits
}

// Union type for all feed content
export type HybridFeedEntry = FeedEntry | ProductFeedEntry;

// Simple mock data for immediate display using ultra-reliable data URIs
// These will NEVER fail to load since they're embedded directly
const MOCK_IMAGE_1 = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22mockGrad1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%23667eea%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%23764ba2%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23mockGrad1)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2228%22%20font-weight%3D%22bold%22%3ECasual%20Style%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22330%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.9)%22%20font-size%3D%2218%22%3EExample%20Outfit%20%231%3C/text%3E%3C/svg%3E';
const MOCK_IMAGE_2 = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22mockGrad2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20style%3D%22stop-color%3A%234ecdc4%3Bstop-opacity%3A1%22%20/%3E%3Cstop%20offset%3D%22100%25%22%20style%3D%22stop-color%3A%2344a08d%3Bstop-opacity%3A1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22url(%23mockGrad2)%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2228%22%20font-weight%3D%22bold%22%3EBusiness%20Look%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22330%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.9)%22%20font-size%3D%2218%22%3EExample%20Outfit%20%232%3C/text%3E%3C/svg%3E';

// Fallback to simple data URIs if external fails
const FALLBACK_IMAGE_1 = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%23667eea%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22300%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%3ECasual%3C/text%3E%3C/svg%3E';
const FALLBACK_IMAGE_2 = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%234ecdc4%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22300%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%3EBusiness%3C/text%3E%3C/svg%3E';

// Validate image URLs to prevent null/undefined from reaching React Native Image component
const validateImageUrl = (url: string | null | undefined, fallbackUrl: string, context: string): string => {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    console.warn(`[FEED] 🚨 Invalid image URL detected in ${context}, using fallback:`, url);
    return fallbackUrl;
  }

  // Check for common invalid URL patterns that cause React Native errors
  if (url === 'null' || url === 'undefined' || url === '') {
    console.warn(`[FEED] 🚨 Invalid URL string detected in ${context}: "${url}", using fallback`);
    return fallbackUrl;
  }

  return url;
};

const INITIAL_FEED: FeedEntry[] = [
  {
    id: 'mock-1-ultra-reliable',
    imageUrl: validateImageUrl(MOCK_IMAGE_1, FALLBACK_IMAGE_1, 'initial mock feed entry 1'),
    prompt: 'Casual everyday outfit - placeholder',
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
    // Add fallback URL for extra reliability
    fallbackImageUrl: FALLBACK_IMAGE_1,
  },
  {
    id: 'mock-2-ultra-reliable',
    imageUrl: validateImageUrl(MOCK_IMAGE_2, FALLBACK_IMAGE_2, 'initial mock feed entry 2'),
    prompt: 'Business casual outfit - placeholder',
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
    // Add fallback URL for extra reliability
    fallbackImageUrl: FALLBACK_IMAGE_2,
  },
];

console.log('[FEED] 🎯 Initial mock feed created with ultra-reliable data URI images');
console.log('[FEED] Mock images are embedded data URIs - guaranteed to load');
console.log('[FEED] ✅ Image validation system active - prevents null URL errors');

export const [FeedProvider, useFeed] = createContextHook(() => {
  // Advanced loading service - force recreation for 30 workers
  const loadingService = useRef<FeedLoadingService | null>(null);
  if (!loadingService.current) {
    console.log('[FEED] 🆕 Creating FRESH FeedLoadingService instance');
    loadingService.current = new FeedLoadingService();
  }
  const service = loadingService.current;

  // Get user image from UserProvider
  const { userImage } = useUser();

  // State management - hybrid feed with both outfits and products
  const [feed, setFeed] = useState<HybridFeedEntry[]>(INITIAL_FEED);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productFeed, setProductFeed] = useState<ProductFeedEntry[]>([]);
  const [nextProductIndex, setNextProductIndex] = useState(0);

  // tRPC hooks for catalog integration
  const { data: trendingProducts, refetch: refetchTrending } = trpc.catalog.getTrendingProducts.useQuery({
    limit: 20 // Get more products to mix into feed
  }, {
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000 // Consider stale after 2 minutes
  });

  const { data: searchProducts, refetch: refetchProducts } = trpc.catalog.searchProducts.useQuery({
    limit: 30,
    sortBy: 'popularity',
    inStock: true
  }, {
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    staleTime: 5 * 60 * 1000 // Consider stale after 5 minutes
  });

  // Transform catalog products into product feed entries
  useEffect(() => {
    const allProducts = [
      ...(trendingProducts?.data || []),
      ...(searchProducts?.data || [])
    ];

    if (allProducts.length > 0) {
      const productEntries: ProductFeedEntry[] = allProducts.map((product, index) => {
        // 🚨 CRITICAL: Validate product image URLs to prevent React Native errors
        const primaryImageUrl = product.mainImage || product.images?.[0]?.original_url || '';
        const validatedMainImage = validateImageUrl(primaryImageUrl, FALLBACK_IMAGE_2, `product ${product.id} (${product.brand?.name || 'Unknown'})`);

        return {
          id: `product_${product.id}_${Date.now()}_${index}`,
          type: 'product' as const,
          product: {
            ...product,
            base_price: product.base_price || 0,
            currency: product.currency || 'USD',
            mainImage: validatedMainImage,
            isOnSale: product.isOnSale || false,
            popularity_score: product.popularity_score || 0,
            availableSizes: product.availableSizes || [],
            availableColors: product.availableColors || [],
            tags: product.tags || []
          },
          timestamp: Date.now() - index * 1000 // Spread timestamps to avoid duplicates
        };
      });

      // Shuffle products for variety
      const shuffledProducts = productEntries.sort(() => Math.random() - 0.5);
      setProductFeed(shuffledProducts);

      console.log('[FEED] 🛍️ Loaded', shuffledProducts.length, 'products into feed');
    }
  }, [trendingProducts, searchProducts]);

  // Function to get next product to inject into feed
  const getNextProduct = useCallback((): ProductFeedEntry | null => {
    if (productFeed.length === 0) return null;

    const product = productFeed[nextProductIndex % productFeed.length];
    setNextProductIndex(prev => prev + 1);

    // Create a unique instance to avoid React key collisions
    return {
      ...product,
      id: `product_instance_${product.product.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };
  }, [productFeed, nextProductIndex]);

  const [hasInitialized, setHasInitialized] = useState(false);
  const [loadingStats, setLoadingStats] = useState<any>({});
  const [systemHealth, setSystemHealth] = useState<any>({});
  const [scrollVelocity, setScrollVelocity] = useState(0);

  // Scroll tracking for intelligent preloading
  const lastScrollTime = useRef<number>(Date.now());
  const lastScrollIndex = useRef<number>(0);

  // 🚨 ULTRATHINK: Optimized feed update with efficient cache scanning
  const updateFeedFromCache = useCallback(() => {
    setFeed(currentFeed => {
      const stats = service.getCacheStats();
      const health = service.getSystemHealth();
      setLoadingStats(stats);
      setSystemHealth(health);

      // Start with existing feed - NEVER replace existing entries
      const updatedFeed = [...currentFeed];
      let hasNewImages = false;

      // 🚨 EFFICIENT SCANNING: Only scan reasonable range around user position
      const userPosition = currentIndex;
      const scanStart = Math.max(2, userPosition - 5); // Don't go too far behind
      const scanEnd = Math.min(userPosition + 50, 200); // Reasonable ahead limit

      // Track what we already have to avoid duplicate checking
      const existingImageUrls = new Set(
        updatedFeed
          .filter(entry => entry && entry.imageUrl)
          .map(entry => entry.imageUrl)
      );

      // Count new additions for more efficient logging
      let newImagesAdded = 0;
      let duplicatesSkipped = 0;

      // Only scan the range we actually need
      for (let i = scanStart; i < scanEnd; i++) {
        const cachedImage = service.getImage(i);

        // Only add if we don't already have an image at this position AND it's a valid cached image
        if (cachedImage && (i >= updatedFeed.length || !updatedFeed[i])) {
          // Quick duplicate check using Set for O(1) lookup
          if (existingImageUrls.has(cachedImage.imageUrl)) {
            duplicatesSkipped++;
            continue; // Skip quietly, no need to log every duplicate
          }

          // 🚨 CRITICAL: Validate image URL before creating feed entry
          const validatedImageUrl = validateImageUrl(cachedImage.imageUrl, FALLBACK_IMAGE_1, `position ${i}, cached image ${cachedImage.id.substring(0, 12)}`);

          const feedEntry: FeedEntry = {
            id: cachedImage.id,
            imageUrl: validatedImageUrl,
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
          existingImageUrls.add(validatedImageUrl); // Track this new URL
          hasNewImages = true;
          newImagesAdded++;
        }
      }

      // Efficient logging - only log when there are actually changes
      if (hasNewImages || duplicatesSkipped > 0) {
        console.log('[FEED] 📦 Cache scan results:', {
          scannedRange: `${scanStart}-${scanEnd}`,
          newImagesAdded,
          duplicatesSkipped,
          totalFeedLength: updatedFeed.filter(Boolean).length,
          userPosition
        });
      }

      // Inject products every 3-4 positions to create a hybrid feed
      const shouldInjectProducts = productFeed.length > 0 && updatedFeed.length >= 4;
      if (shouldInjectProducts) {
        // Calculate product injection positions (every 3-4 items)
        const productPositions = [];
        for (let pos = 4; pos < scanLimit; pos += (3 + Math.floor(Math.random() * 2))) { // 3-4 positions apart
          productPositions.push(pos);
        }

        productPositions.forEach(position => {
          // Only inject if position is empty or near the end of current feed
          if (position >= updatedFeed.length || !updatedFeed[position]) {
            const productEntry = getNextProduct();
            if (productEntry) {
              // Extend array if needed
              while (updatedFeed.length <= position) {
                updatedFeed.push(undefined as any);
              }
              updatedFeed[position] = productEntry;
              hasNewImages = true;
              console.log('[FEED] 🛍️ Injected product at position', position, productEntry.product.brand.name, productEntry.product.name);
            }
          }
        });
      }

      // Only return new array if we actually added images (prevents unnecessary re-renders)
      if (hasNewImages) {
        const filteredFeed = updatedFeed.filter(Boolean);

        // More efficient duplicate validation - only check if we suspect issues
        if (newImagesAdded > 0) {
          const imageUrls = new Set();
          const duplicateCount = filteredFeed.reduce((count, entry) => {
            if (entry && imageUrls.has(entry.imageUrl)) {
              return count + 1;
            }
            if (entry) imageUrls.add(entry.imageUrl);
            return count;
          }, 0);

          // Only log final result, not every operation
          console.log('[FEED] ✅ Feed updated:', {
            totalImages: filteredFeed.length,
            uniqueImages: imageUrls.size,
            duplicatesFound: duplicateCount,
            bufferHealth: stats.bufferHealth?.toFixed(1) + '%'
          });
        }

        return filteredFeed;
      }
      return currentFeed;
    });
  }, [service, getNextProduct, productFeed.length]);

  // Enhanced scroll tracking with velocity calculation
  const updateScrollPosition = useCallback((newIndex: number) => {
    const now = Date.now();
    const timeDelta = now - lastScrollTime.current;
    const indexDelta = newIndex - lastScrollIndex.current;

    // Calculate scroll velocity (items per second)
    const velocity = timeDelta > 0 ? (indexDelta / timeDelta) * 1000 : 0;
    setScrollVelocity(velocity);

    // Update loading service with scroll data
    service.updateScrollPosition(newIndex, velocity);

    // Update tracking refs
    lastScrollTime.current = now;
    lastScrollIndex.current = newIndex;

    setCurrentIndex(newIndex);

    // 🚀 IMMEDIATE cache sync after index change
    updateFeedFromCache(); // Immediate update
    setTimeout(updateFeedFromCache, 50); // Very quick follow-up
  }, [service, updateFeedFromCache]);

  // Initialize with intelligent preloading and continuous generation
  const initializeIntelligentFeed = useCallback((userImageBase64: string) => {
    if (hasInitialized) return;

    console.log('[FEED] 🚀 Initializing intelligent loading with 10 parallel workers + continuous generation');
    setHasInitialized(true);

    // Enable continuous generation for 100-image buffer
    service.enableContinuousGeneration(userImageBase64);

    // Generate ultra-unique identifiers to prevent React key collisions
    const initTimestamp = Date.now();
    const sessionId = Math.random().toString(36).substring(2, 15); // Longer for more uniqueness
    const processId = Math.floor(Math.random() * 100000);

    // Helper function to generate guaranteed unique IDs
    const generateUniqueId = (index: number) => {
      const microTime = Date.now() + index; // Offset each by index
      const random = Math.random().toString(36).substring(2, 10);
      return `init_${initTimestamp}_${sessionId}_${processId}_${microTime}_${random}_${index}`;
    };

    // Create initial jobs with guaranteed unique IDs and varied prompts
    const initialJobs = [
      // Critical - immediately visible
      { id: generateUniqueId(0), prompt: getSmartPrompt(2), priority: 'critical' as const, position: 2 },
      { id: generateUniqueId(1), prompt: getSmartPrompt(3), priority: 'critical' as const, position: 3 },
      { id: generateUniqueId(2), prompt: getSmartPrompt(4), priority: 'critical' as const, position: 4 },

      // High priority preload
      { id: generateUniqueId(3), prompt: getSmartPrompt(5), priority: 'preload' as const, position: 5 },
      { id: generateUniqueId(4), prompt: getSmartPrompt(6), priority: 'preload' as const, position: 6 },
      { id: generateUniqueId(5), prompt: getSmartPrompt(7), priority: 'preload' as const, position: 7 },
      { id: generateUniqueId(6), prompt: getSmartPrompt(8), priority: 'preload' as const, position: 8 },
      { id: generateUniqueId(7), prompt: getSmartPrompt(9), priority: 'preload' as const, position: 9 },

      // Background cache
      { id: generateUniqueId(8), prompt: getSmartPrompt(10), priority: 'cache' as const, position: 10 },
      { id: generateUniqueId(9), prompt: getSmartPrompt(11), priority: 'cache' as const, position: 11 },
      { id: generateUniqueId(10), prompt: getSmartPrompt(12), priority: 'cache' as const, position: 12 },
      { id: generateUniqueId(11), prompt: getSmartPrompt(13), priority: 'cache' as const, position: 13 },
      { id: generateUniqueId(12), prompt: getSmartPrompt(14), priority: 'cache' as const, position: 14 },
      { id: generateUniqueId(13), prompt: getSmartPrompt(15), priority: 'cache' as const, position: 15 },
      { id: generateUniqueId(14), prompt: getSmartPrompt(16), priority: 'cache' as const, position: 16 },
    ];

    console.log('[FEED] 🎯 Generated', initialJobs.length, 'ULTRA-UNIQUE initialization jobs. Session:', sessionId.substring(0,8));
    console.log('[FEED] 🔑 First job ID sample:', initialJobs[0].id.substring(0, 40) + '...');

    // Queue all jobs for parallel processing
    service.queueJobs(initialJobs, userImageBase64);

    // Set up enhanced continuous cache updating for infinite scroll
    const updateInterval = setInterval(() => {
      updateFeedFromCache();
    }, 2000); // Longer interval since we have continuous generation

    // Don't clean up interval - keep running for infinite scroll
    // The continuous generation system will handle buffer maintenance
  }, [hasInitialized, service, updateFeedFromCache]);

  // Enhanced smart preloading with continuous generation
  const triggerSmartPreload = useCallback((userImageBase64: string) => {
    if (!hasInitialized) return;

    const currentStats = service.getCacheStats();

    console.log('[FEED] 🧠 Smart preload triggered:', {
      scrollVelocity: scrollVelocity.toFixed(2),
      bufferHealth: currentStats.bufferHealth?.toFixed(1) + '%',
      distanceFromEnd: currentStats.distanceFromEnd,
      cached: currentStats.cached
    });

    // Generate ultra-unique critical jobs for immediate positions
    const jobs = [];
    const criticalTimestamp = Date.now();
    const batchId = Math.random().toString(36).substring(2, 15);
    const criticalProcessId = Math.floor(Math.random() * 100000);

    for (let i = currentIndex + 1; i <= currentIndex + 5; i++) {
      if (!service.getImage(i)) {
        const microTime = Date.now() + i;
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const uniqueId = `critical_${criticalTimestamp}_${batchId}_${criticalProcessId}_${microTime}_${randomSuffix}_${i}`;

        jobs.push({
          id: uniqueId,
          prompt: getSmartPrompt(i),
          priority: 'critical' as const,
          position: i
        });
        console.log(`[FEED] ⚡ Queuing critical position ${i} with ULTRA-UNIQUE ID: ${uniqueId.substring(0, 35)}...`);
      }
    }

    if (jobs.length > 0) {
      console.log('[FEED] ⚡ Queueing', jobs.length, 'critical positions for immediate processing');
      service.queueJobs(jobs, userImageBase64);
    }

    // 🚀 IMMEDIATE feed update + aggressive polling
    updateFeedFromCache(); // Immediate update
    setTimeout(updateFeedFromCache, 100); // Quick follow-up
    setTimeout(updateFeedFromCache, 500); // Original timing
  }, [hasInitialized, service, currentIndex, scrollVelocity, updateFeedFromCache]);

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

  // 🚨 ULTRATHINK: Optimized feed synchronization - reduced frequency for better performance
  useEffect(() => {
    const feedSyncInterval = setInterval(() => {
      updateFeedFromCache(); // Sync every 3 seconds - much more reasonable
    }, 3000); // Reduced from 1000ms to 3000ms

    return () => clearInterval(feedSyncInterval);
  }, [updateFeedFromCache]);

  // 🚨 ULTRATHINK: Optimized monitoring - reduced frequency and conditional logging
  useEffect(() => {
    const monitoringInterval = setInterval(() => {
      const stats = service.getCacheStats();
      const health = service.getSystemHealth();
      setLoadingStats(stats);
      setSystemHealth(health);

      // Only log efficiency when it's exceptional (not every time it's high)
      if (stats.efficiency === 1.0 && Date.now() % 10000 < 5000) { // Log max efficiency occasionally
        console.log('[FEED] ⚡ Peak efficiency:', (stats.efficiency * 100).toFixed(1) + '%');
      }
    }, 5000); // Reduced from 2000ms to 5000ms

    return () => clearInterval(monitoringInterval);
  }, [service]);

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
    systemHealth, // 🚨 EMERGENCY SYSTEM HEALTH DATA
    scrollVelocity,
    workerStats: service.getWorkerStats(),

    // Continuous generation status
    bufferHealth: loadingStats?.bufferHealth || 0,
    distanceFromEnd: loadingStats?.distanceFromEnd || 0,
    continuousEnabled: loadingStats?.continuousEnabled || false,

    // Debug and reset functions
    resetLoadingService: () => {
      console.log('[FEED] 🔄 Resetting loading service and clearing all caches');
      service.clearAllCaches();
      setFeed(INITIAL_FEED); // Reset to initial mock data
      setCurrentIndex(0);
      setHasInitialized(false);
      console.log('[FEED] ✨ Ready for fresh start');
    },
  };
});