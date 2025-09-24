import { initTRPC } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';

// Simple context - no auth for now
export const createTRPCContext = (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Export reusable router and procedure builders
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
