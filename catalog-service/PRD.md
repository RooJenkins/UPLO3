# UPLO-DB Product Requirements Document

**Version:** 1.0
**Date:** September 30, 2025
**Status:** Active Development
**Project Type:** Backend Catalog Database Service

---

## Executive Summary

UPLO-DB is a high-performance clothing catalog backend service that scrapes, stores, and serves product data from major e-commerce retailers. It provides real-time product information to the UPLO3 mobile fashion app, enabling users to browse and purchase actual clothing items from hundreds of brands.

**Core Mission:** Maintain a comprehensive, up-to-date catalog of 10,000+ clothing items from 5-10 major retailers, updating 2-4 times daily, serving data via fast API endpoints with <200ms response times globally.

---

## Problem Statement

### Current State
UPLO3 currently uses mock product data, limiting its utility as a real shopping platform. Users cannot:
- Browse real, purchasable clothing items
- See accurate prices and availability
- Click through to purchase products
- Trust that outfit recommendations feature actual products

### Target State
UPLO-DB will provide:
- **Real product data** from Zara, H&M, ASOS, Nike, Adidas, and more
- **Fresh data** updated 2-4 times per day
- **Fast API access** with CDN caching for global performance
- **Comprehensive product info**: 2-5 images, sizes, colors, prices, descriptions, buy links
- **Scalable architecture** supporting 1000s of concurrent mobile app users

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      UPLO-DB System                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [E-commerce Sites] → [Scrapers] → [Staging DB]            │
│                             ↓                               │
│                    [Data Normalization]                     │
│                             ↓                               │
│                    [Production DB]                          │
│                     (PostgreSQL)                            │
│                             ↓                               │
│                    [FastAPI Service]                        │
│                             ↓                               │
│                    [CDN Cache Layer]                        │
│                             ↓                               │
│                    [UPLO3 Mobile Apps]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Database:**
- PostgreSQL 15+ (via Supabase or Railway)
- Redis for caching (optional, use in-memory initially)

**Backend:**
- Python 3.10+ (scraping + data processing)
- FastAPI (REST API endpoints)
- Playwright (web scraping)

**Infrastructure:**
- Railway or Render (app hosting)
- Cloudflare (CDN + DDoS protection)
- GitHub Actions (scheduled scraping)

**Monitoring:**
- Simple logging to stdout
- Health check endpoint
- Scrape success/failure tracking

---

## Database Schema

### Core Tables

#### 1. `brands`
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(100) NOT NULL UNIQUE
slug            VARCHAR(100) NOT NULL UNIQUE
website         TEXT
logo_url        TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

#### 2. `stores`
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(100) NOT NULL UNIQUE
domain          VARCHAR(255)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### 3. `products`
```sql
id              BIGSERIAL PRIMARY KEY
brand_id        INT REFERENCES brands(id)
store_id        INT REFERENCES stores(id)
external_id     VARCHAR(255)           -- Store's product ID
name            TEXT NOT NULL
description     TEXT
category        VARCHAR(100)
product_url     TEXT
buy_url         TEXT
updated_at      TIMESTAMPTZ DEFAULT NOW()
created_at      TIMESTAMPTZ DEFAULT NOW()

UNIQUE(store_id, external_id)
INDEX(brand_id, category)
INDEX(updated_at DESC, id DESC)
```

#### 4. `product_images`
```sql
id              BIGSERIAL PRIMARY KEY
product_id      BIGINT REFERENCES products(id) ON DELETE CASCADE
src_url         TEXT NOT NULL
cdn_url         TEXT                    -- Optional CDN URL
position        INT DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()

INDEX(product_id, position)
```

#### 5. `variants`
```sql
id              BIGSERIAL PRIMARY KEY
product_id      BIGINT REFERENCES products(id) ON DELETE CASCADE
color           VARCHAR(100)
size            VARCHAR(50)
sku             VARCHAR(255)
price_cents     INT NOT NULL
in_stock        BOOLEAN DEFAULT true
updated_at      TIMESTAMPTZ DEFAULT NOW()
created_at      TIMESTAMPTZ DEFAULT NOW()

INDEX(product_id)
INDEX(in_stock, price_cents) WHERE in_stock = true
```

