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

  // Force reload to show outfit items - VERSION 2.0
  console.log('[PRODUCTFEEDCARD] ✨ VERSION 2.0 - Rendering with 4 outfit items feature');

  // 🚨 CRITICAL: Final safety check for product image URL to prevent React Native crashes
  const fallbackProductImageUrl = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22600%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%22400%22%20height%3D%22600%22%20fill%3D%22%234ecdc4%22/%3E%3Ctext%20x%3D%22200%22%20y%3D%22250%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%3EProduct%20Image%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22280%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%3EUnavailable%3C/text%3E%3Ctext%20x%3D%22200%22%20y%3D%22320%22%20text-anchor%3D%22middle%22%20fill%3D%22rgba(255,255,255,0.8)%22%20font-size%3D%2216%22%3EFallback%20Display%3C/text%3E%3C/svg%3E';

  const safeProductImageUrl = (!product.mainImage || product.mainImage === 'null' || product.mainImage === 'undefined' || product.mainImage.trim() === '')
    ? fallbackProductImageUrl
    : product.mainImage;

  // 🚨 CRITICAL: Additional validation to ensure URL is never null/undefined
  const finalImageUrl = safeProductImageUrl || fallbackProductImageUrl;

  // Log any URL issues for debugging
  if (finalImageUrl !== product.mainImage) {
    console.warn('[PRODUCTFEEDCARD] 🚨 Invalid image URL detected in ProductFeedCard:', product.mainImage, 'using fallback for product:', product.id);
  }

  // Extra safety log
  if (!finalImageUrl) {
    console.error('[PRODUCTFEEDCARD] ❌ CRITICAL: finalImageUrl is null/undefined!', { product: product.id, mainImage: product.mainImage });
  }
  const displayPrice = selectedVariant?.sale_price || selectedVariant?.current_price || product.base_price;
  const originalPrice = selectedVariant?.current_price || product.base_price;
  const isOnSale = (selectedVariant?.sale_price && selectedVariant.sale_price < originalPrice) || product.isOnSale;

  // Reset image state when entry changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [entry.id, finalImageUrl]);

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
        imageUrl: safeProductImageUrl, // 🚨 ULTRATHINK: Use validated image URL for favorites
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

  // Generate complementary outfit items based on main product category
  const generateOutfitItems = () => {
    const category = product.category.slug.toLowerCase();
    const items = [];

    // Map of complementary items for each category
    const outfitComplements = {
      // Tops category
      tops: [
        { type: 'Top', brand: product.brand.name, name: product.name, price: formatPrice(displayPrice) },
        { type: 'Bottom', brand: 'Levi\'s', name: 'Slim Fit Jeans', price: '$79.99' },
        { type: 'Shoes', brand: 'Nike', name: 'Air Force 1', price: '$110' },
        { type: 'Accessory', brand: 'Fossil', name: 'Leather Watch', price: '$125' },
      ],
      // Bottoms category
      bottoms: [
        { type: 'Top', brand: 'Uniqlo', name: 'Cotton T-Shirt', price: '$19.99' },
        { type: 'Bottom', brand: product.brand.name, name: product.name, price: formatPrice(displayPrice) },
        { type: 'Shoes', brand: 'Adidas', name: 'Stan Smith', price: '$90' },
        { type: 'Accessory', brand: 'Herschel', name: 'Card Holder', price: '$25' },
      ],
      // Dresses category
      dresses: [
        { type: 'Dress', brand: product.brand.name, name: product.name, price: formatPrice(displayPrice) },
        { type: 'Shoes', brand: 'Steve Madden', name: 'Heeled Sandals', price: '$89.99' },
        { type: 'Accessory', brand: 'Michael Kors', name: 'Clutch Bag', price: '$198' },
        { type: 'Jewelry', brand: 'Pandora', name: 'Bracelet Set', price: '$75' },
      ],
      // Outerwear category
      outerwear: [
        { type: 'Outerwear', brand: product.brand.name, name: product.name, price: formatPrice(displayPrice) },
        { type: 'Top', brand: 'Gap', name: 'Crew Neck Sweater', price: '$49.99' },
        { type: 'Bottom', brand: 'Dockers', name: 'Chinos', price: '$68' },
        { type: 'Shoes', brand: 'Clarks', name: 'Desert Boots', price: '$130' },
      ],
      // Shoes category
      shoes: [
        { type: 'Top', brand: 'Champion', name: 'Graphic Hoodie', price: '$54.99' },
        { type: 'Bottom', brand: 'Nike', name: 'Joggers', price: '$65' },
        { type: 'Shoes', brand: product.brand.name, name: product.name, price: formatPrice(displayPrice) },
        { type: 'Accessory', brand: 'Nike', name: 'Backpack', price: '$55' },
      ],
    };

    // Check which category and get appropriate items
    if (category.includes('top') || category.includes('shirt') || category.includes('blouse') || category.includes('sweater') || category.includes('hoodie')) {
      return outfitComplements.tops;
    } else if (category.includes('bottom') || category.includes('pant') || category.includes('jean') || category.includes('short') || category.includes('skirt')) {
      return outfitComplements.bottoms;
    } else if (category.includes('dress')) {
      return outfitComplements.dresses;
    } else if (category.includes('jacket') || category.includes('coat') || category.includes('blazer') || category.includes('cardigan')) {
      return outfitComplements.outerwear;
    } else if (category.includes('shoe') || category.includes('sneaker') || category.includes('boot') || category.includes('sandal')) {
      return outfitComplements.shoes;
    }

    // Default: treat as a top
    return outfitComplements.tops;
  };

  const outfitItems = generateOutfitItems();

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
          source={{ uri: finalImageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(error) => {
            console.warn('[PRODUCTFEEDCARD] Image failed to load:', {
              originalUrl: product.mainImage,
              safeUrl: finalImageUrl,
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

        {/* Outfit Items - Compact Single Line Display */}
        <View style={styles.outfitItemsContainer}>
          {outfitItems.map((item, index) => (
            <View key={index} style={styles.outfitItem}>
              <Text style={styles.outfitItemType}>{item.type}</Text>
              <Text style={styles.outfitItemSeparator}>•</Text>
              <Text style={styles.outfitItemBrand}>{item.brand}</Text>
              <Text style={styles.outfitItemName}>{item.name}</Text>
              <Text style={styles.outfitItemPrice}>{item.price}</Text>
            </View>
          ))}
        </View>
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
    bottom: 140,
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
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
    lineHeight: 26,
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
    marginBottom: 8,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
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
  outfitItemsContainer: {
    marginTop: 8,
    gap: 3,
  },
  outfitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outfitItemType: {
    color: '#4ECDC4',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 55,
  },
  outfitItemSeparator: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
  },
  outfitItemBrand: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
  outfitItemName: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.8,
    flex: 1,
  },
  outfitItemPrice: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});