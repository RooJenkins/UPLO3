import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

interface UserImage {
  id: string;
  uri: string;
  base64?: string;
  timestamp: number;
}

interface UserState {
  isOnboarded: boolean;
  userImage: UserImage | null;
  isLoading: boolean;
}

const USER_STORAGE_KEY = '@user_data';

export const [UserProvider, useUser] = createContextHook(() => {
  const [state, setState] = useState<UserState>({
    isOnboarded: false,
    userImage: null,
    isLoading: true,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        // Validate stored data
        if (userData && typeof userData.isOnboarded === 'boolean') {
          setState(prev => ({
            ...prev,
            ...userData,
            isLoading: false,
          }));
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
    setState(prev => ({ ...prev, isLoading: false }));
  };

  const saveUserImage = async (image: UserImage) => {
    try {
      const newState = {
        isOnboarded: true,
        userImage: image,
        isLoading: false,
      };
      
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newState));
      setState(newState);
    } catch (error) {
      console.error('Failed to save user image:', error);
      throw error;
    }
  };

  const clearUserData = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setState({
        isOnboarded: false,
        userImage: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  };

  return {
    ...state,
    saveUserImage,
    clearUserData,
  };
});