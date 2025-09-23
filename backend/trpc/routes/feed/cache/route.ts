import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

// In-memory cache for feed entries (in production, use Redis or database)
const feedCache = new Map<string, any>();
const MAX_CACHE_SIZE = 100;

export const saveFeedEntryProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      prompt: z.string(),
      outfitId: z.string(),
      items: z.array(z.object({
        id: z.string(),
        name: z.string(),
        brand: z.string(),
        price: z.string(),
        category: z.string(),
        buyUrl: z.string().optional(),
      })),
      metadata: z.object({
        style: z.string(),
        occasion: z.string(),
        season: z.string(),
        colors: z.array(z.string()),
      }),
      timestamp: z.number(),
    })
  )
  .mutation(async ({ input }: { input: any }) => {
    try {
      // Clean up cache if it gets too large
      if (feedCache.size >= MAX_CACHE_SIZE) {
        const entries = Array.from(feedCache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        // Keep only the newest 50 entries
        feedCache.clear();
        entries.slice(0, 50).forEach(([key, value]) => {
          feedCache.set(key, value);
        });
      }
      
      feedCache.set(input.id, input);
      console.log(`Saved feed entry: ${input.id}`);
      
      return { success: true, id: input.id };
    } catch (error) {
      console.error('Failed to save feed entry:', error);
      throw new Error('Failed to save feed entry');
    }
  });

export const getFeedEntriesProcedure = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(15),
      outfitId: z.string().optional(),
    })
  )
  .query(async ({ input }: { input: { limit: number; outfitId?: string } }) => {
    try {
      let entries = Array.from(feedCache.values());
      
      // Filter by outfitId if provided
      if (input.outfitId) {
        entries = entries.filter(entry => entry.outfitId === input.outfitId);
      }
      
      // Sort by timestamp (newest first) and limit
      entries.sort((a, b) => b.timestamp - a.timestamp);
      entries = entries.slice(0, input.limit);
      
      console.log(`Retrieved ${entries.length} feed entries`);
      return entries;
    } catch (error) {
      console.error('Failed to get feed entries:', error);
      throw new Error('Failed to get feed entries');
    }
  });

export const clearFeedCacheProcedure = publicProcedure
  .mutation(async () => {
    try {
      feedCache.clear();
      console.log('Feed cache cleared');
      return { success: true };
    } catch (error) {
      console.error('Failed to clear feed cache:', error);
      throw new Error('Failed to clear feed cache');
    }
  });