#### 6. `feed_items`
Denormalized table for fast feed queries:
```sql
product_id      BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE
brand_id        INT
brand_name      VARCHAR(100)
store_name      VARCHAR(100)
category        VARCHAR(100)
name            TEXT
description     TEXT
image_urls      TEXT[]                  -- First 3 images
min_price_cents INT
max_price_cents INT
available_colors TEXT[]
available_sizes TEXT[]
in_stock        BOOLEAN
product_url     TEXT
buy_url         TEXT
updated_at      TIMESTAMPTZ

INDEX(updated_at DESC, product_id DESC)
INDEX(brand_id, category, in_stock)
```

#### 7. `catalog_versions`
Track ingestion runs:
```sql
version         TIMESTAMPTZ PRIMARY KEY DEFAULT NOW()
source          VARCHAR(100)
items_count     INT
status          VARCHAR(50) DEFAULT 'running'
```

---

## API Specification

### Base URL
```
https://uplo-db.your-domain.com/api/v1
```

### Endpoints

#### 1. **GET /feed**
Paginated product feed with filters

**Query Parameters:**
```
cursor        string    - Opaque cursor for pagination
limit         int       - Items per page (default: 100, max: 100)
brand         string    - Filter by brand name
category      string    - Filter by category
in_stock      boolean   - Only in-stock items (default: true)
price_min     int       - Min price in cents
price_max     int       - Max price in cents
```

**Response:**
```json
{
  "items": [
    {
      "product_id": 123,
      "brand_name": "Zara",
      "store_name": "Zara",
      "name": "Classic White T-Shirt",
      "description": "100% cotton, relaxed fit",
      "category": "tops",
      "image_urls": [
        "https://cdn.zara.com/img1.jpg",
        "https://cdn.zara.com/img2.jpg"
      ],
      "min_price_cents": 2999,
      "available_colors": ["White", "Black", "Navy"],
      "available_sizes": ["XS", "S", "M", "L", "XL"],
      "in_stock": true,
      "product_url": "https://zara.com/product/123",
      "buy_url": "https://zara.com/buy/123"
    }
  ],
  "next_cursor": "eyJ1cGRhdGVkX2F0IjoxNjk...",
  "catalog_version": "2025-09-30T15:00:00Z"
}
```

**Performance Target:** <50ms (with CDN cache), <150ms (cold)

#### 2. **GET /product/:id**
Detailed product information

**Response:**
```json
{
  "id": 123,
  "brand": {
    "name": "Zara",
    "logo_url": "https://logo.clearbit.com/zara.com"
  },
  "store": {
    "name": "Zara",
    "domain": "zara.com"
  },
  "name": "Classic White T-Shirt",
  "description": "100% cotton, relaxed fit...",
  "category": "tops",
  "images": [
    {
      "src_url": "https://cdn.zara.com/img1.jpg",
      "position": 0
    }
  ],
  "variants": [
    {
      "id": 456,
      "color": "White",
      "size": "M",
      "sku": "ZARA-TS-001-M",
      "price_cents": 2999,
      "in_stock": true
    }
  ],
  "product_url": "https://zara.com/product/123",
  "buy_url": "https://zara.com/buy/123",
  "updated_at": "2025-09-30T14:30:00Z"
}
```

