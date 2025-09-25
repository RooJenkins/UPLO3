import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useUser } from '@/providers/UserProvider';
import { View, ActivityIndicator, Text } from 'react-native';

export default function IndexScreen() {
  const { isOnboarded, isLoading, userImage } = useUser();
  const [emergencyTimeoutReached, setEmergencyTimeoutReached] = useState(false);

  console.log('[INDEX] 🔍 Routing decision:', {
    isLoading,
    isOnboarded,
    hasUserImage: !!userImage,
    hasBase64: !!(userImage?.base64),
    emergencyTimeoutReached
  });

  // Emergency timeout protection - critical for production builds
  useEffect(() => {
    const EMERGENCY_TIMEOUT = 15000; // 15 seconds absolute maximum
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('[INDEX] ⚠️ Emergency timeout reached - forcing app to proceed');
        setEmergencyTimeoutReached(true);
      }
    }, EMERGENCY_TIMEOUT);

    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  useEffect(() => {
    // Hide splash screen after providers are loaded
    if (!isLoading || emergencyTimeoutReached) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, emergencyTimeoutReached]);

  // Emergency timeout override - proceed to onboarding
  if (emergencyTimeoutReached) {
    console.log('[INDEX] 🚨 Emergency timeout - redirecting to onboarding');
    return <Redirect href="/onboarding" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ color: '#fff', marginTop: 20, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  if (isOnboarded) {
    return <Redirect href="/(main)/feed" />;
  }

  return <Redirect href="/onboarding" />;
}