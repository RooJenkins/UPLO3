import { z } from "zod";
import { publicProcedure } from "../../../create-context";

export const hiProcedure = publicProcedure
  .input(z.object({ name: z.string() }))
  .query(({ input }) => {
    return {
      hello: input.name,
      date: new Date(),
    };
  });