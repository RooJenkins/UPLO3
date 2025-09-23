import React, { ReactNode } from 'react';
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
  return (
    <StorageProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </StorageProvider>
  );
}