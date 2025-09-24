import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/providers/AppProvider";

SplashScreen.preventAutoHideAsync();

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