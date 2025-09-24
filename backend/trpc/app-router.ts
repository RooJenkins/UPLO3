import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { generateOutfitProcedure } from "./routes/outfit/generate/route";
import { 
  saveFeedEntryProcedure, 
  getFeedEntriesProcedure, 
  clearFeedCacheProcedure 
} from "./routes/feed/cache/route";

console.log('tRPC app-router loading...');

// Verify all procedures are properly imported
console.log('Imported procedures:', {
  hiProcedure: typeof hiProcedure,
  generateOutfitProcedure: typeof generateOutfitProcedure,
  saveFeedEntryProcedure: typeof saveFeedEntryProcedure,
  getFeedEntriesProcedure: typeof getFeedEntriesProcedure,
  clearFeedCacheProcedure: typeof clearFeedCacheProcedure,
});

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
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

console.log('tRPC app-router loaded successfully');
console.log('App router structure:', {
  example: { hi: 'available' },
  outfit: { generate: 'available' },
  feed: { save: 'available', list: 'available', clear: 'available' },
});