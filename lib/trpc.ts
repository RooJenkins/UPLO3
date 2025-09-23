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

  // Default to localhost for development
  if (Platform.OS === 'web') {
    // Web environment - use current origin
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    console.log('Using web base URL:', baseUrl);
    return baseUrl;
  }
  
  // Mobile environment - use localhost (Expo dev server)
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
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error('tRPC fetch failed:', response.status, response.statusText);
            // Don't throw for 404s or 500s, let tRPC handle them
          }
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
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