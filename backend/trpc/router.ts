import { createTRPCRouter } from './context';
import { exampleProcedures } from './procedures/example';
import { outfitProcedures } from './procedures/outfit';
import { feedProcedures } from './procedures/feed';
import { catalogProcedures } from './procedures/catalog';

export const appRouter = createTRPCRouter({
  example: createTRPCRouter(exampleProcedures),
  outfit: createTRPCRouter(outfitProcedures),
  feed: createTRPCRouter(feedProcedures),
  catalog: createTRPCRouter(catalogProcedures),
});

export type AppRouter = typeof appRouter;
