-- CreateTable
CREATE TABLE "WeeklyAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strengthsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weaknessesScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunitiesScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "threatsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAssessmentAnswer" (
    "id" TEXT NOT NULL,
    "weeklyAssessmentId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionType" "AssessmentQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" "SWOTCategory" NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "sourceTag" TEXT NOT NULL,
    "linkedSwotItemId" TEXT,
    "linkedSwotTitle" TEXT,
    "answerText" TEXT,
    "answerScore" DOUBLE PRECISION,
    "optionLabel" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "evidenceExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAssessment_userId_createdAt_idx" ON "WeeklyAssessment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAssessment_userId_weekStart_key" ON "WeeklyAssessment"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyAssessmentAnswer_weeklyAssessmentId_category_idx" ON "WeeklyAssessmentAnswer"("weeklyAssessmentId", "category");

-- CreateIndex
CREATE INDEX "WeeklyAssessmentAnswer_weeklyAssessmentId_questionKey_idx" ON "WeeklyAssessmentAnswer"("weeklyAssessmentId", "questionKey");

-- AddForeignKey
ALTER TABLE "WeeklyAssessment" ADD CONSTRAINT "WeeklyAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAssessmentAnswer" ADD CONSTRAINT "WeeklyAssessmentAnswer_weeklyAssessmentId_fkey" FOREIGN KEY ("weeklyAssessmentId") REFERENCES "WeeklyAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
