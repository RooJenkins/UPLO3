import { z } from 'zod';
import { publicProcedure } from '../context';

export const outfitProcedures = {
  generate: publicProcedure
    .input(z.object({
      prompt: z.string().min(1),
      userImageBase64: z.string().min(1),
      outfitId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // For now, return mock data - we can implement AI later
      return {
        id: Date.now().toString(),
        imageUrl: `https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=${encodeURIComponent(input.prompt)}`,
        prompt: input.prompt,
        outfitId: input.outfitId || `outfit_${Date.now()}`,
        items: [
          { id: '1', name: 'Generated T-Shirt', brand: 'AI Fashion', price: '$29.99', category: 'tops' },
          { id: '2', name: 'Generated Pants', brand: 'AI Fashion', price: '$59.99', category: 'bottoms' },
        ],
        metadata: {
          style: 'generated',
          occasion: 'ai-created',
          season: 'all',
          colors: ['generated'],
        },
        timestamp: Date.now(),
      };
    }),
};
