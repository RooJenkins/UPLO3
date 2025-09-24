import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';

console.log('[BACKEND] Starting server initialization...');

// Initialize Hono app with enhanced error handling
const app = new Hono();

// Global error handler
app.onError((error, c) => {
  console.error('[BACKEND] Global error:', error);
  return c.json({
    error: 'Internal Server Error',
    message: error.message || 'An unknown error occurred',
    timestamp: new Date().toISOString(),
    backend: 'hono'
  }, 500);
});

// CORS middleware with comprehensive settings
app.use('*', cors({
  origin: '*', // Allow all origins in development
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false, // Set to false when using origin: '*'
}));

// Enhanced request logging with error catching
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`[BACKEND] → ${c.req.method} ${c.req.url}`);

  try {
    await next();
    const duration = Date.now() - start;
    console.log(`[BACKEND] ← ${c.req.method} ${c.req.url} [${c.res.status}] ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[BACKEND] ✕ ${c.req.method} ${c.req.url} [ERROR] ${duration}ms:`, error);
    throw error;
  }
});

// Enhanced health check endpoint
app.get('/', (c) => {
  console.log('[BACKEND] Health check endpoint accessed');
  return c.json({
    status: 'healthy',
    message: 'UPLO3 Backend API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    backend: 'hono'
  });
});

// Debug endpoint for server status
app.get('/debug', (c) => {
  console.log('[BACKEND] Debug endpoint accessed');
  return c.json({
    status: 'debug',
    server: 'hono',
    backend: 'uplo3',
    routes: ['/', '/debug', '/plain', '/trpc/*'],
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: process.memoryUsage()
  });
});

// Plain-text endpoint for routing verification
app.get('/plain', (c) => {
  console.log('[BACKEND] Plain text endpoint accessed');
  return c.text('UPLO3_BACKEND_OK', 200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
});

// Import and mount tRPC with synchronous require (for Expo compatibility)
try {
  console.log('[BACKEND] Loading tRPC components...');

  // Use require instead of import for better Expo compatibility
  const routerModule = require('./trpc/router');
  const contextModule = require('./trpc/context');

  const appRouter = routerModule.appRouter;
  const createTRPCContext = contextModule.createTRPCContext;

  if (!appRouter) {
    throw new Error('appRouter is undefined - check router export');
  }
  if (!createTRPCContext) {
    throw new Error('createTRPCContext is undefined - check context export');
  }

  console.log('[BACKEND] tRPC components loaded successfully');
  console.log('[BACKEND] AppRouter type:', typeof appRouter);
  console.log('[BACKEND] AppRouter routes:', Object.keys(appRouter._def?.record || {}));
  console.log('[BACKEND] CreateContext type:', typeof createTRPCContext);
  console.log('[BACKEND] Mounting tRPC at /trpc/* → /api/trpc/*');

  app.use('/trpc/*', trpcServer({
    router: appRouter,
    createContext: createTRPCContext,
    onError: ({ error, path, type, input }) => {
      console.error(`[BACKEND] tRPC ${type} error on path "${path}":`, error);
      console.error('[BACKEND] Input:', input);
      console.error('[BACKEND] Error stack:', error.stack);
      if (error.cause) console.error('[BACKEND] Error cause:', error.cause);
    },
  }));

  console.log('[BACKEND] tRPC server mounted successfully');

} catch (error) {
  console.error('[BACKEND] Failed to load tRPC components:', error);
  console.error('[BACKEND] Error name:', error?.name);
  console.error('[BACKEND] Error message:', error?.message);
  console.error('[BACKEND] Error stack:', error?.stack);

  console.warn('[BACKEND] Setting up fallback tRPC handler');

  // Add fallback tRPC endpoint with detailed error info
  app.use('/trpc/*', (c) => {
    console.error('[BACKEND] tRPC fallback handler activated');
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    } : String(error);

    return c.json({
      error: 'tRPC Loading Failed',
      message: 'tRPC components could not be loaded properly',
      details: errorDetails,
      timestamp: new Date().toISOString(),
      fallback: true,
      backend: 'hono',
      suggestion: 'Check backend/trpc/ files for compilation errors',
      path: c.req.path,
      method: c.req.method
    }, 500);
  });
}

console.log('[BACKEND] Server initialization complete - ready to handle requests');

export default app;

// Export for testing
export { app as __honoAppForTests };
