import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useUser } from '@/providers/UserProvider';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const { isOnboarded, isLoading, userImage } = useUser();

  console.log('[INDEX] 🔍 Routing decision:', {
    isLoading,
    isOnboarded,
    hasUserImage: !!userImage,
    hasBase64: !!(userImage?.base64)
  });

  useEffect(() => {
    // Hide splash screen after providers are loaded
    if (!isLoading) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (isOnboarded) {
    return <Redirect href="/(main)/feed" />;
  }

  return <Redirect href="/onboarding" />;
}