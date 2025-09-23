import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

interface ImageEditRequest {
  prompt: string;
  images: { type: 'image'; image: string }[];
}

interface ImageEditResponse {
  image: { base64Data: string; mimeType: string };
}

export const generateOutfitProcedure = publicProcedure
  .input(
    z.object({
      prompt: z.string().min(1).max(500),
      userImageBase64: z.string().min(1),
      outfitId: z.string().optional(),
    })
  )
  .mutation(async ({ input }: { input: { prompt: string; userImageBase64: string; outfitId?: string } }) => {
    const { prompt, userImageBase64, outfitId } = input;

    try {
      console.log(`Generating outfit with prompt: ${prompt}`);
      
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Change the person's outfit to: ${prompt.trim()}. Keep the person's face, body shape, and pose exactly the same. Only change the clothing. Full body shot with space around feet and head. High-end fashion photography, studio lighting, professional model pose.`,
          images: [{ type: 'image', image: userImageBase64 }],
        } as ImageEditRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate outfit image: ${response.status}`);
      }

      const data: ImageEditResponse = await response.json();
      const imageData = data.image;
      
      // Create data URL for the generated image
      const imageUrl = `data:${imageData.mimeType};base64,${imageData.base64Data}`;
      
      // Generate mock outfit items
      const mockItems = [
        { id: '1', name: 'Classic White T-Shirt', brand: 'Uniqlo', price: '$19.90', category: 'tops' },
        { id: '2', name: 'Slim Fit Jeans', brand: 'Levi\'s', price: '$89.50', category: 'bottoms' },
        { id: '3', name: 'White Sneakers', brand: 'Adidas', price: '$120.00', category: 'shoes' },
        { id: '4', name: 'Leather Jacket', brand: 'Zara', price: '$199.00', category: 'outerwear' },
        { id: '5', name: 'Denim Jacket', brand: 'Gap', price: '$79.95', category: 'outerwear' },
        { id: '6', name: 'Black Dress', brand: 'H&M', price: '$49.99', category: 'dresses' },
      ];
      
      const items = mockItems.slice(0, Math.floor(Math.random() * 3) + 2);
      
      const result = {
        id: Date.now().toString(),
        imageUrl,
        prompt,
        outfitId: outfitId || `outfit_${Date.now()}`,
        items,
        metadata: {
          style: 'casual',
          occasion: 'everyday',
          season: 'all',
          colors: ['black', 'white'],
        },
        timestamp: Date.now(),
      };
      
      console.log(`Successfully generated outfit: ${result.id}`);
      return result;
    } catch (error) {
      console.error('Failed to generate outfit:', error);
      throw new Error('Failed to generate outfit image');
    }
  });