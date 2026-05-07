-- CreateEnum
CREATE TYPE "AcademicStage" AS ENUM ('FY', 'SY', 'TY', 'LY');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('MCQ', 'WRITTEN');

-- CreateTable
CREATE TABLE "SwotAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicStage" "AcademicStage" NOT NULL,
    "title" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strengthsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weaknessesScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunitiesScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "threatsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "narrative" TEXT NOT NULL,
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwotAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwotAssessmentAnswer" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionType" "AssessmentQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" "SWOTCategory" NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "answerText" TEXT,
    "answerScore" DOUBLE PRECISION,
    "optionLabel" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "evidenceExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwotAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwotAssessment_userId_takenAt_idx" ON "SwotAssessment"("userId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SwotAssessment_userId_academicStage_key" ON "SwotAssessment"("userId", "academicStage");

-- CreateIndex
CREATE INDEX "SwotAssessmentAnswer_assessmentId_category_idx" ON "SwotAssessmentAnswer"("assessmentId", "category");

-- CreateIndex
CREATE INDEX "SwotAssessmentAnswer_assessmentId_questionKey_idx" ON "SwotAssessmentAnswer"("assessmentId", "questionKey");

-- AddForeignKey
ALTER TABLE "SwotAssessment" ADD CONSTRAINT "SwotAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwotAssessmentAnswer" ADD CONSTRAINT "SwotAssessmentAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SwotAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
