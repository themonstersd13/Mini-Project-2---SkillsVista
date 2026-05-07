import { z } from "zod";

const listItemSchema = z.string().trim().min(2).max(120);

function normalizeListValue(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

const listSchema = z.preprocess(normalizeListValue, z.array(listItemSchema).min(1).max(12));

export const onboardingSchema = z.object({
  academicBackground: z.string().min(3).max(400),
  goalsSummary: z.string().min(3).max(800),
  interests: listSchema,
  habits: listSchema,
  challenges: listSchema,
});

export const goalCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(400).optional(),
  dueDate: z.string().datetime().optional(),
});
