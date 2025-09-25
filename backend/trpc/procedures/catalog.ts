import { z } from 'zod';
import { publicProcedure } from '../context';

// Conditional imports - only load database services in Node.js environment
let getDatabaseService: any, getSyncManager: any, getSupportedBrands: any;

try {
  // Only import database modules if running in Node.js (not React Native/Metro)
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    ({ getDatabaseService, getSyncManager } = require('../../database'));
    ({ getSupportedBrands } = require('../../scraper/adapters'));
  }
} catch (error) {
  console.warn('[CATALOG] Database modules not available in current environment:', error.message);
  // Fallback functions for React Native environment
  getDatabaseService = () => ({ getStats: () => ({ brands: {}, categories: {} }), searchProducts: () => ({ products: [], total: 0 }) });
  getSyncManager = () => ({ getStats: () => ({}), getSyncHistory: () => ([]) });
  getSupportedBrands = () => ['asos', 'zara', 'h&m', 'nike', 'adidas'];
}

// Mock data for development - will be replaced with real database integration
const MOCK_BRANDS = [
  { id: 1, name: 'Zara', slug: 'zara', logo_url: 'https://logo.clearbit.com/zara.com', website: 'https://zara.com' },
  { id: 2, name: 'H&M', slug: 'hm', logo_url: 'https://logo.clearbit.com/hm.com', website: 'https://hm.com' },
  { id: 3, name: 'ASOS', slug: 'asos', logo_url: 'https://logo.clearbit.com/asos.com', website: 'https://asos.com' },
  { id: 4, name: 'Nike', slug: 'nike', logo_url: 'https://logo.clearbit.com/nike.com', website: 'https://nike.com' },
  { id: 5, name: 'Adidas', slug: 'adidas', logo_url: 'https://logo.clearbit.com/adidas.com', website: 'https://adidas.com' }
];

const MOCK_CATEGORIES = [
  {
    id: 1,
    name: 'Tops',
    slug: 'tops',
    icon_name: 'Shirt',
    children: [
      { id: 11, name: 'T-Shirts', slug: 'tshirts', icon_name: 'Shirt', children: [] },
      { id: 12, name: 'Shirts', slug: 'shirts', icon_name: 'Shirt', children: [] },
      { id: 13, name: 'Blouses', slug: 'blouses', icon_name: 'Shirt', children: [] }
    ]
  },
  {
    id: 2,
    name: 'Bottoms',
    slug: 'bottoms',
    icon_name: 'Shirt',
    children: [
      { id: 21, name: 'Jeans', slug: 'jeans', icon_name: 'Shirt', children: [] },
      { id: 22, name: 'Pants', slug: 'pants', icon_name: 'Shirt', children: [] },
      { id: 23, name: 'Shorts', slug: 'shorts', icon_name: 'Shirt', children: [] }
    ]
  },
  {
    id: 3,
    name: 'Dresses',
    slug: 'dresses',
    icon_name: 'Shirt',
    children: []
  },
  {
    id: 4,
    name: 'Shoes',
    slug: 'shoes',
    icon_name: 'Footprints',
    children: [
      { id: 41, name: 'Sneakers', slug: 'sneakers', icon_name: 'Footprints', children: [] },
      { id: 42, name: 'Boots', slug: 'boots', icon_name: 'Footprints', children: [] },
      { id: 43, name: 'Sandals', slug: 'sandals', icon_name: 'Footprints', children: [] }
    ]
  },
  {
    id: 5,
    name: 'Accessories',
    slug: 'accessories',
    icon_name: 'Watch',
    children: []
  }
];

