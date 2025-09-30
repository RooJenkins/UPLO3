# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UPLO3** is a React Native + Expo Router mobile fashion app featuring:
- **30-worker parallel AI outfit generation system** with infinite scroll
- **Virtual try-on capabilities** with real product integration
- **Smart recommendation engine** powered by ML
- **Real-time product catalog** with shopping integration
- **Cloud-first architecture** with tRPC + Hono backend

**Platform**: Cross-platform (iOS, Android, Web) via Expo + Rork.com deployment

**Monorepo Structure**: This repository contains both the mobile app and the backend catalog service.

---

## 📦 Catalog Service (Python Backend)

The `catalog-service/` directory contains the **UPLO-DB** backend - a Python scraping and API service that provides real product data to the mobile app.

### Quick Start (Catalog Service)
```bash
# Navigate to catalog service
cd catalog-service

# Setup Python environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
playwright install chromium

# Configure database
cp .env.example .env
# Edit .env with DATABASE_URL

# Initialize database
python scripts/init_db.py

# Run scraper
python scraper/run.py --source hm --limit 50

# Start API server (when implemented)
uvicorn backend.api.main:app --reload --port 8000
```

### Catalog Service Documentation
- **catalog-service/PRD.md** - Product requirements & architecture
- **catalog-service/README.md** - Detailed usage guide
- See catalog-service directory for full documentation

### Integration
The mobile app calls the catalog API for real product data:
```
EXPO_PUBLIC_UPLO_DB_API_URL=https://your-api.com/api/v1
```

---

## Development Commands

### Essential Workflow
```bash
# Install dependencies
bun install

# Start development (mobile + web with tunnel)
bun run start              # Rork tunnel mode (default)
bun run start-web          # Web + tunnel mode
bun run start-web-dev      # Web + tunnel + debug logging

# Alternative development modes
bun run dev                # Custom dev-start.js script
bun run dev:web            # Web-only via dev-start.js
bun run dev:clean          # Clear cache + restart

# Testing & Debugging
bun run test-api           # Test API endpoint health
bun run debug              # Test debug endpoint
curl http://localhost:8081/api/health  # Backend health check

# Linting & Type Checking
expo lint                  # ESLint checks
npx tsc --noEmit          # TypeScript type checking

# Cache management
bunx expo start --clear    # Clear Metro cache
bun run clean              # Nuclear option: remove node_modules + reinstall
```

### Platform-Specific Testing
```bash
# iOS (requires Xcode)
bun run start -- --ios

# Android (requires Android Studio)
bun run start -- --android

# Web preview
bun run start-web
```

## Architecture Deep Dive

### High-Level System Design
```
┌─────────────────────────────────────────────────────────────────┐
│                      UPLO3 Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (React Native + Expo Router)                         │
│    ├── 30-Worker AI Generation System                          │
│    ├── Virtual Try-On Service                                  │
│    ├── Smart Recommendation Engine                             │
│    └── Infinite Scroll Feed Management                         │
│                        ↕ tRPC                                   │
│  Backend (Hono + tRPC)                                          │
│    ├── Product Catalog API                                     │
│    ├── AI Outfit Generation                                    │
│    ├── Database Services (PostgreSQL ready)                    │
│    ├── Image Cache Service                                     │
│    └── Web Scraper Infrastructure                              │
│                                                                 │
│  External Integrations                                          │
│    ├── Rork Toolkit API (AI generation)                       │
│    ├── Brand APIs (Shopify, BigCommerce)                      │
│    └── Web Scrapers (Playwright-based)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Service Architecture

#### FeedLoadingService (30-Worker Engine)
**Location**: `lib/FeedLoadingService.ts`

The core AI generation system with sophisticated worker pool management:

```typescript
class FeedLoadingService {
  private MAX_WORKERS = 30;              // Parallel processing capacity
  private BUFFER_TARGET = 30;            // Images to maintain ahead
  private GENERATION_TRIGGER_DISTANCE = 15; // When to start generating