#### 3. **GET /health**
Service health check

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "last_scrape": "2025-09-30T14:00:00Z",
  "catalog_size": 8543,
  "uptime_seconds": 86400
}
```

#### 4. **GET /stats**
Catalog statistics

**Response:**
```json
{
  "total_products": 8543,
  "total_brands": 7,
  "by_brand": {
    "Zara": 2341,
    "H&M": 1876,
    "ASOS": 1543
  },
  "by_category": {
    "tops": 3241,
    "bottoms": 2123,
    "dresses": 987
  },
  "last_updated": "2025-09-30T14:00:00Z"
}
```

---

## Scraping Strategy

### Target Sites (Initial Launch)

1. **H&M** - Good HTML structure, ~2000 products
2. **ASOS** - JSON API available, ~1500 products
3. **Zara** - Dynamic content, ~1800 products
4. **Nike** - Product feeds available, ~1000 products
5. **Adidas** - Product feeds, ~1200 products

### Scraping Approach

**Per-Source Configuration:**
```python
SOURCES = {
    'hm': {
        'method': 'playwright',  # Browser automation
        'urls': [
            'https://www2.hm.com/en_us/men/products/t-shirts-tank-tops.html',
            'https://www2.hm.com/en_us/women/products/dresses.html'
        ],
        'rate_limit': '1 req/2s',
        'max_products': 500
    },
    'asos': {
        'method': 'requests',  # Direct HTTP
        'api_url': 'https://api.asos.com/product/search/v2',
        'rate_limit': '2 req/s',
        'max_products': 400
    }
}
```

**Scraping Flow:**
1. Fetch product listing pages
2. Extract product URLs
3. Visit individual product pages
4. Extract: name, price, images, sizes, colors, description
5. Write to `staging` table
6. Run normalization + deduplication
7. Upsert to `products`, `variants`, `images`
8. Rebuild `feed_items` table
9. Insert `catalog_version` entry

**Error Handling:**
- Retry failed requests 3x with exponential backoff
- Log all failures to `scrape_errors` table
- Continue with next product on failure
- Alert if success rate < 80%

**Legal Compliance:**
- Respect `robots.txt`
- Use realistic user agents
- Rate limit all requests
- Prefer official APIs when available
- Store attribution (store URL, brand)

---

## Data Update Schedule

### Scraping Schedule
Run via GitHub Actions or Railway cron:

**Option 1: Staggered (Recommended)**
```
H&M:     Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
ASOS:    Every 6 hours (01:00, 07:00, 13:00, 19:00 UTC)
Zara:    Every 6 hours (02:00, 08:00, 14:00, 20:00 UTC)
Nike:    Every 6 hours (03:00, 09:00, 15:00, 21:00 UTC)
Adidas:  Every 6 hours (04:00, 10:00, 16:00, 22:00 UTC)
```

**Option 2: Batch**
```
All sources: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
```

### Cache Invalidation
- API responses cached for 30-60 minutes at CDN
- Emit `catalog_version` header with each response
- Apps can check version and refresh if changed

---

## Performance Requirements

### API Performance
| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Feed query (cached) | <50ms | 100ms |
| Feed query (cold) | <150ms | 300ms |
| Product detail (cached) | <30ms | 80ms |
| Product detail (cold) | <100ms | 200ms |

### Scraping Performance
| Metric | Target |
|--------|--------|
| H&M scrape (500 products) | <15 minutes |
| ASOS scrape (400 products) | <10 minutes |
| Full catalog refresh | <2 hours |
| Success rate | >90% |

### Database Performance
| Metric | Target |
|--------|--------|
| Feed query execution | <20ms |
| Product detail query | <10ms |
| Concurrent connections | 100+ |

---

## Deployment Architecture

### Phase 1: Prototype (Week 1-2)
```
GitHub Actions (scraper cron)
    ↓
Supabase (database)
    ↓
Supabase Edge Functions (API)
    ↓
Cloudflare (CDN)
    ↓
UPLO3 Apps
```

**Pros:** Free tier, fast setup, Postgres + API included
**Cons:** Limited compute for scraping, cold starts
**Cost:** $0-25/month

### Phase 2: Production (Week 3+)
```
Railway (scraper + API service)
    ↓
Supabase (database only)
    ↓
Cloudflare (CDN)
    ↓
