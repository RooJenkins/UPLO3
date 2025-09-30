-- UPLO-DB Database Schema
-- PostgreSQL 15+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Brands
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    website TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_active ON brands(is_active) WHERE is_active = true;

-- Stores
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    brand_id INT REFERENCES brands(id),
    store_id INT REFERENCES stores(id),
    external_id VARCHAR(255) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100),
    product_url TEXT,
    buy_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_store_product UNIQUE(store_id, external_id)
);

CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_updated ON products(updated_at DESC, id DESC);

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    src_url TEXT NOT NULL,
    cdn_url TEXT,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_images_product ON product_images(product_id, position);

-- Product Variants
CREATE TABLE IF NOT EXISTS variants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color VARCHAR(100),
    size VARCHAR(50),
    sku VARCHAR(255),
    price_cents INT NOT NULL CHECK (price_cents > 0),
    in_stock BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_variants_stock_price ON variants(in_stock, price_cents) WHERE in_stock = true;

-- ============================================================================
-- Denormalized Feed Table (for fast queries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feed_items (
    product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    brand_id INT,
    brand_name VARCHAR(100),
    store_name VARCHAR(100),
    category VARCHAR(100),
    name TEXT,
    description TEXT,
    image_urls TEXT[],
    min_price_cents INT,
    max_price_cents INT,
    available_colors TEXT[],
    available_sizes TEXT[],
    in_stock BOOLEAN,
    product_url TEXT,
    buy_url TEXT,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_feed_cursor ON feed_items(updated_at DESC, product_id DESC);
CREATE INDEX idx_feed_filters ON feed_items(brand_id, category, in_stock);
CREATE INDEX idx_feed_category ON feed_items(category);
CREATE INDEX idx_feed_brand ON feed_items(brand_name);

-- ============================================================================
-- Metadata & Logging Tables
-- ============================================================================

-- Catalog Versions (track ingestion runs)
CREATE TABLE IF NOT EXISTS catalog_versions (
    version TIMESTAMPTZ PRIMARY KEY DEFAULT NOW(),
    source VARCHAR(100),
    items_count INT,
    status VARCHAR(50) DEFAULT 'running'
);

CREATE INDEX idx_catalog_versions_status ON catalog_versions(status, version DESC);

-- Scrape Logs (track scraping success/failures)
CREATE TABLE IF NOT EXISTS scrape_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    products_scraped INT DEFAULT 0,
    errors INT DEFAULT 0,
    error_messages JSONB,
    duration_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_logs_source ON scrape_logs(source, created_at DESC);
CREATE INDEX idx_scrape_logs_created ON scrape_logs(created_at DESC);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to rebuild feed_items table
CREATE OR REPLACE FUNCTION rebuild_feed_items()
RETURNS void AS $$
BEGIN
    TRUNCATE feed_items;

    INSERT INTO feed_items (
        product_id, brand_id, brand_name, store_name, category,
        name, description, image_urls, min_price_cents, max_price_cents,
        available_colors, available_sizes, in_stock, product_url, buy_url, updated_at
    )
    SELECT
        p.id,
        p.brand_id,
        b.name,
        s.name,
        p.category,
        p.name,
        p.description,
        ARRAY(
            SELECT i.src_url
            FROM product_images i
            WHERE i.product_id = p.id
            ORDER BY i.position
            LIMIT 3
        ),
        MIN(v.price_cents),
        MAX(v.price_cents),
        ARRAY_AGG(DISTINCT v.color) FILTER (WHERE v.color IS NOT NULL),
        ARRAY_AGG(DISTINCT v.size) FILTER (WHERE v.size IS NOT NULL),
        BOOL_OR(v.in_stock),
        p.product_url,
        p.buy_url,
        p.updated_at
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN stores s ON s.id = p.store_id
    LEFT JOIN variants v ON v.product_id = p.id
    GROUP BY p.id, b.name, s.name;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data (Initial brands/stores)
-- ============================================================================

INSERT INTO brands (name, slug, logo_url, website) VALUES
    ('Zara', 'zara', 'https://logo.clearbit.com/zara.com', 'https://www.zara.com'),
    ('H&M', 'hm', 'https://logo.clearbit.com/hm.com', 'https://www2.hm.com'),
    ('ASOS', 'asos', 'https://logo.clearbit.com/asos.com', 'https://www.asos.com'),
    ('Nike', 'nike', 'https://logo.clearbit.com/nike.com', 'https://www.nike.com'),
    ('Adidas', 'adidas', 'https://logo.clearbit.com/adidas.com', 'https://www.adidas.com')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO stores (name, domain) VALUES
    ('Zara', 'zara.com'),
    ('H&M', 'hm.com'),
    ('ASOS', 'asos.com'),
    ('Nike', 'nike.com'),
    ('Adidas', 'adidas.com')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Views
-- ============================================================================

-- Catalog stats view
CREATE OR REPLACE VIEW catalog_stats AS
SELECT
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT p.brand_id) as total_brands,
    COUNT(DISTINCT v.id) as total_variants,
    COUNT(DISTINCT CASE WHEN v.in_stock THEN p.id END) as in_stock_products,
    MAX(p.updated_at) as last_updated
FROM products p
LEFT JOIN variants v ON v.product_id = p.id;

-- Brand stats view
CREATE OR REPLACE VIEW brand_stats AS
SELECT
    b.id,
    b.name,
    b.slug,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT CASE WHEN v.in_stock THEN p.id END) as in_stock_count,
    MIN(v.price_cents) as min_price_cents,
    MAX(v.price_cents) as max_price_cents
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
LEFT JOIN variants v ON v.product_id = p.id
WHERE b.is_active = true
GROUP BY b.id, b.name, b.slug;

-- Category stats view
CREATE OR REPLACE VIEW category_stats AS
SELECT
    p.category,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT CASE WHEN v.in_stock THEN p.id END) as in_stock_count
FROM products p
LEFT JOIN variants v ON v.product_id = p.id
WHERE p.category IS NOT NULL
GROUP BY p.category
ORDER BY product_count DESC;

-- ============================================================================
-- Permissions (for production)
-- ============================================================================

-- Uncomment these when setting up with a dedicated API user
-- CREATE ROLE uplo_db_api WITH LOGIN PASSWORD 'your-password-here';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO uplo_db_api;
-- GRANT INSERT, UPDATE ON scrape_logs TO uplo_db_api;
