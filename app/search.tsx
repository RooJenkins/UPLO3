import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search as SearchIcon, TrendingUp } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSearch } from '@/providers/SearchProvider';
import { useFeed } from '@/providers/FeedProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SearchScreen() {
  const { query, setQuery, suggestions, searchResults, searchFeed, clearSearch, isSearching } = useSearch();
  const { feed } = useFeed();
  const [inputFocused, setInputFocused] = useState(false);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    searchFeed(feed, searchQuery);
  };

  const handleSuggestionPress = (suggestion: any) => {
    handleSearch(suggestion.text);
  };

  const renderSuggestion = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
    >
      <TrendingUp size={16} color="#666" />
      <Text style={styles.suggestionText}>{item.text}</Text>
      <Text style={styles.suggestionCount}>{item.count}</Text>
    </TouchableOpacity>
  );

  const renderResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        router.back();
        // TODO: Navigate to specific outfit
      }}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultStyle}>{item.metadata.style}</Text>
        <Text style={styles.resultOccasion}>{item.metadata.occasion}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search outfits, styles, brands..."
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {query.length === 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Trending searches</Text>
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View>
            {suggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <FlatList
                  data={suggestions.slice(0, 5)}
                  renderItem={renderSuggestion}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
            
            {searchResults.length > 0 && (
              <View style={styles.resultsSection}>
                <Text style={styles.sectionTitle}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </Text>
                <FlatList
                  data={searchResults}
                  renderItem={renderResult}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  columnWrapperStyle={styles.resultRow}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
            
            {!isSearching && searchResults.length === 0 && query.length > 0 && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No outfits found</Text>
                <Text style={styles.noResultsSubtext}>
                  Try searching for different styles or occasions
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    color: '#667eea',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textTransform: 'capitalize',
  },
  suggestionCount: {
    fontSize: 14,
    color: '#666',
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  resultsSection: {
    flex: 1,
  },
  resultRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultItem: {
    width: (SCREEN_WIDTH - 48) / 2,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  resultInfo: {
    padding: 12,
  },
  resultStyle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  resultOccasion: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  noResults: {
    alignItems: 'center',
    marginTop: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});