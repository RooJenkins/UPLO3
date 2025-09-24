import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const loadUserData = useCallback(async () => {
    console.log('[USER] 🔍 Starting to load user data...');
    try {
      // Load basic user state
      const stored = await getItem(USER_STORAGE_KEY);
      console.log('UserProvider: Stored user data:', stored);
      
      let isOnboarded = false;
      let userImage = null;
      
      if (stored) {
        const userData = JSON.parse(stored);
        console.log('UserProvider: Parsed user data:', userData);
        
        if (userData && typeof userData.isOnboarded === 'boolean') {
          isOnboarded = userData.isOnboarded;
          console.log('UserProvider: Setting onboarded state:', isOnboarded);
          
          // Load user image separately if onboarded
          if (isOnboarded) {
            console.log('UserProvider: Loading user image...');
            const imageData = await getItem(USER_IMAGES_KEY);
            if (imageData) {
              try {
                const parsedImage = JSON.parse(imageData);
                if (parsedImage.originalImage) {
                  console.log('UserProvider: Setting user image');
                  userImage = parsedImage.originalImage;
                }
              } catch (imageError) {
                console.error('Failed to parse user image:', imageError);
              }
            }
          }
        }
      }
      
      // For debugging - validate onboarding state
      const shouldBeOnboarded = isOnboarded && userImage && userImage.base64;

      console.log('[USER] 🔍 Final state evaluation:', {
        storedOnboarded: isOnboarded,
        hasUserImage: !!userImage,
        hasBase64: !!(userImage?.base64),
        finalOnboardedState: shouldBeOnboarded
      });

      // Set all state at once to avoid multiple renders
      setState({
        isOnboarded: shouldBeOnboarded, // Only consider onboarded if we have both flag and image with base64
        userImage,
        isLoading: false,
      });

      console.log('[USER] ✅ Finished loading user data - onboarded:', shouldBeOnboarded);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setState({
        isOnboarded: false,
        userImage: null,
        isLoading: false,
      });
    }
  }, [getItem]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const saveUserImage = useCallback(async (image: UserImage) => {
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
  }, [setItem]);

  const clearUserData = useCallback(async () => {
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
  }, [removeItem]);

  return useMemo(() => ({
    ...state,
    saveUserImage,
    clearUserData,
  }), [state, saveUserImage, clearUserData]);
});