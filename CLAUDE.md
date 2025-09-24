# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UPLO3** is a React Native + Expo Router mobile app featuring AI-powered outfit generation with tRPC backend integration. Built for the Rork platform with cross-platform deployment capabilities.

### Tech Stack
- **Frontend**: React Native + Expo Router + TypeScript
- **Backend**: Hono + tRPC + Zod validation
- **State Management**: Zustand + React Query
- **Styling**: NativeWind (Tailwind for React Native)
- **Platform**: Rork.com deployment + local development
- **AI Integration**: Rork Toolkit API for outfit generation

## Development Commands

### Essential Commands
```bash
# Install dependencies
bun install

# Start development server
bun run start                    # Mobile development with QR code
bun run start-web               # Web development mode
bun run start-web-dev           # Web with debug logging

# Platform-specific
bun run start -- --ios         # iOS simulator (if available)
bun run start -- --android     # Android emulator (if available)

# Linting
expo lint                       # Run ESLint checks
```

### Testing & Debugging
- Navigate to `/backend-test` in the app for comprehensive API testing
- Check browser console for tRPC connection logs
- Use React Query DevTools for state inspection

## Architecture

### Directory Structure
```
├── app/                        # Expo Router screens
│   ├── api/                   # API routes (tRPC integration)
│   │   ├── [...api]+api.ts   # Main API handler
│   │   ├── health+api.ts     # Health check endpoint
│   │   └── trpc/             # tRPC-specific routes
│   ├── (tabs)/               # Tab navigation screens
│   └── backend-test.tsx      # Development testing screen
├── backend/                   # Server-side code
│   ├── hono.ts               # Hono server setup
│   └── trpc/                 # tRPC configuration
│       ├── app-router.ts     # Main tRPC router
│       ├── create-context.ts # tRPC context setup
│       └── routes/           # Organized route handlers
├── components/               # Reusable UI components
├── lib/                      # Utilities and configurations
│   └── trpc.ts              # tRPC client setup
├── providers/                # React context providers
│   └── AppProvider.tsx      # Main provider wrapper
└── types/                    # TypeScript type definitions
```

### Key Files to Understand

#### `lib/trpc.ts` - tRPC Client Configuration
- Handles environment detection (Rork platform vs local)
- Implements fallback responses for development mode
- Contains comprehensive error handling and logging
- **Critical for API debugging**

#### `backend/trpc/app-router.ts` - API Routes
- Defines all available tRPC procedures
- Routes: `example.hi`, `outfit.generate`, `feed.*`
- **Edit here to add new API endpoints**

#### `providers/AppProvider.tsx` - App Setup
- tRPC provider configuration
- React Query setup with retry logic
- **Essential for proper app initialization**

## Development Workflow

### Adding New Features
1. **Define Types**: Add TypeScript interfaces in `types/`
2. **Create tRPC Route**: Add procedure in `backend/trpc/routes/`
3. **Update Router**: Export route in `app-router.ts`
4. **Frontend Integration**: Use `trpc.route.procedure.useQuery/useMutation()`
5. **Test**: Use `/backend-test` screen for verification

### tRPC Development Patterns
```typescript
// Query (GET-like operations)
const { data, isLoading, error } = trpc.feed.list.useQuery();

// Mutation (POST-like operations)
const generateOutfit = trpc.outfit.generate.useMutation({
  onSuccess: (data) => console.log('Generated:', data),
  onError: (error) => console.error('Failed:', error)
});
```

### Error Handling Strategy
- **Development Mode**: Automatic fallback to mock responses
- **Production**: Real API calls with comprehensive error boundaries
- **Network Issues**: Automatic retry with exponential backoff
- **Debugging**: Extensive console logging for troubleshooting

## Environment Configuration

### Development Modes
- **Local Web**: API routes may not work (uses mock responses)
- **Local Mobile**: Full tRPC backend functionality
- **Rork Platform**: Production API with real data
- **Deployed**: Full production environment

### Environment Variables
```bash
# Optional: Override API base URL
EXPO_PUBLIC_RORK_API_BASE_URL=https://your-api.com

# Development server URL (auto-detected)
EXPO_PUBLIC_DEV_SERVER_URL=http://localhost:8081
```

