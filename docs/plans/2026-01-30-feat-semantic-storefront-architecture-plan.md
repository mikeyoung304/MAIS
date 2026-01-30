---
title: Semantic Storefront Architecture
type: feat
date: 2026-01-30
status: in_progress
risk: medium
estimated_effort: 5-6 weeks (revised after plan review)
reviewers: DHH, Kieran, Simplicity Reviewer
review_date: 2026-01-30
branch: feat/semantic-storefront
---

# Semantic Storefront Architecture Implementation Plan

## Implementation Progress

| Phase    | Status         | Commits    | Description                                                            |
| -------- | -------------- | ---------- | ---------------------------------------------------------------------- |
| Phase 0  | ✅ Complete    | `d2941c8a` | Database schema foundation (Tier, SectionContent, VocabularyEmbedding) |
| Phase 1  | ✅ Complete    | `972f2939` | Vocabulary Embedding Service with pgvector semantic search             |
| Phase 2a | 🔲 Not Started | -          | Tenant Agent Foundation                                                |
| Phase 2b | 🔲 Not Started | -          | Migrate Onboarding capabilities                                        |
| Phase 2c | 🔲 Not Started | -          | Migrate Build Mode (storefront editing)                                |
| Phase 2d | 🔲 Not Started | -          | Retire legacy agents                                                   |
| Phase 3  | 🔲 Not Started | -          | Unified Customer Agent                                                 |
| Phase 4  | 🔲 Not Started | -          | Cleanup & Polish                                                       |

### What's Been Built

**Phase 0 - Database Schema Foundation:**

- `Tier` model with `TierLevel` enum (GOOD/BETTER/BEST) for 3-tier pricing
- `SectionContent` model with `BlockType` enum for unified content storage
- `VocabularyEmbedding` model with pgvector (768 dimensions) for semantic phrase mapping
- Zod contracts: `TierFeaturesSchema`, `SectionContentSchema`, `VersionHistorySchema`
- Extended tenant provisioning to create tiers and section content atomically
- **68 tests** (63 schema + 5 provisioning)

**Phase 1 - Vocabulary Embedding Service:**

- `VocabularyEmbeddingService` using Vertex AI `text-embedding-005` model
- `resolveBlockType()` maps user phrases to BlockTypes with confidence scores
- `findSimilarPhrases()` for debugging and analytics
- Seed script with 120+ canonical phrases across all 10 block types
- Cosine similarity search via pgvector `<=>` operator
- **19 tests** validating embedding generation and similarity search

### Files Created/Modified

```
# New files
packages/contracts/src/schemas/tier.schema.ts
packages/contracts/src/schemas/section-content.schema.ts
packages/contracts/src/schemas/version-history.schema.ts
server/src/services/vocabulary-embedding.service.ts
server/scripts/seed-vocabulary.ts
server/test/schemas/tier.schema.test.ts
server/test/schemas/section-content.schema.test.ts
server/test/schemas/version-history.schema.test.ts
server/test/services/vocabulary-embedding.service.test.ts
server/prisma/migrations/20260130210304_semantic_storefront_foundation/
server/prisma/migrations/20260130210423_add_vocabulary_embedding_ivfflat_index/

# Modified files
server/prisma/schema.prisma
server/src/lib/tenant-defaults.ts
server/src/services/tenant-provisioning.service.ts
packages/contracts/src/index.ts
```

### Next Steps

To continue implementation, run `/workflows:work` on this plan and proceed with **Phase 2a: Tenant Agent Foundation**.

---

## Overview

Transform MAIS's AI-powered website builder into a unified agent-first experience where:

- Users speak with a dashboard agent that controls what they see
- The agent edits their website in real-time with visual feedback
- Service offerings follow a 3-Segment × 3-Tier ontology (Good/Better/Best)
- Semantic vocabulary mapping understands natural language ("update my bio" → ABOUT section)

**Key architectural changes:**

- Consolidate 6 agents → 3 agents (Tenant, Customer, Research)
- Replace dual draft system with unified `SectionContent` model
- Add pgvector for enterprise-grade vocabulary mapping
- Deprecate Visual Editor in favor of agent-controlled dashboard

**Source:** `docs/brainstorms/2026-01-30-semantic-storefront-architecture-brainstorm.md`

---

## Decisions from Clarifying Session

These decisions were made through collaborative discussion on 2026-01-30:

### Schema Decisions

| Decision           | Choice                  | Rationale                                                            |
| ------------------ | ----------------------- | -------------------------------------------------------------------- |
| Tier model         | Create NEW `Tier` model | Clean slate (delete demo data), avoid Package model complexity       |
| Tier count         | Exactly 3 required      | Pricing psychology; consistent UX; hard constraint at validation     |
| Segment count      | 1 default, up to 3      | Every tenant starts with "General" segment; can add 2 more           |
| Vocabulary mapping | pgvector embeddings     | Enterprise-grade; handles phrases we never anticipated; ~$0.10 setup |

### Agent Architecture

| Current (6 agents)     | New (3 agents)               |
| ---------------------- | ---------------------------- |
| Concierge              | → Tenant Agent               |
| Storefront Agent       | → Tenant Agent               |
| Marketing Agent        | → Tenant Agent               |
| Project Hub (tenant)   | → Tenant Agent               |
| Booking Agent          | → Customer Agent             |
| Project Hub (customer) | → Customer Agent             |
| Research Agent         | → Research Agent (unchanged) |

**Rationale:**

