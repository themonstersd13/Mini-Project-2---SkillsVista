export const academicStages = ["FY", "SY", "TY", "LY"] as const;

export type AcademicStageCode = (typeof academicStages)[number];
export type SwotCategoryCode =
  | "STRENGTH"
  | "WEAKNESS"
  | "OPPORTUNITY"
  | "THREAT";

export type QuestionOption = {
  value: number;
  label: string;
  description: string;
};

export type AssessmentSignal = {
  category: SwotCategoryCode;
  title: string;
  description: string;
};

type QuestionBase = {
  key: string;
  prompt: string;
  category: SwotCategoryCode;
  dimensionKey: string;
  weight: number;
};

export type McqQuestion = QuestionBase & {
  type: "MCQ";
  options: QuestionOption[];
  highSignal: AssessmentSignal;
  lowSignal?: AssessmentSignal;
};

export type WrittenQuestion = QuestionBase & {
  type: "WRITTEN";
  placeholder: string;
  guidance: string;
  minLength: number;
};

export type AssessmentQuestion = McqQuestion | WrittenQuestion;

export type AssessmentQuestionSet = {
  stage: AcademicStageCode;
  label: string;
  title: string;
  description: string;
  questions: AssessmentQuestion[];
};

const scale4: QuestionOption[] = [
  {
    value: 1,
    label: "Rarely",
    description: "This is still difficult for me most of the time.",
  },
  {
    value: 2,
    label: "Sometimes",
    description: "I can do this occasionally but not with consistency.",
  },
  {
    value: 3,
    label: "Often",
    description: "I show this in many situations with decent consistency.",
  },
  {
    value: 4,
    label: "Almost Always",
    description: "This is now a dependable pattern for me.",
  },
];

function mcq(
  key: string,
  prompt: string,
  category: SwotCategoryCode,
  dimensionKey: string,
  highSignal: AssessmentSignal,
  lowSignal?: AssessmentSignal,
  weight = 1,
): McqQuestion {
  return {
    key,
    type: "MCQ",
    prompt,
    category,
    dimensionKey,
    options: scale4,
    highSignal,
    lowSignal,
    weight,
  };
}

function written(
  key: string,
  prompt: string,
  category: SwotCategoryCode,
  dimensionKey: string,
  placeholder: string,
  guidance: string,
  minLength = 20,
  weight = 1,
): WrittenQuestion {
  return {
    key,
    type: "WRITTEN",
    prompt,
    category,
    dimensionKey,
    placeholder,
    guidance,
    minLength,
    weight,
  };
}

const stageMetadata: Record<
  AcademicStageCode,
  Pick<AssessmentQuestionSet, "label" | "title" | "description">
> = {
  FY: {
    label: "First Year",
    title: "FY Foundation Review",
    description: "Track how well the student is adjusting, building confidence, and creating healthy early habits.",
  },
  SY: {
    label: "Second Year",
    title: "SY Growth Review",
    description: "Measure consistency, initiative, and whether the student is turning first-year learning into stable progress.",
  },
  TY: {
    label: "Third Year",
    title: "TY Maturity Review",
    description: "Evaluate ownership, resilience, and how actively the student is preparing for bigger responsibilities.",
  },
  LY: {
    label: "Last Year",
    title: "LY Transition Review",
    description: "Assess readiness for the next stage, decision-making quality, and how well the student manages pressure.",
  },
};

