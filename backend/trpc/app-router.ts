import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { generateOutfitProcedure } from "./routes/outfit/generate/route";
import { 
  saveFeedEntryProcedure, 
  getFeedEntriesProcedure, 
  clearFeedCacheProcedure 
} from "./routes/feed/cache/route";

console.log('tRPC app-router loading...');
console.log('Procedures loaded:', {
  hiProcedure: !!hiProcedure,
  generateOutfitProcedure: !!generateOutfitProcedure,
  saveFeedEntryProcedure: !!saveFeedEntryProcedure,
  getFeedEntriesProcedure: !!getFeedEntriesProcedure,
  clearFeedCacheProcedure: !!clearFeedCacheProcedure,
});

// Test individual procedures
if (hiProcedure) {
  console.log('hiProcedure type:', typeof hiProcedure);
  console.log('hiProcedure._def:', !!hiProcedure._def);
}
if (generateOutfitProcedure) {
  console.log('generateOutfitProcedure type:', typeof generateOutfitProcedure);
  console.log('generateOutfitProcedure._def:', !!generateOutfitProcedure._def);
}

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

console.log('appRouter created:', !!appRouter);
console.log('appRouter._def:', !!appRouter._def);
console.log('appRouter._def.procedures:', Object.keys(appRouter._def?.procedures || {}));

export type AppRouter = typeof appRouter;

console.log('tRPC app-router loaded successfully');