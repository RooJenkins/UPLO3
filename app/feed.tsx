import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFeed, FeedEntry } from '@/providers/FeedProvider';
import { useUser } from '@/providers/UserProvider';
import { FeedCard } from '@/components/FeedCard';
import { SwipeIndicator } from '@/components/SwipeIndicator';
import { LoadingCard } from '@/components/LoadingCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedScreen() {
  const { feed, currentIndex, setCurrentIndex, isLoading, processQueue, generateInitialFeed, preloadNextOutfits } = useFeed();
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
  if (feed.length < 5) {
    for (let i = feed.length; i < 5; i++) {
      displayFeed.push({ id: `loading_${i}`, isGenerating: true });
    }
  }

  if (isLoading && feed.length === 0) {
    return (
      <View style={styles.container}>
        <LoadingCard />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        style={styles.flatList}
      />
      
      {!hasScrolled && <SwipeIndicator />}
      <StatusBar style="light" />
    </View>
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
});