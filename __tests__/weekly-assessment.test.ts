import { describe, expect, it } from "vitest";
import {
  buildWeeklyQuestionnaire,
  evaluateWeeklyAssessment,
} from "@/lib/assessment/weekly";

describe("buildWeeklyQuestionnaire", () => {
  it("creates standard questions plus SWOT-personalized questions", () => {
    const questionnaire = buildWeeklyQuestionnaire([
      {
        id: "w1",
        title: "Time management friction",
        category: "WEAKNESS",
        description: "Routine breaks under pressure.",
        confidence: 0.82,
        status: "ACTIVE",
      },
      {
        id: "t1",
        title: "Burnout risk",
        category: "THREAT",
        description: "Stress rises near deadlines.",
        confidence: 0.79,
        status: "ACTIVE",
      },
      {
        id: "s1",
        title: "Communication confidence",
        category: "STRENGTH",
        description: "Explains ideas calmly.",
        confidence: 0.77,
        status: "ACTIVE",
      },
      {
        id: "o1",
        title: "Mentor network",
        category: "OPPORTUNITY",
        description: "Helpful seniors are available.",
        confidence: 0.7,
        status: "ACTIVE",
      },
    ]);

    expect(questionnaire.standardQuestions.length).toBeGreaterThanOrEqual(8);
    expect(questionnaire.swotQuestions.length).toBe(8);
    expect(questionnaire.allQuestions.some((question) => question.key === "swot-w1-impact")).toBe(true);
  });
});

describe("evaluateWeeklyAssessment", () => {
  it("scores the week and produces both generic signals and linked SWOT updates", () => {
    const questionnaire = buildWeeklyQuestionnaire([
      {
        id: "w1",
        title: "Time management friction",
        category: "WEAKNESS",
        description: "Routine breaks under pressure.",
        confidence: 0.82,
        status: "ACTIVE",
      },
      {
        id: "s1",
        title: "Communication confidence",
        category: "STRENGTH",
        description: "Explains ideas calmly.",
        confidence: 0.77,
        status: "ACTIVE",
      },
    ]);

    const result = evaluateWeeklyAssessment(
      questionnaire,
      [
        { questionKey: "weekly-discipline", answerScore: 4 },
        { questionKey: "weekly-confidence", answerScore: 4 },
        { questionKey: "weekly-support", answerScore: 3 },
        { questionKey: "weekly-overwhelm", answerScore: 1 },
        { questionKey: "weekly-avoidance", answerScore: 1 },
        {
          questionKey: "weekly-win",
          answerText: "I handled a tense team conversation calmly and spoke more clearly than before.",
        },
        {
          questionKey: "weekly-blocker",
          answerText: "I still hesitated before starting one difficult task, but I did not let it control the full week.",
        },
        {
          questionKey: "weekly-next-step",
          answerText: "A realistic weekly plan and one mentor check-in would help me keep the momentum stable.",
        },
        { questionKey: "swot-w1-impact", answerScore: 2 },
        {
          questionKey: "swot-w1-trigger",
          answerText: "The weakness appeared briefly when my schedule changed suddenly.",
        },
        { questionKey: "swot-s1-usage", answerScore: 4 },
        {
          questionKey: "swot-s1-example",
          answerText: "I used this strength during a meeting where I explained my plan without panicking.",
        },
      ],
      {
        overallScore: 0.54,
        strengthsScore: 0.5,
        weaknessesScore: 0.62,
        opportunitiesScore: 0.46,
        threatsScore: 0.58,
        weekLabel: "previous",
      },
    );

    expect(result.metrics.overallScore).toBeGreaterThan(0.7);
    expect(result.genericSignals.some((signal) => signal.title === "Weekly self-discipline")).toBe(true);
    expect(result.linkedSwotUpdates.some((update) => update.swotItemId === "w1")).toBe(true);
    expect(result.linkedSwotUpdates.some((update) => update.swotItemId === "s1")).toBe(true);
    expect(result.summary).toContain("Compared with last week");
  });
});
