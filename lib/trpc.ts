import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // First priority: Rork platform API URL from environment
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    console.log('Using Rork API base URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  // Second priority: Check if we're on Rork platform
  if (typeof window !== 'undefined' && window.location.hostname.includes('rork.com')) {
    const rorkUrl = window.location.origin;
    console.log('Using Rork platform URL:', rorkUrl);
    return rorkUrl;
  }

  // For development, use the Expo dev server URL
  if (Platform.OS === 'web') {
    // Web environment - use current origin
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    console.log('Using web base URL:', baseUrl);
    return baseUrl;
  }

  // Mobile environment - try to get the dev server URL from Expo
  // Use the same host as the Metro bundler
  const devServerUrl = process.env.EXPO_PUBLIC_DEV_SERVER_URL || 'http://localhost:8081';
  console.log('Using mobile base URL:', devServerUrl);
  return devServerUrl;
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;
console.log('[TRPC-CLIENT] tRPC client connecting to:', trpcUrl);
console.log('[TRPC-CLIENT] Base URL:', baseUrl);
console.log('[TRPC-CLIENT] Platform:', Platform.OS);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      // Use standard fetch for better compatibility with tRPC server
      fetch: (url, options) => {
        console.log('[TRPC-CLIENT] Fetching:', url);
        return fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });
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
      // Use standard fetch for consistency
      fetch: (url, options) => {
        console.log('[VANILLA-TRPC] Fetching:', url);
        return fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });
      },
    }),
  ],
});

// Test function to check if tRPC is working
export const testTrpcConnection = async () => {
  try {
    console.log('[CONNECTION-TEST] Testing backend connection...');
    console.log('[CONNECTION-TEST] Base URL:', baseUrl);
    console.log('[CONNECTION-TEST] tRPC URL:', trpcUrl);

    // Test basic health endpoint first
    console.log('[CONNECTION-TEST] Testing health endpoint:', `${baseUrl}/api/`);
    const healthResponse = await fetch(`${baseUrl}/api/`);
    console.log('[CONNECTION-TEST] Health check response:', healthResponse.status, healthResponse.statusText);

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('[CONNECTION-TEST] Health check data:', healthData);
    } else {
      const errorText = await healthResponse.text();
      console.error('[CONNECTION-TEST] Health check failed:', errorText);
    }

    // Test backend test endpoint
    console.log('[CONNECTION-TEST] Testing backend test endpoint:', `${baseUrl}/api/test`);
    const testBackendResponse = await fetch(`${baseUrl}/api/test`);
    console.log('[CONNECTION-TEST] Backend test response:', testBackendResponse.status, testBackendResponse.statusText);

    if (testBackendResponse.ok) {
      const testBackendData = await testBackendResponse.json();
      console.log('[CONNECTION-TEST] Backend test data:', testBackendData);
    }

    // Test tRPC endpoint with vanilla client
    console.log('[CONNECTION-TEST] Testing tRPC endpoint with vanilla client...');
    try {
      const result = await vanillaTrpcClient.example.hi.query({ name: 'Connection Test' });
      console.log('[CONNECTION-TEST] Vanilla tRPC test successful:', result);
      return true;
    } catch (trpcError) {
      console.error('[CONNECTION-TEST] Vanilla tRPC test failed:', trpcError);

      // Fallback to direct HTTP test
      const queryParams = new URLSearchParams({
        input: JSON.stringify({})
      });
      console.log('[CONNECTION-TEST] Testing tRPC endpoint directly:', `${trpcUrl}/example.hi?${queryParams}`);
      const testResponse = await fetch(`${trpcUrl}/example.hi?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[CONNECTION-TEST] Direct tRPC test response:', testResponse.status, testResponse.statusText);

      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('[CONNECTION-TEST] Direct tRPC test data:', testData);
        return true;
      } else {
        const errorText = await testResponse.text();
        console.error('[CONNECTION-TEST] Direct tRPC test failed:', errorText);
      }
    }

    return false;
  } catch (error) {
    console.error('[CONNECTION-TEST] Connection test failed:', error);
    return false;
  }
};