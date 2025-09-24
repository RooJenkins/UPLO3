import { z } from 'zod';
import { publicProcedure } from '../context';

export const exampleProcedures = {
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name ?? 'World'}!`,
        timestamp: new Date().toISOString(),
        status: 'success'
      };
    }),

  test: publicProcedure
    .query(() => {
      return {
        message: 'tRPC is working!',
        timestamp: new Date().toISOString(),
        server: 'hono'
      };
    }),
};
