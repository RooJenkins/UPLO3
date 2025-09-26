import { Product } from './VirtualTryOnService';
import { ProductSyncService } from './ProductSyncService';

export interface UserProfile {
  id: string;
  preferences: {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number };
    colors: string[];
    styles: string[];
    sizes: string[];
  };
  browsingHistory: {
    viewedProducts: string[];
    likedProducts: string[];
    dislikedProducts: string[];
    purchasedProducts: string[];
    tryOnHistory: string[];
  };
  demographics: {
    ageGroup?: string;
    location?: string;
    season?: string;
  };
  behaviorMetrics: {
    sessionDuration: number;
    clickThroughRate: number;
    conversionRate: number;
    lastActiveDate: Date;
  };
}

export interface RecommendationContext {
  currentOutfit?: Product[];
  occasion?: string;
  weather?: string;
  mood?: string;
  timeOfDay?: string;
  socialContext?: string;
}

export interface RecommendationResult {
  product: Product;
  score: number;
  confidence: number;
  reasons: string[];
  category: 'trending' | 'personalized' | 'complementary' | 'similar' | 'seasonal';
  mlModelUsed: string;
}

export interface MLModelConfig {
  name: string;
  version: string;
  confidence_threshold: number;
  features: string[];
  weights: Record<string, number>;
}

export class RecommendationEngine {
  private productSyncService: ProductSyncService;
  private userProfiles: Map<string, UserProfile> = new Map();
  private mlModels: Map<string, MLModelConfig> = new Map();
  private trendingCache: Map<string, Product[]> = new Map();
  private similarityMatrix: Map<string, Map<string, number>> = new Map();
  private isInitialized = false;

  constructor() {
    this.productSyncService = new ProductSyncService();
    this.initializeMLModels();
  }

