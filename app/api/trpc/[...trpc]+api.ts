import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/backend/trpc/app-router';
import { createContext } from '@/backend/trpc/create-context';

console.log('tRPC API route loaded');

const handler = (request: Request) => {
  console.log('tRPC request:', request.method, request.url);
  
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`tRPC Error on ${path}:`, error);
    },
  });
};

// Export the handler for all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;

export default handler;