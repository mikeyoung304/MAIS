-- Create IVFFlat index for fast similarity search on vocabulary embeddings
-- This index enables O(sqrt(n)) approximate nearest neighbor search
-- Using vector_cosine_ops for cosine similarity (best for normalized embeddings)
-- lists=100 is a starting point, can be tuned as data grows (rows/1000 for <1M rows)
CREATE INDEX IF NOT EXISTS "VocabularyEmbedding_embedding_idx" ON "VocabularyEmbedding"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
