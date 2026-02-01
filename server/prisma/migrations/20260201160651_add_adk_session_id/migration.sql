-- DropIndex
DROP INDEX "VocabularyEmbedding_embedding_idx";

-- AlterTable
ALTER TABLE "AgentSession" ADD COLUMN     "adkSessionId" TEXT;
