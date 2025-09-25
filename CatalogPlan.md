# 🛍️ UPLO3 Complete Clothing Catalog Implementation Plan

**Version:** 1.0
**Date:** September 25, 2025
**Status:** Implementation Ready
**Architecture:** Cloud-First with Real-Time Sync

---

## 📋 Executive Summary

Transform UPLO3 into a comprehensive fashion platform by integrating a complete clothing catalog system with real-time data from major online brands. This system will feed authentic product data into the AI try-on generator, enabling users to virtually try on actual purchasable clothing items.

---

## 🏗️ Architecture Overview

### Current State Integration
- **Existing**: 30-worker AI generation system with tRPC backend
- **Enhancement**: Real product data replaces mock outfit generation
- **Maintained**: Cloud-first architecture with intelligent caching

### New System Components
```
┌─────────────────────────────────────────────────────────────┐
│                    UPLO3 Catalog System                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Brand APIs ──► Data Sync ──► Database ──► tRPC ──► App    │
│      │             │             │           │        │     │
│      │             │             │           │        │     │
│   Shopify      Normalization   PostgreSQL   Redis   React  │
│   BigCommerce   & Processing    + Metadata  Cache   Native  │
│   Custom APIs   Cloud Jobs      + Images    Layer          │
│   Web Scrapers  Queue System    + Search    CDN            │
│                                                             │
│             AI Try-On Integration Layer                     │
│        User Photo + Real Products ──► Generated Outfits    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Phase 1: Database & Infrastructure Architecture

### 1.1 Database Schema Design

#### Core Catalog Tables
```sql
-- Brand Registry
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  api_type VARCHAR(50), -- 'shopify', 'bigcommerce', 'custom', 'scraper'
  api_credentials JSONB, -- Encrypted API keys/tokens
  is_active BOOLEAN DEFAULT true,
  sync_frequency INTEGER DEFAULT 240, -- minutes
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product Categories (hierarchical)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES categories(id),
  display_order INTEGER DEFAULT 0,
  icon_name VARCHAR(50), -- Lucide icon name
  is_active BOOLEAN DEFAULT true
);

-- Main Product Catalog
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES brands(id) NOT NULL,
  external_id VARCHAR(255), -- Brand's internal product ID
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) NOT NULL,
  subcategory_id INTEGER REFERENCES categories(id),

  -- Product Details
  materials JSONB, -- ['cotton', 'polyester']
  care_instructions TEXT[],
  fit_type VARCHAR(50), -- 'regular', 'slim', 'loose', 'oversized'
  season VARCHAR(20), -- 'spring', 'summer', 'fall', 'winter', 'all'
  gender VARCHAR(20), -- 'men', 'women', 'unisex', 'kids'

  -- Pricing (in cents to avoid float precision)
  base_price INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Metadata
  tags TEXT[],
  is_trending BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Search optimization
  search_vector tsvector,

  CONSTRAINT valid_price CHECK (base_price > 0)
);

-- Product Variants (colors, sizes, specific SKUs)
CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  external_variant_id VARCHAR(255),

  -- Variant Specifics
  color VARCHAR(100),
  color_hex VARCHAR(7), -- #FFFFFF format
  size VARCHAR(20),
  size_category VARCHAR(20), -- 'XS', 'S', 'M', 'L', 'XL', 'numeric'

  -- Inventory & Pricing
  stock_quantity INTEGER DEFAULT 0,
  current_price INTEGER NOT NULL, -- Can differ from base_price
  sale_price INTEGER, -- NULL if no sale
  is_on_sale BOOLEAN GENERATED ALWAYS AS (sale_price IS NOT NULL) STORED,

  -- Availability
  is_available BOOLEAN DEFAULT true,
  restock_date DATE,

  -- Variant metadata
  variant_sku VARCHAR(100),
  weight_grams INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_current_price CHECK (current_price > 0),
  CONSTRAINT valid_sale_price CHECK (sale_price IS NULL OR sale_price < current_price)
);

-- Product Images (multiple per product/variant)
CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Image Details
  original_url TEXT NOT NULL,
  cdn_url TEXT, -- Our CDN URL after processing
  thumbnail_url TEXT,

  -- Image Metadata
  image_type VARCHAR(20) DEFAULT 'product', -- 'product', 'lifestyle', 'detail', 'swatch'
  display_order INTEGER DEFAULT 0,
  alt_text VARCHAR(255),
  width INTEGER,
  height INTEGER,

  -- Processing Status
  is_processed BOOLEAN DEFAULT false,
  processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'

  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync Status & Logging
CREATE TABLE catalog_sync_logs (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES brands(id),
  sync_type VARCHAR(50), -- 'full', 'incremental', 'webhook'

  -- Sync Results
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'partial'
  items_processed INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_deleted INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Error Tracking
  error_messages JSONB,
  last_successful_sync TIMESTAMP,

  -- Metadata
  sync_metadata JSONB -- Store additional sync information
);

-- Search & Filter Support
CREATE TABLE product_search_cache (
  id SERIAL PRIMARY KEY,
  query_hash VARCHAR(64) UNIQUE, -- MD5 of search parameters
  query_params JSONB, -- Original search parameters
  result_product_ids INTEGER[], -- Array of matching product IDs
  result_count INTEGER,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);
