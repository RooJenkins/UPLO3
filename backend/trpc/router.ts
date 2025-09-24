import { createTRPCRouter } from './context';
import { exampleProcedures } from './procedures/example';
import { outfitProcedures } from './procedures/outfit';
import { feedProcedures } from './procedures/feed';

export const appRouter = createTRPCRouter({
  example: createTRPCRouter(exampleProcedures),
  outfit: createTRPCRouter(outfitProcedures),
  feed: createTRPCRouter(feedProcedures),
});

export type AppRouter = typeof appRouter;