- Eliminates delegation context loss (pitfall #90)
- Reduces maintenance burden (6 codebases → 3)
- Eliminates cold start latency for specialists
- Actually CHEAPER (fewer LLM calls per task)

### UX Decisions

| Decision              | Choice                   | Rationale                                                |
| --------------------- | ------------------------ | -------------------------------------------------------- |
| Primary editor        | Agent-first              | Deprecate Visual Editor; agent controls dashboard window |
| Change confirmation   | All changes need confirm | MVP simplicity; safer; future: smart auto-approve        |
| Multi-option variants | Future                   | MVP: single best option; user can request revisions      |

### MVP Scope

**In MVP:**

- New schema (Segment → Tier with 3×3 ontology)
- `SectionContent` model (replace dual draft system)
- pgvector vocabulary mapping
- Unified Tenant Agent
- Unified Customer Agent
- Agent-controlled dashboard with real-time preview

**Deferred:**

- A2A API for external agents
- Reference site crawling
- Multi-option variant generation
- Smart auto-approve
- Inline click-to-edit

---

## TypeScript Contract Layer (Kieran's Addition)

All Json fields in Prisma must have corresponding Zod schemas in `packages/contracts/` for type safety.

### Tier Features Schema

```typescript
// packages/contracts/src/schemas/tier.ts
import { z } from 'zod';

export const TierFeatureSchema = z.object({
  text: z.string().min(1).max(200),
  highlighted: z.boolean().default(false),
  icon: z.string().optional(), // Lucide icon name
});

export const TierFeaturesSchema = z.array(TierFeatureSchema).max(15);

export type TierFeature = z.infer<typeof TierFeatureSchema>;
export type TierFeatures = z.infer<typeof TierFeaturesSchema>;
```

### Section Content Schemas

```typescript
// packages/contracts/src/schemas/section-content.ts
import { z } from 'zod';

// Base schema all blocks extend
const BaseBlockSchema = z.object({
  visible: z.boolean().default(true),
  customClasses: z.string().optional(),
});

export const HeroContentSchema = BaseBlockSchema.extend({
  headline: z.string().max(100),
  subheadline: z.string().max(200).optional(),
  ctaText: z.string().max(40).optional(),
  ctaLink: z.string().url().optional(),
  backgroundImage: z.string().url().optional(),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
});

export const AboutContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100),
  body: z.string().max(2000),
  image: z.string().url().optional(),
  imagePosition: z.enum(['left', 'right']).default('right'),
});

export const TestimonialItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string().max(100),
  role: z.string().max(100).optional(),
  quote: z.string().max(500),
  image: z.string().url().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const TestimonialsContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('What Clients Say'),
  items: z.array(TestimonialItemSchema).max(20),
  layout: z.enum(['grid', 'carousel', 'masonry']).default('grid'),
});

export const FaqItemSchema = z.object({
  id: z.string().cuid(),
  question: z.string().max(200),
  answer: z.string().max(1000),
});

export const FaqContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Frequently Asked Questions'),
  items: z.array(FaqItemSchema).max(30),
});

export const ContactContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Get in Touch'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  showForm: z.boolean().default(true),
  formFields: z
    .array(z.enum(['name', 'email', 'phone', 'message', 'date', 'service']))
    .default(['name', 'email', 'message']),
});

export const GalleryItemSchema = z.object({
  id: z.string().cuid(),
  url: z.string().url(),
  alt: z.string().max(200),
  caption: z.string().max(300).optional(),
});

export const GalleryContentSchema = BaseBlockSchema.extend({
  title: z.string().max(100).default('Portfolio'),
  items: z.array(GalleryItemSchema).max(50),
  columns: z.number().int().min(2).max(4).default(3),
});

export const CtaContentSchema = BaseBlockSchema.extend({
  headline: z.string().max(100),
  subheadline: z.string().max(200).optional(),
  buttonText: z.string().max(40),
  buttonLink: z.string().url().optional(),
  style: z.enum(['primary', 'secondary', 'outline']).default('primary'),
});

// Discriminated union for type-safe content handling
export const SectionContentSchema = z.discriminatedUnion('blockType', [
  z.object({ blockType: z.literal('HERO'), content: HeroContentSchema }),
  z.object({ blockType: z.literal('ABOUT'), content: AboutContentSchema }),
  z.object({ blockType: z.literal('TESTIMONIALS'), content: TestimonialsContentSchema }),
  z.object({ blockType: z.literal('FAQ'), content: FaqContentSchema }),
  z.object({ blockType: z.literal('CONTACT'), content: ContactContentSchema }),
  z.object({ blockType: z.literal('GALLERY'), content: GalleryContentSchema }),
  z.object({ blockType: z.literal('CTA'), content: CtaContentSchema }),
  // SERVICES, PRICING use Tier model directly
  z.object({ blockType: z.literal('CUSTOM'), content: z.record(z.unknown()) }),
]);

export type HeroContent = z.infer<typeof HeroContentSchema>;
export type AboutContent = z.infer<typeof AboutContentSchema>;
// ... etc
```

### Version History Schema

```typescript
// packages/contracts/src/schemas/version-history.ts
import { z } from 'zod';

export const VersionEntrySchema = z.object({
  content: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  author: z.enum(['agent', 'user', 'previous']),
  toolName: z.string().optional(),
});

export const VersionHistorySchema = z.array(VersionEntrySchema).max(5);

export type VersionEntry = z.infer<typeof VersionEntrySchema>;
export type VersionHistory = z.infer<typeof VersionHistorySchema>;
```

### ts-rest Internal Contracts

```typescript
// packages/contracts/src/internal/tenant-agent.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { SectionContentSchema } from '../schemas/section-content';

const c = initContract();

export const tenantAgentContract = c.router({
  updateSection: {
    method: 'POST',
    path: '/internal/agent/section',
    body: z.object({
      tenantId: z.string().cuid(),
      blockType: z.enum([
        'HERO',
        'ABOUT',
        'SERVICES',
        'PRICING',
        'TESTIMONIALS',
        'FAQ',
        'CONTACT',
        'CTA',
        'GALLERY',
        'CUSTOM',
      ]),
      content: z.record(z.unknown()),
      segmentId: z.string().cuid().optional(),
    }),
    responses: {
      200: z.object({
        sectionId: z.string().cuid(),
        isDraft: z.boolean(),
        canUndo: z.boolean(),
      }),
      400: z.object({ error: z.string() }),
    },
  },
  publishSections: {
    method: 'POST',
    path: '/internal/agent/publish',
    body: z.object({
      tenantId: z.string().cuid(),
      sectionIds: z.array(z.string().cuid()).optional(), // null = all
    }),
    responses: {
      200: z.object({ publishedCount: z.number() }),
      400: z.object({ error: z.string() }),
    },
  },
  resolveVocabulary: {
    method: 'POST',
    path: '/internal/agent/vocabulary/resolve',
    body: z.object({
      phrase: z.string().min(1).max(200),
    }),
    responses: {
      200: z.object({
        blockType: z
          .enum([
            'HERO',
            'ABOUT',
            'SERVICES',
            'PRICING',
            'TESTIMONIALS',
            'FAQ',
            'CONTACT',
            'CTA',
            'GALLERY',
            'CUSTOM',
          ])
          .nullable(),
        confidence: z.number().min(0).max(1),
        matchedPhrase: z.string().nullable(),
      }),
    },
  },
});
```

---

## Phase 0: Database Reset & Schema Foundation (Week 1)

### 0.1 Clean Slate Migration

Since all data is demo users, we can delete and start fresh:

```bash
# Backup current schema for reference
pg_dump -s $DATABASE_URL > backup-schema-2026-01-30.sql

# Reset database
npx prisma migrate reset --force

# Apply new schema
npx prisma migrate dev --name semantic_storefront_foundation
```

### 0.2 New Prisma Schema

```prisma
// ============================================
// SEGMENT: Customer segment (e.g., "Weddings")
// ============================================
model Segment {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  name        String   // "Weddings", "Portraits", "Corporate"
  slug        String   // "weddings" for URL routing
  description String?  @db.Text
  order       Int      @default(0)

  // SEO metadata
  metaTitle       String?
  metaDescription String? @db.Text

  tiers       Tier[]
  content     SectionContent[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

// ============================================
// TIER: Pricing tier (exactly 3 per segment)
// ============================================
model Tier {
  id          String    @id @default(cuid())
  segmentId   String
  segment     Segment   @relation(fields: [segmentId], references: [id], onDelete: Cascade)

  level       TierLevel // GOOD, BETTER, BEST (enforced)
  name        String    // Display name: "Essential", "Professional", "Premium"
  description String?   @db.Text
  price       Decimal   @db.Decimal(10, 2)
  currency    String    @default("USD")
  features    Json      // Array of feature strings

  // Booking integration
  durationMinutes Int?
  depositPercent  Int?  @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([segmentId, level]) // Exactly one of each level per segment
  @@index([segmentId])
}

enum TierLevel {
  GOOD
  BETTER
  BEST
}

// ============================================
// SECTION CONTENT: Unified content storage
// ============================================
model SectionContent {
  id          String     @id @default(cuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  segmentId   String?    // null = shared across all segments
  segment     Segment?   @relation(fields: [segmentId], references: [id], onDelete: SetNull)

  blockType   BlockType
  content     Json       // Block-specific content structure
  order       Int        @default(0)

  // Draft/publish workflow
  isDraft     Boolean    @default(true)
  publishedAt DateTime?

  // Version history for undo (last 5)
  versions    Json?      // [{ content, timestamp, author }]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([tenantId, segmentId, blockType])
  @@index([tenantId, blockType])
  @@index([tenantId, segmentId])
}

enum BlockType {
  HERO
  ABOUT
  SERVICES
  PRICING
  TESTIMONIALS
  FAQ
  CONTACT
  CTA
  GALLERY
  CUSTOM
}

// ============================================
// VOCABULARY EMBEDDING: pgvector for semantic matching
// ============================================
model VocabularyEmbedding {
  id          String    @id @default(cuid())
  phrase      String    @unique  // "my bio", "about section"
  blockType   BlockType
  embedding   Unsupported("vector(1536)")  // OpenAI ada-002 dimensions
  isCanonical Boolean   @default(false)

  createdAt   DateTime  @default(now())

  @@index([blockType])
}

// ============================================
// MODIFIED: Tenant model additions
// ============================================
model Tenant {
  // ... existing fields ...

  // NEW: Replace landingPageConfig columns
  segments        Segment[]
  sectionContent  SectionContent[]

  // DEPRECATED: Will be removed after migration
  // landingPageConfig         Json?
  // landingPageConfigDraft    Json?
  // landingPageConfigDraftVersion Int
}
```

### 0.3 pgvector Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for fast similarity search
CREATE INDEX ON "VocabularyEmbedding"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 0.4 Seed Default Segment

Every new tenant gets a default segment:

```typescript
// server/src/services/tenant.service.ts
async createTenant(data: CreateTenantInput) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data });

    // Create default segment with 3 tiers
    const segment = await tx.segment.create({
      data: {
        tenantId: tenant.id,
        name: 'Services',
        slug: 'services',
        description: 'My professional services',
        tiers: {
          create: [
            { level: 'GOOD', name: 'Essential', price: 0, features: [] },
            { level: 'BETTER', name: 'Professional', price: 0, features: [] },
            { level: 'BEST', name: 'Premium', price: 0, features: [] },
          ]
        }
      }
    });

    // Create default sections
    await tx.sectionContent.createMany({
      data: [
        { tenantId: tenant.id, blockType: 'HERO', content: defaultHeroContent(), order: 0 },
        { tenantId: tenant.id, blockType: 'ABOUT', content: defaultAboutContent(), order: 1 },
        { tenantId: tenant.id, blockType: 'SERVICES', content: {}, order: 2 },
        { tenantId: tenant.id, blockType: 'TESTIMONIALS', content: { items: [] }, order: 3 },
        { tenantId: tenant.id, blockType: 'FAQ', content: { items: [] }, order: 4 },
        { tenantId: tenant.id, blockType: 'CONTACT', content: defaultContactContent(), order: 5 },
      ]
    });

    return tenant;
  });
}
```

### 0.5 Validation Gate

**Before proceeding to Phase 1:**

- [x] pgvector extension installed
- [x] New schema applied successfully
- [x] Default segment creation works
- [x] All 3 tiers created per segment (constraint enforced)

**Completed 2026-01-30**: Phase 0 validation gate passed. All schema tests (63 tests) and provisioning tests (5 tests) passing.

---

## Phase 1: Vocabulary Embedding Service (Week 2)

### 1.1 Embedding Generation

```typescript
// server/src/services/vocabulary-embedding.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class VocabularyEmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: string = 'text-embedding-004'; // Gemini embedding model

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async resolveBlockType(userPhrase: string): Promise<{
    blockType: BlockType | null;
    confidence: number;
    matchedPhrase: string | null;
  }> {
    const embedding = await this.generateEmbedding(userPhrase.toLowerCase());

    // Query pgvector for nearest neighbor
    const result = await prisma.$queryRaw<
      Array<{
        blockType: BlockType;
        phrase: string;
        similarity: number;
      }>
    >`
      SELECT
        "blockType",
        phrase,
        1 - (embedding <=> ${embedding}::vector) as similarity
      FROM "VocabularyEmbedding"
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT 1
    `;

    if (result.length === 0 || result[0].similarity < 0.7) {
      return { blockType: null, confidence: result[0]?.similarity ?? 0, matchedPhrase: null };
    }

    return {
      blockType: result[0].blockType,
      confidence: result[0].similarity,
      matchedPhrase: result[0].phrase,
    };
  }
}
```

### 1.2 Seed Canonical Vocabulary

```typescript
// scripts/seed-vocabulary.ts
const CANONICAL_VOCABULARY: Array<{ phrase: string; blockType: BlockType }> = [
  // HERO
  { phrase: 'hero', blockType: 'HERO' },
  { phrase: 'hero section', blockType: 'HERO' },
  { phrase: 'banner', blockType: 'HERO' },
  { phrase: 'headline', blockType: 'HERO' },
  { phrase: 'main header', blockType: 'HERO' },
  { phrase: 'top of the page', blockType: 'HERO' },

  // ABOUT
  { phrase: 'about', blockType: 'ABOUT' },
  { phrase: 'about me', blockType: 'ABOUT' },
  { phrase: 'about section', blockType: 'ABOUT' },
  { phrase: 'bio', blockType: 'ABOUT' },
  { phrase: 'my bio', blockType: 'ABOUT' },
  { phrase: 'my story', blockType: 'ABOUT' },
  { phrase: 'who i am', blockType: 'ABOUT' },
  { phrase: 'background', blockType: 'ABOUT' },
  { phrase: 'introduction', blockType: 'ABOUT' },

  // SERVICES
  { phrase: 'services', blockType: 'SERVICES' },
  { phrase: 'what i offer', blockType: 'SERVICES' },
  { phrase: 'offerings', blockType: 'SERVICES' },
  { phrase: 'my services', blockType: 'SERVICES' },

  // PRICING
  { phrase: 'pricing', blockType: 'PRICING' },
  { phrase: 'packages', blockType: 'PRICING' },
  { phrase: 'rates', blockType: 'PRICING' },
  { phrase: 'investment', blockType: 'PRICING' },
  { phrase: 'tiers', blockType: 'PRICING' },
  { phrase: 'pricing section', blockType: 'PRICING' },

  // TESTIMONIALS
  { phrase: 'testimonials', blockType: 'TESTIMONIALS' },
  { phrase: 'reviews', blockType: 'TESTIMONIALS' },
  { phrase: 'client feedback', blockType: 'TESTIMONIALS' },
  { phrase: 'what clients say', blockType: 'TESTIMONIALS' },
  { phrase: 'social proof', blockType: 'TESTIMONIALS' },

  // FAQ
  { phrase: 'faq', blockType: 'FAQ' },
  { phrase: 'frequently asked questions', blockType: 'FAQ' },
  { phrase: 'questions', blockType: 'FAQ' },
  { phrase: 'common questions', blockType: 'FAQ' },

  // CONTACT
  { phrase: 'contact', blockType: 'CONTACT' },
  { phrase: 'contact section', blockType: 'CONTACT' },
  { phrase: 'get in touch', blockType: 'CONTACT' },
  { phrase: 'reach out', blockType: 'CONTACT' },
  { phrase: 'contact info', blockType: 'CONTACT' },

  // CTA
  { phrase: 'cta', blockType: 'CTA' },
  { phrase: 'call to action', blockType: 'CTA' },
  { phrase: 'book now', blockType: 'CTA' },
  { phrase: 'get started', blockType: 'CTA' },

  // GALLERY
  { phrase: 'gallery', blockType: 'GALLERY' },
  { phrase: 'portfolio', blockType: 'GALLERY' },
  { phrase: 'my work', blockType: 'GALLERY' },
  { phrase: 'photos', blockType: 'GALLERY' },
  { phrase: 'images', blockType: 'GALLERY' },
];

async function seedVocabulary() {
  const service = new VocabularyEmbeddingService();

  for (const item of CANONICAL_VOCABULARY) {
    const embedding = await service.generateEmbedding(item.phrase);

    await prisma.$executeRaw`
      INSERT INTO "VocabularyEmbedding" (id, phrase, "blockType", embedding, "isCanonical", "createdAt")
      VALUES (
        ${generateCuid()},
        ${item.phrase},
        ${item.blockType}::"BlockType",
        ${embedding}::vector,
        true,
        NOW()
      )
      ON CONFLICT (phrase) DO NOTHING
    `;

    console.log(`✓ Seeded: "${item.phrase}" → ${item.blockType}`);
  }
}
```

### 1.3 Validation Gate

**Before proceeding to Phase 2:**

- [x] Vocabulary embeddings seeded (~40 phrases)
- [x] Similarity search returns correct results
- [x] Test: "update my life story" → ABOUT (confidence >0.8)
- [x] Test: "fix the hero banner" → HERO (confidence >0.8)

**Completed 2026-01-30**: Phase 1 validation gate passed. All 19 vocabulary service tests passing. Seed script created with 120+ canonical phrases across all 10 block types.

---

## Phase 2: Unified Tenant Agent (Weeks 3-4)

**Incremental Approach (Kieran's revision):** Instead of one big merge, consolidate agents in subphases to reduce risk and allow early validation.

### Phase 2a: Tenant Agent Foundation (Days 1-2)

Create the new Tenant Agent shell with core infrastructure:

```
server/src/agent-v2/deploy/tenant/
├── src/
│   ├── index.ts              # Agent entry point
│   ├── context-builder.ts    # TenantAgentContext builder
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   └── navigate.ts       # T1: navigate_to_section
│   └── prompts/
│       └── system.ts         # System prompt
├── package.json
└── Dockerfile
```

**Deliverables:**

- [ ] Deploy tenant-agent to Cloud Run (empty shell)
- [ ] Route `/chat/tenant` to new agent
- [ ] Verify context injection works
- [ ] Navigation tool works (scroll to dashboard sections)

### Phase 2b: Merge Storefront Agent (Days 3-5)

Move all storefront editing capabilities:

```typescript
// Migrate from storefront-agent:
-update_section - // → tenant/src/tools/update-section.ts
  update_branding - // → tenant/src/tools/update-branding.ts
  reorder_sections - // → tenant/src/tools/reorder-sections.ts
  add_section - // → tenant/src/tools/add-section.ts
  remove_section - // → tenant/src/tools/remove-section.ts
  preview_website - // → tenant/src/tools/preview.ts
  publish_website - // → tenant/src/tools/publish.ts
  discard_draft; // → tenant/src/tools/discard-draft.ts
```

**Validation:**

- [ ] All storefront tools work in Tenant Agent
- [ ] E2E: "update my about section" → section updates, preview scrolls
- [ ] Archive storefront-agent (don't delete yet)

### Phase 2c: Merge Marketing + Concierge (Days 6-8)

Add copy generation and remove router:

```typescript
// Migrate from marketing-agent:
-generate_copy - // → tenant/src/tools/generate-copy.ts
  improve_section_copy; // → tenant/src/tools/improve-copy.ts

// Concierge becomes unnecessary:
// - Routing logic absorbed into Tenant Agent's system prompt
// - No more delegation = no more context loss (pitfall #90)
```

**Validation:**

- [ ] "Write me a catchy headline" → generates copy
- [ ] "Make my about section sound more professional" → rewrites
- [ ] Archive concierge-agent and marketing-agent

### Phase 2d: Merge Project Hub (Tenant View) (Days 9-10)

Add project management for tenant:

```typescript
// Migrate from project-hub-agent (tenant context only):
-get_project_details - // → tenant/src/tools/get-project.ts
  send_project_message - // → tenant/src/tools/send-message.ts
  update_project_status; // → tenant/src/tools/update-project-status.ts
```

**Validation:**

- [ ] Tenant can view projects via chat
- [ ] Tenant can message customers via chat
- [ ] Archive project-hub-agent (tenant portion)

---

### 2.1 Final Agent Structure

After Phase 2d, the Tenant Agent consolidates 4 agents:

```
BEFORE (6 agents):
- concierge-agent      ─┐
- storefront-agent     ─┼─→ tenant-agent (1)
- marketing-agent      ─┤
- project-hub-agent    ─┘ (tenant view only)
- booking-agent        ─┬─→ customer-agent (Phase 3)
- project-hub-agent    ─┘ (customer view)
- research-agent       ───→ research-agent (unchanged)

AFTER (3 agents):
- tenant-agent (new)
- customer-agent (new)
- research-agent (unchanged)
```

### 2.2 Context Injection

```typescript
// server/src/agent-v2/deploy/tenant/src/context-builder.ts
interface TenantAgentContext {
  tenant: {
    name: string;
    slug: string;
    branding: BrandingConfig;
  };
  segments: Array<{
    id: string;
    name: string;
    slug: string;
    tiers: Array<{
      level: TierLevel;
      name: string;
      price: number;
      features: string[];
    }>;
  }>;
  sections: Array<{
    blockType: BlockType;
    isDraft: boolean;
    summary: string; // 50-word summary for token efficiency
  }>;
  projects: Array<{
    id: string;
    customerName: string;
    status: string;
    unreadMessages: number;
  }>;
  dashboardCapabilities: string[];
}

export async function buildTenantContext(tenantId: string): Promise<TenantAgentContext> {
  const [tenant, segments, sections, projects] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, branding: true },
    }),
    prisma.segment.findMany({
      where: { tenantId },
      include: { tiers: { orderBy: { level: 'asc' } } },
      orderBy: { order: 'asc' },
    }),
    prisma.sectionContent.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    }),
    prisma.project.findMany({
      where: { tenantId, status: { not: 'COMPLETED' } },
      include: { _count: { select: { messages: { where: { readAt: null } } } } },
      take: 10,
    }),
  ]);

  return {
    tenant: {
      name: tenant!.name,
      slug: tenant!.slug,
      branding: tenant!.branding as BrandingConfig,
    },
    segments: segments.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      tiers: s.tiers.map((t) => ({
        level: t.level,
        name: t.name,
        price: t.price.toNumber(),
        features: t.features as string[],
      })),
    })),
    sections: sections.map((s) => ({
      blockType: s.blockType,
      isDraft: s.isDraft,
      summary: summarizeContent(s.content as object, 50),
    })),
    projects: projects.map((p) => ({
      id: p.id,
      customerName: p.customerName,
      status: p.status,
      unreadMessages: p._count.messages,
    })),
    dashboardCapabilities: [
      'navigate_to_section(section: "website" | "bookings" | "projects" | "settings")',
      'update_section(blockType, content) — updates website section, scrolls to it',
      'update_tier(segmentId, level, data) — updates pricing tier',
      'add_segment(name) — adds new customer segment (max 3)',
      'get_project_details(projectId) — view project details',
      'send_project_message(projectId, message) — message customer',
      'preview_website() — shows current draft state',
      'publish_website() — requires confirmation',
    ],
  };
}
```

### 2.3 Tool Definitions

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/
export const tenantAgentTools = [
  // Navigation
  navigateToDashboardSection, // T1: navigate_to_section

  // Website editing
  resolveVocabulary, // T1: resolve user phrase → BlockType
  updateSection, // T2: update section content
  updateBranding, // T2: update colors/fonts (live immediately)
  reorderSections, // T1: change section order
  addSection, // T2: add new section
  removeSection, // T2: remove section

  // Segments & Tiers
  addSegment, // T2: add customer segment (max 3)
  updateSegment, // T2: update segment details
  updateTier, // T2: update tier pricing/features

  // Publishing
  previewWebsite, // T1: show current draft
  publishWebsite, // T3: publish all changes (requires confirm)
  discardDraft, // T3: discard all changes (requires confirm)

  // Project management
  getProjectDetails, // T1: view project
  sendProjectMessage, // T2: message customer
  updateProjectStatus, // T2: change project status

  // Marketing (merged from marketing-agent)
  generateCopy, // T1: generate copy suggestions
  improveSectionCopy, // T2: rewrite section with better copy
];
```

### 2.4 Update Section Tool (Key Implementation)

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/update-section.ts
export const updateSectionTool = createTool({
  name: 'update_section',
  description:
    'Update a website section. Agent should call resolve_vocabulary first if user used natural language.',
  trustTier: 'T2',
  parameters: z.object({
    blockType: z.nativeEnum(BlockType),
    content: z.record(z.unknown()).describe('Block-specific content'),
    segmentId: z.string().optional().describe('If section is segment-scoped'),
  }),
  execute: async (params, context) => {
    const parseResult = updateSectionSchema.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.format() };
    }

    const { blockType, content, segmentId } = parseResult.data;
    const tenantId = context.state.get<string>('tenantId');

    // Find or create section
    const existing = await prisma.sectionContent.findFirst({
      where: { tenantId, blockType, segmentId: segmentId ?? null },
    });

    // Save current version for undo
    const versions = existing?.versions ? JSON.parse(existing.versions as string) : [];
    if (existing) {
      versions.unshift({
        content: existing.content,
        timestamp: new Date().toISOString(),
        author: 'previous',
      });
      if (versions.length > 5) versions.pop();
    }

    const section = await prisma.sectionContent.upsert({
      where: {
        tenantId_segmentId_blockType: {
          tenantId,
          segmentId: segmentId ?? null,
          blockType,
        },
      },
      create: {
        tenantId,
        segmentId,
        blockType,
        content,
        isDraft: true,
        versions: JSON.stringify(versions),
      },
      update: {
        content,
        isDraft: true,
        versions: JSON.stringify(versions),
        updatedAt: new Date(),
      },
    });

    // Return state for agent context (pitfall #52)
    return {
      success: true,
      data: {
        sectionId: section.id,
        blockType: section.blockType,
        isDraft: true,
        canUndo: versions.length > 0,
        summary: `Updated ${blockType} section. Preview showing changes.`,
        // Instruction for dashboard
        dashboardAction: {
          type: 'SCROLL_TO_SECTION',
          blockType,
          highlight: true,
        },
      },
    };
  },
});
```

### 2.5 Dashboard Communication Protocol

The agent sends dashboard actions via tool responses:

```typescript
// Dashboard action types
type DashboardAction =
  | { type: 'SCROLL_TO_SECTION'; blockType: BlockType; highlight?: boolean }
  | { type: 'NAVIGATE'; section: 'website' | 'bookings' | 'projects' | 'settings' }
  | { type: 'SHOW_PREVIEW'; fullScreen?: boolean }
  | { type: 'SHOW_CONFIRMATION'; message: string; confirmAction: string }
  | { type: 'REFRESH' };

// Frontend handler
function handleAgentResponse(response: AgentResponse) {
  const dashboardAction = response.data?.dashboardAction;
  if (!dashboardAction) return;

  switch (dashboardAction.type) {
    case 'SCROLL_TO_SECTION':
      scrollToSection(dashboardAction.blockType);
      if (dashboardAction.highlight) {
        highlightSection(dashboardAction.blockType);
      }
      break;
    case 'NAVIGATE':
      router.push(`/dashboard/${dashboardAction.section}`);
      break;
    // ... etc
  }
}
```

### 2.6 Deprecate Old Agents

After Tenant Agent is deployed and validated:

```bash
# Archive old agent code (don't delete yet)
git mv server/src/agent-v2/deploy/concierge server/src/agent-v2/archive/concierge
git mv server/src/agent-v2/deploy/storefront server/src/agent-v2/archive/storefront
git mv server/src/agent-v2/deploy/marketing server/src/agent-v2/archive/marketing

# Delete Cloud Run services
gcloud run services delete concierge-agent --region=us-central1 --quiet
gcloud run services delete storefront-agent --region=us-central1 --quiet
gcloud run services delete marketing-agent --region=us-central1 --quiet
```

### 2.7 Validation Gate

**Before proceeding to Phase 3:**

- [ ] Tenant Agent deployed to Cloud Run
- [ ] All 4 merged agents' capabilities work
- [ ] Vocabulary resolution works in conversation
- [ ] Dashboard actions (scroll, navigate) work
- [ ] Old agents deleted from Cloud Run

---

## Phase 3: Unified Customer Agent (Week 5)

### 3.1 Agent Consolidation

Merge 2 agents into 1:

```
BEFORE:
- booking-agent (customer booking)
- project-hub-agent (customer view)

AFTER:
- customer-agent (booking + project)
```

### 3.2 Customer Agent Context

```typescript
interface CustomerAgentContext {
  customer: {
    name: string;
    email: string;
  };
  tenant: {
    name: string;
    slug: string;
  };
  segments: Array<{
    name: string;
    tiers: Array<{
      level: TierLevel;
      name: string;
      price: number;
      description: string;
    }>;
  }>;
  existingProjects: Array<{
    id: string;
    status: string;
    segmentName: string;
    tierName: string;
    unreadFromTenant: number;
  }>;
  capabilities: string[];
}
```

### 3.3 Customer Agent Tools

```typescript
export const customerAgentTools = [
  // Booking (merged from booking-agent)
  viewSegments, // T1: see available segments
  viewTiers, // T1: see tiers for a segment
  startBooking, // T2: begin booking flow
  selectTier, // T2: choose tier
  submitBooking, // T3: complete booking (requires confirm)

  // Project (merged from project-hub-agent)
  viewProject, // T1: see project details
  sendMessage, // T2: message tenant
  viewTimeline, // T1: see project timeline
  viewDeliverables, // T1: see uploaded files
];
```

### 3.4 Validation Gate

**Before declaring MVP complete:**

- [ ] Customer Agent deployed to Cloud Run
- [ ] Booking flow works end-to-end
- [ ] Project messaging works
- [ ] Old booking-agent and project-hub-agent deleted

---

## Phase 4: Cleanup & Polish (Week 5 continued)

### 4.1 Remove Deprecated Code

```typescript
// Delete old columns after migration
// Migration: remove_legacy_landing_page_columns.sql
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfig";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraft";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraftVersion";
```

### 4.2 Update Frontend

- Remove Visual Editor component
- Update dashboard to use agent-controlled preview
- Add section highlighting for agent scroll actions
- Add confirmation dialogs for T2/T3 actions

### 4.3 Test Specifications (Kieran's Addition)

Explicit test file locations and coverage requirements:

#### Schema & Service Tests

```
server/test/services/
├── segment.service.test.ts           # NEW
│   ├── createSegment() - creates with 3 tiers
│   ├── createSegment() - enforces max 3 segments per tenant
│   ├── updateSegment() - multi-tenant isolation
│   └── deleteSegment() - cascades to tiers/sections
│
├── tier.service.test.ts              # NEW
│   ├── updateTier() - validates TierFeaturesSchema
│   ├── updateTier() - enforces exactly 3 levels per segment
│   └── getTiersBySegment() - orders by GOOD/BETTER/BEST
│
├── section-content.service.test.ts   # NEW
│   ├── createSection() - validates against SectionContentSchema
│   ├── updateSection() - adds version history (max 5)
│   ├── publishSection() - sets isDraft=false, publishedAt
│   ├── undoSection() - restores from version history
│   └── getSection() - multi-tenant isolation
│
└── vocabulary-embedding.service.test.ts  # NEW
    ├── resolveBlockType("my bio") - returns ABOUT
    ├── resolveBlockType("hero banner") - returns HERO
    ├── resolveBlockType("asdf gibberish") - returns null (low confidence)
    └── seedCanonicalVocabulary() - idempotent
```

#### Agent Integration Tests

```
server/test/agent-v2/
├── tenant-agent.integration.test.ts  # NEW
│   ├── context injection - includes segments, tiers, sections
│   ├── update_section tool - validates content schema
│   ├── update_section tool - returns dashboardAction
│   ├── publish_website tool - requires T3 confirmation
│   └── vocabulary resolution - "update my bio" → ABOUT
│
├── customer-agent.integration.test.ts  # NEW
│   ├── context injection - includes tiers, existing projects
│   ├── startBooking tool - creates booking with tier
│   ├── sendMessage tool - multi-tenant isolation
│   └── viewProject tool - only shows customer's projects
│
└── multi-tenant-isolation.test.ts    # NEW
    ├── Tenant A cannot see Tenant B's segments
    ├── Tenant A cannot update Tenant B's sections
    ├── Customer cannot access tenant tools
    └── Cross-tenant vocabulary doesn't leak
```

#### E2E Tests

```
apps/web/e2e/
├── tenant-dashboard-agent.spec.ts    # NEW
│   ├── "update my about section" → section updates, preview scrolls
│   ├── "add a testimonial" → testimonials section updated
│   ├── "publish my website" → confirmation dialog → published
│   └── "undo that change" → previous version restored
│
└── customer-booking-agent.spec.ts    # NEW
    ├── "show me your packages" → displays tiers
    ├── "I want the professional package" → booking flow starts
    └── "message the photographer" → project message sent
```

#### Contract Tests

```
packages/contracts/test/
├── tier-features.schema.test.ts      # NEW
│   ├── validates valid features array
│   ├── rejects features > max(15)
│   └── rejects invalid feature structure
│
├── section-content.schema.test.ts    # NEW
│   ├── validates each blockType's content schema
│   ├── discriminated union correctly routes
│   └── rejects unknown blockType
│
└── version-history.schema.test.ts    # NEW
    ├── validates version entry structure
    ├── enforces max 5 entries
    └── validates datetime format
```

#### Coverage Targets

| Area                   | Target         | Rationale                        |
| ---------------------- | -------------- | -------------------------------- |
| Zod schemas            | 100%           | Type safety is non-negotiable    |
| Service methods        | 90%            | Business logic must be tested    |
| Agent tools            | 80%            | Include happy path + error cases |
| E2E flows              | Critical paths | Agent chat → visible change      |
| Multi-tenant isolation | 100%           | Security requirement             |

---

## Success Metrics

| Metric                 | Target        | How to Measure                     |
| ---------------------- | ------------- | ---------------------------------- |
| Vocabulary accuracy    | >90%          | Test corpus of 100 phrases         |
| Agent response time    | <3s p95       | Cloud Run metrics                  |
| Zero delegation losses | 0             | No agent-to-agent handoffs         |
| Maintenance burden     | 3 agents vs 6 | Codebase count                     |
| Cold start frequency   | Rare          | Only Research Agent scales to zero |

---

## Risk Mitigation

| Risk                      | Mitigation                                                     |
| ------------------------- | -------------------------------------------------------------- |
| pgvector complexity       | Start with 40 canonical phrases; expand based on logged misses |
| Agent token overflow      | Context compression at 6000 tokens; summarize old sections     |
| Customer/tenant data leak | Separate agents with strict context boundaries                 |
| Rollback needed           | Keep archived agent code for 30 days                           |

---

## Timeline Summary (Revised)

| Phase        | Duration           | Deliverables                                               |
| ------------ | ------------------ | ---------------------------------------------------------- |
| **Phase 0**  | Week 1             | Schema + pgvector + default segment + TypeScript contracts |
| **Phase 1**  | Week 2             | Vocabulary embedding service + schema tests                |
| **Phase 2a** | Days 1-2 (Week 3)  | Tenant Agent foundation                                    |
| **Phase 2b** | Days 3-5 (Week 3)  | Merge Storefront Agent                                     |
| **Phase 2c** | Days 6-8 (Week 4)  | Merge Marketing + Concierge                                |
| **Phase 2d** | Days 9-10 (Week 4) | Merge Project Hub (tenant view)                            |
| **Phase 3**  | Week 5             | Unified Customer Agent                                     |
| **Phase 4**  | Weeks 5-6          | Cleanup + polish + comprehensive tests                     |

**Total: 5-6 weeks** (Revised after plan review incorporating Kieran's TypeScript/testing additions)

---

## Deferred to Future Releases

1. **A2A API** — External agents query tenant offerings
2. **Reference site crawling** — Extract patterns from URLs
3. **Multi-option variants** — Generate 2-3 options per section
4. **Smart auto-approve** — Risk-based confirmation logic
5. **Inline click-to-edit** — Double-click to edit copy directly

---

## References

- **Brainstorm:** `docs/brainstorms/2026-01-30-semantic-storefront-architecture-brainstorm.md`
- **Agent pitfalls:** `docs/solutions/agent-issues/`
- **Wrapper format fix:** `docs/solutions/STOREFRONT-AGENT-PUBLISH-WRAPPER-FIX.md`
- **Tool state returns:** `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md`

---

## Revision History

| Date       | Reviewer   | Changes                                                        |
| ---------- | ---------- | -------------------------------------------------------------- |
| 2026-01-30 | Initial    | Created after clarifying session                               |
| 2026-01-30 | DHH        | Recommended 2-week cut (declined in favor of full plan)        |
| 2026-01-30 | Kieran     | TypeScript contracts, phased consolidation, explicit tests     |
| 2026-01-30 | Simplicity | Scored 3/10 (noted, proceeding with full plan per user choice) |

**User decision:** Option C: Full + Revisions (5-6 weeks)

---

_Plan revised after plan review on 2026-01-30_
_Generated with Claude Code_
