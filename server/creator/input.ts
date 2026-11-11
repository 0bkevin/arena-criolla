import { z } from "zod";

export const CharacterInputSchema = z.object({
  name: z.string().trim().min(2).max(24),
  description: z.string().trim().min(10).max(240),
  style: z.enum(["agile", "technical", "power"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