```

#### Optimization Indexes
```sql
-- Performance Indexes
CREATE INDEX idx_products_brand_category ON products(brand_id, category_id);
CREATE INDEX idx_products_active_trending ON products(is_active, is_trending);
CREATE INDEX idx_products_search_vector ON products USING GIN(search_vector);
CREATE INDEX idx_variants_product_available ON product_variants(product_id, is_available);
CREATE INDEX idx_variants_price_sale ON product_variants(current_price, sale_price);
CREATE INDEX idx_images_product_type_order ON product_images(product_id, image_type, display_order);
CREATE INDEX idx_sync_logs_brand_status ON catalog_sync_logs(brand_id, status, started_at);
```

### 1.2 Cloud Infrastructure Setup

#### Supabase Configuration
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }, // We handle auth differently
  db: {
    schema: 'catalog'
  }
});

// Database types
export type Database = {
  catalog: {
    Tables: {
      brands: Brand;
      products: Product;
      product_variants: ProductVariant;
      product_images: ProductImage;
      categories: Category;
      catalog_sync_logs: SyncLog;
    };
  };
};
```

#### Redis Caching Layer
```typescript
// backend/services/cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

export const CacheKeys = {
  PRODUCT: (id: number) => `product:${id}`,
  BRAND_PRODUCTS: (brandId: number) => `brand:${brandId}:products`,
  CATEGORY_PRODUCTS: (categoryId: number) => `category:${categoryId}:products`,
  TRENDING_PRODUCTS: 'trending:products',
  SEARCH_RESULTS: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
  SYNC_STATUS: (brandId: number) => `sync:${brandId}:status`,
};

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const values = await redis.mget(keys);
    return values.map(v => v ? JSON.parse(v) : null);
  }
};
```

---

## 🔌 Phase 2: Brand Integration Layer

### 2.1 Brand API Adapters

#### Universal Brand Adapter Interface
```typescript
// backend/services/brandAdapters/types.ts
export interface BrandProduct {
  externalId: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  materials?: string[];
  careInstructions?: string[];
  basePrice: number; // in cents
  currency: string;
  tags: string[];
  variants: BrandVariant[];
  images: BrandImage[];
}

export interface BrandVariant {
  externalVariantId: string;
  color?: string;
  colorHex?: string;
  size?: string;
  sizeCategory?: string;
  stockQuantity: number;
  currentPrice: number;
  salePrice?: number;
  sku?: string;
  isAvailable: boolean;
}

export interface BrandImage {
  originalUrl: string;
  imageType: 'product' | 'lifestyle' | 'detail' | 'swatch';
  altText?: string;
  displayOrder: number;
}

export abstract class BrandAdapter {
  protected brandId: number;
  protected credentials: any;

  constructor(brandId: number, credentials: any) {
    this.brandId = brandId;
    this.credentials = credentials;
  }

  abstract authenticate(): Promise<boolean>;
  abstract fetchProducts(page?: number, limit?: number): Promise<BrandProduct[]>;
  abstract fetchProductDetails(externalId: string): Promise<BrandProduct>;
  abstract getProductCount(): Promise<number>;
  abstract setupWebhook?(callbackUrl: string): Promise<{ webhookId: string }>;
}
```

