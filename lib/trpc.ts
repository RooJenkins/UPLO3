import { createTRPCReact } from '@trpc/react-query';
import { httpLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/router';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser environment
    const baseUrl = window.location.origin;
    console.log('[TRPC] Browser base URL:', baseUrl);
    return baseUrl;
  }
  
  // Default fallback
  console.log('[TRPC] Using fallback URL: http://localhost:8081');
  return 'http://localhost:8081';
}

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;
console.log('[TRPC] Full tRPC URL:', trpcUrl);

export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpLink({
      url: trpcUrl,
      fetch: (url, options) => {
        console.log('[TRPC] Fetching:', url);
        console.log('[TRPC] Options:', options);
        return fetch(url, options).then(response => {
          console.log('[TRPC] Response status:', response.status);
          console.log('[TRPC] Response ok:', response.ok);
          if (!response.ok) {
            return response.text().then(text => {
              console.error('[TRPC] Error response body:', text);
              throw new Error(`HTTP ${response.status}: ${text}`);
            });
          }
          return response;
        }).catch(error => {
          console.error('[TRPC] Fetch error:', error);
          throw error;
        });
      },
    }),
  ],
});