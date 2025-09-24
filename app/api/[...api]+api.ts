import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from '@/backend/trpc/app-router';
import { createContext } from '@/backend/trpc/create-context';

console.log('[API-ROUTE] Creating Hono app directly in API route...');

// Create the Hono app directly here to avoid import issues
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Add request logging middleware
app.use('*', async (c, next) => {
  console.log(`[API-ROUTE] ${c.req.method} ${c.req.url}`);
  await next();
});

// Simple health check endpoint
app.get("/", (c) => {
  console.log('[API-ROUTE] Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running", timestamp: Date.now() });
});

// Mount tRPC router - this will handle all tRPC requests
try {
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext,
      onError: ({ error, path }) => {
        console.error(`[API-ROUTE] tRPC Error on ${path}:`, error);
      },
    })
  );
  console.log('[API-ROUTE] tRPC middleware mounted successfully at /trpc/*');
} catch (error) {
  console.error('[API-ROUTE] Failed to mount tRPC middleware:', error);
}

// Add a test endpoint to verify the server is working
app.get("/test", (c) => {
  console.log('[API-ROUTE] Test endpoint hit');
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

console.log('[API-ROUTE] Hono app initialized successfully');

// Export the Hono app as the default export for Expo API routes
export default app;

// Handle all HTTP methods by creating proper Request objects
export async function GET(request: Request) {
  console.log('[API-ROUTE] GET request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] GET response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request) {
  console.log('[API-ROUTE] POST request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] POST response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT(request: Request) {
  console.log('[API-ROUTE] PUT request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] PUT response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] PUT error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request: Request) {
  console.log('[API-ROUTE] DELETE request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] DELETE response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] DELETE error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(request: Request) {
  console.log('[API-ROUTE] PATCH request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] PATCH response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] PATCH error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS(request: Request) {
  console.log('[API-ROUTE] OPTIONS request:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] OPTIONS response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] OPTIONS error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}