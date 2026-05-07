import { z } from "zod";
import { academicStages } from "@/lib/assessment/question-bank";

export const assessmentAnswerSchema = z.object({
  questionKey: z.string().min(1),
  answerScore: z.number().min(1).max(4).optional(),
  answerText: z.string().optional(),
});

export const submitAssessmentSchema = z.object({
  academicStage: z.enum(academicStages),
  answers: z.array(assessmentAnswerSchema).min(1),
});
