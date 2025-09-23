import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';

export const [StorageProvider, useStorage] = createContextHook(() => {
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
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error(`Failed to set item ${key}:`, error);
        throw error;
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
  }), []);
});