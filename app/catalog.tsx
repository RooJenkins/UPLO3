import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Search, Filter, Grid, List, Star, Heart, ShoppingBag, TrendingUp } from 'lucide-react-native';
import { trpc } from '../lib/trpc';

interface Product {
  id: string;
  name: string;
  description?: string;
  brand: { name: string; logo_url: string };
  category: { name: string; slug: string };
  basePrice: number;
  salePrice?: number;
  currency: string;
  images: Array<{ id: number; original_url: string; alt?: string }>;
  variants: Array<{ color: string; size: string; available: boolean }>;
  tags: string[];
  gender?: string;
  isActive: boolean;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  productCount: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  icon_name: string;
}

const CatalogScreen = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [showOnlyInStock, setShowOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // API queries
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts
  } = trpc.catalog.searchDatabaseProducts.useQuery({
    query: searchQuery,
    brand: selectedBrands.length > 0 ? selectedBrands.join(',') : undefined,
    category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
    priceRange: priceRange.min || priceRange.max ? priceRange : undefined,
    gender: selectedGender || undefined,
    inStock: showOnlyInStock,
    limit: 20,
    offset: page * 20
  }, {
    enabled: true,
    refetchOnWindowFocus: false
  });

  const { data: brandsData } = trpc.catalog.getDatabaseBrands.useQuery();
  const { data: categoriesData } = trpc.catalog.getDatabaseCategories.useQuery();
  const { data: trendingData } = trpc.catalog.getTrendingProducts.useQuery({ limit: 6 });

  // Effects
  useEffect(() => {
    if (productsData?.success && productsData.data) {
      if (page === 0) {
        setAllProducts(productsData.data as Product[]);
      } else {
        setAllProducts(prev => [...prev, ...(productsData.data as Product[])]);
      }
    }
  }, [productsData, page]);

  // Handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(0);
    setAllProducts([]);
  };

  const handleBrandToggle = (brandId: number) => {
    setSelectedBrands(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    );
    setPage(0);
    setAllProducts([]);
  };

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
    setPage(0);
    setAllProducts([]);
  };

  const handleFavoriteToggle = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const handleLoadMore = () => {
    if (productsData?.pagination?.hasMore && !productsLoading) {
      setPage(prev => prev + 1);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setAllProducts([]);
    await refetchProducts();
    setRefreshing(false);
  };

  const formatPrice = (price: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(price / 100);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBrands([]);
    setSelectedCategories([]);
    setPriceRange({});
    setSelectedGender('');
    setShowOnlyInStock(true);
    setSortBy('popularity');
    setPage(0);
    setAllProducts([]);
  };

  const renderProduct = (product: Product) => {
    const mainImage = product.images[0];
    const hasDiscount = product.salePrice && product.salePrice < product.basePrice;
    const isFavorite = favorites.has(product.id);

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          key={product.id}
          className="w-[48%] mb-4 bg-white rounded-xl shadow-sm"
          onPress={() => router.push({
            pathname: '/product-detail',
            params: { productId: product.id }
          })}
        >
          <View className="relative">
            <Image
              source={{ uri: mainImage?.original_url }}
              className="w-full h-48 rounded-t-xl"
              contentFit="cover"
            />

            {hasDiscount && (
              <View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded-full">
                <Text className="text-white text-xs font-medium">
                  {Math.round((1 - (product.salePrice! / product.basePrice)) * 100)}% OFF
                </Text>
              </View>
            )}

            <TouchableOpacity
              className="absolute top-2 right-2 p-2 bg-white/80 rounded-full"
              onPress={() => handleFavoriteToggle(product.id)}
            >
              <Heart
                size={16}
                color={isFavorite ? "#ef4444" : "#374151"}
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
            </TouchableOpacity>
          </View>

          <View className="p-3">
            <Text className="text-xs text-gray-500 uppercase tracking-wide">
              {product.brand.name}
            </Text>
            <Text className="font-medium text-gray-900 mt-1" numberOfLines={2}>
              {product.name}
            </Text>

            <View className="flex-row items-center justify-between mt-2">
              <View className="flex-row items-center space-x-1">
                {hasDiscount ? (
                  <>
                    <Text className="font-bold text-red-600">
                      {formatPrice(product.salePrice!, product.currency)}
                    </Text>
                    <Text className="text-sm text-gray-500 line-through">
                      {formatPrice(product.basePrice, product.currency)}
                    </Text>
                  </>
                ) : (
                  <Text className="font-bold text-gray-900">
                    {formatPrice(product.basePrice, product.currency)}
                  </Text>
                )}
              </View>

              <View className="flex-row items-center space-x-1">
                <Text className="text-xs text-gray-500">
                  {product.variants.filter(v => v.available).length} variants
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap mt-2">
              {product.tags.slice(0, 2).map((tag, index) => (
                <View key={index} className="bg-gray-100 px-2 py-1 rounded-full mr-1 mb-1">
                  <Text className="text-xs text-gray-600">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // List view
    return (
      <TouchableOpacity
        key={product.id}
        className="bg-white rounded-xl shadow-sm mb-3 p-4"
        onPress={() => router.push({
          pathname: '/product-detail',
          params: { productId: product.id }
        })}
      >
        <View className="flex-row">
          <View className="relative">
            <Image
              source={{ uri: mainImage?.original_url }}
              className="w-20 h-20 rounded-lg"
              contentFit="cover"
            />

            {hasDiscount && (
              <View className="absolute -top-1 -right-1 bg-red-500 px-1 py-0.5 rounded-full">
                <Text className="text-white text-xs font-medium">
                  -{Math.round((1 - (product.salePrice! / product.basePrice)) * 100)}%
                </Text>
              </View>
            )}
          </View>

          <View className="flex-1 ml-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-xs text-gray-500 uppercase tracking-wide">
                  {product.brand.name}
                </Text>
                <Text className="font-medium text-gray-900 mt-1" numberOfLines={2}>
                  {product.name}
                </Text>

                <View className="flex-row items-center mt-2">
                  {hasDiscount ? (
                    <>
                      <Text className="font-bold text-red-600 mr-2">
                        {formatPrice(product.salePrice!, product.currency)}
                      </Text>
                      <Text className="text-sm text-gray-500 line-through">
                        {formatPrice(product.basePrice, product.currency)}
                      </Text>
                    </>
                  ) : (
                    <Text className="font-bold text-gray-900">
                      {formatPrice(product.basePrice, product.currency)}
                    </Text>
                  )}
                </View>

                <View className="flex-row flex-wrap mt-2">
                  {product.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} className="bg-gray-100 px-2 py-1 rounded-full mr-1 mb-1">
                      <Text className="text-xs text-gray-600">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                className="p-2"
                onPress={() => handleFavoriteToggle(product.id)}
              >
                <Heart
                  size={20}
                  color={isFavorite ? "#ef4444" : "#374151"}
                  fill={isFavorite ? "#ef4444" : "transparent"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterSection = () => {
    if (!showFilters) return null;

    return (
      <View className="bg-white border-t border-gray-200 p-4">
        <ScrollView showsVerticalScrollIndicator={false} className="max-h-80">
          {/* Brands Filter */}
          <View className="mb-4">
            <Text className="font-semibold text-gray-900 mb-2">Brands</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              {brandsData?.data?.map((brand: Brand) => (
                <TouchableOpacity
                  key={brand.id}
                  onPress={() => handleBrandToggle(brand.id)}
                  className={`mr-2 px-3 py-2 rounded-full border ${
                    selectedBrands.includes(brand.id)
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text className={`text-sm ${
                    selectedBrands.includes(brand.id) ? 'text-white' : 'text-gray-700'
                  }`}>
                    {brand.name} ({brand.productCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Categories Filter */}
          <View className="mb-4">
            <Text className="font-semibold text-gray-900 mb-2">Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              {categoriesData?.data?.map((category: Category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => handleCategoryToggle(category.id)}
                  className={`mr-2 px-3 py-2 rounded-full border ${
                    selectedCategories.includes(category.id)
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text className={`text-sm ${
                    selectedCategories.includes(category.id) ? 'text-white' : 'text-gray-700'
                  }`}>
                    {category.name} ({category.productCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Clear Filters */}
          <TouchableOpacity
            onPress={clearFilters}
            className="bg-gray-100 py-2 px-4 rounded-lg self-center"
          >
            <Text className="text-gray-700 font-medium">Clear All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900 mb-3">Catalog</Text>

        {/* Search Bar */}
        <View className="flex-row items-center space-x-3">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Search size={20} color="#6B7280" />
            <TextInput
              className="flex-1 ml-2 text-gray-900"
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg ${showFilters ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <Filter size={20} color={showFilters ? "white" : "#6B7280"} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-lg bg-gray-200"
          >
            {viewMode === 'grid' ? (
              <List size={20} color="#6B7280" />
            ) : (
              <Grid size={20} color="#6B7280" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      {renderFilterSection()}

      {/* Trending Products */}
      {!searchQuery && allProducts.length === 0 && !productsLoading && trendingData?.data && (
        <View className="bg-white mx-4 mt-4 rounded-xl shadow-sm p-4">
          <View className="flex-row items-center mb-3">
            <TrendingUp size={20} color="#059669" />
            <Text className="ml-2 font-semibold text-gray-900">Trending Now</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trendingData.data.map((product: any) => (
              <TouchableOpacity
                key={product.id}
                className="mr-3 w-32"
                onPress={() => router.push({
                  pathname: '/product-detail',
                  params: { productId: product.id }
                })}
              >
                <Image
                  source={{ uri: product.mainImage }}
                  className="w-32 h-40 rounded-lg"
                  contentFit="cover"
                />
                <Text className="text-xs text-gray-500 mt-2" numberOfLines={1}>
                  {product.brand.name}
                </Text>
                <Text className="font-medium text-gray-900" numberOfLines={2}>
                  {product.name}
                </Text>
                <Text className="text-sm font-bold text-gray-900 mt-1">
                  {formatPrice(product.base_price)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Products List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;

          if (isNearBottom && !productsLoading && productsData?.pagination?.hasMore) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Results Info */}
        {(allProducts.length > 0 || productsLoading) && (
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-600">
              {productsData?.pagination?.total || 0} products found
            </Text>
            <View className="flex-row items-center">
              <Text className="text-gray-600 mr-2">Sort by:</Text>
              <TouchableOpacity>
                <Text className="text-blue-600 font-medium capitalize">{sortBy}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Products Grid/List */}
        {productsLoading && allProducts.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-500 mt-2">Loading products...</Text>
          </View>
        ) : allProducts.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <ShoppingBag size={48} color="#9CA3AF" />
            <Text className="text-gray-500 text-lg mt-4">No products found</Text>
            <Text className="text-gray-400 text-center mt-2">
              Try adjusting your search or filters
            </Text>
          </View>
        ) : (
          <View className={viewMode === 'grid' ? 'flex-row flex-wrap justify-between' : ''}>
            {allProducts.map(renderProduct)}
          </View>
        )}

        {/* Load More */}
        {productsLoading && allProducts.length > 0 && (
          <View className="py-4 justify-center items-center">
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text className="text-gray-500 mt-1">Loading more...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CatalogScreen;