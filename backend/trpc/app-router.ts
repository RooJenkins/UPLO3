import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { generateOutfitProcedure } from "./routes/outfit/generate/route";
import { 
  saveFeedEntryProcedure, 
  getFeedEntriesProcedure, 
  clearFeedCacheProcedure 
} from "./routes/feed/cache/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  outfit: createTRPCRouter({
    generate: generateOutfitProcedure,
  }),
  feed: createTRPCRouter({
    save: saveFeedEntryProcedure,
    list: getFeedEntriesProcedure,
    clear: clearFeedCacheProcedure,
  }),
});

export type AppRouter = typeof appRouter;