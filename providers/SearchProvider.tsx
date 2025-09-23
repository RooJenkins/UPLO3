import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo } from 'react';
import { FeedEntry } from './FeedProvider';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'style' | 'occasion' | 'color' | 'brand';
  count: number;
}

const SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { id: '1', text: 'casual', type: 'style', count: 156 },
  { id: '2', text: 'business', type: 'style', count: 89 },
  { id: '3', text: 'date night', type: 'occasion', count: 67 },
  { id: '4', text: 'workout', type: 'occasion', count: 134 },
  { id: '5', text: 'black', type: 'color', count: 203 },
  { id: '6', text: 'white', type: 'color', count: 187 },
  { id: '7', text: 'nike', type: 'brand', count: 98 },
  { id: '8', text: 'zara', type: 'brand', count: 76 },
];

export const [SearchProvider, useSearch] = createContextHook(() => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FeedEntry[]>([]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return SEARCH_SUGGESTIONS;
    
    const normalizedQuery = query.toLowerCase().trim();
    return SEARCH_SUGGESTIONS.filter(suggestion =>
      suggestion.text.toLowerCase().includes(normalizedQuery)
    ).sort((a, b) => b.count - a.count);
  }, [query]);

  const searchFeed = (feedEntries: FeedEntry[], searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Simulate search delay
    setTimeout(() => {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      const results = feedEntries.filter(entry => {
        const searchableText = [
          entry.prompt,
          entry.metadata.style,
          entry.metadata.occasion,
          entry.metadata.season,
          ...entry.metadata.colors,
          ...entry.items.map(item => `${item.name} ${item.brand} ${item.category}`)
        ].join(' ').toLowerCase();
        
        return searchableText.includes(normalizedQuery);
      });
      
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  };

  const clearSearch = () => {
    setQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  return {
    query,
    setQuery,
    isSearching,
    searchResults,
    suggestions,
    searchFeed,
    clearSearch,
  };
});