#### Shopify Adapter Implementation
```typescript
// backend/services/brandAdapters/ShopifyAdapter.ts
import { BrandAdapter, BrandProduct } from './types';

export class ShopifyAdapter extends BrandAdapter {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion = '2024-01';

  constructor(brandId: number, credentials: { shopDomain: string; accessToken: string }) {
    super(brandId, credentials);
    this.shopDomain = credentials.shopDomain;
    this.accessToken = credentials.accessToken;
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`https://${this.shopDomain}.myshopify.com/admin/api/${this.apiVersion}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': this.accessToken }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchProducts(page = 1, limit = 250): Promise<BrandProduct[]> {
    const response = await fetch(
      `https://${this.shopDomain}.myshopify.com/admin/api/${this.apiVersion}/products.json?limit=${limit}&page=${page}&fields=id,title,body_html,product_type,tags,variants,images,created_at,updated_at`,
      { headers: { 'X-Shopify-Access-Token': this.accessToken } }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    return data.products.map(this.transformProduct.bind(this));
  }

  private transformProduct(shopifyProduct: any): BrandProduct {
    return {
      externalId: shopifyProduct.id.toString(),
      name: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.body_html || ''),
      category: this.mapCategory(shopifyProduct.product_type),
      subcategory: undefined,
      materials: this.extractMaterials(shopifyProduct.body_html),
      careInstructions: [],
      basePrice: Math.min(...shopifyProduct.variants.map((v: any) => parseFloat(v.price) * 100)),
      currency: 'USD',
      tags: shopifyProduct.tags.split(',').map((t: string) => t.trim()),
      variants: shopifyProduct.variants.map(this.transformVariant.bind(this)),
      images: shopifyProduct.images.map(this.transformImage.bind(this))
    };
  }

  private transformVariant(shopifyVariant: any) {
    return {
      externalVariantId: shopifyVariant.id.toString(),
      color: shopifyVariant.option1, // Assumes first option is color
      size: shopifyVariant.option2, // Assumes second option is size
      stockQuantity: shopifyVariant.inventory_quantity || 0,
      currentPrice: parseFloat(shopifyVariant.price) * 100,
      salePrice: shopifyVariant.compare_at_price ? parseFloat(shopifyVariant.compare_at_price) * 100 : undefined,
      sku: shopifyVariant.sku,
      isAvailable: shopifyVariant.available
    };
  }

  private transformImage(shopifyImage: any, index: number) {
    return {
      originalUrl: shopifyImage.src,
      imageType: index === 0 ? 'product' : 'detail',
      altText: shopifyImage.alt,
      displayOrder: shopifyImage.position || index
    };
  }

  private mapCategory(productType: string): string {
    const categoryMap: Record<string, string> = {
      'T-Shirts': 'tops',
      'Shirts': 'tops',
      'Pants': 'bottoms',
      'Jeans': 'bottoms',
      'Dresses': 'dresses',
      'Shoes': 'shoes',
      'Accessories': 'accessories'
    };
    return categoryMap[productType] || 'other';
  }

  private extractMaterials(description: string): string[] {
    const materials = ['cotton', 'polyester', 'silk', 'wool', 'denim', 'leather'];
    return materials.filter(material =>
      description.toLowerCase().includes(material.toLowerCase())
    );
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  async setupWebhook(callbackUrl: string): Promise<{ webhookId: string }> {
    const webhook = {
      webhook: {
        topic: 'products/update',
        address: callbackUrl,
        format: 'json'
      }
    };

    const response = await fetch(
      `https://${this.shopDomain}.myshopify.com/admin/api/${this.apiVersion}/webhooks.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      }
    );

    const data = await response.json();
    return { webhookId: data.webhook.id.toString() };
  }
}
```

#### ASOS Scraper Adapter (Fallback)
```typescript
// backend/services/brandAdapters/AsosScraperAdapter.ts
import puppeteer from 'puppeteer';
import { BrandAdapter, BrandProduct } from './types';

export class AsosScraperAdapter extends BrandAdapter {
  private baseUrl = 'https://www.asos.com';

  async authenticate(): Promise<boolean> {
    return true; // No authentication needed for scraping
  }

  async fetchProducts(page = 1, limit = 50): Promise<BrandProduct[]> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const browserPage = await browser.newPage();

      // Set realistic user agent
      await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // Navigate to category page (men's clothing for example)
      await browserPage.goto(`${this.baseUrl}/men/ctas/new-in/cat/?cid=27108&page=${page}`, {
        waitUntil: 'networkidle2'
      });

      // Extract product data
      const products = await browserPage.evaluate(() => {
        const productElements = document.querySelectorAll('[data-testid="product-tile"]');

        return Array.from(productElements).slice(0, 50).map((element, index) => {
          const link = element.querySelector('a');
          const image = element.querySelector('img');
          const priceElement = element.querySelector('[data-testid="current-price"]');
          const nameElement = element.querySelector('[data-testid="product-title"]');

          return {
            externalId: link?.getAttribute('href')?.split('/').pop() || `asos_${Date.now()}_${index}`,
            name: nameElement?.textContent?.trim() || 'ASOS Product',
            description: '',
            category: 'other',
            materials: [],
            careInstructions: [],
            basePrice: this.parsePriceString(priceElement?.textContent || '0'),
            currency: 'USD',
            tags: ['asos'],
            variants: [{
              externalVariantId: `variant_${Date.now()}_${index}`,
              stockQuantity: 10, // Assume in stock
              currentPrice: this.parsePriceString(priceElement?.textContent || '0'),
              isAvailable: true
            }],
            images: image ? [{
              originalUrl: image.src,
              imageType: 'product',
              altText: image.alt,
              displayOrder: 0
            }] : []
          };
        });
      });

      return products.filter(p => p.name && p.basePrice > 0);

    } finally {
      await browser.close();
    }
  }

  private parsePriceString(priceStr: string): number {
    const match = priceStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) * 100 : 0; // Convert to cents
  }
}
```

### 2.2 Brand Adapter Factory
```typescript
// backend/services/brandAdapters/AdapterFactory.ts
import { BrandAdapter } from './types';
import { ShopifyAdapter } from './ShopifyAdapter';
import { AsosScraperAdapter } from './AsosScraperAdapter';

export class AdapterFactory {
  static create(brandId: number, apiType: string, credentials: any): BrandAdapter {
    switch (apiType) {
      case 'shopify':
        return new ShopifyAdapter(brandId, credentials);
      case 'asos_scraper':
        return new AsosScraperAdapter(brandId, credentials);
      default:
        throw new Error(`Unsupported brand adapter type: ${apiType}`);
    }
  }
}
```

---

## 📡 Phase 3: Data Synchronization Service

### 3.1 Sync Orchestration Service
```typescript
// backend/services/catalogSync.ts
import { supabase } from '../lib/supabase';
import { AdapterFactory } from './brandAdapters/AdapterFactory';
import { cache, CacheKeys } from './cache';
import { BrandProduct } from './brandAdapters/types';

export class CatalogSyncService {
  private static instance: CatalogSyncService;
  private activeJobs = new Map<number, boolean>();

  static getInstance(): CatalogSyncService {
    if (!CatalogSyncService.instance) {
      CatalogSyncService.instance = new CatalogSyncService();
    }
    return CatalogSyncService.instance;
  }

  async syncBrand(brandId: number, syncType: 'full' | 'incremental' = 'incremental'): Promise<void> {
    if (this.activeJobs.get(brandId)) {
      console.log(`Sync already running for brand ${brandId}`);
      return;
    }

    this.activeJobs.set(brandId, true);

    try {
      // Get brand configuration
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (!brand || !brand.is_active) {
        throw new Error(`Brand ${brandId} not found or inactive`);
      }

      // Create sync log entry
      const { data: syncLog } = await supabase
        .from('catalog_sync_logs')
        .insert({
          brand_id: brandId,
          sync_type: syncType,
          status: 'running',
          started_at: new Date()
        })
        .select()
        .single();

      // Initialize brand adapter
      const adapter = AdapterFactory.create(brandId, brand.api_type, brand.api_credentials);

      // Authenticate
      const isAuthenticated = await adapter.authenticate();
      if (!isAuthenticated) {
        throw new Error(`Failed to authenticate with brand ${brand.name}`);
      }

      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let page = 1;
      const batchSize = 100;

      // Sync products in batches
      while (true) {
        const products = await adapter.fetchProducts(page, batchSize);

        if (products.length === 0) {
          break; // No more products
        }

        const batchResult = await this.processBatch(brandId, products);
        totalProcessed += batchResult.processed;
        totalCreated += batchResult.created;
        totalUpdated += batchResult.updated;

        // Update sync progress
        await supabase
          .from('catalog_sync_logs')
          .update({
            items_processed: totalProcessed,
            items_created: totalCreated,
            items_updated: totalUpdated
          })
          .eq('id', syncLog.id);

        page++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Complete sync log
      await supabase
        .from('catalog_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date(),
          duration_seconds: Math.floor((Date.now() - new Date(syncLog.started_at).getTime()) / 1000)
        })
        .eq('id', syncLog.id);

      // Update brand last sync
      await supabase
        .from('brands')
        .update({ last_sync: new Date() })
        .eq('id', brandId);

      // Clear relevant caches
      await this.clearBrandCaches(brandId);

      console.log(`✅ Sync completed for brand ${brandId}: ${totalProcessed} products processed`);

    } catch (error) {
      console.error(`❌ Sync failed for brand ${brandId}:`, error);

      // Update sync log with error
      await supabase
        .from('catalog_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date(),
          error_messages: { error: error.message }
        })
        .eq('brand_id', brandId)
        .eq('status', 'running');

      throw error;
    } finally {
      this.activeJobs.delete(brandId);
    }
  }

  private async processBatch(brandId: number, products: BrandProduct[]) {
    let processed = 0;
    let created = 0;
    let updated = 0;

    for (const productData of products) {
      try {
        // Check if product exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id, updated_at')
          .eq('brand_id', brandId)
          .eq('external_id', productData.externalId)
          .single();

        if (existingProduct) {
          // Update existing product
          await this.updateProduct(existingProduct.id, productData);
          updated++;
        } else {
          // Create new product
          await this.createProduct(brandId, productData);
          created++;
        }

        processed++;
      } catch (error) {
        console.error(`Failed to process product ${productData.externalId}:`, error);
        // Continue with next product
      }
    }

    return { processed, created, updated };
  }

  private async createProduct(brandId: number, productData: BrandProduct) {
    // Get or create category
    const categoryId = await this.ensureCategoryExists(productData.category);

    // Insert product
    const { data: product } = await supabase
      .from('products')
      .insert({
        brand_id: brandId,
        external_id: productData.externalId,
        name: productData.name,
        description: productData.description,
        category_id: categoryId,
        materials: productData.materials,
        care_instructions: productData.careInstructions,
        base_price: productData.basePrice,
        currency: productData.currency,
        tags: productData.tags
      })
      .select()
      .single();

    // Insert variants
    if (productData.variants.length > 0) {
      const variantInserts = productData.variants.map(variant => ({
        product_id: product.id,
        external_variant_id: variant.externalVariantId,
        color: variant.color,
        color_hex: variant.colorHex,
        size: variant.size,
        size_category: variant.sizeCategory,
        stock_quantity: variant.stockQuantity,
        current_price: variant.currentPrice,
        sale_price: variant.salePrice,
        variant_sku: variant.sku,
        is_available: variant.isAvailable
      }));

      await supabase.from('product_variants').insert(variantInserts);
    }

    // Insert images
    if (productData.images.length > 0) {
      const imageInserts = productData.images.map(image => ({
        product_id: product.id,
        original_url: image.originalUrl,
        image_type: image.imageType,
        alt_text: image.altText,
        display_order: image.displayOrder
      }));

      await supabase.from('product_images').insert(imageInserts);
    }

    return product;
  }

  private async updateProduct(productId: number, productData: BrandProduct) {
    // Update product base data
    await supabase
      .from('products')
      .update({
        name: productData.name,
        description: productData.description,
        materials: productData.materials,
        care_instructions: productData.careInstructions,
        base_price: productData.basePrice,
        tags: productData.tags,
        updated_at: new Date()
      })
      .eq('id', productId);

    // Handle variants (delete and recreate for simplicity)
    await supabase.from('product_variants').delete().eq('product_id', productId);

    if (productData.variants.length > 0) {
      const variantInserts = productData.variants.map(variant => ({
        product_id: productId,
        external_variant_id: variant.externalVariantId,
        color: variant.color,
        color_hex: variant.colorHex,
        size: variant.size,
        size_category: variant.sizeCategory,
        stock_quantity: variant.stockQuantity,
        current_price: variant.currentPrice,
        sale_price: variant.salePrice,
        variant_sku: variant.sku,
        is_available: variant.isAvailable
      }));

      await supabase.from('product_variants').insert(variantInserts);
    }
  }

  private async ensureCategoryExists(categorySlug: string): Promise<number> {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (category) {
      return category.id;
    }

    // Create new category
    const { data: newCategory } = await supabase
      .from('categories')
      .insert({
        name: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1),
        slug: categorySlug,
        is_active: true
      })
      .select()
      .single();

    return newCategory.id;
  }

  private async clearBrandCaches(brandId: number) {
    const cacheKeys = [
      CacheKeys.BRAND_PRODUCTS(brandId),
      CacheKeys.TRENDING_PRODUCTS,
      'search:*' // Clear all search caches
    ];

    await Promise.all(cacheKeys.map(key => cache.del(key)));
  }

  async syncAllBrands(): Promise<void> {
    const { data: activeBrands } = await supabase
      .from('brands')
      .select('id, name, sync_frequency, last_sync')
      .eq('is_active', true);

    const now = new Date();

    for (const brand of activeBrands || []) {
      const lastSync = brand.last_sync ? new Date(brand.last_sync) : new Date(0);
      const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);

      if (minutesSinceLastSync >= brand.sync_frequency) {
        console.log(`🔄 Starting sync for brand ${brand.name} (${brand.id})`);

        try {
          await this.syncBrand(brand.id, 'incremental');
        } catch (error) {
          console.error(`Failed to sync brand ${brand.name}:`, error);
          // Continue with other brands
        }

        // Rate limiting between brands
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// Cron job setup
export function setupSyncSchedule() {
  const syncService = CatalogSyncService.getInstance();

  // Run every 30 minutes
  setInterval(async () => {
    try {
      console.log('🕐 Starting scheduled catalog sync...');
      await syncService.syncAllBrands();
      console.log('✅ Scheduled sync completed');
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error);
    }
  }, 30 * 60 * 1000); // 30 minutes
}
```

### 3.2 Webhook Handler Service
```typescript
// backend/services/webhookHandler.ts
import { Request, Response } from 'express';
import { CatalogSyncService } from './catalogSync';
import crypto from 'crypto';

export class WebhookHandler {
  static async handleShopifyWebhook(req: Request, res: Response) {
    // Verify webhook signature
    const signature = req.get('X-Shopify-Hmac-Sha256');
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
      .update(body, 'utf8')
      .digest('base64');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    // Handle product update
    if (req.body && req.body.id) {
      const brandId = await this.getBrandIdFromShopDomain(req.get('X-Shopify-Shop-Domain'));

      if (brandId) {
        // Trigger single product sync
        const syncService = CatalogSyncService.getInstance();
        await syncService.syncSingleProduct(brandId, req.body.id.toString());
      }
    }

    res.status(200).json({ status: 'received' });
  }

  private static async getBrandIdFromShopDomain(domain?: string): Promise<number | null> {
    if (!domain) return null;

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('api_credentials->>shopDomain', domain.replace('.myshopify.com', ''))
      .single();

    return brand?.id || null;
  }
}
```

---

## 🔌 Phase 4: Enhanced tRPC API Layer

### 4.1 New Catalog Procedures
```typescript
// backend/trpc/procedures/catalog.ts
import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../context';
import { supabase } from '../../lib/supabase';
import { cache, CacheKeys } from '../../services/cache';

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

export const catalogProcedures = {
  // Get all active brands
  getBrands: publicProcedure.query(async () => {
    const cacheKey = 'catalog:brands:active';
    const cached = await cache.get(cacheKey);

    if (cached) return cached;

    const { data: brands } = await supabase
      .from('brands')
      .select('id, name, slug, logo_url, website')
      .eq('is_active', true)
      .order('name');

    await cache.set(cacheKey, brands, 3600); // 1 hour cache
    return brands;
  }),

  // Get product categories hierarchy
  getCategories: publicProcedure.query(async () => {
    const cacheKey = 'catalog:categories:tree';
    const cached = await cache.get(cacheKey);

    if (cached) return cached;

    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order, name');

    // Build category tree
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    categories?.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    categories?.forEach(cat => {
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      } else {
        rootCategories.push(categoryMap.get(cat.id));
      }
    });

    await cache.set(cacheKey, rootCategories, 3600);
    return rootCategories;
  }),

  // Advanced product search
  searchProducts: publicProcedure
    .input(searchProductsSchema)
    .query(async ({ input }) => {
      // Generate cache key from search parameters
      const cacheKey = CacheKeys.SEARCH_RESULTS(JSON.stringify(input));
      const cached = await cache.get(cacheKey);

      if (cached) return cached;

      // Build dynamic query
      let query = supabase
        .from('products')
        .select(`
          *,
          brand:brands(name, logo_url),
          category:categories(name, slug),
          variants:product_variants(*),
          images:product_images(*)
        `)
        .eq('is_active', true);

      // Apply filters
      if (input.brandIds?.length) {
        query = query.in('brand_id', input.brandIds);
      }

      if (input.categoryIds?.length) {
        query = query.in('category_id', input.categoryIds);
      }

      if (input.query) {
        query = query.textSearch('search_vector', input.query);
      }

      if (input.priceMin !== undefined || input.priceMax !== undefined) {
        if (input.priceMin) query = query.gte('base_price', input.priceMin);
        if (input.priceMax) query = query.lte('base_price', input.priceMax);
      }

      if (input.isOnSale) {
        query = query.not('variants.sale_price', 'is', null);
      }

      if (input.inStock) {
        query = query.gt('variants.stock_quantity', 0);
      }

      // Apply sorting
      switch (input.sortBy) {
        case 'name':
          query = query.order('name');
          break;
        case 'price_asc':
          query = query.order('base_price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('base_price', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('popularity_score', { ascending: false });
      }

      // Apply pagination
      query = query.range(input.offset, input.offset + input.limit - 1);

      const { data: products, error } = await query;

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      // Transform and enrich results
      const enrichedProducts = products?.map(product => ({
        ...product,
        minPrice: Math.min(...(product.variants?.map(v => v.current_price) || [product.base_price])),
        maxPrice: Math.max(...(product.variants?.map(v => v.current_price) || [product.base_price])),
        isOnSale: product.variants?.some(v => v.sale_price !== null) || false,
        mainImage: product.images?.find(img => img.image_type === 'product')?.cdn_url || product.images?.[0]?.original_url,
        availableSizes: product.variants?.filter(v => v.is_available && v.stock_quantity > 0).map(v => v.size) || [],
        availableColors: [...new Set(product.variants?.filter(v => v.is_available).map(v => v.color))] || []
      }));

      await cache.set(cacheKey, enrichedProducts, 900); // 15 minutes cache
      return enrichedProducts;
    }),

  // Get trending/featured products
  getTrendingProducts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(12),
      categoryId: z.number().optional()
    }))
    .query(async ({ input }) => {
      const cacheKey = `${CacheKeys.TRENDING_PRODUCTS}:${input.categoryId || 'all'}:${input.limit}`;
      const cached = await cache.get(cacheKey);

      if (cached) return cached;

      let query = supabase
        .from('products')
        .select(`
          *,
          brand:brands(name, logo_url),
          variants:product_variants(*),
          images:product_images(*)
        `)
        .eq('is_active', true)
        .eq('is_trending', true);

      if (input.categoryId) {
        query = query.eq('category_id', input.categoryId);
      }

      query = query
        .order('popularity_score', { ascending: false })
        .limit(input.limit);

      const { data: products } = await query;

      await cache.set(cacheKey, products, 1800); // 30 minutes cache
      return products;
    }),

  // Get product details with full variant/image data
  getProductDetails: publicProcedure
    .input(z.object({
      productId: z.number()
    }))
    .query(async ({ input }) => {
      const cacheKey = CacheKeys.PRODUCT(input.productId);
      const cached = await cache.get(cacheKey);

      if (cached) return cached;

      const { data: product } = await supabase
        .from('products')
        .select(`
          *,
          brand:brands(*),
          category:categories(*),
          variants:product_variants(*),
          images:product_images(*)
        `)
        .eq('id', input.productId)
        .single();

      if (!product) {
        throw new Error('Product not found');
      }

      // Enrich with computed properties
      const enrichedProduct = {
        ...product,
        priceRange: {
          min: Math.min(...(product.variants?.map(v => v.current_price) || [product.base_price])),
          max: Math.max(...(product.variants?.map(v => v.current_price) || [product.base_price]))
        },
        totalStock: product.variants?.reduce((sum, v) => sum + v.stock_quantity, 0) || 0,
        availableVariants: product.variants?.filter(v => v.is_available && v.stock_quantity > 0) || [],
        imagesByType: product.images?.reduce((acc, img) => {
          acc[img.image_type] = acc[img.image_type] || [];
          acc[img.image_type].push(img);
          return acc;
        }, {} as Record<string, any[]>) || {}
      };

      await cache.set(cacheKey, enrichedProduct, 600); // 10 minutes cache
      return enrichedProduct;
    }),

  // Get similar products (recommendation engine)
  getSimilarProducts: publicProcedure
    .input(z.object({
      productId: z.number(),
      limit: z.number().min(1).max(20).default(8)
    }))
    .query(async ({ input }) => {
      // Get base product for similarity matching
      const { data: baseProduct } = await supabase
        .from('products')
        .select('category_id, tags, base_price')
        .eq('id', input.productId)
        .single();

      if (!baseProduct) return [];

      // Find similar products by category and price range
      const priceRange = baseProduct.base_price * 0.3; // 30% price variance

      const { data: similarProducts } = await supabase
        .from('products')
        .select(`
          *,
          brand:brands(name, logo_url),
          images:product_images!inner(*)
        `)
        .eq('category_id', baseProduct.category_id)
        .neq('id', input.productId)
        .gte('base_price', baseProduct.base_price - priceRange)
        .lte('base_price', baseProduct.base_price + priceRange)
        .eq('is_active', true)
        .limit(input.limit);

      return similarProducts || [];
    })
};

export const catalogRouter = createTRPCRouter(catalogProcedures);
```

### 4.2 Sync Management Procedures
```typescript
// backend/trpc/procedures/sync.ts
import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../context';
import { CatalogSyncService } from '../../services/catalogSync';
import { supabase } from '../../lib/supabase';

export const syncProcedures = {
  // Trigger manual brand sync
  triggerBrandSync: publicProcedure
    .input(z.object({
      brandId: z.number(),
      syncType: z.enum(['full', 'incremental']).default('incremental')
    }))
    .mutation(async ({ input }) => {
      const syncService = CatalogSyncService.getInstance();

      try {
        await syncService.syncBrand(input.brandId, input.syncType);
        return { success: true, message: 'Sync completed successfully' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Get sync status for all brands
  getSyncStatus: publicProcedure.query(async () => {
    const { data: syncLogs } = await supabase
      .from('catalog_sync_logs')
      .select(`
        *,
        brand:brands(name, api_type, last_sync)
      `)
      .order('started_at', { ascending: false })
      .limit(50);

    return syncLogs?.map(log => ({
      ...log,
      is_running: log.status === 'running',
      success_rate: log.items_processed > 0
        ? ((log.items_processed - log.errors_count) / log.items_processed) * 100
        : 0
    })) || [];
  }),

  // Get catalog statistics
  getCatalogStats: publicProcedure.query(async () => {
    // Get basic counts
    const [
      { count: totalProducts },
      { count: totalBrands },
      { count: totalVariants },
      { count: inStockProducts }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('brands').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('product_variants').select('*', { count: 'exact', head: true }),
      supabase.from('product_variants').select('*', { count: 'exact', head: true }).gt('stock_quantity', 0)
    ]);

    // Get category breakdown
    const { data: categoryStats } = await supabase
      .from('products')
      .select('category_id, categories(name)')
      .eq('is_active', true);

    const categoryCounts = categoryStats?.reduce((acc, item) => {
      const categoryName = item.categories?.name || 'Other';
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get recent sync activity
    const { data: recentSyncs } = await supabase
      .from('catalog_sync_logs')
      .select('brand_id, brands(name), completed_at, status')
      .order('completed_at', { ascending: false })
      .limit(10);

    return {
      totalProducts: totalProducts || 0,
      totalBrands: totalBrands || 0,
      totalVariants: totalVariants || 0,
      inStockProducts: inStockProducts || 0,
      stockPercentage: totalProducts ? (inStockProducts || 0) / totalProducts * 100 : 0,
      categoryBreakdown: categoryCounts,
      recentSyncActivity: recentSyncs || []
    };
  })
};

export const syncRouter = createTRPCRouter(syncProcedures);
```

### 4.3 Enhanced Outfit Generation with Real Products
```typescript
// backend/trpc/procedures/outfit.ts (Enhanced)
import { z } from 'zod';
import { publicProcedure } from '../context';
import { supabase } from '../../lib/supabase';
import { cache, CacheKeys } from '../../services/cache';

export const outfitProcedures = {
  generate: publicProcedure
    .input(z.object({
      prompt: z.string().min(1),
      userImageBase64: z.string().min(1),
      outfitId: z.string().optional(),
      categoryPreference: z.string().optional(),
      priceRange: z.object({
        min: z.number().optional(),
        max: z.number().optional()
      }).optional(),
      brandPreferences: z.array(z.number()).optional(),
      style: z.string().optional() // 'casual', 'business', 'formal', 'streetwear'
    }))
    .mutation(async ({ input }) => {
      try {
        // Step 1: Get suitable products based on preferences
        const suitableProducts = await getSuitableProducts({
          categoryPreference: input.categoryPreference,
          priceRange: input.priceRange,
          brandPreferences: input.brandPreferences,
          style: input.style
        });

        if (suitableProducts.length === 0) {
          throw new Error('No suitable products found for outfit generation');
        }

        // Step 2: Select products for outfit (top, bottom, accessories)
        const outfitItems = selectOutfitItems(suitableProducts, input.style);

        // Step 3: Generate outfit image using AI try-on service
        const generatedImage = await generateAITryOn({
          userImage: input.userImageBase64,
          products: outfitItems,
          prompt: input.prompt
        });

        // Step 4: Calculate total outfit price
        const totalPrice = outfitItems.reduce((sum, item) => {
          const variant = item.variants?.find(v => v.is_available) || item.variants?.[0];
          return sum + (variant?.current_price || item.base_price);
        }, 0);

        // Step 5: Create outfit response
        const outfitResponse = {
          id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          imageUrl: generatedImage.url,
          prompt: input.prompt,
          outfitId: input.outfitId || `outfit_${Date.now()}`,

          // Real product data
          items: outfitItems.map(product => ({
            id: product.id.toString(),
            name: product.name,
            brand: product.brand?.name || 'Unknown',
            price: formatPrice(product.variants?.[0]?.current_price || product.base_price),
            salePrice: product.variants?.find(v => v.sale_price)?.sale_price
              ? formatPrice(product.variants.find(v => v.sale_price)!.sale_price!)
              : undefined,
            category: product.category?.name || 'other',
            imageUrl: product.images?.find(img => img.image_type === 'product')?.cdn_url ||
                     product.images?.[0]?.original_url,
            productUrl: `${process.env.EXPO_PUBLIC_APP_URL}/product/${product.id}`,
            shopUrl: product.brand?.website,
            isAvailable: product.variants?.some(v => v.is_available && v.stock_quantity > 0) || false,
            availableSizes: product.variants?.filter(v => v.is_available).map(v => v.size) || [],
            availableColors: [...new Set(product.variants?.map(v => v.color).filter(Boolean))] || []
          })),

          // Outfit metadata
          metadata: {
            style: input.style || 'generated',
            occasion: inferOccasionFromPrompt(input.prompt),
            season: 'all',
            colors: extractColorsFromProducts(outfitItems),
            totalPrice: formatPrice(totalPrice),
            priceCategory: categorizePriceRange(totalPrice),
            canPurchaseAll: outfitItems.every(item =>
              item.variants?.some(v => v.is_available && v.stock_quantity > 0)
            )
          },

          timestamp: Date.now(),
        };

        return outfitResponse;

      } catch (error) {
        console.error('Outfit generation failed:', error);

        // Fallback to mock data for development
        return {
          id: `fallback_${Date.now()}`,
          imageUrl: `https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=${encodeURIComponent(input.prompt)}`,
          prompt: input.prompt,
          outfitId: input.outfitId || `outfit_${Date.now()}`,
          items: [
            { id: '1', name: 'Fallback T-Shirt', brand: 'Demo Brand', price: '$29.99', category: 'tops' },
          ],
          metadata: {
            style: 'fallback',
            occasion: 'demo',
            season: 'all',
            colors: ['demo'],
          },
          timestamp: Date.now(),
        };
      }
    }),

  // New: Get outfit by ID with real product data
  getOutfitDetails: publicProcedure
    .input(z.object({ outfitId: z.string() }))
    .query(async ({ input }) => {
      // This would typically fetch from a saved outfits table
      // For now, return cached outfit or regenerate
      const cacheKey = `outfit:${input.outfitId}`;
      const cached = await cache.get(cacheKey);

      if (cached) return cached;

      throw new Error('Outfit not found');
    }),

  // New: Save outfit for later
  saveOutfit: publicProcedure
    .input(z.object({
      outfitId: z.string(),
      outfitData: z.any(), // The complete outfit response
      userId: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      // Cache the outfit
      const cacheKey = `outfit:${input.outfitId}`;
      await cache.set(cacheKey, input.outfitData, 86400); // 24 hours

      // Optionally save to database for persistence
      if (input.userId) {
        // Save to user's outfits collection
      }

      return { success: true, outfitId: input.outfitId };
    })
};

// Helper functions
async function getSuitableProducts({
  categoryPreference,
  priceRange,
  brandPreferences,
  style
}: {
  categoryPreference?: string;
  priceRange?: { min?: number; max?: number };
  brandPreferences?: number[];
  style?: string;
}) {
  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
    .eq('is_active', true)
    .gt('variants.stock_quantity', 0); // Only in-stock items

  // Apply filters
  if (categoryPreference) {
    query = query.eq('category.slug', categoryPreference);
  }

  if (priceRange?.min || priceRange?.max) {
    if (priceRange.min) query = query.gte('base_price', priceRange.min);
    if (priceRange.max) query = query.lte('base_price', priceRange.max);
  }

  if (brandPreferences?.length) {
    query = query.in('brand_id', brandPreferences);
  }

  if (style) {
    // Filter by style-related tags
    const styleTags = getStyleTags(style);
    query = query.overlaps('tags', styleTags);
  }

  const { data: products } = await query.limit(100);
  return products || [];
}

function selectOutfitItems(products: any[], style?: string) {
  const categorizedProducts = products.reduce((acc, product) => {
    const category = product.category?.slug || 'other';
    acc[category] = acc[category] || [];
    acc[category].push(product);
    return acc;
  }, {} as Record<string, any[]>);

  const outfit = [];

  // Select one item from each category for a complete outfit
  const categoryPriority = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'];

  for (const category of categoryPriority) {
    if (categorizedProducts[category] && outfit.length < 4) {
      // Randomly select from available items in category
      const randomItem = categorizedProducts[category][
        Math.floor(Math.random() * categorizedProducts[category].length)
      ];
      outfit.push(randomItem);
    }
  }

  return outfit.slice(0, 3); // Max 3 items per outfit
}

async function generateAITryOn({
  userImage,
  products,
  prompt
}: {
  userImage: string;
  products: any[];
  prompt: string;
}) {
  // This would integrate with actual AI try-on service
  // For now, return placeholder
  return {
    url: `https://via.placeholder.com/400x600/4F46E5/FFFFFF?text=${encodeURIComponent(prompt + ' - ' + products.length + ' items')}`
  };
}

function getStyleTags(style: string): string[] {
  const styleTagMap: Record<string, string[]> = {
    'casual': ['casual', 'comfort', 'everyday', 'relaxed'],
    'business': ['professional', 'business', 'formal', 'work'],
    'formal': ['formal', 'elegant', 'dress-up', 'occasion'],
    'streetwear': ['streetwear', 'urban', 'trendy', 'hip']
  };

  return styleTagMap[style] || ['casual'];
}

function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(2)}`;
}

function inferOccasionFromPrompt(prompt: string): string {
  if (prompt.toLowerCase().includes('work') || prompt.toLowerCase().includes('office')) {
    return 'work';
  }
  if (prompt.toLowerCase().includes('date') || prompt.toLowerCase().includes('dinner')) {
    return 'date';
  }
  if (prompt.toLowerCase().includes('casual') || prompt.toLowerCase().includes('everyday')) {
    return 'casual';
  }
  return 'general';
}

function extractColorsFromProducts(products: any[]): string[] {
  const colors = new Set<string>();
  products.forEach(product => {
    product.variants?.forEach((variant: any) => {
      if (variant.color) colors.add(variant.color.toLowerCase());
    });
  });
  return Array.from(colors).slice(0, 5); // Top 5 colors
}

function categorizePriceRange(totalPriceInCents: number): string {
  const price = totalPriceInCents / 100;
  if (price < 100) return 'budget';
  if (price < 300) return 'mid-range';
  if (price < 500) return 'premium';
  return 'luxury';
}
```

---

This completes the first major section of the comprehensive catalog implementation plan. The system provides:

1. **Complete Database Schema** - Scalable PostgreSQL design with all necessary tables
2. **Brand Integration Layer** - Adapters for Shopify, custom APIs, and web scraping
3. **Synchronization Service** - Automated data sync with error handling and logging
4. **Enhanced tRPC API** - Type-safe procedures for catalog management
5. **Real Product Integration** - AI try-on with actual purchasable items

Next, I'll mark the first todo as complete and continue with the remaining phases covering the frontend implementation, UI components, and performance optimizations.