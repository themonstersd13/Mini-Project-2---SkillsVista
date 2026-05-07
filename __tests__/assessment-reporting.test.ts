import { describe, expect, it } from "vitest";
import {
  getAssessmentQuestionBank,
} from "@/lib/assessment/question-bank";
import {
  buildYearlyReport,
  evaluateAssessment,
} from "@/lib/assessment/reporting";

describe("assessment question bank", () => {
  it("provides MCQ and written questions for every academic stage", () => {
    const bank = getAssessmentQuestionBank();

    expect(bank).toHaveLength(4);
    for (const set of bank) {
      expect(set.questions.filter((question) => question.type === "MCQ").length).toBeGreaterThanOrEqual(5);
      expect(set.questions.filter((question) => question.type === "WRITTEN").length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("evaluateAssessment", () => {
  it("builds strong FY metrics and positive SWOT signals from structured answers", () => {
    const result = evaluateAssessment("FY", [
      { questionKey: "fy-routine", answerScore: 4 },
      { questionKey: "fy-communication", answerScore: 3 },
      { questionKey: "fy-opportunity-seeking", answerScore: 4 },
      { questionKey: "fy-stress-adjustment", answerScore: 1 },
      { questionKey: "fy-time-management", answerScore: 2 },
      {
        questionKey: "fy-proud-moment",
        answerText: "I became much more confident in introducing myself and asking doubts in class.",
      },
      {
        questionKey: "fy-main-challenge",
        answerText: "Adjustment stress was high in the first months, but I now recover faster and reach out sooner.",
      },
      {
        questionKey: "fy-opportunity-next",
        answerText: "I want to use clubs and peer groups better so that I stop staying isolated.",
      },
    ]);

    expect(result.metrics.strengthsScore).toBeGreaterThan(0.7);
    expect(result.metrics.opportunitiesScore).toBeGreaterThan(0.9);
    expect(result.metrics.threatsScore).toBeLessThan(0.2);
    expect(result.metrics.overallScore).toBeGreaterThan(0.7);
    expect(result.signalUpdates.some((signal) => signal.title === "Consistent discipline")).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("attaches written reflections to risk signals when risk answers are high", () => {
    const result = evaluateAssessment("FY", [
      { questionKey: "fy-routine", answerScore: 1 },
      { questionKey: "fy-communication", answerScore: 1 },
      { questionKey: "fy-opportunity-seeking", answerScore: 1 },
      { questionKey: "fy-stress-adjustment", answerScore: 4 },
      { questionKey: "fy-time-management", answerScore: 4 },
      {
        questionKey: "fy-proud-moment",
        answerText: "I am still trying to become more open and less afraid to participate.",
      },
      {
        questionKey: "fy-main-challenge",
        answerText: "Homesickness and uncertainty made me withdraw from others and delay important tasks.",
      },
      {
        questionKey: "fy-opportunity-next",
        answerText: "I need to connect with mentors and healthier friend groups instead of isolating myself.",
      },
    ]);

    expect(result.metrics.weaknessesScore).toBeGreaterThan(0.8);
    expect(result.metrics.threatsScore).toBeGreaterThan(0.8);

    const adjustmentRisk = result.signalUpdates.find((signal) => signal.title === "Adjustment stress risk");
    expect(adjustmentRisk?.evidenceExcerpt).toContain("Reflection:");
    expect(result.narrative).toContain("structured baseline");
  });
});

describe("buildYearlyReport", () => {
  it("summarizes progress from the first available year to the latest year", () => {
    const report = buildYearlyReport([
      {
        stage: "FY",
        overallScore: 0.42,
        strengthsScore: 0.35,
        weaknessesScore: 0.72,
        opportunitiesScore: 0.4,
        threatsScore: 0.74,
        narrative: "First year baseline.",
        takenAt: "2026-01-10T00:00:00.000Z",
      },
      {
        stage: "TY",
        overallScore: 0.71,
        strengthsScore: 0.76,
        weaknessesScore: 0.42,
        opportunitiesScore: 0.73,
        threatsScore: 0.33,
        narrative: "Third year shows much stronger balance.",
        takenAt: "2026-03-10T00:00:00.000Z",
      },
    ]);

    expect(report.completedStages).toBe(2);
    expect(report.completionRatio).toBe(0.5);
    expect(report.evolutionSummary).toContain("First Year");
    expect(report.evolutionSummary).toContain("Third Year");
    expect(report.strongestImprovement).toContain("positive shift");
  });
});
