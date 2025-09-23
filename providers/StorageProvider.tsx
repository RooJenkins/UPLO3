import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';

const MAX_STORAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB limit
const STORAGE_KEYS_TO_MONITOR = ['@outfit_feed_cache', '@user_favorites', '@user_images'];

export const [StorageProvider, useStorage] = createContextHook(() => {
  const getStorageSize = (data: string): number => {
    return new Blob([data]).size;
  };

  const getTotalStorageSize = async (): Promise<number> => {
    let totalSize = 0;
    for (const key of STORAGE_KEYS_TO_MONITOR) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += getStorageSize(data);
        }
      } catch (error) {
        console.warn(`Failed to get size for ${key}:`, error);
      }
    }
    return totalSize;
  };

  const cleanupStorage = async (): Promise<void> => {
    console.log('Starting storage cleanup...');
    
    try {
      // Clear feed cache first (largest consumer)
      await AsyncStorage.removeItem('@outfit_feed_cache');
      console.log('Cleared feed cache');
      
      // Clear favorites but keep the IDs
      const favData = await AsyncStorage.getItem('@user_favorites');
      if (favData) {
        try {
          const parsed = JSON.parse(favData);
          if (parsed.favorites) {
            // Keep only the favorite IDs, remove entries
            const minimal = {
              favorites: parsed.favorites,
              entries: [], // Remove all stored entries
              timestamp: Date.now(),
            };
            await AsyncStorage.setItem('@user_favorites', JSON.stringify(minimal));
            console.log('Cleaned favorites data');
          }
        } catch (parseError) {
          await AsyncStorage.removeItem('@user_favorites');
          console.log('Removed corrupted favorites data');
        }
      }
      
      // Keep user images but remove processed versions
      const userImages = await AsyncStorage.getItem('@user_images');
      if (userImages) {
        try {
          const parsed = JSON.parse(userImages);
          if (parsed.originalImage) {
            // Keep only original, remove processed
            const minimal = {
              originalImage: parsed.originalImage,
              timestamp: Date.now(),
            };
            await AsyncStorage.setItem('@user_images', JSON.stringify(minimal));
            console.log('Cleaned user images data');
          }
        } catch (parseError) {
          console.log('Failed to parse user images, keeping as is');
        }
      }
      
    } catch (error) {
      console.error('Storage cleanup failed:', error);
      // Last resort - clear everything
      try {
        await AsyncStorage.clear();
        console.log('Performed complete storage clear');
      } catch (clearError) {
        console.error('Complete clear failed:', clearError);
      }
    }
  };

  return useMemo(() => ({
    getItem: async (key: string): Promise<string | null> => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error(`Failed to get item ${key}:`, error);
        return null;
      }
    },
    
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const dataSize = getStorageSize(value);
        const totalSize = await getTotalStorageSize();
        
        // Check if this operation would exceed storage limit
        if (totalSize + dataSize > MAX_STORAGE_SIZE_BYTES) {
          console.warn(`Storage limit would be exceeded. Current: ${(totalSize / 1024 / 1024).toFixed(2)}MB, Adding: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
          await cleanupStorage();
        }
        
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error(`Failed to set item ${key}:`, error);
        
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          console.log('Quota exceeded, attempting cleanup and retry...');
          await cleanupStorage();
          
          // Retry with smaller data if possible
          try {
            await AsyncStorage.setItem(key, value);
          } catch (retryError) {
            console.error('Retry after cleanup failed:', retryError);
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    },
    
    removeItem: async (key: string): Promise<void> => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove item ${key}:`, error);
        throw error;
      }
    },
    
    clear: async (): Promise<void> => {
      try {
        await AsyncStorage.clear();
      } catch (error) {
        console.error('Failed to clear storage:', error);
        throw error;
      }
    },
    
    getStorageSize,
    getTotalStorageSize,
    cleanupStorage,
  }), []);
});