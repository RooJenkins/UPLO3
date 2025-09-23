import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    console.log('Using configured API base URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  // For development, use the Expo dev server URL
  if (Platform.OS === 'web') {
    // Web environment - use current origin
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    console.log('Using web base URL:', baseUrl);
    return baseUrl;
  }
  
  // Mobile environment - use the Expo dev server URL
  // The backend should be served by the same Expo dev server
  const mobileUrl = 'http://localhost:8081';
  console.log('Using mobile base URL:', mobileUrl);
  return mobileUrl;
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;
console.log('tRPC client connecting to:', trpcUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      fetch: async (url, options) => {
        console.log('tRPC fetch:', url);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error('tRPC fetch failed:', response.status, response.statusText);
            // For connection errors, provide more helpful error message
            if (response.status === 0 || response.status >= 500) {
              console.warn('Backend server may not be running. Using fallback mode.');
            }
          }
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          // Provide more helpful error messages for common issues
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              console.warn('tRPC request timed out. Backend may be slow or unavailable.');
            } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
              console.warn('Network error: Backend server may not be running or accessible.');
            }
          }
          // Re-throw to let tRPC handle the error properly
          throw error;
        }
      },
    }),
  ],
});

// Create a vanilla tRPC client for non-React usage
export const vanillaTrpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
    }),
  ],
});