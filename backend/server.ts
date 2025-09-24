import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc/router';
import { createTRPCContext } from './trpc/context';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Simple health check
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'UPLO3 API Server',
    timestamp: new Date().toISOString()
  });
});

// Mount tRPC
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: createTRPCContext,
}));

export default app;