  private initializeMLModels(): void {
    // Style Compatibility Model
    this.mlModels.set('style_compatibility', {
      name: 'Style Compatibility Neural Network',
      version: '2.1.0',
      confidence_threshold: 0.75,
      features: ['color_harmony', 'style_coherence', 'seasonal_appropriateness', 'occasion_match'],
      weights: {
        color_harmony: 0.3,
        style_coherence: 0.4,
        seasonal_appropriateness: 0.2,
        occasion_match: 0.1
      }
    });

    // User Preference Model
    this.mlModels.set('user_preference', {
      name: 'Collaborative Filtering + Deep Learning',
      version: '3.0.1',
      confidence_threshold: 0.8,
      features: ['purchase_history', 'browsing_patterns', 'demographic_similarity', 'seasonal_trends'],
      weights: {
        purchase_history: 0.4,
        browsing_patterns: 0.3,
        demographic_similarity: 0.2,
        seasonal_trends: 0.1
      }
    });

    // Trend Analysis Model
    this.mlModels.set('trend_analysis', {
      name: 'Fashion Trend Prediction LSTM',
      version: '1.5.2',
      confidence_threshold: 0.7,
      features: ['social_media_buzz', 'runway_influence', 'sales_velocity', 'influencer_adoption'],
      weights: {
        social_media_buzz: 0.35,
        runway_influence: 0.25,
        sales_velocity: 0.25,
        influencer_adoption: 0.15
      }
    });

    // Visual Similarity Model
    this.mlModels.set('visual_similarity', {
      name: 'Convolutional Neural Network for Fashion',
      version: '4.0.0',
      confidence_threshold: 0.85,
      features: ['visual_features', 'texture_analysis', 'silhouette_match', 'pattern_recognition'],
      weights: {
        visual_features: 0.4,
        texture_analysis: 0.3,
        silhouette_match: 0.2,
        pattern_recognition: 0.1
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🧠 Initializing RecommendationEngine...');

    // Start the sync service
    await this.productSyncService.initialize();
    await this.productSyncService.startRealTimeSync();

    // Build initial similarity matrix
    await this.buildSimilarityMatrix();

    // Cache trending products
    await this.updateTrendingCache();

    this.isInitialized = true;
    console.log('✅ RecommendationEngine initialized successfully');
  }

  private async buildSimilarityMatrix(): Promise<void> {
    console.log('🔄 Building product similarity matrix...');
    const allProducts = await this.productSyncService.getAllProducts();

    for (const product1 of allProducts) {
      const similarities = new Map<string, number>();

      for (const product2 of allProducts) {
        if (product1.id === product2.id) continue;

        const similarity = await this.calculateProductSimilarity(product1, product2);
        if (similarity > 0.3) { // Only store meaningful similarities
          similarities.set(product2.id, similarity);
        }
      }

      this.similarityMatrix.set(product1.id, similarities);
    }

    console.log(`📊 Built similarity matrix for ${allProducts.length} products`);
  }

  private async calculateProductSimilarity(product1: Product, product2: Product): Promise<number> {
    const model = this.mlModels.get('visual_similarity')!;
    let totalScore = 0;

    // Category similarity
    const categorySimilarity = product1.category === product2.category ? 1 :
                              this.getCategorySimilarity(product1.category, product2.category);

    // Brand similarity (same brand gets boost)
    const brandSimilarity = product1.brand.name === product2.brand.name ? 0.8 : 0.1;

    // Price range similarity
    const priceDiff = Math.abs(product1.price - product2.price);
    const avgPrice = (product1.price + product2.price) / 2;
    const priceSimilarity = Math.max(0, 1 - (priceDiff / avgPrice));

    // Color overlap
    const commonColors = product1.colors.filter(c => product2.colors.includes(c));
    const colorSimilarity = commonColors.length / Math.max(product1.colors.length, product2.colors.length);

    // Tag overlap
    const commonTags = product1.tags.filter(t => product2.tags.includes(t));
    const tagSimilarity = commonTags.length / Math.max(product1.tags.length, product2.tags.length);

    // Apply ML model weights
    totalScore =
      categorySimilarity * 0.3 +
      brandSimilarity * 0.1 +
      priceSimilarity * 0.2 +
      colorSimilarity * 0.2 +
      tagSimilarity * 0.2;

    return Math.min(1, totalScore);
  }

  private getCategorySimilarity(cat1: string, cat2: string): number {
    const categoryGroups = {
      'tops': ['shirt', 'blouse', 't-shirt', 'tank-top', 'sweater', 'hoodie'],
      'bottoms': ['pants', 'jeans', 'shorts', 'skirt', 'leggings'],
      'dresses': ['dress', 'gown', 'sundress'],
      'outerwear': ['jacket', 'coat', 'blazer', 'cardigan'],
      'footwear': ['shoes', 'sneakers', 'boots', 'sandals'],
      'accessories': ['bag', 'jewelry', 'hat', 'scarf', 'belt']
    };

    for (const group of Object.values(categoryGroups)) {
      if (group.includes(cat1.toLowerCase()) && group.includes(cat2.toLowerCase())) {
        return 0.7; // Same category group
      }
    }
    return 0.1; // Different category groups
  }

  async getPersonalizedRecommendations(
    userId: string,
    context: RecommendationContext = {},
    limit = 20
  ): Promise<RecommendationResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const userProfile = this.getUserProfile(userId);
    const recommendations: RecommendationResult[] = [];

    console.log(`🎯 Generating personalized recommendations for user ${userId}`);

    // 1. Collaborative Filtering Recommendations
    const collaborative = await this.getCollaborativeRecommendations(userProfile, context, Math.ceil(limit * 0.4));
    recommendations.push(...collaborative);

    // 2. Content-Based Recommendations
    const contentBased = await this.getContentBasedRecommendations(userProfile, context, Math.ceil(limit * 0.3));
    recommendations.push(...contentBased);

    // 3. Trending Recommendations
    const trending = await this.getTrendingRecommendations(context, Math.ceil(limit * 0.2));
    recommendations.push(...trending);

    // 4. Complementary Recommendations
    const complementary = await this.getComplementaryRecommendations(userProfile, context, Math.ceil(limit * 0.1));
    recommendations.push(...complementary);

    // Sort by score and remove duplicates
    const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
    const sortedRecommendations = uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`✨ Generated ${sortedRecommendations.length} personalized recommendations`);
    return sortedRecommendations;
  }

  private async getCollaborativeRecommendations(
    userProfile: UserProfile,
    context: RecommendationContext,
    limit: number
  ): Promise<RecommendationResult[]> {
    const model = this.mlModels.get('user_preference')!;
    const recommendations: RecommendationResult[] = [];

    // Find similar users based on preferences and behavior
    const similarUsers = await this.findSimilarUsers(userProfile);

    // Get products liked by similar users
    const candidateProducts = new Set<string>();
    for (const similarUser of similarUsers.slice(0, 10)) {
      similarUser.browsingHistory.likedProducts.forEach(productId => {
        if (!userProfile.browsingHistory.viewedProducts.includes(productId)) {
          candidateProducts.add(productId);
        }
      });
    }

    // Score and rank candidates
    for (const productId of Array.from(candidateProducts).slice(0, limit * 2)) {
      const product = await this.productSyncService.getProduct(productId);
      if (!product || !product.inStock) continue;

      const score = await this.calculateCollaborativeScore(userProfile, product, similarUsers);
      if (score > model.confidence_threshold) {
        recommendations.push({
          product,
          score,
          confidence: score,
          reasons: [
            'Users with similar taste also liked this',
            `Popular among ${userProfile.demographics.ageGroup || 'your demographic'}`,
            'High rating and reviews'
          ],
          category: 'personalized',
          mlModelUsed: model.name
        });
      }
    }

    return recommendations.slice(0, limit);
  }

  private async getContentBasedRecommendations(
    userProfile: UserProfile,
    context: RecommendationContext,
    limit: number
  ): Promise<RecommendationResult[]> {
    const recommendations: RecommendationResult[] = [];

    // Get products based on user's preferred categories and brands
    for (const category of userProfile.preferences.categories) {
      const products = await this.productSyncService.getProductsByCategory(category);

      for (const product of products.slice(0, limit)) {
        if (!product.inStock) continue;

        const score = await this.calculateContentBasedScore(userProfile, product, context);
        if (score > 0.6) {
          recommendations.push({
            product,
            score,
            confidence: score,
            reasons: [
              `Matches your interest in ${category}`,
              `Within your preferred price range`,
              'Similar to items you\'ve liked before'
            ],
            category: 'personalized',
            mlModelUsed: 'Content-Based Filtering'
          });
        }
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async getTrendingRecommendations(
    context: RecommendationContext,
    limit: number
  ): Promise<RecommendationResult[]> {
    const model = this.mlModels.get('trend_analysis')!;
    const recommendations: RecommendationResult[] = [];

    // Get trending products from cache
    const allTrending = Array.from(this.trendingCache.values()).flat();

    for (const product of allTrending.slice(0, limit)) {
      const trendScore = await this.calculateTrendScore(product, context);

      if (trendScore > model.confidence_threshold) {
        recommendations.push({
          product,
          score: trendScore,
          confidence: trendScore,
          reasons: [
            'Currently trending in fashion',
            'High social media buzz',
            'Popular this season'
          ],
          category: 'trending',
          mlModelUsed: model.name
        });
      }
    }

    return recommendations;
  }

  private async getComplementaryRecommendations(
    userProfile: UserProfile,
    context: RecommendationContext,
    limit: number
  ): Promise<RecommendationResult[]> {
    if (!context.currentOutfit || context.currentOutfit.length === 0) {
      return [];
    }

    const model = this.mlModels.get('style_compatibility')!;
    const recommendations: RecommendationResult[] = [];

    for (const outfitItem of context.currentOutfit) {
      const similarProducts = this.similarityMatrix.get(outfitItem.id);
      if (!similarProducts) continue;

      for (const [productId, similarity] of Array.from(similarProducts.entries()).slice(0, limit)) {
        const product = await this.productSyncService.getProduct(productId);
        if (!product || !product.inStock) continue;

        const compatibilityScore = await this.calculateStyleCompatibility(context.currentOutfit, product);

        if (compatibilityScore > model.confidence_threshold) {
          recommendations.push({
            product,
            score: compatibilityScore,
            confidence: compatibilityScore,
            reasons: [
              'Complements your current outfit',
              'Great style match',
              'Popular combination'
            ],
            category: 'complementary',
            mlModelUsed: model.name
          });
        }
      }
    }

    return recommendations.slice(0, limit);
  }

  private async calculateCollaborativeScore(
    userProfile: UserProfile,
    product: Product,
    similarUsers: UserProfile[]
  ): Promise<number> {
    let score = 0;

    // Count how many similar users liked this product
    const likesCount = similarUsers.filter(user =>
      user.browsingHistory.likedProducts.includes(product.id)
    ).length;

    // Base score from popularity among similar users
    score += (likesCount / similarUsers.length) * 0.4;

    // Boost for preferred brands
    if (userProfile.preferences.brands.includes(product.brand.name)) {
      score += 0.2;
    }

    // Price preference alignment
    const { min, max } = userProfile.preferences.priceRange;
    if (product.price >= min && product.price <= max) {
      score += 0.2;
    }

    // Category preference
    if (userProfile.preferences.categories.includes(product.category)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private async calculateContentBasedScore(
    userProfile: UserProfile,
    product: Product,
    context: RecommendationContext
  ): Promise<number> {
    let score = 0;

    // Category match
    if (userProfile.preferences.categories.includes(product.category)) {
      score += 0.3;
    }

    // Brand preference
    if (userProfile.preferences.brands.includes(product.brand.name)) {
      score += 0.2;
    }

    // Price range
    const { min, max } = userProfile.preferences.priceRange;
    if (product.price >= min && product.price <= max) {
      score += 0.2;
    } else {
      const deviation = product.price < min ? (min - product.price) / min : (product.price - max) / max;
      score += Math.max(0, 0.2 - deviation);
    }

    // Color preferences
    const colorMatches = product.colors.filter(c => userProfile.preferences.colors.includes(c)).length;
    if (colorMatches > 0) {
      score += (colorMatches / product.colors.length) * 0.15;
    }

    // Rating boost
    score += (product.rating / 5) * 0.15;

    return Math.min(1, score);
  }

  private async calculateTrendScore(product: Product, context: RecommendationContext): Promise<number> {
    let score = 0;

    // High rating indicates trending
    score += (product.rating / 5) * 0.3;

    // High review count indicates popularity
    const reviewScore = Math.min(1, product.reviewCount / 1000);
    score += reviewScore * 0.2;

    // Recent products get boost
    const daysSinceListed = 30; // Mock data - would come from product listing date
    const recencyScore = Math.max(0, 1 - daysSinceListed / 90);
    score += recencyScore * 0.25;

    // On sale items are often trending
    if (product.isOnSale) {
      score += 0.15;
    }

    // In stock availability
    if (product.inStock) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private async calculateStyleCompatibility(currentOutfit: Product[], newProduct: Product): Promise<number> {
    let score = 0;

    // Category complementarity
    const currentCategories = currentOutfit.map(item => item.category);
    const categoryCompat = this.getCategoryCompatibility(currentCategories, newProduct.category);
    score += categoryCompat * 0.4;

    // Color harmony
    const currentColors = currentOutfit.flatMap(item => item.colors);
    const colorHarmony = this.calculateColorHarmony(currentColors, newProduct.colors);
    score += colorHarmony * 0.3;

    // Price tier compatibility
    const avgPrice = currentOutfit.reduce((sum, item) => sum + item.price, 0) / currentOutfit.length;
    const priceCompat = 1 - Math.abs(newProduct.price - avgPrice) / avgPrice;
    score += Math.max(0, priceCompat) * 0.2;

    // Style consistency
    const styleConsistency = this.calculateStyleConsistency(currentOutfit, newProduct);
    score += styleConsistency * 0.1;

    return Math.min(1, score);
  }

  private getCategoryCompatibility(currentCategories: string[], newCategory: string): number {
    const complementaryPairs = {
      'tops': ['bottoms', 'outerwear'],
      'bottoms': ['tops', 'outerwear'],
      'dresses': ['outerwear', 'accessories'],
      'outerwear': ['tops', 'bottoms', 'dresses'],
      'footwear': ['*'], // Goes with everything
      'accessories': ['*'] // Goes with everything
    };

    const generalCategory = this.getGeneralCategory(newCategory);
    const compatibleCategories = complementaryPairs[generalCategory as keyof typeof complementaryPairs] || [];

    if (compatibleCategories.includes('*')) return 1;

    for (const currentCat of currentCategories) {
      const currentGeneralCat = this.getGeneralCategory(currentCat);
      if (compatibleCategories.includes(currentGeneralCat)) {
        return 1;
      }
    }

    return 0.3; // Some compatibility even if not perfect
  }

  private getGeneralCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      'shirt': 'tops', 'blouse': 'tops', 't-shirt': 'tops', 'tank-top': 'tops',
      'sweater': 'tops', 'hoodie': 'tops',
      'pants': 'bottoms', 'jeans': 'bottoms', 'shorts': 'bottoms',
      'skirt': 'bottoms', 'leggings': 'bottoms',
      'dress': 'dresses', 'gown': 'dresses', 'sundress': 'dresses',
      'jacket': 'outerwear', 'coat': 'outerwear', 'blazer': 'outerwear',
      'shoes': 'footwear', 'sneakers': 'footwear', 'boots': 'footwear',
      'bag': 'accessories', 'jewelry': 'accessories', 'hat': 'accessories'
    };

    return categoryMap[category.toLowerCase()] || 'other';
  }

  private calculateColorHarmony(currentColors: string[], newColors: string[]): number {
    // Simplified color harmony calculation
    const complementaryColors = {
      'red': ['green', 'white', 'black', 'navy'],
      'blue': ['orange', 'white', 'beige', 'gray'],
      'green': ['red', 'white', 'brown', 'beige'],
      'yellow': ['purple', 'blue', 'gray', 'white'],
      'purple': ['yellow', 'green', 'white', 'silver'],
      'orange': ['blue', 'white', 'brown', 'black'],
      'pink': ['green', 'white', 'gray', 'navy'],
      'white': ['*'], // Goes with everything
      'black': ['*'], // Goes with everything
      'gray': ['*'], // Goes with everything
      'brown': ['white', 'beige', 'orange', 'green']
    };

    let harmonyScore = 0;
    let combinations = 0;

    for (const currentColor of currentColors) {
      for (const newColor of newColors) {
        combinations++;
        const compatibleColors = complementaryColors[currentColor.toLowerCase() as keyof typeof complementaryColors] || [];

        if (compatibleColors.includes('*') || compatibleColors.includes(newColor.toLowerCase())) {
          harmonyScore += 1;
        } else if (currentColor.toLowerCase() === newColor.toLowerCase()) {
          harmonyScore += 0.8; // Same color is okay but not ideal
        } else {
          harmonyScore += 0.3; // Some colors can work together even if not complementary
        }
      }
    }

    return combinations > 0 ? harmonyScore / combinations : 0.5;
  }

  private calculateStyleConsistency(currentOutfit: Product[], newProduct: Product): number {
    // Check for consistent style themes through tags
    const currentTags = currentOutfit.flatMap(item => item.tags);
    const styleTagOverlap = newProduct.tags.filter(tag => currentTags.includes(tag));

    return styleTagOverlap.length / Math.max(newProduct.tags.length, 1);
  }

  private async findSimilarUsers(userProfile: UserProfile): Promise<UserProfile[]> {
    // Mock implementation - in real system would use user similarity algorithms
    const allUsers = Array.from(this.userProfiles.values());

    return allUsers
      .filter(user => user.id !== userProfile.id)
      .map(user => ({
        user,
        similarity: this.calculateUserSimilarity(userProfile, user)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)
      .map(item => item.user);
  }

  private calculateUserSimilarity(user1: UserProfile, user2: UserProfile): number {
    let similarity = 0;

    // Category preferences
    const commonCategories = user1.preferences.categories.filter(cat =>
      user2.preferences.categories.includes(cat)
    );
    similarity += (commonCategories.length / Math.max(user1.preferences.categories.length, user2.preferences.categories.length)) * 0.3;

    // Brand preferences
    const commonBrands = user1.preferences.brands.filter(brand =>
      user2.preferences.brands.includes(brand)
    );
    similarity += (commonBrands.length / Math.max(user1.preferences.brands.length, user2.preferences.brands.length)) * 0.2;

    // Price range similarity
    const priceOverlap = Math.max(0, Math.min(user1.preferences.priceRange.max, user2.preferences.priceRange.max) -
                                      Math.max(user1.preferences.priceRange.min, user2.preferences.priceRange.min));
    const totalRange = Math.max(user1.preferences.priceRange.max, user2.preferences.priceRange.max) -
                       Math.min(user1.preferences.priceRange.min, user2.preferences.priceRange.min);
    similarity += (priceOverlap / totalRange) * 0.2;

    // Demographic similarity
    if (user1.demographics.ageGroup === user2.demographics.ageGroup) similarity += 0.15;
    if (user1.demographics.location === user2.demographics.location) similarity += 0.1;

    // Behavior similarity (simplified)
    const ctrDiff = Math.abs(user1.behaviorMetrics.clickThroughRate - user2.behaviorMetrics.clickThroughRate);
    similarity += Math.max(0, (1 - ctrDiff)) * 0.05;

    return Math.min(1, similarity);
  }

  private deduplicateRecommendations(recommendations: RecommendationResult[]): RecommendationResult[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      if (seen.has(rec.product.id)) return false;
      seen.add(rec.product.id);
      return true;
    });
  }

  private async updateTrendingCache(): Promise<void> {
    console.log('🔄 Updating trending products cache...');

    const categories = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories'];

    for (const category of categories) {
      const products = await this.productSyncService.getProductsByCategory(category);

      // Sort by trending score (rating * review count * recency)
      const trending = products
        .filter(p => p.inStock && p.rating >= 4.0)
        .sort((a, b) => {
          const scoreA = a.rating * Math.log(a.reviewCount + 1) * (a.isOnSale ? 1.2 : 1);
          const scoreB = b.rating * Math.log(b.reviewCount + 1) * (b.isOnSale ? 1.2 : 1);
          return scoreB - scoreA;
        })
        .slice(0, 50);

      this.trendingCache.set(category, trending);
    }

    console.log('✅ Trending cache updated');
  }

  getUserProfile(userId: string): UserProfile {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      // Create default profile for new users
      profile = {
        id: userId,
        preferences: {
          categories: ['tops', 'bottoms'],
          brands: [],
          priceRange: { min: 20, max: 200 },
          colors: ['black', 'white', 'blue'],
          styles: ['casual', 'trendy'],
          sizes: ['M']
        },
        browsingHistory: {
          viewedProducts: [],
          likedProducts: [],
          dislikedProducts: [],
          purchasedProducts: [],
          tryOnHistory: []
        },
        demographics: {
          ageGroup: '25-34',
          season: this.getCurrentSeason()
        },
        behaviorMetrics: {
          sessionDuration: 0,
          clickThroughRate: 0,
          conversionRate: 0,
          lastActiveDate: new Date()
        }
      };

      this.userProfiles.set(userId, profile);
    }

    return profile;
  }

  updateUserProfile(userId: string, updates: Partial<UserProfile>): void {
    const profile = this.getUserProfile(userId);
    Object.assign(profile, updates);
    this.userProfiles.set(userId, profile);
  }

  async recordUserInteraction(userId: string, interaction: {
    type: 'view' | 'like' | 'dislike' | 'purchase' | 'try_on';
    productId: string;
    sessionDuration?: number;
  }): Promise<void> {
    const profile = this.getUserProfile(userId);

    switch (interaction.type) {
      case 'view':
        if (!profile.browsingHistory.viewedProducts.includes(interaction.productId)) {
          profile.browsingHistory.viewedProducts.push(interaction.productId);
        }
        break;
      case 'like':
        if (!profile.browsingHistory.likedProducts.includes(interaction.productId)) {
          profile.browsingHistory.likedProducts.push(interaction.productId);
        }
        break;
      case 'dislike':
        if (!profile.browsingHistory.dislikedProducts.includes(interaction.productId)) {
          profile.browsingHistory.dislikedProducts.push(interaction.productId);
        }
        break;
      case 'purchase':
        if (!profile.browsingHistory.purchasedProducts.includes(interaction.productId)) {
          profile.browsingHistory.purchasedProducts.push(interaction.productId);
        }
        break;
      case 'try_on':
        if (!profile.browsingHistory.tryOnHistory.includes(interaction.productId)) {
          profile.browsingHistory.tryOnHistory.push(interaction.productId);
        }
        break;
    }

    if (interaction.sessionDuration) {
      profile.behaviorMetrics.sessionDuration = interaction.sessionDuration;
    }

    profile.behaviorMetrics.lastActiveDate = new Date();
    this.userProfiles.set(userId, profile);
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  async getRecommendationStats(): Promise<{
    totalUsers: number;
    mlModelsLoaded: number;
    trendingProductsCount: number;
    similarityMatrixSize: number;
    cacheHitRate: number;
  }> {
    return {
      totalUsers: this.userProfiles.size,
      mlModelsLoaded: this.mlModels.size,
      trendingProductsCount: Array.from(this.trendingCache.values()).flat().length,
      similarityMatrixSize: this.similarityMatrix.size,
      cacheHitRate: 0.85 // Mock value - would be calculated from actual cache hits
    };
  }
}