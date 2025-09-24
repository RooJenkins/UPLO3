import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { generateOutfitProcedure } from "./routes/outfit/generate/route";
import { 
  saveFeedEntryProcedure, 
  getFeedEntriesProcedure, 
  clearFeedCacheProcedure 
} from "./routes/feed/cache/route";

console.log('[APP-ROUTER] tRPC app-router loading...');

// Verify all procedures are properly imported
console.log('[APP-ROUTER] Imported procedures:', {
  hiProcedure: typeof hiProcedure,
  generateOutfitProcedure: typeof generateOutfitProcedure,
  saveFeedEntryProcedure: typeof saveFeedEntryProcedure,
  getFeedEntriesProcedure: typeof getFeedEntriesProcedure,
  clearFeedCacheProcedure: typeof clearFeedCacheProcedure,
});

// Validate procedures have the right structure
if (hiProcedure?._def) {
  console.log('[APP-ROUTER] hiProcedure._def.type:', hiProcedure._def.type);
}
if (generateOutfitProcedure?._def) {
  console.log('[APP-ROUTER] generateOutfitProcedure._def.type:', generateOutfitProcedure._def.type);
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

console.log('[APP-ROUTER] appRouter created:', !!appRouter);
console.log('[APP-ROUTER] appRouter._def:', !!appRouter._def);
console.log('[APP-ROUTER] appRouter._def.procedures:', Object.keys(appRouter._def?.procedures || {}));

// Test the router structure
try {
  const exampleRouter = appRouter.example;
  console.log('[APP-ROUTER] example router:', !!exampleRouter);
  console.log('[APP-ROUTER] example router procedures:', Object.keys(exampleRouter._def?.procedures || {}));
  
  const outfitRouter = appRouter.outfit;
  console.log('[APP-ROUTER] outfit router:', !!outfitRouter);
  console.log('[APP-ROUTER] outfit router procedures:', Object.keys(outfitRouter._def?.procedures || {}));
  
  const feedRouter = appRouter.feed;
  console.log('[APP-ROUTER] feed router:', !!feedRouter);
  console.log('[APP-ROUTER] feed router procedures:', Object.keys(feedRouter._def?.procedures || {}));
} catch (error) {
  console.error('[APP-ROUTER] Error inspecting router structure:', error);
}

export type AppRouter = typeof appRouter;

console.log('[APP-ROUTER] tRPC app-router loaded successfully');