-- Enable pgvector extension for semantic vocabulary matching
-- This extension must be enabled before creating the VocabularyEmbedding table
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "TierLevel" AS ENUM ('GOOD', 'BETTER', 'BEST');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('HERO', 'ABOUT', 'SERVICES', 'PRICING', 'TESTIMONIALS', 'FAQ', 'CONTACT', 'CTA', 'GALLERY', 'CUSTOM');

-- CreateTable
CREATE TABLE "Tier" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "level" "TierLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL,
    "durationMinutes" INTEGER,
    "depositPercent" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionContent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "segmentId" TEXT,
    "blockType" "BlockType" NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "versions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyEmbedding" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "blockType" "BlockType" NOT NULL,
    "embedding" vector(768) NOT NULL,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tier_segmentId_idx" ON "Tier"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Tier_segmentId_level_key" ON "Tier"("segmentId", "level");

-- CreateIndex
CREATE INDEX "SectionContent_tenantId_blockType_idx" ON "SectionContent"("tenantId", "blockType");

-- CreateIndex
CREATE INDEX "SectionContent_tenantId_segmentId_idx" ON "SectionContent"("tenantId", "segmentId");

-- CreateIndex
CREATE INDEX "SectionContent_tenantId_isDraft_idx" ON "SectionContent"("tenantId", "isDraft");

-- CreateIndex
CREATE UNIQUE INDEX "SectionContent_tenantId_segmentId_blockType_key" ON "SectionContent"("tenantId", "segmentId", "blockType");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyEmbedding_phrase_key" ON "VocabularyEmbedding"("phrase");

-- CreateIndex
CREATE INDEX "VocabularyEmbedding_blockType_idx" ON "VocabularyEmbedding"("blockType");

-- AddForeignKey
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create IVFFlat index for fast similarity search on vocabulary embeddings
-- Note: IVFFlat requires data to exist for optimal list count tuning
-- Using lists=100 as initial value, can be tuned after data population
-- Formula: lists = rows / 1000 for datasets < 1M rows
CREATE INDEX "VocabularyEmbedding_embedding_idx" ON "VocabularyEmbedding"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
