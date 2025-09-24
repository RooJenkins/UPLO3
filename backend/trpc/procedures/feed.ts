import { z } from 'zod';
import { publicProcedure } from '../context';

// Simple in-memory store for demo
const feedStore: any[] = [];

export const feedProcedures = {
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(({ input }) => {
      return feedStore.slice(0, input.limit);
    }),

  save: publicProcedure
    .input(z.object({
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
    }))
    .mutation(({ input }) => {
      // Add to store (keep only last 50)
      feedStore.unshift(input);
      if (feedStore.length > 50) {
        feedStore.length = 50;
      }
      
      return { success: true, id: input.id };
    }),

  clear: publicProcedure
    .mutation(() => {
      feedStore.length = 0;
      return { success: true };
    }),
};
