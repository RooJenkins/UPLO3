import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { useStorage } from './StorageProvider';

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
const USER_IMAGES_KEY = '@user_images';

export const [UserProvider, useUser] = createContextHook(() => {
  const [state, setState] = useState<UserState>({
    isOnboarded: false,
    userImage: null,
    isLoading: true,
  });
  
  const { getItem, setItem, removeItem } = useStorage();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Load basic user state
      const stored = await getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        if (userData && typeof userData.isOnboarded === 'boolean') {
          setState(prev => ({
            ...prev,
            isOnboarded: userData.isOnboarded,
            isLoading: false,
          }));
          
          // Load user image separately if onboarded
          if (userData.isOnboarded) {
            const imageData = await getItem(USER_IMAGES_KEY);
            if (imageData) {
              try {
                const parsedImage = JSON.parse(imageData);
                if (parsedImage.originalImage) {
                  setState(prev => ({
                    ...prev,
                    userImage: parsedImage.originalImage,
                  }));
                }
              } catch (imageError) {
                console.error('Failed to parse user image:', imageError);
              }
            }
          }
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
      // Save basic state without image
      const basicState = {
        isOnboarded: true,
        timestamp: Date.now(),
      };
      
      // Save image separately with size optimization
      const imageData = {
        originalImage: {
          id: image.id,
          uri: image.uri,
          base64: image.base64, // Keep base64 for AI processing
          timestamp: image.timestamp,
        },
        timestamp: Date.now(),
      };
      
      await setItem(USER_STORAGE_KEY, JSON.stringify(basicState));
      await setItem(USER_IMAGES_KEY, JSON.stringify(imageData));
      
      setState({
        isOnboarded: true,
        userImage: image,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to save user image:', error);
      throw error;
    }
  };

  const clearUserData = async () => {
    try {
      await removeItem(USER_STORAGE_KEY);
      await removeItem(USER_IMAGES_KEY);
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