const MOCK_PRODUCTS = [
  {
    id: 1,
    brand: { name: 'Zara', logo_url: 'https://logo.clearbit.com/zara.com' },
    category: { name: 'Tops', slug: 'tops' },
    name: 'Classic White T-Shirt',
    description: 'A timeless white cotton t-shirt perfect for everyday wear',
    base_price: 2999, // $29.99 in cents
    tags: ['casual', 'basic', 'cotton'],
    is_trending: true,
    popularity_score: 95,
    minPrice: 2999,
    maxPrice: 2999,
    isOnSale: false,
    mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=600&fit=crop',
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableColors: ['White', 'Black', 'Gray'],
    variants: [
      { id: 1, color: 'White', size: 'M', current_price: 2999, stock_quantity: 15, is_available: true },
      { id: 2, color: 'Black', size: 'M', current_price: 2999, stock_quantity: 8, is_available: true }
    ],
    images: [
      { id: 1, original_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=600&fit=crop', image_type: 'product' }
    ]
  },
  {
    id: 2,
    brand: { name: 'Nike', logo_url: 'https://logo.clearbit.com/nike.com' },
    category: { name: 'Shoes', slug: 'shoes' },
    name: 'Air Max 270',
    description: 'Comfortable running shoes with max air cushioning',
    base_price: 15999, // $159.99 in cents
    tags: ['athletic', 'running', 'comfort'],
    is_trending: true,
    popularity_score: 88,
    minPrice: 15999,
    maxPrice: 15999,
    isOnSale: true,
    mainImage: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=600&fit=crop',
    availableSizes: ['7', '8', '9', '10', '11'],
    availableColors: ['Black', 'White', 'Red'],
    variants: [
      { id: 3, color: 'Black', size: '9', current_price: 15999, sale_price: 12799, stock_quantity: 25, is_available: true },
      { id: 4, color: 'White', size: '10', current_price: 15999, stock_quantity: 12, is_available: true }
    ],
    images: [
      { id: 2, original_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=600&fit=crop', image_type: 'product' }
    ]
  },
  {
    id: 3,
    brand: { name: 'H&M', logo_url: 'https://logo.clearbit.com/hm.com' },
    category: { name: 'Bottoms', slug: 'bottoms' },
    name: 'Slim Fit Jeans',
    description: 'Classic blue jeans with a modern slim fit',
    base_price: 4999, // $49.99 in cents
    tags: ['denim', 'casual', 'slim-fit'],
    is_trending: false,
    popularity_score: 72,
    minPrice: 4999,
    maxPrice: 4999,
    isOnSale: false,
    mainImage: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=600&fit=crop',
    availableSizes: ['28', '30', '32', '34', '36'],
    availableColors: ['Blue', 'Black', 'Gray'],
    variants: [
      { id: 5, color: 'Blue', size: '32', current_price: 4999, stock_quantity: 20, is_available: true },
      { id: 6, color: 'Black', size: '30', current_price: 4999, stock_quantity: 5, is_available: true }
    ],
    images: [
      { id: 3, original_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=600&fit=crop', image_type: 'product' }
    ]
  },
  {
    id: 4,
    brand: { name: 'ASOS', logo_url: 'https://logo.clearbit.com/asos.com' },
    category: { name: 'Dresses', slug: 'dresses' },
    name: 'Summer Midi Dress',
    description: 'Flowy midi dress perfect for summer occasions',
    base_price: 7999, // $79.99 in cents
    tags: ['summer', 'midi', 'flowy', 'casual'],
    is_trending: true,
    popularity_score: 90,
    minPrice: 7999,
    maxPrice: 7999,
    isOnSale: true,
    mainImage: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=600&fit=crop',
    availableSizes: ['XS', 'S', 'M', 'L'],
    availableColors: ['Floral', 'Navy', 'Red'],
    variants: [
      { id: 7, color: 'Floral', size: 'M', current_price: 7999, sale_price: 5999, stock_quantity: 18, is_available: true },
      { id: 8, color: 'Navy', size: 'L', current_price: 7999, stock_quantity: 10, is_available: true }
    ],
    images: [
      { id: 4, original_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=600&fit=crop', image_type: 'product' }
    ]
  },
  {
    id: 5,
    brand: { name: 'Adidas', logo_url: 'https://logo.clearbit.com/adidas.com' },
    category: { name: 'Tops', slug: 'tops' },
    name: 'Performance Tank Top',
    description: 'Breathable athletic tank top for workout sessions',
    base_price: 3499, // $34.99 in cents
    tags: ['athletic', 'performance', 'breathable'],
    is_trending: false,
    popularity_score: 75,
    minPrice: 3499,
    maxPrice: 3499,
    isOnSale: false,
    mainImage: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&h=600&fit=crop',
    availableSizes: ['S', 'M', 'L', 'XL'],
    availableColors: ['Black', 'White', 'Blue'],
    variants: [
      { id: 9, color: 'Black', size: 'L', current_price: 3499, stock_quantity: 22, is_available: true },
      { id: 10, color: 'Blue', size: 'M', current_price: 3499, stock_quantity: 14, is_available: true }
    ],
    images: [
      { id: 5, original_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&h=600&fit=crop', image_type: 'product' }
    ]
  }
];

// Input validation schemas
const searchProductsSchema = z.object({
  query: z.string().optional(),
  brandIds: z.array(z.number()).optional(),
  categoryIds: z.array(z.number()).optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  isOnSale: z.boolean().optional(),
  inStock: z.boolean().default(true),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['name', 'price_asc', 'price_desc', 'newest', 'popularity']).default('popularity')
});

// Helper function to get category icon based on name
function getCategoryIcon(categoryName: string): string {
  const iconMap: Record<string, string> = {
    'tops': 'Shirt',
    'shirts': 'Shirt',
    'tshirts': 'Shirt',
    'blouses': 'Shirt',
    'bottoms': 'Shirt',
    'jeans': 'Shirt',
    'pants': 'Shirt',
    'shorts': 'Shirt',
    'dresses': 'Shirt',
    'shoes': 'Footprints',
    'sneakers': 'Footprints',
    'boots': 'Footprints',
    'sandals': 'Footprints',
    'accessories': 'Watch',
    'bags': 'ShoppingBag',
    'jewelry': 'Watch',
    'outerwear': 'Shirt',
    'jackets': 'Shirt',
    'coats': 'Shirt'
  };

  return iconMap[categoryName.toLowerCase()] || 'Shirt';
}

export const catalogProcedures = {
  // Get database statistics
  getDatabaseStats: publicProcedure.query(async () => {
    console.log('[CATALOG] 📊 Getting database statistics');

    try {
      const databaseService = getDatabaseService();
      const syncManager = getSyncManager();

      const dbStats = databaseService.getStats();
      const syncStats = syncManager.getStats();
      const supportedBrands = getSupportedBrands();

      return {
        success: true,
        data: {
          database: dbStats,
          sync: syncStats,
          scraper: {
            supportedBrands,
            totalSupportedBrands: supportedBrands.length
          }
        }
      };
    } catch (error) {
      console.error('[CATALOG] ❌ Error getting database stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }),

  // Search real products from database
  searchDatabaseProducts: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
      priceRange: z.object({
        min: z.number().optional(),
        max: z.number().optional()
      }).optional(),
      gender: z.string().optional(),
      tags: z.array(z.string()).optional(),
      inStock: z.boolean().default(true),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input }) => {
      console.log('[CATALOG] 🔍 Searching database products with filters:', JSON.stringify(input, null, 2));

      try {
        const databaseService = getDatabaseService();

        const searchResult = databaseService.searchProducts({
          brand: input.brand,
          category: input.category,
          priceRange: input.priceRange ? {
            min: input.priceRange.min || 0,
            max: input.priceRange.max || Number.MAX_SAFE_INTEGER
          } : undefined,
          gender: input.gender,
          tags: input.tags,
          inStock: input.inStock,
          limit: input.limit,
          offset: input.offset
        });

        // Transform database products to API format
        const transformedProducts = searchResult.products.map(product => ({
          id: product.id,
          externalId: product.externalId,
          name: product.name,
          description: product.description,
          brand: {
            name: product.brand,
            logo_url: `https://logo.clearbit.com/${product.brand.toLowerCase()}.com`
          },
          category: {
            name: product.category,
            slug: product.category.toLowerCase()
          },
          basePrice: product.basePrice,
          salePrice: product.salePrice,
          currency: product.currency,
          images: product.images.map((img, index) => ({
            id: index,
            original_url: img.cdnUrl || img.url,
            alt: img.alt,
            cached: img.cached
          })),
          variants: product.variants.map(variant => ({
            id: variant.id,
            color: variant.color,
            size: variant.size,
            sku: variant.sku,
            available: variant.available,
            stockQuantity: variant.stockQuantity,
            price: variant.price
          })),
          materials: product.materials,
          careInstructions: product.careInstructions,
          tags: product.tags,
          gender: product.gender,
          season: product.season,
          url: product.url,
          lastScraped: product.lastScraped,
          isActive: product.isActive
        }));

        console.log(`[CATALOG] ✅ Found ${searchResult.total} database products, returning ${transformedProducts.length}`);

        return {
          success: true,
          data: transformedProducts,
          pagination: {
            total: searchResult.total,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < searchResult.total
          }
        };

      } catch (error) {
        console.error('[CATALOG] ❌ Error searching database products:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search failed',
          data: [],
          pagination: {
            total: 0,
            limit: input.limit,
            offset: input.offset,
            hasMore: false
          }
        };
      }
    }),

  // Get sync manager statistics
  getSyncManagerStats: publicProcedure.query(async () => {
    console.log('[CATALOG] 🔄 Getting sync manager statistics');

    try {
      const syncManager = getSyncManager();
      const stats = syncManager.getStats();
      const recentHistory = syncManager.getSyncHistory(10);

      return {
        success: true,
        data: {
          ...stats,
          recentHistory: recentHistory.map(h => ({
            ...h,
            timestamp: h.timestamp.toISOString(),
            errors: h.errors.slice(0, 3) // Limit errors for API response
          }))
        }
      };
    } catch (error) {
      console.error('[CATALOG] ❌ Error getting sync manager stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stats retrieval failed'
      };
    }
  }),

  // Get brands from database
  getDatabaseBrands: publicProcedure.query(async () => {
    console.log('[CATALOG] 📋 Getting brands from database');

    try {
      const databaseService = getDatabaseService();
      const dbStats = databaseService.getStats();

      // Convert brand counts to brand list
      const brands = Object.entries(dbStats.brands).map(([name, count], index) => ({
        id: index + 1,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        logo_url: `https://logo.clearbit.com/${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        productCount: count,
        lastUpdated: new Date().toISOString()
      }));

      // Add supported brands that might not have products yet
      const supportedBrands = getSupportedBrands();
      supportedBrands.forEach(brandName => {
        const formattedName = brandName === 'h&m' ? 'H&M' :
                             brandName.charAt(0).toUpperCase() + brandName.slice(1);

        if (!brands.some(b => b.name.toLowerCase() === formattedName.toLowerCase())) {
          brands.push({
            id: brands.length + 1,
            name: formattedName,
            slug: brandName,
            logo_url: `https://logo.clearbit.com/${brandName.replace(/[^a-z0-9]/g, '')}.com`,
            productCount: 0,
            lastUpdated: new Date().toISOString()
          });
        }
      });

      return {
        success: true,
        data: brands.sort((a, b) => b.productCount - a.productCount),
        count: brands.length
      };
    } catch (error) {
      console.error('[CATALOG] ❌ Error getting database brands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get brands'
      };
    }
  }),

  // Get categories from database
  getDatabaseCategories: publicProcedure.query(async () => {
    console.log('[CATALOG] 📂 Getting categories from database');

    try {
      const databaseService = getDatabaseService();
      const dbStats = databaseService.getStats();

      // Convert category counts to category hierarchy
      const categories = Object.entries(dbStats.categories).map(([name, count], index) => ({
        id: index + 1,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        slug: name.toLowerCase(),
        productCount: count,
        icon_name: getCategoryIcon(name),
        children: []
      }));

      return {
        success: true,
        data: categories.sort((a, b) => b.productCount - a.productCount),
        count: categories.length
      };
    } catch (error) {
      console.error('[CATALOG] ❌ Error getting database categories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get categories'
      };
    }
  }),

  // Get all active brands
  getBrands: publicProcedure.query(async () => {
    console.log('[CATALOG] 📋 Getting all active brands');

    // Simulate slight delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      data: MOCK_BRANDS,
      count: MOCK_BRANDS.length
    };
  }),

  // Get product categories hierarchy
  getCategories: publicProcedure.query(async () => {
    console.log('[CATALOG] 📂 Getting category hierarchy');

    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      data: MOCK_CATEGORIES,
      count: MOCK_CATEGORIES.length
    };
  }),

  // Advanced product search with filters
  searchProducts: publicProcedure
    .input(searchProductsSchema)
    .query(async ({ input }) => {
      console.log('[CATALOG] 🔍 Searching products with filters:', JSON.stringify(input, null, 2));

      let filteredProducts = [...MOCK_PRODUCTS];

      // Apply text search filter
      if (input.query) {
        const query = input.query.toLowerCase();
        filteredProducts = filteredProducts.filter(product =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some(tag => tag.toLowerCase().includes(query)) ||
          product.brand.name.toLowerCase().includes(query)
        );
      }

      // Apply brand filter
      if (input.brandIds?.length) {
        const brandNames = input.brandIds.map(id => MOCK_BRANDS.find(b => b.id === id)?.name).filter(Boolean);
        filteredProducts = filteredProducts.filter(product =>
          brandNames.includes(product.brand.name)
        );
      }

      // Apply category filter
      if (input.categoryIds?.length) {
        const categoryNames = input.categoryIds.map(id => MOCK_CATEGORIES.find(c => c.id === id)?.name).filter(Boolean);
        filteredProducts = filteredProducts.filter(product =>
          categoryNames.includes(product.category.name)
        );
      }

      // Apply price range filter
      if (input.priceMin !== undefined) {
        filteredProducts = filteredProducts.filter(product => product.base_price >= input.priceMin!);
      }

      if (input.priceMax !== undefined) {
        filteredProducts = filteredProducts.filter(product => product.base_price <= input.priceMax!);
      }

      // Apply sale filter
      if (input.isOnSale) {
        filteredProducts = filteredProducts.filter(product => product.isOnSale);
      }

      // Apply in-stock filter
      if (input.inStock) {
        filteredProducts = filteredProducts.filter(product =>
          product.variants.some(v => v.is_available && v.stock_quantity > 0)
        );
      }

      // Apply sorting
      switch (input.sortBy) {
        case 'name':
          filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'price_asc':
          filteredProducts.sort((a, b) => a.base_price - b.base_price);
          break;
        case 'price_desc':
          filteredProducts.sort((a, b) => b.base_price - a.base_price);
          break;
        case 'newest':
          // Mock: reverse order for "newest"
          filteredProducts.reverse();
          break;
        case 'popularity':
        default:
          filteredProducts.sort((a, b) => b.popularity_score - a.popularity_score);
          break;
      }

      // Apply pagination
      const totalCount = filteredProducts.length;
      const paginatedProducts = filteredProducts.slice(input.offset, input.offset + input.limit);

      console.log(`[CATALOG] ✅ Found ${totalCount} products, returning ${paginatedProducts.length}`);

      return {
        success: true,
        data: paginatedProducts,
        pagination: {
          total: totalCount,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + input.limit < totalCount
        }
      };
    }),

  // Get trending/featured products
  getTrendingProducts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(12),
      categoryId: z.number().optional()
    }))
    .query(async ({ input }) => {
      console.log('[CATALOG] 🔥 Getting trending products', { limit: input.limit, categoryId: input.categoryId });

      let trendingProducts = MOCK_PRODUCTS.filter(product => product.is_trending);

      // Apply category filter if specified
      if (input.categoryId) {
        const categoryName = MOCK_CATEGORIES.find(c => c.id === input.categoryId)?.name;
        if (categoryName) {
          trendingProducts = trendingProducts.filter(product =>
            product.category.name === categoryName
          );
        }
      }

      // Sort by popularity and limit
      trendingProducts = trendingProducts
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, input.limit);

      return {
        success: true,
        data: trendingProducts,
        count: trendingProducts.length
      };
    }),

  // Get product details with full variant/image data
  getProductDetails: publicProcedure
    .input(z.object({
      productId: z.number()
    }))
    .query(async ({ input }) => {
      console.log('[CATALOG] 📋 Getting product details for ID:', input.productId);

      const product = MOCK_PRODUCTS.find(p => p.id === input.productId);

      if (!product) {
        throw new Error(`Product with ID ${input.productId} not found`);
      }

      // Enrich product with computed properties
      const enrichedProduct = {
        ...product,
        priceRange: {
          min: product.minPrice,
          max: product.maxPrice
        },
        totalStock: product.variants.reduce((sum, v) => sum + v.stock_quantity, 0),
        availableVariants: product.variants.filter(v => v.is_available && v.stock_quantity > 0),
        imagesByType: product.images.reduce((acc, img) => {
          acc[img.image_type] = acc[img.image_type] || [];
          acc[img.image_type].push(img);
          return acc;
        }, {} as Record<string, any[]>),

        // Additional metadata
        materials: product.name.toLowerCase().includes('cotton') ? ['Cotton'] :
                   product.name.toLowerCase().includes('denim') ? ['Cotton', 'Elastane'] :
                   product.category.name === 'Shoes' ? ['Synthetic', 'Rubber'] : ['Polyester'],
        care_instructions: ['Machine wash cold', 'Do not bleach', 'Tumble dry low'],
        fit_type: product.tags.includes('slim-fit') ? 'slim' : 'regular',
        season: product.tags.includes('summer') ? 'summer' : 'all',
        gender: 'unisex'
      };

      console.log('[CATALOG] ✅ Product details retrieved successfully');

      return {
        success: true,
        data: enrichedProduct
      };
    }),

  // Get similar products (recommendation engine)
  getSimilarProducts: publicProcedure
    .input(z.object({
      productId: z.number(),
      limit: z.number().min(1).max(20).default(8)
    }))
    .query(async ({ input }) => {
      console.log('[CATALOG] 🔗 Finding similar products for ID:', input.productId);

      const baseProduct = MOCK_PRODUCTS.find(p => p.id === input.productId);

      if (!baseProduct) {
        return {
          success: true,
          data: [],
          count: 0
        };
      }

      // Find products in same category with similar price range
      const priceVariance = baseProduct.base_price * 0.5; // 50% variance

      const similarProducts = MOCK_PRODUCTS
        .filter(product =>
          product.id !== input.productId &&
          product.category.slug === baseProduct.category.slug &&
          Math.abs(product.base_price - baseProduct.base_price) <= priceVariance
        )
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, input.limit);

      console.log(`[CATALOG] ✅ Found ${similarProducts.length} similar products`);

      return {
        success: true,
        data: similarProducts,
        count: similarProducts.length
      };
    }),

  // Get products suitable for outfit generation
  getOutfitProducts: publicProcedure
    .input(z.object({
      categories: z.array(z.string()).optional(),
      priceRange: z.object({
        min: z.number().optional(),
        max: z.number().optional()
      }).optional(),
      brandIds: z.array(z.number()).optional(),
      style: z.string().optional(),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(async ({ input }) => {
      console.log('[CATALOG] 👕 Getting products for outfit generation:', JSON.stringify(input, null, 2));

      let suitableProducts = [...MOCK_PRODUCTS];

      // Filter by categories if specified
      if (input.categories?.length) {
        suitableProducts = suitableProducts.filter(product =>
          input.categories!.includes(product.category.slug)
        );
      }

      // Filter by price range
      if (input.priceRange?.min !== undefined) {
        suitableProducts = suitableProducts.filter(product =>
          product.base_price >= input.priceRange!.min!
        );
      }

      if (input.priceRange?.max !== undefined) {
        suitableProducts = suitableProducts.filter(product =>
          product.base_price <= input.priceRange!.max!
        );
      }

      // Filter by brands
      if (input.brandIds?.length) {
        const brandNames = input.brandIds.map(id => MOCK_BRANDS.find(b => b.id === id)?.name).filter(Boolean);
        suitableProducts = suitableProducts.filter(product =>
          brandNames.includes(product.brand.name)
        );
      }

      // Filter by style preferences
      if (input.style) {
        const styleMap: Record<string, string[]> = {
          'casual': ['casual', 'basic', 'everyday'],
          'business': ['professional', 'formal', 'business'],
          'athletic': ['athletic', 'performance', 'sport'],
          'summer': ['summer', 'light', 'breathable']
        };

        const styleTags = styleMap[input.style] || [input.style];
        suitableProducts = suitableProducts.filter(product =>
          product.tags.some(tag => styleTags.includes(tag))
        );
      }

      // Only include in-stock products
      suitableProducts = suitableProducts.filter(product =>
        product.variants.some(v => v.is_available && v.stock_quantity > 0)
      );

      // Sort by popularity and limit
      const result = suitableProducts
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, input.limit);

      console.log(`[CATALOG] ✅ Found ${result.length} suitable products for outfit generation`);

      return {
        success: true,
        data: result,
        count: result.length
      };
    })
};

export { catalogProcedures };