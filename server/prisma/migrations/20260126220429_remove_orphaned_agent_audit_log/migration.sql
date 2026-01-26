/*
  Warnings:

  - You are about to drop the `AgentAuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgentAuditLog" DROP CONSTRAINT "AgentAuditLog_tenantId_fkey";

-- DropIndex
DROP INDEX "idx_session_cleanup";

-- DropTable
DROP TABLE "AgentAuditLog";

-- DropEnum
DROP TYPE "AgentApprovalStatus";

-- CreateIndex
CREATE INDEX "idx_session_cleanup" ON "AgentSession"("deletedAt", "lastActivityAt");
