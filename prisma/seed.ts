import bcrypt from "bcryptjs";
import {
  AssessmentQuestionType,
  EvidenceType,
  SWOTStatus,
  type AcademicStage,
  type SWOTCategory,
} from "@prisma/client";
import { createPrismaClient } from "../lib/prisma-client";
import {
  type AcademicStageCode,
} from "../lib/assessment/question-bank";
import {
  evaluateAssessment,
  type AssessmentAnswerInput,
  type AssessmentSnapshot,
} from "../lib/assessment/reporting";

const prisma = createPrismaClient();

type StageSeed = {
  stage: AcademicStageCode;
  takenAt: Date;
  answers: AssessmentAnswerInput[];
};

type DemoUserSeed = {
  email: string;
  password: string;
  displayName: string;
  profile: {
    academicBackground: string;
    goalsSummary: string;
    interests: string[];
    habits: string[];
    challenges: string[];
    currentStreak: number;
    longestStreak: number;
  };
  goals: Array<{
    title: string;
    description: string;
    progress: number;
    milestones?: Array<{ label: string; done: boolean }>;
    tasks: Array<{
      title: string;
      status: "TODO" | "IN_PROGRESS" | "DONE" | "MISSED";
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueInDays?: number;
      completedDaysAgo?: number;
    }>;
  }>;
  sessions: Array<{
    startedAt: Date;
    summary: string;
    messages: Array<{
      role: "USER" | "ASSISTANT";
      content: string;
      moodScore?: number;
      isCheckIn?: boolean;
      patternSignalScore?: number;
      createdAt: Date;
    }>;
    keyInsights: string[];
    topics: string[];
  }>;
  followUps: Array<{
    question: string;
    context: string;
    status: "PENDING" | "ASKED" | "ANSWERED" | "EXPIRED";
    askedDaysAgo?: number;
    answer?: string;
  }>;
  assessments: StageSeed[];
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function stageAnswers(
  entries: Array<[string, number | string]>,
): AssessmentAnswerInput[] {
  return entries.map(([questionKey, value]) =>
    typeof value === "number"
      ? { questionKey, answerScore: value }
      : { questionKey, answerText: value },
  );
}

async function resetDemoUser(email: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!existing) {
    return;
  }

  const userId = existing.id;

  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.contextEmbedding.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.conversationSummary.deleteMany({ where: { userId } });
  await prisma.chatMessage.deleteMany({ where: { userId } });
  await prisma.followUp.deleteMany({ where: { userId } });
  await prisma.signal.deleteMany({ where: { userId } });
  await prisma.evidence.deleteMany({ where: { userId } });
  await prisma.swotAssessment.deleteMany({ where: { userId } });
  await prisma.swotItem.deleteMany({ where: { userId } });
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.goal.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.skill.deleteMany({ where: { userId } });
  await prisma.habit.deleteMany({ where: { userId } });
  await prisma.checkIn.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function upsertAssessmentSignal(
  userId: string,
  stage: AcademicStageCode,
  signal: {
    category: SWOTCategory;
    title: string;
    description: string;
    confidence: number;
    evidenceExcerpt: string;
  },
) {
  const existing = await prisma.swotItem.findFirst({
    where: {
      userId,
      category: signal.category,
      title: signal.title,
    },
  });

  const status =
    signal.confidence >= 0.68 ? SWOTStatus.ACTIVE : SWOTStatus.UNCERTAIN;

  if (!existing) {
    const created = await prisma.swotItem.create({
      data: {
        userId,
        category: signal.category,
        title: signal.title,
        description: signal.description,
        confidence: signal.confidence,
        status,
        signalCount: 1,
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.evidence.create({
      data: {
        userId,
        swotItemId: created.id,
        type: EvidenceType.ASSESSMENT,
        source: `assessment:${stage}`,
        excerpt: signal.evidenceExcerpt,
        score: signal.confidence,
      },
    });

    await prisma.swotItemVersion.create({
      data: {
        swotItemId: created.id,
        changedBy: "seed",
        reason: `Seeded from ${stage} assessment`,
        confidenceFrom: 0,
        confidenceTo: created.confidence,
        statusFrom: SWOTStatus.UNCERTAIN,
        statusTo: created.status,
        snapshot: {
          title: created.title,
          description: created.description,
          stage,
        },
      },
    });

    return created;
  }

  const nextConfidence = Math.min(
    0.98,
    existing.confidence * 0.64 + signal.confidence * 0.36 + 0.03,
  );

  const updated = await prisma.swotItem.update({
    where: { id: existing.id },
    data: {
      description: signal.description,
      confidence: nextConfidence,
      status: nextConfidence >= 0.68 ? SWOTStatus.ACTIVE : SWOTStatus.UNCERTAIN,
      signalCount: existing.signalCount + 1,
      lastUpdatedAt: new Date(),
    },
  });

  await prisma.evidence.create({
    data: {
      userId,
      swotItemId: updated.id,
      type: EvidenceType.ASSESSMENT,
      source: `assessment:${stage}`,
      excerpt: signal.evidenceExcerpt,
      score: signal.confidence,
    },
  });

  await prisma.swotItemVersion.create({
    data: {
      swotItemId: updated.id,
      changedBy: "seed",
      reason: `Seed refreshed from ${stage} assessment`,
      confidenceFrom: existing.confidence,
      confidenceTo: updated.confidence,
      statusFrom: existing.status,
      statusTo: updated.status,
      snapshot: {
        title: updated.title,
        description: updated.description,
        stage,
      },
    },
  });

  return updated;
}

async function seedAssessments(userId: string, stages: StageSeed[]) {
  let previous: AssessmentSnapshot | undefined;
  const signalRegistry = new Map<string, string>();

  for (const stageSeed of stages.sort(
    (left, right) => left.takenAt.getTime() - right.takenAt.getTime(),
  )) {
    const evaluation = evaluateAssessment(
      stageSeed.stage,
      stageSeed.answers,
      previous,
    );

    const assessment = await prisma.swotAssessment.create({
      data: {
        userId,
        academicStage: stageSeed.stage as AcademicStage,
        title: evaluation.title,
        overallScore: evaluation.metrics.overallScore,
        strengthsScore: evaluation.metrics.strengthsScore,
        weaknessesScore: evaluation.metrics.weaknessesScore,
        opportunitiesScore: evaluation.metrics.opportunitiesScore,
        threatsScore: evaluation.metrics.threatsScore,
        narrative: evaluation.narrative,
        recommendations: evaluation.recommendations,
        takenAt: stageSeed.takenAt,
        answers: {
          create: evaluation.answers.map((answer) => ({
            questionKey: answer.question.key,
            questionType:
              answer.question.type === "MCQ"
                ? AssessmentQuestionType.MCQ
                : AssessmentQuestionType.WRITTEN,
            prompt: answer.question.prompt,
            category: answer.question.category,
            dimensionKey: answer.question.dimensionKey,
            answerText: answer.answerText,
            answerScore: answer.answerScore,
            optionLabel: answer.optionLabel,
            weight: answer.question.weight,
            evidenceExcerpt:
              answer.answerText ??
              `${answer.question.prompt} Answer: ${answer.optionLabel} (${answer.answerScore}/4).`,
          })),
        },
      },
    });

    for (const signal of evaluation.signalUpdates) {
      const item = await upsertAssessmentSignal(userId, stageSeed.stage, signal);

      const existingSignalId = signalRegistry.get(signal.title);
      if (!existingSignalId) {
        const createdSignal = await prisma.signal.create({
          data: {
            userId,
            swotItemId: item.id,
            title: signal.title,
            category: signal.category,
            confidence: signal.confidence,
            status: "VALIDATED",
            reason: `Seeded from ${stageSeed.stage} yearly review`,
            evidenceExcerpt: signal.evidenceExcerpt,
            evidenceType: EvidenceType.ASSESSMENT,
            recurrenceCount: 1,
            validatedAt: stageSeed.takenAt,
            createdAt: stageSeed.takenAt,
          },
        });
        signalRegistry.set(signal.title, createdSignal.id);
      } else {
        await prisma.signal.update({
          where: { id: existingSignalId },
          data: {
            confidence: signal.confidence,
            recurrenceCount: { increment: 1 },
            validatedAt: stageSeed.takenAt,
          },
        });
      }
    }

    previous = {
      stage: stageSeed.stage,
      overallScore: assessment.overallScore,
      strengthsScore: assessment.strengthsScore,
      weaknessesScore: assessment.weaknessesScore,
      opportunitiesScore: assessment.opportunitiesScore,
      threatsScore: assessment.threatsScore,
      narrative: assessment.narrative,
      takenAt: assessment.takenAt,
    };
  }
}

async function createDemoUser(seed: DemoUserSeed) {
  await resetDemoUser(seed.email);

  const passwordHash = await bcrypt.hash(seed.password, 10);

  const user = await prisma.user.create({
    data: {
      email: seed.email,
      displayName: seed.displayName,
      passwordHash,
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      onboardingComplete: true,
      academicBackground: seed.profile.academicBackground,
      goalsSummary: seed.profile.goalsSummary,
      interests: seed.profile.interests,
      habits: seed.profile.habits,
      challenges: seed.profile.challenges,
      currentStreak: seed.profile.currentStreak,
      longestStreak: seed.profile.longestStreak,
      lastActiveAt: new Date(),
    },
  });

  for (const goalSeed of seed.goals) {
    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: goalSeed.title,
        description: goalSeed.description,
        progress: goalSeed.progress,
        milestones: goalSeed.milestones,
      },
    });

    for (const taskSeed of goalSeed.tasks) {
      await prisma.task.create({
        data: {
          userId: user.id,
          goalId: goal.id,
          title: taskSeed.title,
          status: taskSeed.status,
          priority: taskSeed.priority,
          dueDate:
            typeof taskSeed.dueInDays === "number"
              ? daysFromNow(taskSeed.dueInDays)
              : undefined,
          completedAt:
            typeof taskSeed.completedDaysAgo === "number"
              ? daysAgo(taskSeed.completedDaysAgo)
              : undefined,
        },
      });
    }
  }

  for (const sessionSeed of seed.sessions) {
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        startedAt: sessionSeed.startedAt,
        lastMessageAt:
          sessionSeed.messages[sessionSeed.messages.length - 1]?.createdAt ??
          sessionSeed.startedAt,
        summary: sessionSeed.summary,
        messageCount: sessionSeed.messages.length,
      },
    });

    for (const message of sessionSeed.messages) {
      await prisma.chatMessage.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          role: message.role,
          content: message.content,
          moodScore: message.moodScore,
          isCheckIn: message.isCheckIn ?? false,
          patternSignalScore: message.patternSignalScore ?? 0.65,
          createdAt: message.createdAt,
        },
      });
    }

    await prisma.conversationSummary.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        summary: sessionSeed.summary,
        topics: sessionSeed.topics,
        keyInsights: sessionSeed.keyInsights,
        moodAvg:
          sessionSeed.messages
            .filter((message) => typeof message.moodScore === "number")
            .reduce((sum, message) => sum + (message.moodScore ?? 0), 0) /
            Math.max(
              1,
              sessionSeed.messages.filter(
                (message) => typeof message.moodScore === "number",
              ).length,
            ),
        messageCount: sessionSeed.messages.length,
        periodStart: sessionSeed.startedAt,
        periodEnd:
          sessionSeed.messages[sessionSeed.messages.length - 1]?.createdAt ??
          sessionSeed.startedAt,
      },
    });
  }

  await seedAssessments(user.id, seed.assessments);

  for (const followUp of seed.followUps) {
    await prisma.followUp.create({
      data: {
        userId: user.id,
        question: followUp.question,
        context: followUp.context,
        status: followUp.status,
        answer: followUp.answer,
        askedAt:
          typeof followUp.askedDaysAgo === "number"
            ? daysAgo(followUp.askedDaysAgo)
            : undefined,
        answeredAt:
          followUp.answer && typeof followUp.askedDaysAgo === "number"
            ? daysAgo(Math.max(followUp.askedDaysAgo - 1, 0))
            : undefined,
        expiresAt: daysFromNow(10),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DEMO_ACCOUNT_SEEDED",
      entityType: "User",
      entityId: user.id,
      actor: "seed",
      details: {
        email: seed.email,
        assessments: seed.assessments.map((assessment) => assessment.stage),
      },
    },
  });
}

