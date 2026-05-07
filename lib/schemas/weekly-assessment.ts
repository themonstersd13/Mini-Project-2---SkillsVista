import { z } from "zod";

export const weeklyAssessmentAnswerSchema = z.object({
  questionKey: z.string().min(1),
  answerScore: z.number().min(1).max(4).optional(),
  answerText: z.string().optional(),
});

export const submitWeeklyAssessmentSchema = z.object({
  answers: z.array(weeklyAssessmentAnswerSchema).min(1),
});
