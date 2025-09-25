import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/providers/AppProvider";

// Bulletproof splash screen handling for iOS TestFlight
SplashScreen.preventAutoHideAsync();

// Emergency splash screen hiding - ensures it ALWAYS hides
let splashHidden = false;
const hideSplashScreenSafely = () => {
  if (!splashHidden) {
    splashHidden = true;
    SplashScreen.hideAsync().catch((error) => {
      console.log('[SPLASH] Hide failed (expected):', error.message);
    });
    console.log('[SPLASH] 🚀 Splash screen hidden via emergency mechanism');
  }
};

// Multiple fallback timers for maximum reliability
setTimeout(hideSplashScreenSafely, 2000);  // 2 second fallback
setTimeout(hideSplashScreenSafely, 4000);  // 4 second fallback
setTimeout(hideSplashScreenSafely, 6000);  // 6 second absolute maximum

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="feed" />
      <Stack.Screen name="search" options={{ presentation: "modal" }} />
      <Stack.Screen name="brands" options={{ presentation: "modal" }} />
      <Stack.Screen name="outfit-detail" options={{ presentation: "modal" }} />
      <Stack.Screen name="image-viewer" options={{ presentation: "modal" }} />
      <Stack.Screen name="backend-test" options={{ presentation: "modal" }} />
      <Stack.Screen name="debug" options={{ presentation: "modal" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  // Additional safety net - hide splash screen when component mounts
  useEffect(() => {
    const timer = setTimeout(hideSplashScreenSafely, 1500); // 1.5 second immediate hide
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <AppProvider>
          <RootLayoutNav />
        </AppProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}