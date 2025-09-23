import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStorage } from './StorageProvider';

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
const MAX_CACHED_ENTRIES = 20;
const MAX_STORAGE_SIZE_MB = 10;


export const [FeedProvider, useFeed] = createContextHook(() => {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generationQueue, setGenerationQueue] = useState<GenerationQueue[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { getItem, setItem, removeItem } = useStorage();

  // Load cached feed entries
  const { data: cachedEntries, isLoading } = useQuery({
    queryKey: ['feed-cache'],
    queryFn: async () => {
      try {
        const stored = await getItem(FEED_STORAGE_KEY);
        if (stored) {
          const entries = JSON.parse(stored);
          if (Array.isArray(entries)) {
            return entries.slice(0, MAX_CACHED_ENTRIES);
          }
        }
      } catch (error) {
        console.error('Failed to load cached feed:', error);
      }
      return [];
    },
  });

  useEffect(() => {
    if (cachedEntries && cachedEntries.length > 0) {
      setFeed(cachedEntries);
    }
  }, [cachedEntries]);

  // Generate outfit image using AI
  const generateOutfitMutation = useMutation({
    mutationFn: async ({ prompt, userImageBase64 }: { prompt: string; userImageBase64: string }) => {
      const response = await fetch('https://toolkit.rork.com/images/generate/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `${prompt}. Full body shot with space around feet and head. High-end fashion photography, studio lighting, professional model pose. The person should look exactly like the reference image provided.`,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate outfit image');
      }

      const data = await response.json();
      return data.image;
    },
    onSuccess: (imageData, variables) => {
      // Remove from queue and update feed
      setGenerationQueue(prev => prev.filter(item => item.prompt !== variables.prompt));
      setIsGenerating(false);
      
      // Add generated entry to feed
      const newEntry: FeedEntry = {
        id: Date.now().toString(),
        imageUrl: `data:${imageData.mimeType};base64,${imageData.base64Data}`,
        base64: imageData.base64Data,
        prompt: variables.prompt,
        outfitId: `outfit_${Date.now()}`,
        items: generateMockOutfitItems(),
        metadata: {
          style: 'casual',
          occasion: 'everyday',
          season: 'all',
          colors: ['black', 'white'],
        },
        timestamp: Date.now(),
      };

      setFeed(prev => {
        const updated = [newEntry, ...prev].slice(0, MAX_CACHED_ENTRIES);
        // Save to storage asynchronously to avoid blocking UI
        setTimeout(() => saveFeedToStorage(updated), 100);
        return updated;
      });
    },
    onError: (error) => {
      console.error('Failed to generate outfit:', error);
      setIsGenerating(false);
      setGenerationQueue(prev => prev.slice(1)); // Remove failed item
    },
  });

  const getStorageSize = (data: string): number => {
    return new Blob([data]).size / (1024 * 1024); // Size in MB
  };

  const cleanupOldEntries = (entries: FeedEntry[]): FeedEntry[] => {
    // Sort by timestamp (newest first) and limit count
    const sorted = entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CACHED_ENTRIES);
    
    // Remove base64 data from older entries to save space
    return sorted.map((entry, index) => {
      if (index > 10) { // Keep base64 only for recent 10 entries
        const { base64, ...entryWithoutBase64 } = entry;
        return entryWithoutBase64;
      }
      return entry;
    });
  };

  const saveFeedToStorage = async (entries: FeedEntry[]) => {
    try {
      let cleanedEntries = cleanupOldEntries(entries);
      let dataString = JSON.stringify(cleanedEntries);
      let storageSize = getStorageSize(dataString);
      
      console.log(`Attempting to save ${cleanedEntries.length} entries (${storageSize.toFixed(2)}MB)`);
      
      // If still too large, progressively reduce entries
      while (storageSize > MAX_STORAGE_SIZE_MB && cleanedEntries.length > 5) {
        cleanedEntries = cleanedEntries.slice(0, Math.floor(cleanedEntries.length * 0.8));
        // Remove base64 from remaining entries
        cleanedEntries = cleanedEntries.map(entry => {
          const { base64, ...entryWithoutBase64 } = entry;
          return entryWithoutBase64;
        });
        dataString = JSON.stringify(cleanedEntries);
        storageSize = getStorageSize(dataString);
        console.log(`Reduced to ${cleanedEntries.length} entries (${storageSize.toFixed(2)}MB)`);
      }
      
      await setItem(FEED_STORAGE_KEY, dataString);
      console.log(`Successfully saved ${cleanedEntries.length} entries to storage`);
    } catch (error) {
      console.error('Failed to save feed to storage:', error);
      
      // If quota exceeded, try emergency cleanup
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        try {
          console.log('Quota exceeded, performing emergency cleanup...');
          // Keep only the most recent 5 entries without base64
          const emergencyEntries = entries
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5)
            .map(entry => {
              const { base64, ...entryWithoutBase64 } = entry;
              return entryWithoutBase64;
            });
          
          await setItem(FEED_STORAGE_KEY, JSON.stringify(emergencyEntries));
          console.log('Emergency cleanup successful');
        } catch (emergencyError) {
          console.error('Emergency cleanup failed:', emergencyError);
          // Clear the storage completely as last resort
          try {
            await removeItem(FEED_STORAGE_KEY);
            console.log('Storage cleared completely');
          } catch (clearError) {
            console.error('Failed to clear storage:', clearError);
          }
        }
      }
    }
  };

  const generateMockOutfitItems = (): OutfitItem[] => {
    const mockItems = [
      { id: '1', name: 'Classic White T-Shirt', brand: 'Uniqlo', price: '$19.90', category: 'tops' },
      { id: '2', name: 'Slim Fit Jeans', brand: 'Levi\'s', price: '$89.50', category: 'bottoms' },
      { id: '3', name: 'White Sneakers', brand: 'Adidas', price: '$120.00', category: 'shoes' },
      { id: '4', name: 'Leather Jacket', brand: 'Zara', price: '$199.00', category: 'outerwear' },
    ];
    
    return mockItems.slice(0, Math.floor(Math.random() * 3) + 2);
  };

  const queueGeneration = useCallback((prompt: string, priority: number = 0) => {
    if (!prompt?.trim() || prompt.length > 500) return;
    
    setGenerationQueue(prev => {
      const exists = prev.some(item => item.prompt === prompt);
      if (exists) return prev;
      
      const newQueue = [...prev, { id: Date.now().toString(), prompt: prompt.trim(), priority }];
      return newQueue.sort((a, b) => b.priority - a.priority);
    });
  }, []);

  const { mutate: generateOutfit } = generateOutfitMutation;
  
  const processQueue = useCallback(async (userImageBase64: string) => {
    if (isGenerating || generationQueue.length === 0) return;
    
    const nextItem = generationQueue[0];
    if (!nextItem) return;
    
    setIsGenerating(true);
    generateOutfit({
      prompt: nextItem.prompt,
      userImageBase64,
    });
  }, [isGenerating, generationQueue, generateOutfit]);

  const generateInitialFeed = useCallback((userImageBase64: string) => {
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
    if (currentIndex >= feed.length - 2) {
      const newPrompts = [
        'Trendy street style outfit',
        'Professional work outfit',
        'Cozy winter outfit with layers',
        'Summer beach outfit, light and breezy',
      ];
      
      newPrompts.forEach(prompt => {
        if (prompt?.trim()) {
          queueGeneration(prompt.trim(), 1);
        }
      });
    }
  }, [currentIndex, feed.length, queueGeneration]);

  return useMemo(() => ({
    feed,
    currentIndex,
    setCurrentIndex,
    isLoading,
    isGenerating,
    queueGeneration,
    processQueue,
    generateInitialFeed,
    preloadNextOutfits,
    generationQueue,
  }), [
    feed,
    currentIndex,
    isLoading,
    isGenerating,
    queueGeneration,
    processQueue,
    generateInitialFeed,
    preloadNextOutfits,
    generationQueue,
  ]);
});