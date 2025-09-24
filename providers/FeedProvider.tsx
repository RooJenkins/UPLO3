import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStorage } from './StorageProvider';
import { trpc, testTrpcConnection } from '@/lib/trpc';

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
  base64?: string;
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
  isGenerating?: boolean;
}

interface GenerationQueue {
  id: string;
  prompt: string;
  priority: number;
}

const FEED_STORAGE_KEY = '@outfit_feed_cache';
const MAX_CACHED_ENTRIES = 15; // Increased for URL-based storage
const PRELOAD_THRESHOLD = 3; // Start preloading when 3 items from end

export const [FeedProvider, useFeed] = createContextHook(() => {
  console.log('FeedProvider: Initializing context hook...');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generationQueue, setGenerationQueue] = useState<GenerationQueue[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [preloadedUrls, setPreloadedUrls] = useState<Set<string>>(new Set());
  
  const storage = useStorage();
  const { getItem, setItem } = storage || {};
  
  // Test tRPC connection on startup
  useEffect(() => {
    testTrpcConnection().then(isWorking => {
      console.log('tRPC connection test result:', isWorking);
    }).catch(error => {
      console.error('tRPC connection test error:', error);
    });
  }, []);

  // tRPC hooks with error handling and fallback
  const generateOutfitMutation = trpc.outfit.generate.useMutation({
    onError: (error: any) => {
      console.error('[FEED] Generate outfit mutation error:', error);
      // Don't throw, let the component handle fallback
    },
    onSuccess: (data: any) => {
      console.log('[FEED] Generate outfit mutation success:', data);
    },
  });
  const saveFeedMutation = trpc.feed.save.useMutation({
    onError: (error: any) => {
      console.warn('[FEED] Save feed mutation error:', error);
      // Non-critical, continue without cloud save
    },
  });
  const feedQuery = trpc.feed.list.useQuery(
    { limit: MAX_CACHED_ENTRIES },
    { 
      enabled: false, // Disable cloud sync for now to prevent blocking
      retry: false,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  // Helper functions
  const getStorageSize = useCallback((data: string): number => {
    return new Blob([data]).size / (1024 * 1024); // Size in MB
  }, []);

  // Preload image for smooth scrolling
  const preloadImage = useCallback((url: string) => {
    if (!url?.trim() || url.length > 2000) return; // Validate URL
    if (preloadedUrls.has(url)) return;

    const img = new Image();
    img.onload = () => {
      setPreloadedUrls(prev => new Set([...prev, url]));
      console.log(`Preloaded image: ${url.substring(0, 50)}...`);
    };
    img.onerror = () => {
      console.warn(`Failed to preload image: ${url.substring(0, 50)}...`);
    };
    img.src = url;
  }, []); // Remove preloadedUrls dependency to prevent re-renders

  const cleanupOldEntries = useCallback((entries: FeedEntry[]): FeedEntry[] => {
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 100) return []; // Validate entries
    
    // Sort by timestamp (newest first) and limit count
    const sorted = entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CACHED_ENTRIES);
    
    // With URL-based storage, we only store lightweight metadata
    return sorted.map((entry) => {
      const { base64, ...entryWithoutBase64 } = entry;
      return {
        ...entryWithoutBase64,
        // Keep only essential data for URL-based entries
        items: entry.items?.slice(0, 3) || [], // Keep 3 items instead of 2
        metadata: {
          style: entry.metadata?.style || '',
          occasion: entry.metadata?.occasion || '',
          season: entry.metadata?.season || '',
          colors: entry.metadata?.colors?.slice(0, 3) || [], // Keep 3 colors
        },
      };
    });
  }, []);

  const saveFeedToStorage = useCallback(async (entries: FeedEntry[]) => {
    if (!Array.isArray(entries) || entries.length > 50 || !setItem) return; // Validate entries
    
    try {
      // Validate and clean entries aggressively - no base64 storage
      if (entries.length > 50) return; // Safety check
      let cleanedEntries = cleanupOldEntries(entries);
      
      // Further reduce if still too many
      if (cleanedEntries.length > MAX_CACHED_ENTRIES) {
        cleanedEntries = cleanedEntries.slice(0, MAX_CACHED_ENTRIES);
      }
      
      // Store lightweight URL-based entries
      const urlBasedEntries = cleanedEntries.map(entry => ({
        id: entry.id,
        imageUrl: entry.imageUrl, // URLs are lightweight
        prompt: entry.prompt,
        outfitId: entry.outfitId,
        timestamp: entry.timestamp,
        items: entry.items?.slice(0, 3) || [], // Keep 3 items for better UX
        metadata: {
          style: entry.metadata?.style || '',
          occasion: entry.metadata?.occasion || '',
          season: entry.metadata?.season || '',
          colors: entry.metadata?.colors?.slice(0, 3) || [], // Keep 3 colors
        },
      }));
      
      const dataString = JSON.stringify(urlBasedEntries);
      const storageSize = getStorageSize(dataString);
      
      console.log(`Saving ${urlBasedEntries.length} URL-based entries (${storageSize.toFixed(2)}MB)`);
      
      await setItem(FEED_STORAGE_KEY, dataString);
      console.log(`Successfully saved ${urlBasedEntries.length} entries to storage`);
    } catch (error) {
      console.error('Failed to save feed to storage:', error);
      // Let the StorageProvider handle quota exceeded errors
    }
  }, [setItem, getStorageSize, cleanupOldEntries]);

  // Load cached feed entries on mount (local + cloud)
  useEffect(() => {
    if (isInitialized) return;
    
    const loadCachedEntries = async () => {
      try {
        console.log('FeedProvider: Loading cached entries from local storage...');
        setIsLoading(true);
        
        // This will be handled below in the combined logic
        
        // Always create some mock entries for immediate display if no cached entries
        let currentFeed = feed;
        if (getItem) {
          const stored = await getItem(FEED_STORAGE_KEY);
          if (stored) {
            const entries = JSON.parse(stored);
            if (Array.isArray(entries) && entries.length > 0) {
              console.log(`FeedProvider: Loaded ${entries.length} local cached entries`);
              currentFeed = entries.slice(0, MAX_CACHED_ENTRIES);
              setFeed(currentFeed);
              
              // Preload images from local cache
              entries.slice(0, 5).forEach(entry => {
                if (entry.imageUrl) {
                  preloadImage(entry.imageUrl);
                }
              });
            }
          }
        }
        
        // If still no cached entries, create mock entries for immediate display
        if (currentFeed.length === 0) {
          console.log('FeedProvider: No cached entries, creating mock entries');
          const mockEntries: FeedEntry[] = [
            {
              id: 'mock_1',
              imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=600&fit=crop',
              prompt: 'Casual everyday outfit',
              outfitId: 'mock_outfit_1',
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
              id: 'mock_2',
              imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
              prompt: 'Business casual outfit',
              outfitId: 'mock_outfit_2',
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
            {
              id: 'mock_3',
              imageUrl: 'https://images.unsplash.com/photo-1506629905607-c28b47d3e6b0?w=400&h=600&fit=crop',
              prompt: 'Weekend casual outfit',
              outfitId: 'mock_outfit_3',
              items: [
                { id: '5', name: 'Hoodie', brand: 'Nike', price: '$65.00', category: 'tops' },
                { id: '6', name: 'Joggers', brand: 'Adidas', price: '$55.00', category: 'bottoms' },
              ],
              metadata: {
                style: 'sporty',
                occasion: 'weekend',
                season: 'all',
                colors: ['gray', 'black'],
              },
              timestamp: Date.now() - 3000,
            },
          ];
          setFeed(mockEntries);
        }
      } catch (error) {
        console.error('Failed to load local cached feed:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
        console.log('FeedProvider: Local initialization complete');
      }
    };
    
    loadCachedEntries();
  }, [getItem, isInitialized]);

  // Sync with cloud cache when available
  useEffect(() => {
    if (!isInitialized || !feedQuery.data) return;
    
    const cloudEntries = feedQuery.data;
    if (Array.isArray(cloudEntries) && cloudEntries.length > 0) {
      console.log(`FeedProvider: Syncing ${cloudEntries.length} entries from cloud`);
      
      setFeed(prev => {
        // Merge cloud and local entries, removing duplicates
        const merged = [...cloudEntries];
        prev.forEach(localEntry => {
          if (!merged.find(cloudEntry => cloudEntry.id === localEntry.id)) {
            merged.push(localEntry);
          }
        });
        
        const sorted = merged
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_CACHED_ENTRIES);
        
        // Preload cloud images
        sorted.slice(0, 5).forEach(entry => {
          if (entry.imageUrl) {
            preloadImage(entry.imageUrl);
          }
        });
        
        // Save merged data to local storage
        setTimeout(() => saveFeedToStorage(sorted), 1000);
        
        return sorted;
      });
    }
  }, [isInitialized, feedQuery.data, saveFeedToStorage]);

  // Generate outfit using cloud-first tRPC backend with fallback
  const generateOutfit = useCallback(async (prompt: string, userImageBase64: string) => {
    if (!prompt?.trim() || !userImageBase64?.trim()) {
      console.error('Invalid prompt or image data');
      setIsGenerating(false);
      setGenerationQueue(prev => prev.slice(1));
      return;
    }

    setIsGenerating(true);
    
    // Always generate a fallback first for immediate feedback
    const generateFallbackEntry = () => {
      const mockItems = [
        { id: '1', name: 'Classic White T-Shirt', brand: 'Uniqlo', price: '$19.90', category: 'tops' },
        { id: '2', name: 'Slim Fit Jeans', brand: 'Levi\'s', price: '$89.50', category: 'bottoms' },
        { id: '3', name: 'White Sneakers', brand: 'Adidas', price: '$120.00', category: 'shoes' },
        { id: '4', name: 'Leather Jacket', brand: 'Zara', price: '$199.00', category: 'outerwear' },
        { id: '5', name: 'Casual Blazer', brand: 'H&M', price: '$79.99', category: 'outerwear' },
        { id: '6', name: 'Summer Dress', brand: 'Gap', price: '$59.95', category: 'dresses' },
      ];
      
      const randomItems = mockItems.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2);
      
      return {
        id: Date.now().toString(),
        imageUrl: userImageBase64, // Use original image as fallback
        prompt: prompt.trim(),
        outfitId: `outfit_${Date.now()}`,
        items: randomItems,
        metadata: {
          style: 'casual',
          occasion: 'everyday',
          season: 'all',
          colors: ['black', 'white'],
        },
        timestamp: Date.now(),
      };
    };

    try {
      console.log(`Attempting to generate outfit via tRPC: ${prompt}`);
      
      // Try tRPC mutation for cloud processing with timeout
      const result = await Promise.race([
        generateOutfitMutation.mutateAsync({
          prompt: prompt.trim(),
          userImageBase64,
          outfitId: `outfit_${Date.now()}`,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('tRPC timeout')), 8000)
        )
      ]) as any;
      
      // Remove from queue
      setGenerationQueue(prev => prev.filter(item => item.prompt !== prompt));
      
      // Create feed entry with cloud-generated data
      const newEntry: FeedEntry = {
        id: result.id,
        imageUrl: result.imageUrl, // URL from cloud processing
        prompt: result.prompt,
        outfitId: result.outfitId,
        items: result.items,
        metadata: result.metadata,
        timestamp: result.timestamp,
      };

      // Preload the generated image for smooth UX
      preloadImage(result.imageUrl);
      
      // Save to cloud cache via tRPC (don't block on this)
      try {
        saveFeedMutation.mutate(newEntry);
      } catch (saveError) {
        console.warn('Failed to save to cloud cache:', saveError);
      }
      
      // Update local feed
      setFeed(prev => {
        const updated = [newEntry, ...prev].slice(0, MAX_CACHED_ENTRIES);
        // Save to local storage asynchronously
        setTimeout(() => saveFeedToStorage(updated), 500);
        return updated;
      });
      
      console.log(`Successfully generated and cached outfit: ${result.id}`);
    } catch (error) {
      console.warn('tRPC generation failed, using fallback:', error);
      
      // Generate fallback mock outfit entry
      const mockEntry: FeedEntry = generateFallbackEntry();
      
      // Remove from queue
      setGenerationQueue(prev => prev.filter(item => item.prompt !== prompt));
      
      // Update local feed with mock entry
      setFeed(prev => {
        const updated = [mockEntry, ...prev].slice(0, MAX_CACHED_ENTRIES);
        setTimeout(() => saveFeedToStorage(updated), 500);
        return updated;
      });
      
      console.log('Generated fallback mock outfit:', mockEntry.id);
    } finally {
      setIsGenerating(false);
    }
  }, [generateOutfitMutation, saveFeedMutation, saveFeedToStorage, preloadImage]);



  const queueGeneration = useCallback((prompt: string, priority: number = 0) => {
    if (!prompt?.trim() || prompt.length > 500) return;
    
    setGenerationQueue(prev => {
      const exists = prev.some(item => item.prompt === prompt);
      if (exists) return prev;
      
      const newQueue = [...prev, { id: Date.now().toString(), prompt: prompt.trim(), priority }];
      return newQueue.sort((a, b) => b.priority - a.priority);
    });
  }, []);

  const processQueue = useCallback(async (userImageBase64: string) => {
    if (isGenerating || generationQueue.length === 0 || !userImageBase64?.trim() || userImageBase64.length > 10000000) return; // Validate base64
    
    const nextItem = generationQueue[0];
    if (!nextItem) return;
    
    setIsGenerating(true);
    await generateOutfit(nextItem.prompt, userImageBase64);
  }, [isGenerating, generationQueue, generateOutfit]);

  const generateInitialFeed = useCallback((userImageBase64: string) => {
    if (!userImageBase64?.trim()) return;
    
    const prompts = [
      'Casual everyday outfit with jeans and sneakers',
      'Business casual outfit with blazer',
      'Weekend relaxed outfit with comfortable clothes',
      'Date night outfit, stylish and elegant',
      'Workout outfit, athletic wear',
    ];
    
    prompts.forEach((prompt, index) => {
      if (prompt?.trim()) {
        queueGeneration(prompt.trim(), prompts.length - index);
      }
    });
  }, [queueGeneration]);

  const preloadNextOutfits = useCallback((userImageBase64: string) => {
    if (!userImageBase64?.trim() || userImageBase64.length > 10000000 || currentIndex < feed.length - PRELOAD_THRESHOLD) return; // Validate base64
    
    console.log(`Preloading next outfits (currentIndex: ${currentIndex}, feedLength: ${feed.length})`);
    
    const newPrompts = [
      'Trendy street style outfit with sneakers',
      'Professional work outfit with blazer',
      'Cozy winter outfit with layers and boots',
      'Summer beach outfit, light and breezy',
      'Evening party outfit, elegant and stylish',
      'Casual weekend outfit, comfortable and relaxed',
    ];
    
    // Preload existing images in feed
    feed.slice(currentIndex + 1, currentIndex + 4).forEach(entry => {
      if (entry.imageUrl) {
        preloadImage(entry.imageUrl);
      }
    });
    
    // Queue new generations with higher priority for immediate next items
    newPrompts.forEach((prompt, index) => {
      if (prompt?.trim()) {
        const priority = newPrompts.length - index; // Higher priority for earlier items
        queueGeneration(prompt.trim(), priority);
      }
    });
  }, [currentIndex, feed, queueGeneration]);

  const contextValue = useMemo(() => {
    console.log('FeedProvider: Creating context value, feed length:', feed.length);

    // Ensure all functions are properly bound and safe
    const safeSetCurrentIndex = useCallback((index: number | ((prev: number) => number)) => {
      if (typeof index === 'function') {
        setCurrentIndex(prev => {
          const newIndex = index(prev);
          return typeof newIndex === 'number' ? Math.max(0, newIndex) : prev;
        });
      } else {
        setCurrentIndex(Math.max(0, index));
      }
    }, []);

    // Always return a consistent structure - this is critical for preventing undefined errors
    const baseReturn = {
      feed: Array.isArray(feed) ? feed : [],
      currentIndex: typeof currentIndex === 'number' ? currentIndex : 0,
      setCurrentIndex: safeSetCurrentIndex,
      isLoading: Boolean(isLoading || feedQuery?.isLoading),
      isGenerating: Boolean(isGenerating || generateOutfitMutation?.isPending),
      queueGeneration: typeof queueGeneration === 'function' ? queueGeneration : () => {},
      processQueue: typeof processQueue === 'function' ? processQueue : async () => {},
      generateInitialFeed: typeof generateInitialFeed === 'function' ? generateInitialFeed : () => {},
      preloadNextOutfits: typeof preloadNextOutfits === 'function' ? preloadNextOutfits : () => {},
      generationQueue: Array.isArray(generationQueue) ? generationQueue : [],
      preloadedUrls: preloadedUrls instanceof Set ? preloadedUrls : new Set(),
      // Cloud sync status
      cloudSyncStatus: {
        isLoading: Boolean(feedQuery?.isLoading),
        isError: Boolean(feedQuery?.isError),
        error: feedQuery?.error || null,
      },
    };

    console.log('FeedProvider: Returning context value:', {
      feedLength: baseReturn.feed.length,
      isLoading: baseReturn.isLoading,
      isGenerating: baseReturn.isGenerating,
      currentIndex: baseReturn.currentIndex
    });
    return baseReturn;
  }, [
    feed,
    currentIndex,
    isLoading,
    isGenerating,
    queueGeneration,
    processQueue,
    generateInitialFeed,
    preloadNextOutfits,
    generationQueue,
    preloadedUrls,
    feedQuery?.isLoading,
    feedQuery?.isError,
    feedQuery?.error,
    generateOutfitMutation?.isPending,
  ]);
  
  console.log('FeedProvider: Context hook initialized, returning value');
  return contextValue;
});