import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { FeedEntry } from './FeedProvider';

const FAVORITES_STORAGE_KEY = '@user_favorites';

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteEntries, setFavoriteEntries] = useState<FeedEntry[]>([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
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
      const data = {
        favorites: Array.from(favIds),
        entries: entries,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save favorites:', error);
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
      newEntries.unshift(entry);
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