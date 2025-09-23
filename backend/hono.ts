import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

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
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

// Simple health check endpoint
app.get("/", (c) => {
  console.log('Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running", timestamp: Date.now() });
});

// Mount tRPC router - this will handle all tRPC requests
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`tRPC Error on ${path}:`, error);
    },
  })
);

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
    timestamp: Date.now() 
  });
});

export default app;