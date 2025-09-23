import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { FeedEntry } from './FeedProvider';
import { useStorage } from './StorageProvider';

const FAVORITES_STORAGE_KEY = '@user_favorites';
const MAX_FAVORITE_ENTRIES = 20; // Limit stored favorites

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteEntries, setFavoriteEntries] = useState<FeedEntry[]>([]);
  
  const { getItem, setItem } = useStorage();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.favorites && Array.isArray(data.favorites)) {
          setFavorites(new Set(data.favorites));
        }
        if (data.entries && Array.isArray(data.entries)) {
          setFavoriteEntries(data.entries);
        }
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const saveFavorites = async (favIds: Set<string>, entries: FeedEntry[]) => {
    try {
      // Only store minimal data for favorites
      const minimalEntries = entries
        .slice(0, MAX_FAVORITE_ENTRIES)
        .map(entry => ({
          id: entry.id,
          imageUrl: entry.imageUrl,
          prompt: entry.prompt,
          outfitId: entry.outfitId,
          timestamp: entry.timestamp,
          // Remove heavy data - no base64, minimal items/metadata
          items: entry.items?.slice(0, 1) || [], // Keep only 1 item
          metadata: {
            style: entry.metadata?.style || '',
            occasion: entry.metadata?.occasion || '',
            season: '',
            colors: [],
          },
        }));
      
      const data = {
        favorites: Array.from(favIds),
        entries: minimalEntries,
        timestamp: Date.now(),
      };
      
      await setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save favorites:', error);
      // If saving fails, just keep the favorites IDs
      try {
        const minimalData = {
          favorites: Array.from(favIds),
          entries: [],
          timestamp: Date.now(),
        };
        await setItem(FAVORITES_STORAGE_KEY, JSON.stringify(minimalData));
      } catch (fallbackError) {
        console.error('Failed to save even minimal favorites:', fallbackError);
      }
    }
  };

  const toggleFavorite = (entry: FeedEntry) => {
    const newFavorites = new Set(favorites);
    let newEntries = [...favoriteEntries];

    if (favorites.has(entry.id)) {
      newFavorites.delete(entry.id);
      newEntries = newEntries.filter(e => e.id !== entry.id);
    } else {
      newFavorites.add(entry.id);
      // Remove base64 before storing
      const { base64, ...entryWithoutBase64 } = entry;
      newEntries.unshift(entryWithoutBase64);
      
      // Limit stored entries
      if (newEntries.length > MAX_FAVORITE_ENTRIES) {
        newEntries = newEntries.slice(0, MAX_FAVORITE_ENTRIES);
      }
    }

    setFavorites(newFavorites);
    setFavoriteEntries(newEntries);
    saveFavorites(newFavorites, newEntries);
  };

  const isFavorite = (entryId: string) => favorites.has(entryId);

  return {
    favorites,
    favoriteEntries,
    toggleFavorite,
    isFavorite,
  };
});