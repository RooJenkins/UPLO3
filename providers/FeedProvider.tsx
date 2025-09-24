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
  const [generationQueue, setGenerationQueue] = useState<string[]>([]);
  const [hasGeneratedInitial, setHasGeneratedInitial] = useState(false);

  // Generate using direct cloud API (fallback that works on web when API routes are unavailable)
  const generateOutfit = useCallback(async (prompt: string, userImageBase64: string) => {
    try {
      setIsGenerating(true);
      if (!prompt?.trim() || !userImageBase64?.trim()) return;

      // Call Rork toolkit image edit API directly
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Change the person's outfit to: ${prompt.trim()}. Keep the person's face and pose. Full body.`,
          images: [{ type: 'image', image: userImageBase64 }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloud edit failed: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      const image = data?.image;
      const imageUrl = image?.base64Data && image?.mimeType
        ? `data:${image.mimeType};base64,${image.base64Data}`
        : `https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=${encodeURIComponent('Fallback')}`;

      const entry: FeedEntry = {
        id: Date.now().toString(),
        imageUrl,
        prompt,
        outfitId: `outfit_${Date.now()}`,
        items: [
          { id: '1', name: 'White Tee', brand: 'AI', price: '$29.99', category: 'tops' },
          { id: '2', name: 'Blue Jeans', brand: 'AI', price: '$59.99', category: 'bottoms' },
        ],
        metadata: { style: 'generated', occasion: 'ai', season: 'all', colors: ['auto'] },
        timestamp: Date.now(),
      };

      setFeed(prev => [entry, ...prev]);
    } catch (error) {
      console.error('Generate outfit error:', error);
      // Last-resort placeholder to avoid empty feed
      const fallback: FeedEntry = {
        id: `fallback_${Date.now()}`,
        imageUrl: `https://via.placeholder.com/400x600/999999/FFFFFF?text=${encodeURIComponent('Offline')}`,
        prompt,
        outfitId: `outfit_${Date.now()}`,
        items: [],
        metadata: { style: 'fallback', occasion: 'n/a', season: 'all', colors: [] },
        timestamp: Date.now(),
      };
      setFeed(prev => [fallback, ...prev]);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Queue management
  const queueGeneration = useCallback((prompt?: string) => {
    if (prompt) {
      setGenerationQueue(prev => [...prev, prompt]);
    }
  }, []);

  // Process the generation queue
  const processQueue = useCallback(async (userImageBase64?: string) => {
    if (!userImageBase64 || generationQueue.length === 0 || isGenerating) return;

    const prompt = generationQueue[0];
    setGenerationQueue(prev => prev.slice(1));
    await generateOutfit(prompt, userImageBase64);
  }, [generationQueue, isGenerating, generateOutfit]);

  // Generate initial feed content
  const generateInitialFeed = useCallback((userImageBase64?: string) => {
    if (!userImageBase64 || hasGeneratedInitial) return;

    console.log('[FEED] Starting initial feed generation');
    setHasGeneratedInitial(true);

    const initialPrompts = [
      "casual summer outfit",
      "business professional attire",
      "trendy streetwear look",
      "elegant evening wear",
      "cozy weekend outfit"
    ];

    // Add all prompts to queue
    initialPrompts.forEach(prompt => queueGeneration(prompt));
  }, [hasGeneratedInitial, queueGeneration]);

  // Generate more outfits as user scrolls
  const preloadNextOutfits = useCallback((userImageBase64?: string) => {
    if (!userImageBase64 || isGenerating) return;

    const shouldGenerateMore = currentIndex >= feed.length - 3;
    if (shouldGenerateMore && generationQueue.length === 0) {
      const dynamicPrompts = [
        "vintage inspired outfit",
        "athletic wear ensemble",
        "minimalist chic style",
        "bohemian fashion look",
        "smart casual attire"
      ];

      const randomPrompt = dynamicPrompts[Math.floor(Math.random() * dynamicPrompts.length)];
      queueGeneration(randomPrompt);
    }
  }, [currentIndex, feed.length, isGenerating, generationQueue.length, queueGeneration]);

  return {
    feed,
    currentIndex,
    setCurrentIndex,
    isLoading: false,
    isGenerating,
    generateOutfit,
    queueGeneration,
    processQueue,
    generateInitialFeed,
    preloadNextOutfits,
    generationQueue,
    preloadedUrls: new Set(),
    cloudSyncStatus: {
      isLoading: isGenerating,
      isError: false,
      error: null,
    },
  };
});