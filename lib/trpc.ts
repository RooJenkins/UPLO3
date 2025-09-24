import { createTRPCReact } from '@trpc/react-query';
import { httpLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/router';
import superjson from 'superjson';

console.log('[TRPC] Initializing tRPC client configuration...');

export const trpc = createTRPCReact<AppRouter>();

// Enhanced base URL detection with environment awareness
function getBaseUrl(): string {
  console.log('[TRPC] Detecting environment and base URL...');

  // Prefer explicit backend base URL when provided (works on Rork/hosted)
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBase) {
    console.log('[TRPC] Using EXPO_PUBLIC_API_BASE_URL:', envBase);
    return envBase.replace(/\/$/, '');
  }

  // Check for Rork development environment
  const devServerUrl = process.env.EXPO_PUBLIC_DEV_SERVER_URL;
  if (devServerUrl) {
    console.log('[TRPC] Using EXPO_PUBLIC_DEV_SERVER_URL:', devServerUrl);
    return devServerUrl.replace(/\/$/, '');
  }

  // Browser environment detection
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    console.log('[TRPC] Browser environment - origin:', baseUrl);

    // Special handling for tunnel URLs (exp.direct domains)
    if (baseUrl.includes('.exp.direct')) {
      console.log('[TRPC] Detected Expo tunnel environment');
      return baseUrl;
    }

    // Local development
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      console.log('[TRPC] Detected local development environment');
      return baseUrl;
    }

    return baseUrl;
  }

  // Native environment fallbacks
  console.log('[TRPC] Native environment - checking fallbacks...');

  // Try common development server ports
  const fallbackUrls = [
    'http://localhost:8081',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://192.168.1.100:8081' // Common local network fallback
  ];

  const selectedFallback = fallbackUrls[0]; // Use first as default
  console.log('[TRPC] Using fallback URL:', selectedFallback);
  return selectedFallback;
}

const baseUrl = getBaseUrl();

// Smart tRPC URL construction
function buildTrpcUrl(baseUrl: string): string {
  // If baseUrl already includes /api, append /trpc
  if (baseUrl.endsWith('/api')) {
    return `${baseUrl}/trpc`;
  }
  // Otherwise append /api/trpc
  return `${baseUrl}/api/trpc`;
}

const trpcUrl = buildTrpcUrl(baseUrl);
console.log('[TRPC] Final tRPC URL:', trpcUrl);

// Enhanced fetch function with comprehensive error handling
async function enhancedFetch(url: string, options: RequestInit | undefined): Promise<Response> {
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`[TRPC:${requestId}] → ${options?.method || 'GET'} ${url}`);

  try {
    // Clone request options to avoid mutation
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-Source': 'trpc-client',
        'X-Request-ID': requestId,
        ...options?.headers,
      },
    };

    console.log(`[TRPC:${requestId}] Request options:`, {
      method: requestOptions.method,
      headers: requestOptions.headers,
      hasBody: !!requestOptions.body
    });

    const response = await fetch(url, requestOptions);

    console.log(`[TRPC:${requestId}] ← Status: ${response.status} ${response.statusText}`);
    console.log(`[TRPC:${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));

    // Clone response for error handling
    const responseClone = response.clone();

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await responseClone.text();
        console.error(`[TRPC:${requestId}] Error response body:`, errorBody.slice(0, 500));

        // Check if we received HTML instead of JSON (common issue)
        if (errorBody.trim().startsWith('<!DOCTYPE html>') || errorBody.trim().startsWith('<html')) {
          console.error(`[TRPC:${requestId}] Received HTML instead of JSON - API routes may not be working`);
          throw new Error(`API returned HTML instead of JSON (${response.status}). Check API route configuration.`);
        }

      } catch (parseError) {
        console.error(`[TRPC:${requestId}] Failed to read error response:`, parseError);
        errorBody = `Failed to read error response: ${parseError}`;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }

    // Validate response content type
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      console.warn(`[TRPC:${requestId}] Unexpected content-type: ${contentType}`);
    }

    console.log(`[TRPC:${requestId}] ✓ Request completed successfully`);
    return response;

  } catch (error) {
    console.error(`[TRPC:${requestId}] ✕ Request failed:`, error);

    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[TRPC:${requestId}] Network error - server may be unreachable`);
      throw new Error(`Network error: Unable to reach ${url}. Check if the development server is running.`);
    }

    // Re-throw with additional context
    if (error instanceof Error) {
      error.message = `tRPC Request Failed: ${error.message}`;
    }

    throw error;
  }
}

// Create enhanced tRPC client
export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      fetch: enhancedFetch,
      // Add request timeout
      fetchOptions: {
        timeout: 30000, // 30 second timeout
      },
    }),
  ],
});

console.log('[TRPC] Client configuration completed successfully');