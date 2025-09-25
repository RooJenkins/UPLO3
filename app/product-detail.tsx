import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Share,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Heart,
  Share2,
  ShoppingBag,
  Star,
  Truck,
  Shield,
  RotateCcw,
  Plus,
  Minus,
  Camera,
  ExternalLink
} from 'lucide-react-native';
import { trpc } from '../lib/trpc';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ProductDetailScreen = () => {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // API queries
  const {
    data: productData,
    isLoading,
    error
  } = trpc.catalog.getProductDetails.useQuery(
    { productId: parseInt(productId || '0') },
    { enabled: !!productId }
  );

  const {
    data: similarProducts
  } = trpc.catalog.getSimilarProducts.useQuery(
    { productId: parseInt(productId || '0'), limit: 6 },
    { enabled: !!productId }
  );

  const generateOutfit = trpc.outfit.generate.useMutation({
    onSuccess: (data) => {
      Alert.alert(
        'Outfit Generated',
        'Your AI outfit has been created! Check your feed to see it.',
        [
          { text: 'View Feed', onPress: () => router.push('/feed') },
          { text: 'Stay Here', style: 'cancel' }
        ]
      );
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to generate outfit. Please try again.');
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-2">Loading product...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !productData?.success || !productData.data) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-4">
          <ShoppingBag size={48} color="#9CA3AF" />
          <Text className="text-gray-900 text-lg font-medium mt-4">Product Not Found</Text>
          <Text className="text-gray-500 text-center mt-2">
            Sorry, we couldn't find the product you're looking for.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 bg-blue-500 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const product = productData.data;

  const formatPrice = (price: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(price / 100);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${product.name} from ${product.brand?.name}!`,
        url: product.url || ''
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleGenerateOutfit = () => {
    Alert.alert(
      'Generate Outfit',
      'Create an AI-powered outfit featuring this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            generateOutfit.mutate({
              prompt: `Create a stylish outfit featuring ${product.name} from ${product.brand?.name}. Make it trendy and fashionable.`,
              outfitId: `product_${product.id}_${Date.now()}`,
              userImageBase64: ''
            });
          }
        }
      ]
    );
  };

  const handleAddToCart = () => {
    if (!selectedColor || !selectedSize) {
      Alert.alert('Selection Required', 'Please select a color and size before adding to cart.');
      return;
    }

    Alert.alert(
      'Added to Cart',
      `${product.name} (${selectedColor}, ${selectedSize}) has been added to your cart.`,
      [{ text: 'OK' }]
    );
  };

  const renderImageGallery = () => {
    if (!product.images || product.images.length === 0) {
      return (
        <View className="w-full h-96 bg-gray-200 justify-center items-center">
          <ShoppingBag size={48} color="#9CA3AF" />
          <Text className="text-gray-500 mt-2">No image available</Text>
        </View>
      );
    }

    return (
      <View>
        {/* Main Image */}
        <View className="relative">
          <Image
            source={{ uri: product.images[selectedImageIndex]?.original_url }}
            className="w-full h-96"
            contentFit="cover"
          />

          {/* Sale Badge */}
          {product.salePrice && product.salePrice < product.basePrice && (
            <View className="absolute top-4 left-4 bg-red-500 px-3 py-1 rounded-full">
              <Text className="text-white font-medium">
                {Math.round((1 - (product.salePrice / product.basePrice)) * 100)}% OFF
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="absolute top-4 right-4 space-y-2">
            <TouchableOpacity
              onPress={() => setIsFavorite(!isFavorite)}
              className="p-3 bg-white/90 rounded-full shadow-sm"
            >
              <Heart
                size={24}
                color={isFavorite ? "#ef4444" : "#374151"}
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="p-3 bg-white/90 rounded-full shadow-sm"
            >
              <Share2 size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Image Navigation */}
          {product.images.length > 1 && (
            <View className="absolute bottom-4 self-center flex-row space-x-2">
              {product.images.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImageIndex(index)}
                  className={`w-3 h-3 rounded-full ${
                    index === selectedImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        {/* Thumbnail Images */}
        {product.images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-4 px-4"
          >
            {product.images.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedImageIndex(index)}
                className={`mr-3 border-2 rounded-lg ${
                  index === selectedImageIndex ? 'border-blue-500' : 'border-transparent'
                }`}
              >
                <Image
                  source={{ uri: image.original_url }}
                  className="w-16 h-16 rounded-lg"
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderVariantSelector = (type: 'color' | 'size', variants: string[]) => {
    const selectedValue = type === 'color' ? selectedColor : selectedSize;
    const setValue = type === 'color' ? setSelectedColor : setSelectedSize;

    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-medium text-gray-900 capitalize">
            {type}: {selectedValue && <Text className="text-blue-600">{selectedValue}</Text>}
          </Text>
          {type === 'size' && (
            <TouchableOpacity>
              <Text className="text-blue-600 text-sm">Size Guide</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {variants.map((variant, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setValue(variant)}
              className={`mr-3 px-4 py-2 rounded-lg border ${
                selectedValue === variant
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-white border-gray-300'
              }`}
            >
              <Text className={`font-medium ${
                selectedValue === variant ? 'text-white' : 'text-gray-700'
              }`}>
                {variant}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const availableColors = [...new Set(product.variants?.map(v => v.color) || [])];
  const availableSizes = [...new Set(product.variants?.map(v => v.size) || [])];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2"
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>

        <Text className="font-medium text-gray-900">Product Details</Text>

        <TouchableOpacity
          onPress={handleGenerateOutfit}
          className="p-2 -mr-2"
          disabled={generateOutfit.isPending}
        >
          <Camera size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef} className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        {renderImageGallery()}

        {/* Product Info */}
        <View className="px-4 py-6">
          {/* Brand and Name */}
          <Text className="text-sm text-gray-500 uppercase tracking-wide">
            {product.brand?.name}
          </Text>
          <Text className="text-2xl font-bold text-gray-900 mt-1">
            {product.name}
          </Text>

          {/* Rating and Reviews */}
          <View className="flex-row items-center mt-2">
            <View className="flex-row items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  color="#fbbf24"
                  fill="#fbbf24"
                />
              ))}
            </View>
            <Text className="text-gray-600 ml-2">4.8 (1,234 reviews)</Text>
          </View>

          {/* Price */}
          <View className="flex-row items-center mt-4">
            {product.salePrice && product.salePrice < product.basePrice ? (
              <>
                <Text className="text-3xl font-bold text-red-600">
                  {formatPrice(product.salePrice, product.currency)}
                </Text>
                <Text className="text-xl text-gray-500 line-through ml-2">
                  {formatPrice(product.basePrice, product.currency)}
                </Text>
              </>
            ) : (
              <Text className="text-3xl font-bold text-gray-900">
                {formatPrice(product.basePrice, product.currency)}
              </Text>
            )}
          </View>

          {/* Description */}
          <View className="mt-6">
            <Text className="font-medium text-gray-900 mb-2">Description</Text>
            <Text className={`text-gray-600 leading-6 ${!showFullDescription ? 'line-clamp-3' : ''}`}>
              {product.description || 'No description available.'}
            </Text>
            {(product.description?.length || 0) > 150 && (
              <TouchableOpacity
                onPress={() => setShowFullDescription(!showFullDescription)}
                className="mt-2"
              >
                <Text className="text-blue-600 font-medium">
                  {showFullDescription ? 'Show Less' : 'Read More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Color Selection */}
          {availableColors.length > 0 && renderVariantSelector('color', availableColors)}

          {/* Size Selection */}
          {availableSizes.length > 0 && renderVariantSelector('size', availableSizes)}

          {/* Quantity */}
          <View className="mb-6">
            <Text className="font-medium text-gray-900 mb-3">Quantity</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 border border-gray-300 rounded-lg"
              >
                <Minus size={20} color="#374151" />
              </TouchableOpacity>
              <Text className="mx-6 text-xl font-medium">{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity(quantity + 1)}
                className="p-3 border border-gray-300 rounded-lg"
              >
                <Plus size={20} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Features */}
          <View className="mb-6">
            <View className="flex-row items-center py-3 border-b border-gray-100">
              <Truck size={20} color="#10b981" />
              <Text className="ml-3 text-gray-700">Free shipping on orders over $50</Text>
            </View>
            <View className="flex-row items-center py-3 border-b border-gray-100">
              <Shield size={20} color="#10b981" />
              <Text className="ml-3 text-gray-700">1-year warranty included</Text>
            </View>
            <View className="flex-row items-center py-3">
              <RotateCcw size={20} color="#10b981" />
              <Text className="ml-3 text-gray-700">30-day return policy</Text>
            </View>
          </View>

          {/* Product Details */}
          {(product.materials || product.careInstructions) && (
            <View className="mb-6">
              <Text className="font-medium text-gray-900 mb-3">Product Details</Text>

              {product.materials && (
                <View className="mb-3">
                  <Text className="text-sm font-medium text-gray-700">Materials:</Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    {Array.isArray(product.materials) ? product.materials.join(', ') : product.materials}
                  </Text>
                </View>
              )}

              {product.careInstructions && (
                <View>
                  <Text className="text-sm font-medium text-gray-700">Care Instructions:</Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    {Array.isArray(product.careInstructions)
                      ? product.careInstructions.join(', ')
                      : product.careInstructions}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View className="mb-6">
              <Text className="font-medium text-gray-900 mb-3">Tags</Text>
              <View className="flex-row flex-wrap">
                {product.tags.map((tag, index) => (
                  <View key={index} className="bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2">
                    <Text className="text-sm text-gray-600">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Visit Store */}
          {product.url && (
            <TouchableOpacity
              onPress={() => Alert.alert('External Link', 'This will open the product page in your browser.')}
              className="flex-row items-center justify-center py-3 border border-gray-300 rounded-lg mb-6"
            >
              <ExternalLink size={20} color="#374151" />
              <Text className="ml-2 font-medium text-gray-700">Visit {product.brand?.name} Store</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Similar Products */}
        {similarProducts?.success && similarProducts.data && similarProducts.data.length > 0 && (
          <View className="px-4 pb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Similar Products</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {similarProducts.data.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  className="mr-4 w-40"
                  onPress={() => router.push({
                    pathname: '/product-detail',
                    params: { productId: item.id.toString() }
                  })}
                >
                  <Image
                    source={{ uri: item.mainImage }}
                    className="w-40 h-48 rounded-lg"
                    contentFit="cover"
                  />
                  <Text className="text-xs text-gray-500 mt-2">
                    {item.brand?.name}
                  </Text>
                  <Text className="font-medium text-gray-900" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="text-sm font-bold text-gray-900 mt-1">
                    {formatPrice(item.base_price)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View className="px-4 py-4 border-t border-gray-200 bg-white">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            onPress={handleGenerateOutfit}
            disabled={generateOutfit.isPending}
            className="flex-1 bg-gray-900 py-4 rounded-lg flex-row items-center justify-center"
          >
            {generateOutfit.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Camera size={20} color="white" />
                <Text className="text-white font-medium ml-2">Try AI Outfit</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAddToCart}
            className="flex-1 bg-blue-500 py-4 rounded-lg flex-row items-center justify-center"
          >
            <ShoppingBag size={20} color="white" />
            <Text className="text-white font-medium ml-2">Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ProductDetailScreen;