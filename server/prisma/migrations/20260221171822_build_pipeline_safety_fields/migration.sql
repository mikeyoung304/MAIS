-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "buildRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buildSectionResults" JSONB,
ADD COLUMN     "buildStartedAt" TIMESTAMP(3);
