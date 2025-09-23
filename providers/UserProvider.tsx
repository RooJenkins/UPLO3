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
    console.log('UserProvider: Starting to load user data...');
    try {
      // Load basic user state
      const stored = await getItem(USER_STORAGE_KEY);
      console.log('UserProvider: Stored user data:', stored);
      
      if (stored) {
        const userData = JSON.parse(stored);
        console.log('UserProvider: Parsed user data:', userData);
        
        if (userData && typeof userData.isOnboarded === 'boolean') {
          console.log('UserProvider: Setting onboarded state:', userData.isOnboarded);
          setState(prev => ({
            ...prev,
            isOnboarded: userData.isOnboarded,
            isLoading: false,
          }));
          
          // Load user image separately if onboarded
          if (userData.isOnboarded) {
            console.log('UserProvider: Loading user image...');
            const imageData = await getItem(USER_IMAGES_KEY);
            if (imageData) {
              try {
                const parsedImage = JSON.parse(imageData);
                if (parsedImage.originalImage) {
                  console.log('UserProvider: Setting user image');
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
      
      console.log('UserProvider: No valid stored data, setting not onboarded');
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
    
    console.log('UserProvider: Setting loading to false');
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