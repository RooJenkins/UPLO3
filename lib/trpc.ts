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
      fetch: async (url, options) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (!urlString?.trim()) {
          throw new Error('Invalid URL provided to tRPC fetch');
        }

        console.log('tRPC fetch:', url);
        console.log('tRPC fetch options:', JSON.stringify(options, null, 2));

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

          console.log('tRPC response status:', response.status, response.statusText);

          if (!response.ok) {
            // Clone response before reading text to avoid stream issues
            const responseClone = response.clone();
            const responseText = await responseClone.text();
            console.error('tRPC fetch failed:', response.status, {
              url: urlString,
              status: response.status,
              statusText: response.statusText,
              responseText: responseText.substring(0, 500) // Limit logged response length
            });

            // Check if this is an HTML response (API routes not working in dev mode)
            if (responseText.includes('<!DOCTYPE html>')) {
              console.warn('Received HTML instead of JSON - API routes may not be working in development mode');

              // Return a mock response for development
              if (urlString.includes('outfit.generate')) {
                return new Response(JSON.stringify([{
                  result: {
                    data: {
                      id: Date.now().toString(),
                      imageUrl: 'https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Mock+Outfit',
                      prompt: 'Mock outfit for development',
                      outfitId: `mock_${Date.now()}`,
                      items: [
                        { id: '1', name: 'Mock T-Shirt', brand: 'Dev Brand', price: '$19.99', category: 'tops' },
                        { id: '2', name: 'Mock Jeans', brand: 'Dev Brand', price: '$49.99', category: 'bottoms' }
                      ],
                      metadata: {
                        style: 'casual',
                        occasion: 'development',
                        season: 'all',
                        colors: ['mock', 'colors']
                      },
                      timestamp: Date.now()
                    }
                  }
                }]), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }

              if (urlString.includes('example.hi')) {
                return new Response(JSON.stringify([{
                  result: {
                    data: { greeting: 'Hello from mock API!' }
                  }
                }]), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }

            // For connection errors, provide more helpful error message
            if (response.status === 0 || response.status >= 500) {
              console.warn('Backend server may not be running. Check server logs.');
            } else if (response.status === 404) {
              console.warn('tRPC endpoint not found. Check API route configuration.');
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
      fetch: async (url, options) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        console.log('Vanilla tRPC fetch:', urlString);
        
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
          });
          
          console.log('Vanilla tRPC response:', response.status, response.statusText);
          return response;
        } catch (error) {
          console.error('Vanilla tRPC fetch error:', error);
          throw error;
        }
      },
    }),
  ],
});

// Test function to check if tRPC is working
export const testTrpcConnection = async () => {
  try {
    console.log('Testing backend connection...');
    console.log('Base URL:', baseUrl);
    console.log('tRPC URL:', trpcUrl);
    
    // Test basic health endpoint first
    console.log('Testing health endpoint:', `${baseUrl}/api/`);
    const healthResponse = await fetch(`${baseUrl}/api/`);
    console.log('Health check response:', healthResponse.status, healthResponse.statusText);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health check data:', healthData);
    } else {
      const errorText = await healthResponse.text();
      console.error('Health check failed:', errorText);
    }
    
    // Test backend test endpoint
    console.log('Testing backend test endpoint:', `${baseUrl}/api/test`);
    const testBackendResponse = await fetch(`${baseUrl}/api/test`);
    console.log('Backend test response:', testBackendResponse.status, testBackendResponse.statusText);
    
    if (testBackendResponse.ok) {
      const testBackendData = await testBackendResponse.json();
      console.log('Backend test data:', testBackendData);
    }
    
    // Test tRPC endpoint with proper format for query
    console.log('Testing tRPC endpoint with vanilla client...');
    try {
      const result = await vanillaTrpcClient.example.hi.query({ name: 'Connection Test' });
      console.log('Vanilla tRPC test successful:', result);
      return true;
    } catch (trpcError) {
      console.error('Vanilla tRPC test failed:', trpcError);
      
      // Fallback to direct HTTP test
      const queryParams = new URLSearchParams({
        input: JSON.stringify({})
      });
      console.log('Testing tRPC endpoint directly:', `${trpcUrl}/example.hi?${queryParams}`);
      const testResponse = await fetch(`${trpcUrl}/example.hi?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    
      console.log('Direct tRPC test response:', testResponse.status, testResponse.statusText);
      
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('Direct tRPC test data:', testData);
        return true;
      } else {
        const errorText = await testResponse.text();
        console.error('Direct tRPC test failed:', errorText);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
};