import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc/router';
import { createTRPCContext } from './trpc/context';

console.log('[BACKEND] Initializing backend server...');
console.log('[BACKEND] AppRouter type:', typeof appRouter);

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Add request logging
app.use('*', async (c, next) => {
  console.log(`[BACKEND] ${c.req.method} ${c.req.url}`);
  await next();
});

// Simple health check (mounted at /api/ by Expo route)
app.get('/', (c) => {
  console.log('[BACKEND] Health check endpoint hit');
  return c.json({ 
    status: 'ok', 
    message: 'UPLO3 API Server',
    timestamp: new Date().toISOString()
  });
});

// Mount tRPC (Expo will mount this under /api/trpc/*)
console.log('[BACKEND] Mounting tRPC at /trpc/* (will be available at /api/trpc/*)');
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: createTRPCContext,
  onError: ({ error, path }) => {
    console.error(`[BACKEND] tRPC Error on ${path}:`, error);
  },
}));

console.log('[BACKEND] Server setup complete');

export default app;
