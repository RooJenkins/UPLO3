import React, { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc';
import { StorageProvider } from './StorageProvider';
import { UserProvider } from './UserProvider';
import { FeedProvider } from './FeedProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { BrandProvider } from './BrandProvider';
import { SearchProvider } from './SearchProvider';

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      mutations: {
        retry: 2,
      },
    },
  }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StorageProvider>
          <UserProvider>
            <FeedProvider>
              <FavoritesProvider>
                <BrandProvider>
                  <SearchProvider>
                    {children}
                  </SearchProvider>
                </BrandProvider>
              </FavoritesProvider>
            </FeedProvider>
          </UserProvider>
        </StorageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}