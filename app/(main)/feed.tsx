import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  Text,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeed, FeedEntry } from '@/providers/FeedProvider';
import { useUser } from '@/providers/UserProvider';
import { FeedCard } from '@/components/FeedCard';
import { SwipeIndicator } from '@/components/SwipeIndicator';
import { LoadingCard } from '@/components/LoadingCard';
import { TrpcStatus } from '@/components/TrpcStatus';
import { LoadingStats } from '@/components/LoadingStats';
import { Wifi, Cloud, CloudOff } from 'lucide-react-native';
import { Link } from 'expo-router';

export default function FeedScreen() {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const {
    feed,
    currentIndex,
    setCurrentIndex,
    isLoading,
    processQueue,
    generateInitialFeed,
    preloadNextOutfits,
    preloadedUrls,
    cloudSyncStatus,
    loadingStats,
    scrollVelocity,
    workerStats,
    // Continuous generation properties
    bufferHealth,
    distanceFromEnd,
    continuousEnabled,
    // Debug functions
    resetLoadingService,
  } = useFeed();
  const { userImage, clearUserData } = useUser();
  const [hasScrolled, setHasScrolled] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // tRPC status is now handled by a separate component

  useEffect(() => {
    if (userImage?.base64) {
      if (feed.length === 0) {
        generateInitialFeed(userImage.base64);
      }
      processQueue(userImage.base64);
    }
  }, [userImage, feed.length, generateInitialFeed, processQueue]);

  useEffect(() => {
    if (userImage?.base64) {
      preloadNextOutfits(userImage.base64);
    }
  }, [currentIndex, userImage, preloadNextOutfits]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      if (!hasScrolled && newIndex > 0) {
        setHasScrolled(true);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (!item) {
      return <LoadingCard />;
    }
    if (item.isGenerating) {
      return <LoadingCard />;
    }
    return <FeedCard entry={item} isActive={index === currentIndex} />;
  };

  const getItemLayout = (_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  });

  // Enhanced feed display with infinite scroll support
  const displayFeed: (FeedEntry | { id: string; isGenerating: true })[] = [...feed.filter(Boolean)];

  // Dynamically add loading cards based on buffer health and user position
  const bufferHealthNumber = bufferHealth || 0;
  const shouldShowMoreLoading = bufferHealthNumber < 90 || (distanceFromEnd && distanceFromEnd < 30);
  const loadingCardsCount = shouldShowMoreLoading ? 20 : 8; // More loading cards when buffer is low

  if (displayFeed.length < loadingCardsCount) {
    for (let i = displayFeed.length; i < loadingCardsCount; i++) {
      displayFeed.push({ id: `loading_${i}`, isGenerating: true });
    }
  }

  // Add extra padding for infinite scroll
  const totalItemsToShow = Math.max(displayFeed.length, currentIndex + 25);
  while (displayFeed.length < totalItemsToShow) {
    displayFeed.push({ id: `infinite_${displayFeed.length}`, isGenerating: true });
  }

  // Cloud sync status indicator
  const renderCloudStatus = () => {
    return (
      <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TrpcStatus style={styles.cloudStatus} />
          <Link href="/debug" asChild>
            <View style={styles.debugPill}>
              <Text style={styles.debugText}>Debug</Text>
            </View>
          </Link>
          <View
            style={[styles.debugPill, { backgroundColor: 'rgba(255, 0, 0, 0.8)' }]}
            onTouchEnd={() => {
              console.log('[FEED] 🔄 Full system reset initiated');
              resetLoadingService(); // Clear loading service first
              clearUserData(); // Then clear user data
              console.log('[FEED] ✨ Full reset complete');
            }}
          >
            <Text style={styles.debugText}>Reset</Text>
          </View>
        </View>

        {/* Advanced Loading Stats */}
        {loadingStats && (
          <LoadingStats
            stats={loadingStats}
            scrollVelocity={scrollVelocity || 0}
            style={styles.loadingStats}
          />
        )}
      </View>
    );
  };

  // Preload status indicator
  const renderPreloadStatus = () => {
    if (!preloadedUrls) return null;
    
    const preloadedCount = preloadedUrls.size;
    const totalImages = Math.min(feed.length, 5);
    
    if (preloadedCount > 0) {
      return (
        <View style={styles.preloadStatus}>
          <Wifi size={16} color="#4ecdc4" />
          <Text style={styles.successStatusText}>
            {preloadedCount}/{totalImages}
          </Text>
        </View>
      );
    }
    
    return null;
  };

  // Removed early return to fix React Hooks order violation

  const statusContainerStyle = {
    ...styles.statusContainer,
    top: insets.top + 20,
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        ref={flatListRef}
        data={displayFeed}
        renderItem={renderItem}
        keyExtractor={(item, index) => item?.id || `fallback_${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        style={styles.flatList}
      />
      
      <View style={statusContainerStyle}>
        {renderCloudStatus()}
        {renderPreloadStatus()}
      </View>
      
      {!hasScrolled && <SwipeIndicator />}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flatList: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',
    gap: 8,
  },
  cloudStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  preloadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  debugPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingStats: {
    marginTop: 4,
  },
  cloudStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffa500',
  },
  errorStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  successStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ecdc4',
  },
});