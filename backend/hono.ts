import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

console.log('Hono backend initializing...');

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Add request logging middleware
app.use('*', async (c, next) => {
  console.log(`[HONO] ${c.req.method} ${c.req.url}`);
  console.log(`[HONO] Headers:`, Object.fromEntries(c.req.raw.headers.entries()));
  await next();
});

// Simple health check endpoint
app.get("/", (c) => {
  console.log('Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running", timestamp: Date.now() });
});

// Mount tRPC router - this will handle all tRPC requests
console.log('[HONO] Mounting tRPC server at /trpc/*');
console.log('[HONO] AppRouter type:', typeof appRouter);
console.log('[HONO] AppRouter _def:', !!appRouter._def);
console.log('[HONO] AppRouter procedures:', Object.keys(appRouter._def?.procedures || {}));

try {
  const trpcMiddleware = trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`[HONO] tRPC Error on ${path}:`, error);
    },
  });

  console.log('[HONO] tRPC middleware created successfully');

  app.use("/trpc/*", trpcMiddleware);

  console.log('[HONO] tRPC middleware mounted successfully');
} catch (error) {
  console.error('[HONO] Failed to mount tRPC middleware:', error);
}

// Add a test endpoint to verify the server is working
app.get("/test", (c) => {
  console.log('Test endpoint hit');
  return c.json({ message: "Backend server is working!", timestamp: Date.now() });
});

// Add a debug endpoint to show all routes
app.get("/debug", (c) => {
  return c.json({
    message: "Debug info",
    routes: [
      'GET /',
      'GET /test',
      'GET /debug',
      'ALL /trpc/*'
    ],
    appRouter: {
      example: { hi: 'available' },
      outfit: { generate: 'available' },
      feed: { save: 'available', list: 'available', clear: 'available' }
    },
    timestamp: Date.now()
  });
});

// Test tRPC routes directly
app.get("/test-trpc", async (c) => {
  try {
    // Simple test to verify tRPC is working
    console.log('Testing tRPC routes...');
    return c.json({
      message: "tRPC test endpoint",
      availableRoutes: [
        'POST /api/trpc/example.hi',
        'POST /api/trpc/outfit.generate',
        'POST /api/trpc/feed.save',
        'GET /api/trpc/feed.list',
        'POST /api/trpc/feed.clear'
      ],
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('tRPC test failed:', error);
    return c.json({ error: 'tRPC test failed', details: error }, 500);
  }
});

console.log('Hono backend initialized successfully');

export default app;