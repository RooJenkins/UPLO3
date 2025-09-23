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
import { Wifi, Cloud, CloudOff } from 'lucide-react-native';

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
  } = useFeed();
  const { userImage } = useUser();
  const [hasScrolled, setHasScrolled] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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

  // Add loading cards to the feed for smooth UX
  const displayFeed: (FeedEntry | { id: string; isGenerating: true })[] = [...feed];
  if (feed.length < 8) { // Increased for better preloading
    for (let i = feed.length; i < 8; i++) {
      displayFeed.push({ id: `loading_${i}`, isGenerating: true });
    }
  }

  // Cloud sync status indicator
  const renderCloudStatus = () => {
    if (!cloudSyncStatus) return null;
    
    if (cloudSyncStatus.isLoading) {
      return (
        <View style={styles.cloudStatus}>
          <Cloud size={16} color="#666" />
          <Text style={styles.cloudStatusText}>Syncing...</Text>
        </View>
      );
    }
    
    if (cloudSyncStatus.isError) {
      return (
        <View style={styles.cloudStatus}>
          <CloudOff size={16} color="#ff6b6b" />
          <Text style={styles.errorStatusText}>Offline</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.cloudStatus}>
        <Cloud size={16} color="#4ecdc4" />
        <Text style={styles.successStatusText}>Cloud</Text>
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

  if (isLoading && feed.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingCard />
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

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
        keyExtractor={(item) => item.id}
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
  cloudStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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