UPLO3 Apps
```

**Pros:** Persistent processes, better scraping performance
**Cons:** Slightly more complex setup
**Cost:** $50-100/month

---

## Success Metrics

### Launch Criteria (MVP)
- [ ] 3 sources operational (H&M, ASOS, Zara)
- [ ] 1000+ products in database
- [ ] Scraper runs successfully 2x/day
- [ ] API responds in <200ms average
- [ ] UPLO3 app successfully fetches and displays products

### Phase 1 Goals (Month 1)
- 5 sources operational
- 5000+ products in database
- Scraper success rate >85%
- API p95 latency <300ms
- 90%+ API uptime

### Phase 2 Goals (Month 2-3)
- 10+ sources
- 10,000+ products
- Scraper success rate >90%
- API p95 latency <200ms
- 99%+ API uptime
- CDN hit rate >80%

---

## Development Milestones

### Week 1: Foundation
**Day 1:** Database schema + Supabase setup
**Day 2:** First scraper (H&M) working locally
**Day 3:** Data normalization + ingestion pipeline
**Day 4:** Basic FastAPI with /feed endpoint
**Day 5:** Deploy to Railway + test with UPLO3

### Week 2: Expansion
**Day 6-7:** Add 2 more scrapers (ASOS, Zara)
**Day 8:** Scheduled scraping via GitHub Actions
**Day 9:** CDN setup + caching strategy
**Day 10:** Monitoring + health checks

### Week 3: Polish
**Day 11-12:** Add remaining scrapers (Nike, Adidas)
**Day 13:** Performance optimization
**Day 14:** UPLO3 integration testing
**Day 15:** Production deployment + monitoring

---

## Integration with UPLO3

### UPLO3 Changes Required

**1. Update tRPC catalog procedures** (`backend/trpc/procedures/catalog.ts`):
```typescript
// Replace mock data with UPLO-DB API calls
export const catalogProcedures = {
  searchProducts: publicProcedure
    .input(searchProductsSchema)
    .query(async ({ input }) => {
      const response = await fetch(
        `https://uplo-db.your-domain.com/api/v1/feed?${new URLSearchParams({
          limit: input.limit.toString(),
          brand: input.brandIds?.join(',') || '',
          category: input.categoryIds?.join(',') || ''
        })}`
      );
      const data = await response.json();
      return {
        success: true,
        data: data.items,
        pagination: { /* ... */ }
      };
    })
};
```

**2. Environment variable** (`.env`):
```
EXPO_PUBLIC_UPLO_DB_API_URL=https://uplo-db.your-domain.com/api/v1
```

**3. Cache integration** (`lib/ProductSyncService.ts`):
- Keep existing service structure
- Replace mock retailers with UPLO-DB API
- Use `catalog_version` header for cache invalidation

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scraper blocked by retailer | High | High | Rotate user agents, use proxies, respect rate limits |
| Database costs exceed budget | Medium | Medium | Start with Supabase free tier, monitor usage |
| API performance degrades | Medium | High | Implement caching, optimize queries, use CDN |
| Scraper breaks due to site changes | High | Medium | Monitor scrape success rate, add alerts |

### Legal Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Terms of Service violation | Medium | High | Prefer official APIs, add affiliate links, respect robots.txt |
| Copyright issues with images | Low | Medium | Link to original images, don't rehost without permission |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Service downtime | Low | High | Health checks, uptime monitoring, fallback to cache |
| Data staleness | Medium | Medium | Alert if last scrape >12 hours old |

---

## Future Enhancements

### Phase 3: Advanced Features (Month 4+)
- **Personalization**: Track user preferences, recommend products
- **Price tracking**: Alert users to price drops
- **Availability alerts**: Notify when out-of-stock items return
- **Brand partnerships**: Integrate official APIs for priority brands
- **Analytics**: Track popular products, categories, brands
- **Search**: Full-text search across product names/descriptions
- **Filters**: Advanced filtering (price range, color, size, sale items)

### Phase 4: Scale (Month 6+)
- **50+ retailers**
- **100,000+ products**
- **Multi-region deployment** (US, EU, Asia)
- **GraphQL API** for flexible queries
- **WebSocket subscriptions** for real-time updates
- **Machine learning**: Auto-categorization, duplicate detection

---

## Appendix

### Development Tools
- **Database GUI**: pgAdmin or TablePlus
- **API testing**: Postman or HTTPie
- **Scraping**: Playwright Inspector for debugging

### Useful Commands
```bash
# Run scraper locally
python scraper/run.py --source hm --limit 50

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM products"

# Test API locally
uvicorn backend.api.main:app --reload

# Deploy to Railway
railway up

# Check logs
railway logs --tail
```

### Key Files
```
UPLO-DB/
├── PRD.md                      # This document
├── CLAUDE.md                   # Claude Code instructions
├── scraper/
│   ├── run.py                  # Main scraper entry point
│   ├── sources/                # Per-retailer scrapers
│   │   ├── hm.py
│   │   ├── asos.py
│   │   └── zara.py
│   └── utils.py                # Shared utilities
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Database schema
│   │   └── migrations/         # Schema migrations
│   ├── api/
│   │   ├── main.py             # FastAPI app
│   │   └── routes/             # API route handlers
│   └── services/
│       ├── ingestion.py        # Data ingestion logic
│       └── cache.py            # Caching layer
└── .github/workflows/
    └── scrape.yml              # GitHub Actions scraper schedule
```

---

**Document Owner:** UPLO3 Engineering Team
**Last Updated:** September 30, 2025
**Next Review:** October 7, 2025
