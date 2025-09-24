import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';

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
  const [feed, setFeed] = useState<FeedEntry[]>(INITIAL_FEED);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Simple generate function without tRPC for now
  const generateOutfit = useCallback(async (prompt: string, userImageBase64: string) => {
    try {
      setIsGenerating(true);
      
      // Mock generation for now - replace with tRPC later
      const mockOutfit: FeedEntry = {
        id: Date.now().toString(),
        imageUrl: `https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=${encodeURIComponent(prompt)}`,
        prompt,
        outfitId: `outfit_${Date.now()}`,
        items: [
          { id: '1', name: 'Generated T-Shirt', brand: 'AI Fashion', price: '$29.99', category: 'tops' },
          { id: '2', name: 'Generated Pants', brand: 'AI Fashion', price: '$59.99', category: 'bottoms' },
        ],
        metadata: {
          style: 'generated',
          occasion: 'ai-created',
          season: 'all',
          colors: ['generated'],
        },
        timestamp: Date.now(),
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFeed(prev => [mockOutfit, ...prev]);
    } catch (error) {
      console.error('Generate outfit error:', error);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    feed,
    currentIndex,
    setCurrentIndex,
    isLoading: false,
    isGenerating,
    generateOutfit,
    // Placeholder functions for compatibility
    queueGeneration: () => {},
    processQueue: async () => {},
    generateInitialFeed: () => {},
    preloadNextOutfits: () => {},
    generationQueue: [],
    preloadedUrls: new Set(),
    cloudSyncStatus: {
      isLoading: false,
      isError: false,
      error: null,
    },
  };
});