const questionBank: Record<AcademicStageCode, AssessmentQuestion[]> = {
  FY: [
    mcq(
      "fy-routine",
      "How consistently does the student follow a study and personal routine without external pushing?",
      "STRENGTH",
      "discipline",
      {
        category: "STRENGTH",
        title: "Consistent discipline",
        description: "Builds dependable routines and follows through without heavy supervision.",
      },
      {
        category: "WEAKNESS",
        title: "Needs routine discipline",
        description: "Still struggles to maintain a stable routine and self-management habits.",
      },
      1.2,
    ),
    mcq(
      "fy-communication",
      "How confident is the student while speaking up, asking questions, or expressing ideas in new environments?",
      "STRENGTH",
      "communication",
      {
        category: "STRENGTH",
        title: "Growing communication confidence",
        description: "Speaks up, asks for clarity, and expresses ideas with improving confidence.",
      },
      {
        category: "WEAKNESS",
        title: "Hesitant self-expression",
        description: "Needs support to speak confidently and ask for help when needed.",
      },
    ),
    mcq(
      "fy-opportunity-seeking",
      "How actively does the student explore clubs, mentors, workshops, or healthy peer groups?",
      "OPPORTUNITY",
      "campus-engagement",
      {
        category: "OPPORTUNITY",
        title: "Engages with support opportunities",
        description: "Makes use of campus communities, mentors, and growth opportunities.",
      },
      {
        category: "THREAT",
        title: "Missed support ecosystem",
        description: "May be underusing helpful peer, mentor, and campus support systems.",
      },
    ),
    mcq(
      "fy-stress-adjustment",
      "How strongly are adjustment stress, homesickness, or uncertainty affecting the student?",
      "THREAT",
      "adjustment-stress",
      {
        category: "THREAT",
        title: "Adjustment stress risk",
        description: "Transition stress or uncertainty is interfering with healthy progress.",
      },
      {
        category: "STRENGTH",
        title: "Healthy adaptation",
        description: "Adjusts to new environments with steady emotional balance.",
      },
    ),
    mcq(
      "fy-time-management",
      "How often does procrastination or poor time planning reduce the student's output?",
      "WEAKNESS",
      "time-management",
      {
        category: "WEAKNESS",
        title: "Time management gap",
        description: "Loses momentum because planning and execution are not yet consistent.",
      },
      {
        category: "STRENGTH",
        title: "Improving time management",
        description: "Plans work early and avoids unnecessary last-minute pressure.",
      },
    ),
    written(
      "fy-proud-moment",
      "Describe one proud personal moment from this year that shows how the student has grown.",
      "STRENGTH",
      "communication",
      "Example: I became more comfortable introducing myself and participating in class discussions.",
      "Focus on behavior, confidence, and habits rather than technical skills.",
    ),
    written(
      "fy-main-challenge",
      "Describe one non-technical challenge the student faced this year and how it affected progress.",
      "WEAKNESS",
      "adjustment-stress",
      "Example: I felt isolated at first, so I avoided group activities and delayed asking for help.",
      "Mention the pattern clearly so the SWOT profile can track it over time.",
    ),
    written(
      "fy-opportunity-next",
      "What opportunity should the student make better use of next year?",
      "OPPORTUNITY",
      "campus-engagement",
      "Example: I want to join a club, build better friendships, and speak with a mentor regularly.",
      "Keep it practical and specific.",
    ),
  ],
  SY: [
    mcq(
      "sy-consistency",
      "How consistently does the student sustain good habits after the excitement of the first year has settled?",
      "STRENGTH",
      "discipline",
      {
        category: "STRENGTH",
        title: "Reliable consistency",
        description: "Maintains stable habits even without novelty or pressure spikes.",
      },
      {
        category: "WEAKNESS",
        title: "Inconsistent habits",
        description: "Good routines exist, but they are not stable enough yet.",
      },
      1.2,
    ),
    mcq(
      "sy-teamwork",
      "How well does the student work with peers, handle differences, and stay dependable in group settings?",
      "STRENGTH",
      "teamwork",
      {
        category: "STRENGTH",
        title: "Dependable teamwork",
        description: "Collaborates respectfully and follows through in shared responsibilities.",
      },
      {
        category: "WEAKNESS",
        title: "Team coordination gap",
        description: "Needs more consistency in communication and dependability with peers.",
      },
    ),
    mcq(
      "sy-initiative",
      "How often does the student take initiative in activities, volunteering, or self-driven growth without being told?",
      "OPPORTUNITY",
      "initiative",
      {
        category: "OPPORTUNITY",
        title: "Self-driven initiative",
        description: "Actively creates chances to learn, contribute, and be visible.",
      },
      {
        category: "THREAT",
        title: "Passive participation risk",
        description: "Could fall behind by waiting for direction instead of creating momentum.",
      },
    ),
    mcq(
      "sy-overwhelm",
      "How much do competing responsibilities leave the student feeling mentally overloaded or scattered?",
      "THREAT",
      "overwhelm",
      {
        category: "THREAT",
        title: "Overwhelm under pressure",
        description: "Multiple demands are reducing focus and emotional balance.",
      },
      {
        category: "STRENGTH",
        title: "Balanced responsibility handling",
        description: "Manages multiple responsibilities with healthy balance.",
      },
    ),
    mcq(
      "sy-feedback",
      "How open is the student to feedback and course correction when things are not going well?",
      "WEAKNESS",
      "feedback-receptiveness",
      {
        category: "WEAKNESS",
        title: "Defensive response to feedback",
        description: "May resist feedback or take too long to adjust behavior.",
      },
      {
        category: "STRENGTH",
        title: "Feedback receptiveness",
        description: "Learns from feedback and adjusts without losing confidence.",
      },
    ),
    written(
      "sy-growth-proof",
      "What behavior or habit proves the student became more mature this year?",
      "STRENGTH",
      "discipline",
      "Example: I stopped waiting for reminders and started planning my week on my own.",
      "Choose a non-technical behavior that shows growth.",
    ),
    written(
      "sy-hidden-blocker",
      "What recurring personal blocker still slows the student down?",
      "WEAKNESS",
      "overwhelm",
      "Example: I avoid difficult conversations and then small issues become bigger problems.",
      "Name the blocker honestly and explain its effect.",
    ),
    written(
      "sy-support-gap",
      "Which support system or opportunity is the student not using enough right now?",
      "OPPORTUNITY",
      "initiative",
      "Example: I know seniors can help me, but I rarely reach out to them.",
      "Think about mentors, friends, routines, or communities.",
    ),
  ],
  TY: [
    mcq(
      "ty-ownership",
      "How strongly does the student take ownership of responsibilities without blaming circumstances or other people?",
      "STRENGTH",
      "ownership",
      {
        category: "STRENGTH",
        title: "Strong ownership mindset",
        description: "Takes responsibility, acts early, and follows through under pressure.",
      },
      {
        category: "WEAKNESS",
        title: "Avoids ownership in tough moments",
        description: "Needs more accountability when situations become difficult.",
      },
      1.2,
    ),
    mcq(
      "ty-resilience",
      "How well does the student recover from setbacks, criticism, or disappointing outcomes?",
      "STRENGTH",
      "resilience",
      {
        category: "STRENGTH",
        title: "Resilient under setbacks",
        description: "Bounces back, reflects, and keeps moving after a setback.",
      },
      {
        category: "THREAT",
        title: "Setback recovery risk",
        description: "Negative events may be reducing confidence for too long.",
      },
    ),
    mcq(
      "ty-networking",
      "How actively is the student building relationships with mentors, seniors, or communities that can open doors later?",
      "OPPORTUNITY",
      "networking",
      {
        category: "OPPORTUNITY",
        title: "Builds growth network",
        description: "Creates meaningful relationships that expand future possibilities.",
      },
      {
        category: "THREAT",
        title: "Weak support network",
        description: "Limited mentor or peer network may reduce future options.",
      },
    ),
    mcq(
      "ty-self-doubt",
      "How much are self-doubt, comparison, or fear of being behind affecting the student's decisions?",
      "THREAT",
      "self-doubt",
      {
        category: "THREAT",
        title: "Self-doubt pressure",
        description: "Comparison and fear are influencing decisions and confidence.",
      },
      {
        category: "STRENGTH",
        title: "Grounded self-belief",
        description: "Stays focused on personal progress without being ruled by comparison.",
      },
    ),
    mcq(
      "ty-prioritization",
      "How often does the student get stuck because priorities are unclear or too many goals are being chased at once?",
      "WEAKNESS",
      "prioritization",
      {
        category: "WEAKNESS",
        title: "Prioritization gap",
        description: "Too many competing goals are reducing clarity and execution quality.",
      },
      {
        category: "STRENGTH",
        title: "Clear prioritization",
        description: "Makes focused choices and protects time for the most important work.",
      },
    ),
    written(
      "ty-proud-evolution",
      "Describe one way the student now behaves more maturely than in the first year.",
      "STRENGTH",
      "ownership",
      "Example: I recover faster when I fail, and I take responsibility instead of hiding from the problem.",
      "Connect the answer to long-term personal growth.",
    ),
    written(
      "ty-confidence-threat",
      "What personal pattern currently threatens the student's confidence or consistency the most?",
      "THREAT",
      "self-doubt",
      "Example: I compare myself too much and then I freeze instead of taking action.",
      "Be concrete about the pattern and its impact.",
    ),
    written(
      "ty-next-leverage",
      "What people, routines, or environments could help the student level up next year?",
      "OPPORTUNITY",
      "networking",
      "Example: Better mentor check-ins and a small peer accountability circle would help a lot.",
      "Think beyond classroom performance.",
    ),
  ],
  LY: [
    mcq(
      "ly-decision-making",
      "How confidently does the student make decisions about the next stage without getting stuck in overthinking?",
      "STRENGTH",
      "decision-making",
      {
        category: "STRENGTH",
        title: "Confident decision making",
        description: "Makes thoughtful decisions without getting trapped in indecision.",
      },
      {
        category: "THREAT",
        title: "Decision paralysis risk",
        description: "Overthinking may delay important life and career decisions.",
      },
      1.2,
    ),
    mcq(
      "ly-professional-presence",
      "How prepared does the student feel to present themselves maturely in interviews, meetings, or professional settings?",
      "STRENGTH",
      "professional-presence",
      {
        category: "STRENGTH",
        title: "Professional presence",
        description: "Carries confidence, clarity, and maturity in high-stakes interactions.",
      },
      {
        category: "WEAKNESS",
        title: "Needs stronger self-presentation",
        description: "Would benefit from more confidence and clarity in professional settings.",
      },
    ),
    mcq(
      "ly-network-use",
      "How effectively does the student use alumni, faculty, peers, or family networks to create good next-step opportunities?",
      "OPPORTUNITY",
      "networking",
      {
        category: "OPPORTUNITY",
        title: "Leverages available network",
        description: "Uses relationships and communities well to create opportunities.",
      },
      {
        category: "THREAT",
        title: "Underused support network",
        description: "Important relationships exist but are not being used effectively.",
      },
    ),
    mcq(
      "ly-pressure",
      "How much are pressure, fear of the future, or burnout affecting the student's ability to perform calmly?",
      "THREAT",
      "future-pressure",
      {
        category: "THREAT",
        title: "Future pressure risk",
        description: "Stress about the future is affecting confidence, calm, or execution.",
      },
      {
        category: "STRENGTH",
        title: "Composed under pressure",
        description: "Handles future-related pressure with emotional steadiness.",
      },
    ),
    mcq(
      "ly-consistency",
      "How often does the student slip on commitments because of low energy, low confidence, or poor self-management?",
      "WEAKNESS",
      "self-management",
      {
        category: "WEAKNESS",
        title: "Self-management strain",
        description: "Execution is being affected by low energy, inconsistency, or poor self-management.",
      },
      {
        category: "STRENGTH",
        title: "Stable self-management",
        description: "Maintains commitments even when pressure or uncertainty is high.",
      },
    ),
    written(
      "ly-ready-proof",
      "What shows that the student is more ready for the next stage than they were in earlier years?",
      "STRENGTH",
      "professional-presence",
      "Example: I handle difficult conversations more calmly and I plan my responsibilities better than before.",
      "Use a concrete example of maturity.",
    ),
    written(
      "ly-biggest-risk",
      "What non-technical risk could still hold the student back after graduation or transition?",
      "THREAT",
      "future-pressure",
      "Example: If I keep overthinking every decision, I may miss good opportunities.",
      "Focus on a real behavioral or emotional risk.",
    ),
    written(
      "ly-next-support",
      "What opportunity, person, or habit will be most important to help the student succeed in the next stage?",
      "OPPORTUNITY",
      "networking",
      "Example: Regular mentor conversations and a weekly planning habit will keep me grounded.",
      "Choose the opportunity that will matter most after this year.",
    ),
  ],
};

export function getStageMetadata(stage: AcademicStageCode) {
  return stageMetadata[stage];
}

export function getAssessmentQuestionSet(stage: AcademicStageCode): AssessmentQuestionSet {
  return {
    stage,
    ...stageMetadata[stage],
    questions: questionBank[stage],
  };
}

export function getAssessmentQuestionBank() {
  return academicStages.map((stage) => getAssessmentQuestionSet(stage));
}

export function isAcademicStage(value: string): value is AcademicStageCode {
  return academicStages.includes(value as AcademicStageCode);
}