const demoUsers: DemoUserSeed[] = [
  {
    email: "student@swotcoach.dev",
    password: "student1234",
    displayName: "Aarav Kulkarni",
    profile: {
      academicBackground: "Last-year engineering student focused on placements and leadership growth",
      goalsSummary: "Show year-over-year growth, placement readiness, and stronger self-management",
      interests: ["Mentorship", "Public speaking", "Full-stack projects"],
      habits: ["Weekly reflection review", "Mock interviews", "Peer accountability check-ins"],
      challenges: ["Overthinking major decisions", "Burnout during deadline clusters"],
      currentStreak: 8,
      longestStreak: 19,
    },
    goals: [
      {
        title: "Finish placement season with confidence",
        description: "Keep calm under pressure and present a stronger professional profile.",
        progress: 0.74,
        milestones: [
          { label: "Resume finalized", done: true },
          { label: "Six mock interviews", done: true },
          { label: "Two mentor reviews", done: true },
          { label: "Final confidence sprint", done: false },
        ],
        tasks: [
          {
            title: "Run one final HR mock with mentor",
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueInDays: 4,
          },
          {
            title: "Refine introduction and project storytelling",
            status: "TODO",
            priority: "HIGH",
            dueInDays: 2,
          },
          {
            title: "Complete peer confidence review",
            status: "DONE",
            priority: "MEDIUM",
            completedDaysAgo: 1,
          },
        ],
      },
      {
        title: "Sustain calm routines during final semester",
        description: "Prevent pressure spikes from affecting decisions and consistency.",
        progress: 0.58,
        tasks: [
          {
            title: "Keep phone-free evening focus block",
            status: "DONE",
            priority: "MEDIUM",
            completedDaysAgo: 2,
          },
          {
            title: "Weekly mentor check-in",
            status: "TODO",
            priority: "MEDIUM",
            dueInDays: 6,
          },
        ],
      },
    ],
    sessions: [
      {
        startedAt: daysAgo(3),
        summary: "Reviewed how the student has become calmer, more articulate, and more intentional than in earlier years.",
        topics: ["yearly growth", "decision making", "placement confidence"],
        keyInsights: [
          "Student now handles pressure better than in second year",
          "Professional presence is becoming a visible strength",
          "Overthinking still appears before big decisions",
        ],
        messages: [
          {
            role: "USER",
            content: "Compared to my first year, I explain myself much better now and I panic less before interviews.",
            moodScore: 2,
            isCheckIn: true,
            patternSignalScore: 0.8,
            createdAt: daysAgo(3),
          },
          {
            role: "ASSISTANT",
            content: "That is exactly the kind of long-term evolution your SWOT profile should capture. You are not just completing tasks; you are showing stronger self-presentation and emotional control.",
            isCheckIn: true,
            patternSignalScore: 0.76,
            createdAt: daysAgo(3),
          },
          {
            role: "USER",
            content: "I still overthink some final decisions, but I recover faster now.",
            moodScore: 1,
            patternSignalScore: 0.68,
            createdAt: daysAgo(2),
          },
          {
            role: "ASSISTANT",
            content: "That sounds like a real evolution: the threat is still there, but it no longer controls your whole week. We should keep monitoring decision paralysis without ignoring your progress.",
            isCheckIn: true,
            patternSignalScore: 0.73,
            createdAt: daysAgo(2),
          },
        ],
      },
    ],
    followUps: [
      {
        question: "What routine helps you stay calm before a high-stakes interview or presentation?",
        context: "Track whether professional confidence is stable or situational.",
        status: "ASKED",
        askedDaysAgo: 2,
      },
    ],
    assessments: [
      {
        stage: "FY",
        takenAt: new Date("2023-09-12T10:00:00.000Z"),
        answers: stageAnswers([
          ["fy-routine", 2],
          ["fy-communication", 1],
          ["fy-opportunity-seeking", 2],
          ["fy-stress-adjustment", 4],
          ["fy-time-management", 4],
          ["fy-proud-moment", "I finally began speaking to classmates instead of staying quiet all day, which made me feel more included."],
          ["fy-main-challenge", "Homesickness and confusion about college life made me avoid asking for help and I delayed important work."],
          ["fy-opportunity-next", "I should use clubs, mentors, and healthy friendships more instead of trying to handle everything alone."],
        ]),
      },
      {
        stage: "SY",
        takenAt: new Date("2024-08-28T10:00:00.000Z"),
        answers: stageAnswers([
          ["sy-consistency", 3],
          ["sy-teamwork", 3],
          ["sy-initiative", 2],
          ["sy-overwhelm", 3],
          ["sy-feedback", 2],
          ["sy-growth-proof", "I started planning my week on Sundays and I became more dependable in group commitments."],
          ["sy-hidden-blocker", "When I get overwhelmed, I still avoid difficult conversations and then small issues grow bigger."],
          ["sy-support-gap", "I know seniors and mentors can guide me, but I still do not reach out as often as I should."],
        ]),
      },
      {
        stage: "TY",
        takenAt: new Date("2025-08-24T10:00:00.000Z"),
        answers: stageAnswers([
          ["ty-ownership", 4],
          ["ty-resilience", 3],
          ["ty-networking", 3],
          ["ty-self-doubt", 2],
          ["ty-prioritization", 2],
          ["ty-proud-evolution", "I recover much faster after setbacks now and I take responsibility instead of blaming the situation."],
          ["ty-confidence-threat", "I still compare myself with stronger peers and that can slow down my decisions when pressure is high."],
          ["ty-next-leverage", "Regular mentor conversations and a smaller accountability circle would help me keep perspective."],
        ]),
      },
      {
        stage: "LY",
        takenAt: new Date("2026-03-18T10:00:00.000Z"),
        answers: stageAnswers([
          ["ly-decision-making", 3],
          ["ly-professional-presence", 4],
          ["ly-network-use", 3],
          ["ly-pressure", 2],
          ["ly-consistency", 2],
          ["ly-ready-proof", "I now handle interviews, difficult conversations, and planning with much more calm than I did in earlier years."],
          ["ly-biggest-risk", "If I keep overthinking final choices, I may delay good opportunities even though I am capable."],
          ["ly-next-support", "A steady mentor review and a weekly planning habit will help me stay grounded after graduation."],
        ]),
      },
    ],
  },
  {
    email: "meera@swotcoach.dev",
    password: "demo1234",
    displayName: "Meera Patil",
    profile: {
      academicBackground: "Second-year BBA student building confidence and leadership habits",
      goalsSummary: "Become more visible in teams and use mentor support more consistently",
      interests: ["Leadership", "Event coordination", "Communication"],
      habits: ["Weekly planner", "Class reflection", "Team follow-ups"],
      challenges: ["Saying yes to too many things", "Fear of disappointing people"],
      currentStreak: 4,
      longestStreak: 11,
    },
    goals: [
      {
        title: "Become more confident in group leadership",
        description: "Speak up earlier, delegate better, and stay calm in front of peers.",
        progress: 0.49,
        tasks: [
          {
            title: "Lead one student club meeting",
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueInDays: 5,
          },
          {
            title: "Ask mentor for presentation feedback",
            status: "TODO",
            priority: "MEDIUM",
            dueInDays: 7,
          },
        ],
      },
    ],
    sessions: [
      {
        startedAt: daysAgo(5),
        summary: "Discussed how the student is more dependable now but still gets overloaded by too many commitments.",
        topics: ["teamwork", "overwhelm", "mentor support"],
        keyInsights: [
          "Dependability is improving",
          "The main risk is saying yes to too many responsibilities",
          "Mentor support exists but is not fully used",
        ],
        messages: [
          {
            role: "USER",
            content: "I am better at working with my group now, but I still accept too many responsibilities and then feel scattered.",
            moodScore: 1,
            isCheckIn: true,
            patternSignalScore: 0.74,
            createdAt: daysAgo(5),
          },
          {
            role: "ASSISTANT",
            content: "That sounds like real progress with one clear weakness still active: dependability is growing, but overload is making it harder to stay balanced.",
            isCheckIn: true,
            patternSignalScore: 0.7,
            createdAt: daysAgo(5),
          },
        ],
      },
    ],
    followUps: [
      {
        question: "Which one commitment can you decline next week so your schedule becomes more realistic?",
        context: "Reduce overwhelm by practicing boundaries.",
        status: "PENDING",
      },
    ],
    assessments: [
      {
        stage: "FY",
        takenAt: new Date("2024-01-18T10:00:00.000Z"),
        answers: stageAnswers([
          ["fy-routine", 3],
          ["fy-communication", 2],
          ["fy-opportunity-seeking", 3],
          ["fy-stress-adjustment", 2],
          ["fy-time-management", 3],
          ["fy-proud-moment", "I became more comfortable approaching classmates and taking small responsibilities in college events."],
          ["fy-main-challenge", "I got anxious when I had to speak in front of new people and that reduced my confidence."],
          ["fy-opportunity-next", "I should make better use of mentors and student clubs because they help me open up."],
        ]),
      },
      {
        stage: "SY",
        takenAt: new Date("2025-02-20T10:00:00.000Z"),
        answers: stageAnswers([
          ["sy-consistency", 3],
          ["sy-teamwork", 4],
          ["sy-initiative", 3],
          ["sy-overwhelm", 4],
          ["sy-feedback", 2],
          ["sy-growth-proof", "I now coordinate tasks more confidently and people trust me more in team settings."],
          ["sy-hidden-blocker", "I still say yes too quickly because I do not want to disappoint others, and then I feel overloaded."],
          ["sy-support-gap", "I know my mentor can help me prioritize, but I do not check in regularly enough."],
        ]),
      },
    ],
  },
  {
    email: "rahul@swotcoach.dev",
    password: "demo1234",
    displayName: "Rahul Shaikh",
    profile: {
      academicBackground: "First-year diploma student adapting to campus life",
      goalsSummary: "Build confidence, stable routines, and a healthier support system",
      interests: ["Sports", "Peer learning", "Discipline building"],
      habits: ["Morning checklist", "Evening reflection"],
      challenges: ["Homesickness", "Low confidence in new groups"],
      currentStreak: 2,
      longestStreak: 6,
    },
    goals: [
      {
        title: "Settle into college life with healthier routines",
        description: "Reduce isolation and build stable self-management.",
        progress: 0.27,
        tasks: [
          {
            title: "Join one club or peer activity",
            status: "TODO",
            priority: "MEDIUM",
            dueInDays: 8,
          },
          {
            title: "Keep a 5-day morning routine streak",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            dueInDays: 3,
          },
        ],
      },
    ],
    sessions: [
      {
        startedAt: daysAgo(1),
        summary: "First-year check-in focused on homesickness, self-confidence, and routine building.",
        topics: ["adjustment", "confidence", "routine"],
        keyInsights: [
          "Student is still adjusting emotionally",
          "Routine building is beginning but not stable",
          "Support opportunities are available but underused",
        ],
        messages: [
          {
            role: "USER",
            content: "I am trying to follow a routine, but I still feel out of place and I do not talk much in groups.",
            moodScore: 0,
            isCheckIn: true,
            patternSignalScore: 0.66,
            createdAt: daysAgo(1),
          },
          {
            role: "ASSISTANT",
            content: "That is a very common first-year pattern. We should track both sides honestly: you are trying to build routine, and you are still carrying adjustment stress that affects confidence.",
            isCheckIn: true,
            patternSignalScore: 0.69,
            createdAt: daysAgo(1),
          },
        ],
      },
    ],
    followUps: [
      {
        question: "Which one person or group on campus already feels a little safe to approach this week?",
        context: "Help the student use support opportunities instead of staying isolated.",
        status: "PENDING",
      },
    ],
    assessments: [
      {
        stage: "FY",
        takenAt: new Date("2026-04-02T10:00:00.000Z"),
        answers: stageAnswers([
          ["fy-routine", 2],
          ["fy-communication", 1],
          ["fy-opportunity-seeking", 1],
          ["fy-stress-adjustment", 4],
          ["fy-time-management", 3],
          ["fy-proud-moment", "I have at least started following a morning routine and I now try to sit with classmates instead of being alone."],
          ["fy-main-challenge", "Homesickness and low confidence still make me withdraw from others and delay asking for support."],
          ["fy-opportunity-next", "I need to use clubs, classmates, and teachers more so I do not try to handle college life by myself."],
        ]),
      },
    ],
  },
];

async function main() {
  for (const demoUser of demoUsers) {
    await createDemoUser(demoUser);
  }

  console.log("Demo accounts seeded:");
  for (const demoUser of demoUsers) {
    console.log(`- ${demoUser.email} / ${demoUser.password} (${demoUser.displayName})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
