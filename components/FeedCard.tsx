import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Share, Bookmark, ShoppingBag } from 'lucide-react-native';
import { router } from 'expo-router';
import { FeedEntry } from '@/providers/FeedProvider';
import { useFavorites } from '@/providers/FavoritesProvider';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedCardProps {
  entry: FeedEntry;
  isActive: boolean;
}

export function FeedCard({ entry, isActive }: FeedCardProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [lastTap, setLastTap] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  // Reset image state when entry changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [entry.id, entry.imageUrl]);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      toggleFavorite(entry);
      
      // Animate heart
      heartScale.setValue(0);
      heartOpacity.setValue(1);
      
      Animated.parallel([
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.sequence([
          Animated.timing(heartOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      setLastTap(now);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (Math.abs(gestureState.dx) > 50) {
        // Pinch to zoom - open image viewer
        router.push({
          pathname: '/image-viewer',
          params: { imageUrl: entry.imageUrl, entryId: entry.id }
        });
      }
    },
  });

  const handleShare = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    // TODO: Implement share functionality
  };

  const handleBookmark = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    toggleFavorite(entry);
  };

  const handleShop = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    router.push({
      pathname: '/outfit-detail',
      params: { entryId: entry.id }
    });
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handleDoubleTap}
        activeOpacity={1}
      >
        <Image
          source={{ uri: entry.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(error) => {
            console.warn('[FEEDCARD] Image failed to load:', {
              url: entry.imageUrl,
              error: error.nativeEvent?.error || 'Unknown error',
              entryId: entry.id
            });
            setImageError(true);
            setImageLoaded(false);
          }}
          onLoad={() => {
            console.log('[FEEDCARD] ✅ Image loaded successfully:', entry.id);
            setImageError(false);
            setImageLoaded(true);
          }}
          onLoadStart={() => {
            console.log('[FEEDCARD] 🔄 Image loading started:', entry.id);
            setImageError(false);
          }}
        />

        {/* Loading indicator */}
        {!imageLoaded && !imageError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading outfit...</Text>
          </View>
        )}

        {/* Fallback for failed images - only show for real failures, not during loading */}
        {imageError && imageLoaded === false && (
          <View style={styles.imageFallback}>
            <Text style={styles.fallbackText}>Image Error</Text>
            <Text style={styles.fallbackSubtext}>{entry.prompt}</Text>
            <Text style={styles.fallbackUrl}>URL: {entry.imageUrl.substring(0, 60)}...</Text>
          </View>
        )}
        
        {/* Double tap heart animation */}
        <Animated.View
          style={[
            styles.heartAnimation,
            {
              transform: [{ scale: heartScale }],
              opacity: heartOpacity,
            },
          ]}
        >
          <Heart size={80} color="#fff" fill="#fff" />
        </Animated.View>

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBookmark}
        >
          <Heart
            size={28}
            color={isFavorite(entry.id) ? '#FF6B6B' : '#fff'}
            fill={isFavorite(entry.id) ? '#FF6B6B' : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Share size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBookmark}
        >
          <Bookmark
            size={28}
            color={isFavorite(entry.id) ? '#4ECDC4' : '#fff'}
            fill={isFavorite(entry.id) ? '#4ECDC4' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* Outfit info */}
      <View style={styles.infoContainer}>
        <Text style={styles.styleText}>{entry.metadata.style}</Text>
        <Text style={styles.occasionText}>{entry.metadata.occasion}</Text>
        
        <TouchableOpacity
          style={styles.shopButton}
          onPress={handleShop}
        >
          <ShoppingBag size={20} color="#fff" />
          <Text style={styles.shopButtonText}>Shop this look</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 10,
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 80,
  },
  styleText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  occasionText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    alignSelf: 'flex-start',
    gap: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  fallbackText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  fallbackSubtext: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  fallbackUrl: {
    color: '#aaa',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});