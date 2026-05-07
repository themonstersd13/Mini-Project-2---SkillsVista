import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  displayName: z.string().min(2).max(60),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
});
