import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
const MAX_CACHED_ENTRIES = 5; // Reduced from 10

export const [FeedProvider, useFeed] = createContextHook(() => {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generationQueue, setGenerationQueue] = useState<GenerationQueue[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { getItem, setItem } = useStorage();

  // Helper functions
  const getStorageSize = useCallback((data: string): number => {
    return new Blob([data]).size / (1024 * 1024); // Size in MB
  }, []);

  const cleanupOldEntries = useCallback((entries: FeedEntry[]): FeedEntry[] => {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    
    // Sort by timestamp (newest first) and limit count
    const sorted = entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CACHED_ENTRIES);
    
    // Remove base64 data from ALL entries to save space - only keep URLs
    return sorted.map((entry) => {
      const { base64, ...entryWithoutBase64 } = entry;
      return entryWithoutBase64;
    });
  }, []);

  const saveFeedToStorage = useCallback(async (entries: FeedEntry[]) => {
    if (!Array.isArray(entries)) return;
    
    try {
      // Always clean entries aggressively - no base64 storage
      let cleanedEntries = cleanupOldEntries(entries);
      
      // Further reduce if still too many
      if (cleanedEntries.length > MAX_CACHED_ENTRIES) {
        cleanedEntries = cleanedEntries.slice(0, MAX_CACHED_ENTRIES);
      }
      
      // Only store essential metadata
      const minimalEntries = cleanedEntries.map(entry => ({
        id: entry.id,
        imageUrl: entry.imageUrl,
        prompt: entry.prompt,
        outfitId: entry.outfitId,
        timestamp: entry.timestamp,
        // Remove heavy data
        items: entry.items?.slice(0, 2) || [], // Keep only 2 items
        metadata: {
          style: entry.metadata?.style || '',
          occasion: entry.metadata?.occasion || '',
          season: entry.metadata?.season || '',
          colors: entry.metadata?.colors?.slice(0, 2) || [], // Keep only 2 colors
        },
      }));
      
      const dataString = JSON.stringify(minimalEntries);
      const storageSize = getStorageSize(dataString);
      
      console.log(`Saving ${minimalEntries.length} minimal entries (${storageSize.toFixed(2)}MB)`);
      
      await setItem(FEED_STORAGE_KEY, dataString);
      console.log(`Successfully saved ${minimalEntries.length} entries to storage`);
    } catch (error) {
      console.error('Failed to save feed to storage:', error);
      // Let the StorageProvider handle quota exceeded errors
    }
  }, [setItem, getStorageSize, cleanupOldEntries]);

  // Load cached feed entries on mount
  useEffect(() => {
    const loadCachedEntries = async () => {
      try {
        setIsLoading(true);
        const stored = await getItem(FEED_STORAGE_KEY);
        if (stored) {
          const entries = JSON.parse(stored);
          if (Array.isArray(entries)) {
            setFeed(entries.slice(0, MAX_CACHED_ENTRIES));
          }
        }
      } catch (error) {
        console.error('Failed to load cached feed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCachedEntries();
  }, [getItem]);

  // Generate outfit image using AI image editing
  const generateOutfit = useCallback(async (prompt: string, userImageBase64: string) => {
    if (!prompt?.trim() || !userImageBase64?.trim()) {
      console.error('Invalid prompt or image data');
      setIsGenerating(false);
      setGenerationQueue(prev => prev.slice(1));
      return;
    }

    try {
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Change the person's outfit to: ${prompt.trim()}. Keep the person's face, body shape, and pose exactly the same. Only change the clothing. Full body shot with space around feet and head. High-end fashion photography, studio lighting, professional model pose.`,
          images: [{ type: 'image', image: userImageBase64 }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate outfit image');
      }

      const data = await response.json();
      const imageData = data.image;
      
      // Create data URL for immediate display
      const dataUrl = `data:${imageData.mimeType};base64,${imageData.base64Data}`;
      
      // Remove from queue and update feed
      setGenerationQueue(prev => prev.filter(item => item.prompt !== prompt));
      setIsGenerating(false);
      
      // Add generated entry to feed (store URL only, not base64)
      const newEntry: FeedEntry = {
        id: Date.now().toString(),
        imageUrl: dataUrl,
        // Don't store base64 in the entry to save memory
        prompt: prompt,
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
        setTimeout(() => saveFeedToStorage(updated), 500);
        return updated;
      });
    } catch (error) {
      console.error('Failed to generate outfit:', error);
      setIsGenerating(false);
      setGenerationQueue(prev => prev.slice(1)); // Remove failed item
    }
  }, [saveFeedToStorage]);

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

  const processQueue = useCallback(async (userImageBase64: string) => {
    if (isGenerating || generationQueue.length === 0 || !userImageBase64?.trim()) return;
    
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
    if (!userImageBase64?.trim() || currentIndex < feed.length - 2) return;
    
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