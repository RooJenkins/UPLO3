import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const hiProcedure = publicProcedure
  .input(z.object({ name: z.string().optional() }).optional())
  .query(({ input }: { input?: { name?: string } }) => {
    return {
      hello: input?.name || 'World',
      date: new Date(),
      message: 'tRPC backend is working!',
    };
  });