## Debugging Guide

### Common Issues & Solutions

#### "tRPC fetch failed: 404"
- **Cause**: API routes not working in web development
- **Solution**: Already handled with mock responses
- **Check**: Browser console for "Received HTML instead of JSON" message

#### "Failed to execute 'json' on Response: body stream already read"
- **Cause**: Response body consumed multiple times
- **Solution**: Response cloning implemented
- **Prevention**: Always clone responses before reading

#### "Network request failed"
- **Cause**: Development server connection issues
- **Solution**: Check if Metro bundler is running
- **Fallback**: Mock responses will be used automatically

### Debugging Tools
- **React Query DevTools**: Monitor API state
- **tRPC Panel**: Interactive API testing (when backend running)
- **Expo DevTools**: Performance and bundle analysis
- **Browser DevTools**: Network tab for API calls

## Performance Optimizations

### Implemented Optimizations
- **Query Caching**: 5-minute stale time for API calls
- **Automatic Retries**: Exponential backoff for failed requests
- **Response Cloning**: Prevents stream consumption errors
- **Mock Responses**: Fast development without backend dependency

### Performance Monitoring
- Monitor React Query cache hit rates
- Check bundle size with Expo DevTools
- Profile component re-renders in development

## Deployment

### Rork Platform Deployment
- Push to GitHub automatically triggers deployment
- Environment variables configured in Rork dashboard
- API routes work correctly in production

### Manual Deployment Options
```bash
# Build for production
eas build --platform all

# Deploy to Rork hosting
eas hosting:deploy

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## AI Integration

### Outfit Generation API
- **Endpoint**: `outfit.generate`
- **Provider**: Rork Toolkit API
- **Input**: User image (base64) + text prompt
- **Output**: Generated outfit image + metadata
- **Rate Limiting**: Handled automatically

### API Integration Pattern
```typescript
const generateOutfit = trpc.outfit.generate.useMutation({
  onSuccess: (data) => {
    // Handle successful generation
    console.log('Generated outfit:', data);
  },
  onError: (error) => {
    // Handle API errors gracefully
    console.error('Generation failed:', error.message);
  }
});

// Usage
generateOutfit.mutate({
  prompt: "casual summer outfit",
  userImageBase64: "data:image/jpeg;base64,...",
  outfitId: "unique-id"
});
```

## Contributing Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Expo configuration
- **Formatting**: Use built-in Expo formatting
- **Naming**: camelCase for variables, PascalCase for components

### Commit Conventions
- Use descriptive commit messages
- Include "🤖 Generated with Claude Code" footer
- Test thoroughly before pushing to main branch

### Testing Strategy
- **Manual Testing**: Use `/backend-test` screen
- **API Testing**: Verify all tRPC routes work
- **Cross-Platform**: Test on web, iOS, and Android
- **Error Scenarios**: Test network failures and edge cases

## Troubleshooting

### Getting Help
- Check `/backend-test` screen for diagnostic information
- Review browser console for detailed error logs
- Verify Metro bundler is running on correct port
- Ensure dependencies are installed with `bun install`

### Emergency Debugging
```bash
# Clear all caches and restart
bunx expo start --clear

# Restart Metro bundler
bunx expo r -c

# Check if API endpoints are accessible
curl http://localhost:8081/api/debug
```

## Security Considerations

### API Security
- Input validation with Zod schemas
- Rate limiting implemented by Rork platform
- No sensitive data logged in production
- Environment variables for configuration

### Data Handling
- User images handled securely
- No persistent storage of sensitive data
- API keys managed through environment variables

---

## Quick Reference

**Start Development**: `bun run start-web`
**Test APIs**: Navigate to `/backend-test`
**Debug Issues**: Check browser console
**Deploy**: Push to GitHub (auto-deployment)
**Add API Route**: `backend/trpc/routes/ → app-router.ts → frontend`

This project is optimized for rapid development with Claude Code assistance. All common patterns and debugging strategies are documented above for maximum productivity.