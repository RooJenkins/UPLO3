# tRPC Backend Setup & Benefits

## What is tRPC?

**tRPC** (TypeScript Remote Procedure Call) provides:

### 🎯 **Key Benefits**
- **End-to-end type safety** - Frontend knows exactly what backend expects/returns
- **Automatic API client generation** - No manual fetch calls needed
- **Real-time error handling** - TypeScript catches API mismatches at compile time
- **Better developer experience** - Autocomplete, refactoring, debugging
- **Performance optimizations** - Request deduplication, caching, batching

### 🚀 **For Your Outfit App**
- **Type Safety**: Frontend knows exactly what outfit generation returns
- **Performance**: Optimized queries with React Query integration  
- **Caching**: Automatic request deduplication and smart caching
- **Error Handling**: Structured error responses with fallbacks
- **Real-time**: Easy WebSocket integration for live outfit updates

## Current Architecture

### 📁 **Backend Structure**
```
backend/
├── hono.ts                    # Main server (Hono framework)
├── trpc/
│   ├── app-router.ts         # Main tRPC router
│   ├── create-context.ts     # tRPC context & procedures
│   └── routes/
│       ├── outfit/generate/  # AI outfit generation
│       └── feed/cache/       # Feed caching system
```

### 🔄 **Data Flow**
1. **User uploads image** → Stored in UserProvider
2. **Feed requests outfit** → tRPC calls Google Gemini API
3. **Generated outfit** → Cached locally + cloud (tRPC)
4. **Smooth scrolling** → Preloaded images + smart caching

## Current Status

### ✅ **Working**
- **Fallback system** - App works without backend
- **Local caching** - URL-based lightweight storage
- **Error handling** - Graceful degradation
- **Type safety** - Full TypeScript integration

### ⚠️ **Issues**
- **Backend not running** - tRPC calls timeout and fallback to mock data
- **Network configuration** - localhost may not be accessible on mobile

## How to Test Backend

### 1. **Check if backend is accessible**
```bash
# Test health endpoint
curl http://localhost:8081/api/health

# Test tRPC endpoint  
curl -X POST http://localhost:8081/api/trpc/example.hi \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. **Check console logs**
Look for these messages:
```
✅ "tRPC client connecting to: http://localhost:8081/api/trpc"
✅ "Successfully generated and cached outfit: 12345"

❌ "tRPC fetch error: TypeError: Failed to fetch"
❌ "tRPC generation failed, using fallback"
```

## Solutions

### 🔧 **Option 1: Fix Backend Connection**
The backend server needs to be running and accessible. Currently the app falls back to mock data when tRPC fails.

### 🔧 **Option 2: Use Without Backend** 
The app is designed to work perfectly without backend:
- **Mock outfit generation** with realistic data
- **Local storage caching** for persistence  
- **Smooth UX** with loading states and preloading

### 🔧 **Option 3: Cloud Deployment**
Deploy backend to Vercel/Railway and update `EXPO_PUBLIC_RORK_API_BASE_URL`

## Performance Impact

### **With tRPC Backend:**
- **Real AI-generated outfits** using Google Gemini
- **Cloud caching** for cross-device sync
- **Optimized requests** with batching and deduplication

### **Without Backend (Current):**
- **Instant mock outfits** with realistic data
- **Local-only caching** (still very fast)
- **No network dependency** (works offline)

## Recommendation

The app currently works great without the backend! The tRPC integration provides future scalability and real AI generation, but the fallback system ensures a smooth user experience regardless of backend status.

**For development**: Continue with current setup (backend optional)
**For production**: Deploy backend for real AI outfit generation