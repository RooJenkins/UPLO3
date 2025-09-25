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
import { Heart, Share, ShoppingBag, ExternalLink, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { useFavorites } from '@/providers/FavoritesProvider';
import * as Haptics from 'expo-haptics';
import { Platform, Linking } from 'react-native';
import { trpc } from '@/lib/trpc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ProductFeedEntry {
  id: string;
  type: 'product';
  product: {
    id: number;
    name: string;
    description: string;
    brand: {
      name: string;
      logo_url: string;
    };
    category: {
      name: string;
      slug: string;
    };
    base_price: number;
    sale_price?: number;
    currency?: string;
    mainImage: string;
    images: Array<{
      id: number;
      original_url: string;
      alt?: string;
    }>;
    variants: Array<{
      id: number;
      color: string;
      size: string;
      current_price: number;
      sale_price?: number;
      stock_quantity: number;
      is_available: boolean;
    }>;
    availableSizes: string[];
    availableColors: string[];
    tags: string[];
    isOnSale: boolean;
    popularity_score: number;
    url?: string;
  };
  timestamp: number;
}

interface ProductFeedCardProps {
  entry: ProductFeedEntry;
  isActive: boolean;
}

export function ProductFeedCard({ entry, isActive }: ProductFeedCardProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [lastTap, setLastTap] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(entry.product.variants[0]);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const generateOutfit = trpc.outfit.generate.useMutation();

  const { product } = entry;

  // 🚨 CRITICAL: Final safety check for product image URL to prevent React Native crashes
  const fallbackProductImageUrl = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%234ecdc4%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22250%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%3EProduct%20Image%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3EUnavailable%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EFallback%20Display%3C/text%3E%3C/svg%3E';

  const safeProductImageUrl = (!product.mainImage || product.mainImage === 'null' || product.mainImage === 'undefined' || product.mainImage.trim() === '')
    ? fallbackProductImageUrl
    : product.mainImage;

  // Log any URL issues for debugging
  if (safeProductImageUrl !== product.mainImage) {
    console.warn('[PRODUCTFEEDCARD] 🚨 Invalid image URL detected in ProductFeedCard:', product.mainImage, 'using fallback for product:', product.id);
  }
  const displayPrice = selectedVariant?.sale_price || selectedVariant?.current_price || product.base_price;
  const originalPrice = selectedVariant?.current_price || product.base_price;
  const isOnSale = (selectedVariant?.sale_price && selectedVariant.sale_price < originalPrice) || product.isOnSale;

  // Reset image state when entry changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [entry.id, product.mainImage]);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected - add to favorites
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Convert product to feed entry format for favorites
      const feedEntry = {
        id: entry.id,
        imageUrl: product.mainImage,
        prompt: `${product.brand.name} ${product.name}`,
        outfitId: `product_${product.id}`,
        items: [{
          id: product.id.toString(),
          name: product.name,
          brand: product.brand.name,
          price: `$${(displayPrice / 100).toFixed(2)}`,
          category: product.category.slug,
          buyUrl: product.url
        }],
        metadata: {
          style: product.tags.includes('casual') ? 'casual' : product.tags.includes('formal') ? 'formal' : 'trendy',
          occasion: product.tags.includes('athletic') ? 'workout' : 'shopping',
          season: product.tags.includes('summer') ? 'summer' : 'all',
          colors: product.availableColors.map(c => c.toLowerCase())
        },
        timestamp: entry.timestamp
      };

      toggleFavorite(feedEntry);

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
        // Swipe detected - open product detail
        router.push({
          pathname: '/product-detail',
          params: { productId: product.id.toString() }
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

  const handleFavorite = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    handleDoubleTap(); // Reuse the favorite logic
  };

  const handleShop = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    if (product.url) {
      // Open external product URL
      Linking.openURL(product.url);
    } else {
      // Navigate to product detail screen
      router.push({
        pathname: '/product-detail',
        params: { productId: product.id.toString() }
      });
    }
  };

  const handleGenerateOutfit = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    // Generate AI outfit featuring this product
    generateOutfit.mutate({
      prompt: `Create a stylish outfit featuring ${product.brand.name} ${product.name}. Make it ${product.tags.includes('casual') ? 'casual and comfortable' : product.tags.includes('formal') ? 'professional and elegant' : 'trendy and fashionable'}`,
      outfitId: `product_${product.id}_${Date.now()}`
    });
  };

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const favoriteId = `product_${product.id}`;
  const isFavorited = isFavorite(favoriteId);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={handleDoubleTap}
        activeOpacity={1}
      >
        <Image
          source={{ uri: safeProductImageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(error) => {
            console.warn('[PRODUCTFEEDCARD] Image failed to load:', {
              originalUrl: product.mainImage,
              safeUrl: safeProductImageUrl,
              error: error.nativeEvent?.error || 'Unknown error',
              productId: product.id
            });
            setImageError(true);
            setImageLoaded(false);
          }}
          onLoad={() => {
            console.log('[PRODUCTFEEDCARD] ✅ Image loaded successfully:', product.id);
            setImageError(false);
            setImageLoaded(true);
          }}
          onLoadStart={() => {
            console.log('[PRODUCTFEEDCARD] 🔄 Image loading started:', product.id);
            setImageError(false);
          }}
        />

        {/* Loading indicator */}
        {!imageLoaded && !imageError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading product...</Text>
          </View>
        )}

        {/* Fallback for failed images */}
        {imageError && imageLoaded === false && (
          <View style={styles.imageFallback}>
            <ShoppingBag size={48} color="#667eea" />
            <Text style={styles.fallbackText}>Image Error</Text>
            <Text style={styles.fallbackSubtext}>{product.brand.name} {product.name}</Text>
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

        {/* Product badges */}
        <View style={styles.badgesContainer}>
          {isOnSale && (
            <View style={styles.saleBadge}>
              <Text style={styles.saleBadgeText}>SALE</Text>
            </View>
          )}
          {product.tags.includes('trending') && (
            <View style={styles.trendingBadge}>
              <Zap size={14} color="#fff" />
              <Text style={styles.trendingBadgeText}>HOT</Text>
            </View>
          )}
        </View>

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
          onPress={handleFavorite}
        >
          <Heart
            size={28}
            color={isFavorited ? '#FF6B6B' : '#fff'}
            fill={isFavorited ? '#FF6B6B' : 'transparent'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Share size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(102, 126, 234, 0.9)' }]}
          onPress={handleGenerateOutfit}
          disabled={generateOutfit.isPending}
        >
          {generateOutfit.isPending ? (
            <ActivityIndicator size={24} color="#fff" />
          ) : (
            <Zap size={28} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Product info */}
      <View style={styles.infoContainer}>
        <View style={styles.brandRow}>
          <Image
            source={{
              uri: (!product.brand.logo_url || product.brand.logo_url === 'null' || product.brand.logo_url === 'undefined' || product.brand.logo_url.trim() === '')
                ? `data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22%23667eea%22%20rx%3D%224%22/%3E%3Ctext%20x%3D%2212%22%20y%3D%2216%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2212%22%20font-weight%3D%22bold%22%3E${encodeURIComponent(product.brand.name.charAt(0).toUpperCase())}%3C/text%3E%3C/svg%3E`
                : product.brand.logo_url
            }}
            style={styles.brandLogo}
          />
          <Text style={styles.brandText}>{product.brand.name}</Text>
        </View>

        <Text style={styles.productName}>{product.name}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>{formatPrice(displayPrice)}</Text>
          {isOnSale && (
            <Text style={styles.originalPrice}>{formatPrice(originalPrice)}</Text>
          )}
        </View>

        {/* Size and color variants */}
        <View style={styles.variantsContainer}>
          <Text style={styles.variantLabel}>
            {product.availableColors.length} colors, {product.availableSizes.length} sizes
          </Text>
        </View>

        <TouchableOpacity
          style={styles.shopButton}
          onPress={handleShop}
        >
          <ShoppingBag size={20} color="#fff" />
          <Text style={styles.shopButtonText}>Shop Now</Text>
          <ExternalLink size={16} color="#fff" />
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
    height: '60%',
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 10,
  },
  badgesContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  saleBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  saleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trendingBadge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 200,
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  brandLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  brandText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  productName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 28,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  currentPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.7,
    textDecorationLine: 'line-through',
  },
  variantsContainer: {
    marginBottom: 16,
  },
  variantLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
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
    marginTop: 16,
    marginBottom: 8,
  },
  fallbackSubtext: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
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