  // Advanced Features:
  // - Circuit breaker pattern for API failure protection
  // - Emergency queue size limits (max 50 jobs)
  // - Position lock system prevents duplicate generation
  // - Scroll velocity prediction for smart preloading
  // - Multi-layer deduplication tracking
}
```

**Key Patterns**:
- **Service Reference**: Always use consistent service instance via `useRef` pattern
- **Ultra-Unique IDs**: 6-source entropy system prevents React key collisions
- **4D Prompt Variation**: 36 colors × 30 styles × 23 accessories × 29 base prompts = 25,000+ unique combinations

#### Virtual Try-On Service
**Location**: `lib/VirtualTryOnService.ts`

Machine learning service for realistic clothing try-on:
- Body landmark detection
- Garment warping and fitting
- Real product integration
- Style transfer capabilities

#### Recommendation Engine
**Location**: `lib/RecommendationEngine.ts`

Smart product recommendation system:
- User profile analysis
- Collaborative filtering
- Content-based recommendations
- Real-time context awareness

### tRPC Backend Structure

**Entry Point**: `app/api/[...api]+api.ts` → `backend/server.ts`

```
backend/
├── server.ts                    # Hono app + tRPC mounting
├── trpc/
│   ├── router.ts               # Main router (combines all procedures)
│   ├── context.ts              # tRPC context setup
│   └── procedures/             # Organized API endpoints
│       ├── catalog.ts          # Product catalog APIs
│       ├── outfit.ts           # AI outfit generation
│       ├── feed.ts             # Feed management
│       ├── example.ts          # Example/test endpoints
│       ├── monitoring.ts       # System monitoring
│       └── scraper.ts          # Web scraper controls
├── database/                   # Database services
│   ├── DatabaseService.ts      # PostgreSQL operations
│   ├── DatabaseSyncManager.ts  # Sync coordination
│   ├── ImageCacheService.ts    # Image caching layer
│   └── index.ts
├── scraper/                    # Web scraping infrastructure
│   └── (Playwright-based scrapers)
└── monitoring/                 # System monitoring
```

**API Route Flow**:
1. Request → `/api/trpc/[procedure]` (Expo Router)
2. Hono server mounts at `/api/*`
3. tRPC server handles `/api/trpc/*`
4. Procedures execute with type safety
5. Response with SuperJSON serialization

### Frontend App Structure

```
app/
├── _layout.tsx                 # Root layout + providers
├── index.tsx                   # App entry point
├── onboarding.tsx             # User onboarding flow
├── (main)/                    # Main app screens
│   ├── _layout.tsx           # Main layout
│   └── feed.tsx              # Primary feed screen
├── api/                       # tRPC API routes (Expo Router)
│   ├── [...api]+api.ts       # Main API handler
│   └── health+api.ts         # Health check
├── backend-test.tsx          # API testing/debugging screen
├── catalog.tsx               # Product catalog browser
├── product-detail.tsx        # Individual product view
├── outfit-detail.tsx         # Outfit detail view
├── brands.tsx                # Brand directory
├── search.tsx                # Search functionality
├── debug.tsx                 # Debug utilities
└── +not-found.tsx            # 404 handling

components/                    # Reusable UI components
├── LoadingStats.tsx          # Worker monitoring display
├── FeedCard.tsx              # Feed item component
└── (other components)

providers/                     # React Context providers
├── AppProvider.tsx           # tRPC + React Query setup
├── FeedProvider.tsx          # Feed state management
└── UserProvider.tsx          # User state/image storage

lib/                          # Core services & utilities
├── trpc.ts                   # tRPC client configuration
├── FeedLoadingService.ts     # 30-worker generation engine
├── VirtualTryOnService.ts    # ML try-on service
├── RecommendationEngine.ts   # Smart recommendations
├── ProductSyncService.ts     # Product data sync
└── MLModelService.ts         # ML model management
```

## Critical Development Patterns

### 1. Service Reference Pattern (CRITICAL)
**Location**: `providers/FeedProvider.tsx`

```typescript
// ✅ CORRECT - Consistent service reference
const loadingService = useRef<FeedLoadingService | null>(null);
if (!loadingService.current) {
  loadingService.current = new FeedLoadingService();
}
const service = loadingService.current; // Use this consistently

// Use service.method() everywhere
service.getStats()
service.addJobs()

// ❌ INCORRECT - Mixed references cause bugs
loadingService.current.getStats()  // Don't mix with
service.getStats()                  // this pattern
```

### 2. Ultra-Unique ID Generation
Prevents React "Encountered two children with same key" warnings:

```typescript
const generateUniqueId = (index: number) => {
  const microTime = Date.now() + index;
  const sessionId = Math.random().toString(36).substring(2, 15);
  const processId = Math.floor(Math.random() * 100000);
  const random = Math.random().toString(36).substring(2, 10);
  return `init_${initTimestamp}_${sessionId}_${processId}_${microTime}_${random}_${index}`;
};
```

### 3. tRPC Usage Patterns

```typescript
// Query (GET-like operations)
const { data, isLoading, error } = trpc.catalog.list.useQuery({
  category: 'shirts',
  limit: 20
});

// Mutation (POST-like operations)
const generateOutfit = trpc.outfit.generate.useMutation({
  onSuccess: (data) => {
    console.log('Generated:', data);
  },
  onError: (error) => {
    console.error('Failed:', error);
    // Fallback logic here
  }
});

// Invalidate queries after mutations
const utils = trpc.useContext();
await utils.catalog.list.invalidate();
```

### 4. Adding New tRPC Endpoints

**Step-by-step process**:

1. Create procedure in `backend/trpc/procedures/[name].ts`:
```typescript
import { publicProcedure } from '../context';
import { z } from 'zod';

export const myProcedures = {
  myEndpoint: publicProcedure
    .input(z.object({ param: z.string() }))
    .query(async ({ input }) => {
      return { result: input.param };
    })
};
```

2. Add to router in `backend/trpc/router.ts`:
```typescript
import { myProcedures } from './procedures/my';

export const appRouter = createTRPCRouter({
  my: createTRPCRouter(myProcedures),
  // ... other routes
});
```

3. Use in frontend:
```typescript
const { data } = trpc.my.myEndpoint.useQuery({ param: 'value' });
```

### 5. Metro Bundler Configuration
**Location**: `metro.config.js`

The project uses **extensive module aliasing** to prevent bundling Node.js-only code:
- Backend scraper modules (Playwright, Cheerio, etc.) are aliased to empty modules
- Node.js built-ins (`node:sqlite`, `node:fs`, etc.) are replaced
- This allows backend code to exist without breaking React Native bundling

**When adding new Node.js dependencies to backend**, update `metro.config.js`:
```javascript
config.resolver.alias = {
  'your-nodejs-module': emptyModulePath,
};
```

## Environment Configuration

### Environment Variables
```bash
# Rork platform API (production)
EXPO_PUBLIC_API_BASE_URL=https://your-api.rork.com

# Local development server URL (auto-detected)
EXPO_PUBLIC_DEV_SERVER_URL=http://localhost:8081

# Development mode (auto-set)
NODE_ENV=development
```

### Development Modes
- **Local Web**: Full tRPC backend (Metro bundler serves API routes)
- **Local Mobile**: Full functionality via Rork tunnel or local network
- **Rork Platform**: Production API with real data
- **Deployed**: Full production environment

## Common Development Workflows

### Testing Backend Changes
1. Modify procedure in `backend/trpc/procedures/`
2. Server auto-reloads via Metro
3. Test in app or navigate to `/backend-test` screen
4. Check browser console for detailed tRPC logs

### Adding New Product Catalog Features
1. Review database schema in `CatalogPlan.md`
2. Implement database service in `backend/database/`
3. Create tRPC procedure in `backend/trpc/procedures/catalog.ts`
4. Add frontend UI component
5. Integrate with `ProductSyncService.ts` if needed

### Debugging Feed/Worker Issues
1. Enable worker monitoring: `LoadingStats` component shows real-time worker count
2. Check console for `[LOADING]` and `[FEED]` prefixed logs
3. Verify worker count displays "30/30" not "10/10"
4. Monitor buffer health (should maintain 80%+)
5. Check for React key collision warnings

### Working with AI Generation
- **Mock vs Real**: System automatically falls back to mock responses if backend unavailable
- **Rate Limiting**: Circuit breaker pattern protects against API overload
- **Prompt Engineering**: Modify variation arrays in `FeedLoadingService.ts` for different outfit styles
- **Image Caching**: `ImageCacheService.ts` handles persistence

## Performance Considerations

### Critical Performance Metrics
- **Worker Utilization**: Should show 30/30 active workers
- **Buffer Health**: Target 80%+ for smooth scrolling
- **Generation Speed**: ~2-3s average per outfit
- **Cache Hit Rate**: 90%+ for preloaded images
- **Scroll Performance**: Maintain 60fps during rapid scrolling

### Optimization Patterns
- **Infinite Scroll**: FlatList with `onViewableItemsChanged` for position tracking
- **Image Preloading**: `Image.prefetch()` for upcoming images
- **Memory Management**: Cache size limit of 100 images with LRU eviction
- **Network Optimization**: SuperJSON for efficient serialization
- **Query Caching**: React Query with 5-minute stale time

## Debugging Guide

### Console Log Prefixes
Understanding the logging system:

```
[TRPC]      - tRPC client configuration & requests
[BACKEND]   - Hono server & tRPC server logs
[LOADING]   - FeedLoadingService worker pool operations
[FEED]      - Feed state management & buffer operations
[FEEDCARD]  - Individual feed item rendering
[VIRTUAL]   - Virtual try-on service operations
[RECOMMEND] - Recommendation engine operations
[SYNC]      - Product sync service operations
```

### Common Issues & Solutions

#### "Workers showing 10/10 instead of 30/30"
**Cause**: Mixed service references in `FeedProvider.tsx`
**Solution**: Ensure all method calls use consistent `service` instance (not `loadingService.current`)

#### "React key collision warnings"
**Cause**: Insufficient entropy in ID generation
**Solution**: Verify `generateUniqueId()` uses all 6 entropy sources

#### "Duplicate images in feed"
**Cause**: Limited prompt variation
**Solution**: Enhanced prompt variation system already implemented with 25,000+ combinations

#### "tRPC fetch failed: 404"
**Cause**: API routes not accessible (common in some web dev modes)
**Solution**: System automatically uses mock responses; check console for fallback activation

#### "Metro bundler can't resolve node:sqlite"
**Cause**: Backend code importing Node.js modules
**Solution**: Add to `metro.config.js` alias list

#### "Type errors after tRPC changes"
**Cause**: AppRouter type needs regeneration
**Solution**: Restart TypeScript server or Metro bundler

### Development Testing Screen
**Route**: `/backend-test`

Comprehensive API testing interface showing:
- All available tRPC procedures
- Request/response inspection
- Error handling verification
- Network connectivity status

## TypeScript Configuration

- **Strict mode**: Enabled for maximum type safety
- **Path aliases**: `@/*` maps to project root
- **Expo types**: Auto-generated in `.expo/types/`
- **tRPC types**: Inferred from `AppRouter` type

**Type checking workflow**:
```bash
npx tsc --noEmit           # Full type check
npx tsc --noEmit --watch  # Watch mode
```

## Production Deployment

### Rork Platform (Automatic)
- Push to GitHub → Auto-deployment
- Environment variables in Rork dashboard
- Full API functionality in production
- 30-worker system fully operational

### Manual Deployment (EAS)
```bash
# Build for all platforms
eas build --platform all

# Submit to app stores
eas submit --platform ios
eas submit --platform android

# Web deployment
eas build --platform web
eas hosting:deploy
```

## Key Files Reference

### Must Read Before Major Changes
- `CURRENT_STATE.md` - System status & performance benchmarks
- `CatalogPlan.md` - Product catalog architecture & database schema
- `DEBUGGING.md` - Detailed debugging procedures
- `MEMORY.md` - Session continuity & lessons learned
- `TRPC_SETUP.md` - tRPC architecture explanation

### Critical Implementation Files
- `lib/FeedLoadingService.ts` - Core generation engine (450+ lines)
- `providers/FeedProvider.tsx` - Feed state management (430+ lines)
- `lib/trpc.ts` - tRPC client with extensive error handling
- `backend/server.ts` - Hono server setup
- `backend/trpc/router.ts` - API route aggregation
- `metro.config.js` - Critical bundler configuration

## Special Notes

### Package Manager
This project uses **Bun** (not npm/yarn/pnpm) for faster installation and execution.

### Rork Platform Integration
- Commands use `bunx rork start` for tunnel mode
- Project ID: `11lhbqtb21q4xicqryoig`
- Tunnel mode enables testing on physical devices
- Auto-deployment via GitHub integration

### React Native Web Compatibility
- Most native features work on web via Expo's polyfills
- Some features (camera, haptics) gracefully degrade
- Backend API fully functional on web

### Node.js vs React Native Boundaries
- Backend code (scraper, database) uses Node.js APIs
- Frontend code is React Native compatible
- Metro config prevents accidental bundling of Node.js code
- Use `backend/` directory for Node.js-only code

## Quick Reference Card

| Task | Command |
|------|---------|
| Start development | `bun run start-web` |
| Clear cache | `bunx expo start --clear` |
| Type check | `npx tsc --noEmit` |
| Test API | Navigate to `/backend-test` |
| Check backend | `curl http://localhost:8081/api/health` |
| View logs | Check console with prefix filters |
| Add tRPC route | `procedures/[name].ts` → `router.ts` → frontend |
| Debug workers | Check `LoadingStats` component for "30/30" |
| Clean install | `bun run clean` |

---

**This project is optimized for rapid development with Claude Code assistance. All patterns, architectures, and debugging strategies are documented for maximum productivity.**