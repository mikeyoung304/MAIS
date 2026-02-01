---
title: 'feat: Dual-Schema Agent Architecture'
type: feat
date: 2026-01-31
status: in_progress
brainstorm: docs/brainstorms/2026-01-31-dual-schema-agent-architecture-brainstorm.md
last_updated: 2026-02-01
---

## Progress Update (2026-02-01)

### Phase 1 COMPLETE ✅ (P0 Bug Fix)

The critical "asking known questions" bug is fixed via the Agent-First architecture:

**What was done:**

1. Created `ContextBuilderService` at `server/src/services/context-builder.service.ts`
2. Added `forbiddenSlots` slot-policy (enterprise-grade, key-based not phrase-matching)
3. Wired bootstrap into `VertexAgentService.createSession()` - agent now receives full context at session start
4. Updated tenant-agent system prompt with Session State section
5. Added 10 regression tests at `server/src/services/context-builder.service.test.ts`
6. Deleted legacy systems: XState onboarding, AdvisorMemoryService, 1.4GB archive folder

**Key files modified:**

- `server/src/services/vertex-agent.service.ts` (P0 fix at session creation)
- `server/src/services/context-builder.service.ts` (new - single source of truth)
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (slot-policy instructions)

**What's next:** Phase 2-4 below are still pending. The dual-schema system (websiteSchema + tenantProfile columns) was not implemented - we chose a simpler path using existing `branding.discoveryFacts` storage with the `forbiddenSlots` pattern.

**Architecture decision:** See `docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md`

---

# Dual-Schema Agent Architecture

## Overview

Implement a **dual-schema system** for the tenant agent where:

1. **Website Schema** - Rigid, completion-driven tracker for 5 storefront sections
2. **Tenant Profile** - Flexible, insight-driven personality bank

The agent maintains deep knowledge of both schemas, injected at session start, with explicit write tools for updates. This solves the P0 agent loop issue and enables conversational sorting during onboarding.

## Problem Statement

**Current Problems (from migration debt analysis):**

- Agent asks "What do you do?" repeatedly even after user answers (P0 loop)
- Context builder fetches 4 endpoints but NOT discovery facts
- No structured completion tracking for storefront sections
- Discovery facts scattered in `tenant.branding.discoveryFacts` without organization
- No way to know what's filled vs empty on the storefront

**Root Cause:** Agent relies on prompt instruction to call `get_known_facts` tool, but LLMs don't reliably follow this every turn. Facts must be **injected** at session start.

## Proposed Solution

### Two Schemas, Clear Separation

| Schema             | Purpose                  | Storage                                  | Structure                           |
| ------------------ | ------------------------ | ---------------------------------------- | ----------------------------------- |
| **Website Schema** | Track section completion | `tenant.websiteSchema` (new JSON column) | Rigid: 5 sections with known fields |
| **Tenant Profile** | Personality bank         | `tenant.tenantProfile` (new JSON column) | Flexible: append-only categories    |

### Agent Access Pattern

**Read:** Both schemas injected into system prompt at session start via context builder

**Write:** Two focused tools:

- `update_section(section, content)` → Updates website schema
- `add_insight(category, insight)` → Appends to tenant profile

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SESSION START                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Context Builder (server/src/agent-v2/deploy/tenant/src/context-builder.ts) │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Fetches in parallel:                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ /tenant-     │  │ /tenant-     │  │ /website-    │  │ /tenant-     │    │
│  │ context      │  │ sections     │  │ schema       │  │ profile      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                             │                │                              │
│                             ▼                ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SYSTEM PROMPT INJECTION                          │   │
│  │                                                                     │   │
│  │  ## Website Completion: 45%                                         │   │
│  │  - Hero: accepted ✓                                                 │   │
│  │  - About: draft (awaiting confirmation)                             │   │
│  │  - Services: empty ← PRIORITY                                       │   │
│  │  - FAQ: empty                                                       │   │
│  │  - Reviews: empty                                                   │   │
│  │                                                                     │   │
│  │  ## Tenant Profile                                                  │   │
│  │  - Voice: casual, avoids corporate speak                            │   │
│  │  - Style: candid over posed                                         │   │
│  │  - Ideal client: couples wanting real moments                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONVERSATION TURN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: "I'm a wedding photographer in Austin. Candid stuff, not posed."    │
│                                                                             │
│  Agent thinks:                                                              │
│  - Website: Need to update hero section → DRAFT                            │
│  - Profile: voice=casual, style=candid, business.location=Austin          │
│  - FAQ: "Everyone asks if I travel" → add to FAQ items                     │
│                                                                             │
│  Agent calls:                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ update_section   │  │ add_insight      │  │ update_section   │          │
│  │ (hero, {...})    │  │ (voice, casual)  │  │ (faq, {...})     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
│  Tools return:                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ { success: true, section: "hero", state: "draft",                   │  │
│  │   completionScore: 55, priority: "services",                        │  │
│  │   dashboardAction: { type: 'SCROLL_TO_SECTION', blockType: 'hero' }}│  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Agent responds:                                                            │
│  "Got it—candid wedding photography, Austin. Take a look at your hero."   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Database Schema & Storage

**Files to modify:**

- `server/prisma/schema.prisma`
- `server/src/routes/internal-agent.routes.ts`

**Database migration:**

```prisma
// server/prisma/schema.prisma - Add to Tenant model

model Tenant {
  // ... existing fields

  // NEW: Dual-schema system
  websiteSchema    Json?   // Website completion tracker
  websiteSchemaVersion Int @default(0) // Optimistic locking
  tenantProfile    Json?   // Personality bank
  tenantProfileVersion Int @default(0)
}
```

**Website Schema structure:**

```typescript
// packages/contracts/src/website-schema.ts

import { z } from 'zod';

export const SectionStateSchema = z.enum(['empty', 'draft', 'accepted', 'skipped']);
export type SectionState = z.infer<typeof SectionStateSchema>;

export const HeroSectionSchema = z.object({
  state: SectionStateSchema,
  headline: z.string().nullable(),
  subheadline: z.string().nullable(),
});

export const AboutSectionSchema = z.object({
  state: SectionStateSchema,
  headline: z.string().nullable(),
  copy: z.string().nullable(),
});

export const ServicesSectionSchema = z.object({
  state: SectionStateSchema,
  headline: z.string().nullable(),
  packages: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      price: z.string().nullable(),
    })
  ),
});

export const FaqSectionSchema = z.object({
  state: SectionStateSchema,
  items: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
});

export const ReviewsSectionSchema = z.object({
  state: SectionStateSchema,
  items: z.array(
    z.object({
      author: z.string(),
      content: z.string(),
      rating: z.number().optional(),
    })
  ),
});

export const WebsiteSchemaSchema = z.object({
  completion: z.object({
    score: z.number().min(0).max(100),
    priority: z.enum(['services', 'hero', 'about', 'faq', 'reviews']).nullable(),
  }),
  sections: z.object({
    hero: HeroSectionSchema,
    about: AboutSectionSchema,
    services: ServicesSectionSchema,
    faq: FaqSectionSchema,
    reviews: ReviewsSectionSchema,
  }),
});

export type WebsiteSchema = z.infer<typeof WebsiteSchemaSchema>;

// Section weights for completion score
export const SECTION_WEIGHTS = {
  services: 40, // Required
  hero: 25, // Strongly recommended
  about: 20, // Strongly recommended
  faq: 10, // Optional
  reviews: 5, // Optional
} as const;

export function calculateCompletionScore(sections: WebsiteSchema['sections']): number {
  let score = 0;
  for (const [key, weight] of Object.entries(SECTION_WEIGHTS)) {
    const section = sections[key as keyof typeof sections];
    if (section.state === 'accepted') {
      score += weight;
    } else if (section.state === 'draft') {
      score += weight * 0.5; // Half credit for draft
    }
    // empty and skipped = 0
  }
  return Math.round(score);
}

export function determinePriority(sections: WebsiteSchema['sections']): string | null {
  // Services is required, always priority if empty
  if (sections.services.state === 'empty') return 'services';

  // Then recommended sections
  if (sections.hero.state === 'empty') return 'hero';
  if (sections.about.state === 'empty') return 'about';

  // Then optional
  if (sections.faq.state === 'empty') return 'faq';
  if (sections.reviews.state === 'empty') return 'reviews';

  return null; // All done!
}
```

**Tenant Profile structure:**

```typescript
// packages/contracts/src/tenant-profile.ts

import { z } from 'zod';

export const TenantProfileSchema = z.object({
  voice: z
    .object({
      tone: z.string().nullable(),
      avoids: z.array(z.string()),
      preferences: z.array(z.string()),
    })
    .optional(),

  story: z
    .object({
      origin: z.string().nullable(),
      why: z.string().nullable(),
      journey: z.string().nullable(),
    })
    .optional(),

  style: z
    .object({
      approach: z.string().nullable(),
      signature: z.string().nullable(),
      dislikes: z.array(z.string()),
    })
    .optional(),

  clients: z
    .object({
      ideal: z.string().nullable(),
      demographics: z.string().nullable(),
      redFlags: z.array(z.string()),
    })
    .optional(),

  business: z
    .object({
      location: z.string().nullable(),
      travelRadius: z.string().nullable(),
      pricing: z.string().nullable(),
    })
    .optional(),

  quirks: z.array(z.string()).optional(),

  rawInsights: z
    .array(
      z.object({
        source: z.string(),
        timestamp: z.string(),
        quote: z.string(),
      })
    )
    .optional(),
});

export type TenantProfile = z.infer<typeof TenantProfileSchema>;
```

#### Phase 2: Backend API Endpoints

**Files to create/modify:**

- `server/src/routes/internal-agent.routes.ts` (add new endpoints)

**New endpoints:**

```typescript
// GET /v1/internal/agent/website-schema
// Returns current website schema for context injection

router.get('/v1/internal/agent/website-schema', async (req, res) => {
  const { tenantId } = req.query;
  const tenant = await tenantRepo.findById(tenantId);

  // Return existing or initialize default
  const websiteSchema = tenant.websiteSchema || createDefaultWebsiteSchema();

  res.json({
    success: true,
    websiteSchema,
    version: tenant.websiteSchemaVersion || 0,
  });
});

// GET /v1/internal/agent/tenant-profile
// Returns current tenant profile for context injection

router.get('/v1/internal/agent/tenant-profile', async (req, res) => {
  const { tenantId } = req.query;
  const tenant = await tenantRepo.findById(tenantId);

  const tenantProfile = tenant.tenantProfile || createDefaultTenantProfile();

  res.json({
    success: true,
    tenantProfile,
    version: tenant.tenantProfileVersion || 0,
  });
});

// POST /v1/internal/agent/update-section
// Updates a section in website schema

router.post('/v1/internal/agent/update-section', async (req, res) => {
  const { tenantId, section, content, expectedVersion } = req.body;

  // Validate section name
  const validSections = ['hero', 'about', 'services', 'faq', 'reviews'];
  if (!validSections.includes(section)) {
    return res.status(400).json({ success: false, error: 'Invalid section' });
  }

  const tenant = await tenantRepo.findById(tenantId);
  const currentVersion = tenant.websiteSchemaVersion || 0;

  // Optimistic locking check
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return res.status(409).json({
      success: false,
      error: 'Version conflict',
      currentVersion,
    });
  }

  // Get or initialize schema
  const websiteSchema = tenant.websiteSchema || createDefaultWebsiteSchema();

  // Update section
  websiteSchema.sections[section] = {
    ...websiteSchema.sections[section],
    ...content,
    state: content.state || 'draft', // Default to draft on update
  };

  // Recalculate completion
  websiteSchema.completion = {
    score: calculateCompletionScore(websiteSchema.sections),
    priority: determinePriority(websiteSchema.sections),
  };

  // Save
  await tenantRepo.update(tenantId, {
    websiteSchema,
    websiteSchemaVersion: currentVersion + 1,
  });

  res.json({
    success: true,
    section,
    state: websiteSchema.sections[section].state,
    completionScore: websiteSchema.completion.score,
    priority: websiteSchema.completion.priority,
    version: currentVersion + 1,
    dashboardAction: {
      type: 'SCROLL_TO_SECTION',
      blockType: section,
      highlight: true,
    },
  });
});

// POST /v1/internal/agent/add-insight
// Appends insight to tenant profile

router.post('/v1/internal/agent/add-insight', async (req, res) => {
  const { tenantId, category, insight, expectedVersion } = req.body;

  // Valid categories
  const validCategories = [
    'voice',
    'story',
    'style',
    'clients',
    'business',
    'quirks',
    'rawInsights',
  ];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ success: false, error: 'Invalid category' });
  }

  const tenant = await tenantRepo.findById(tenantId);
  const currentVersion = tenant.tenantProfileVersion || 0;

  // Get or initialize profile
  const tenantProfile = tenant.tenantProfile || createDefaultTenantProfile();

  // Handle different category types
  if (category === 'quirks') {
    tenantProfile.quirks = tenantProfile.quirks || [];
    if (!tenantProfile.quirks.includes(insight)) {
      tenantProfile.quirks.push(insight);
    }
  } else if (category === 'rawInsights') {
    tenantProfile.rawInsights = tenantProfile.rawInsights || [];
    tenantProfile.rawInsights.push({
      source: 'onboarding',
      timestamp: new Date().toISOString(),
      quote: insight,
    });
  } else {
    // Object categories (voice, story, style, clients, business)
    tenantProfile[category] = tenantProfile[category] || {};
    if (typeof insight === 'object') {
      Object.assign(tenantProfile[category], insight);
    } else {
      // String insight - try to parse or store as note
      tenantProfile[category].note = insight;
    }
  }

  // Save
  await tenantRepo.update(tenantId, {
    tenantProfile,
    tenantProfileVersion: currentVersion + 1,
  });

  res.json({
    success: true,
    category,
    profileSummary: summarizeTenantProfile(tenantProfile),
    version: currentVersion + 1,
  });
});

// POST /v1/internal/agent/mark-section-accepted
// Moves section from draft to accepted

router.post('/v1/internal/agent/mark-section-accepted', async (req, res) => {
  const { tenantId, section } = req.body;

  const tenant = await tenantRepo.findById(tenantId);
  const websiteSchema = tenant.websiteSchema || createDefaultWebsiteSchema();

  if (websiteSchema.sections[section].state !== 'draft') {
    return res.status(400).json({
      success: false,
      error: `Section ${section} is not in draft state`,
    });
  }

  websiteSchema.sections[section].state = 'accepted';
  websiteSchema.completion = {
    score: calculateCompletionScore(websiteSchema.sections),
    priority: determinePriority(websiteSchema.sections),
  };

  await tenantRepo.update(tenantId, {
    websiteSchema,
    websiteSchemaVersion: (tenant.websiteSchemaVersion || 0) + 1,
  });

  res.json({
    success: true,
    section,
    state: 'accepted',
    completionScore: websiteSchema.completion.score,
    priority: websiteSchema.completion.priority,
  });
});
```

#### Phase 3: Agent Tools

**Files to create:**

- `server/src/agent-v2/deploy/tenant/src/tools/schema-tools.ts`

**Files to modify:**

- `server/src/agent-v2/deploy/tenant/src/tools/index.ts`

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/schema-tools.ts

import { FunctionTool } from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ToolContext } from '../types';
import { getTenantId, callMaisApi, logger } from '../utils';

// =============================================================================
// UPDATE SECTION TOOL
// =============================================================================

const UpdateSectionParams = z.object({
  section: z
    .enum(['hero', 'about', 'services', 'faq', 'reviews'])
    .describe('The section to update'),
  content: z
    .object({
      headline: z.string().optional().describe('Section headline'),
      subheadline: z.string().optional().describe('Section subheadline (hero only)'),
      copy: z.string().optional().describe('Section body copy (about only)'),
      packages: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            price: z.string().optional(),
          })
        )
        .optional()
        .describe('Service packages (services only)'),
      items: z.array(z.any()).optional().describe('FAQ or review items'),
    })
    .describe('Content to update in the section'),
});

export const updateSectionTool = new FunctionTool({
  name: 'update_section',
  description: `Update a storefront section. Sets section to DRAFT state.

Use this when:
- User provides content for their website
- Agent generates copy for approval
- Updating any of the 5 sections: hero, about, services, faq, reviews

After updating, ask user to confirm. When confirmed, call mark_section_accepted.

Returns: section state, completion score, priority, dashboardAction for scrolling.`,

  parameters: UpdateSectionParams,

  execute: async (params, context: ToolContext | undefined) => {
    // Line 1: Zod validation (pitfall #62)
    const parseResult = UpdateSectionParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { success: false, error: 'No tenant context' };
    }

    const { section, content } = parseResult.data;

    logger.info({ tenantId, section }, '[TenantAgent] update_section called');

    try {
      const result = await callMaisApi('/update-section', tenantId, {
        section,
        content,
      });

      return {
        success: true,
        section,
        state: result.state,
        completionScore: result.completionScore,
        priority: result.priority,
        version: result.version,
        dashboardAction: result.dashboardAction,
        note: `Section "${section}" updated to DRAFT. Ask user to confirm: "Did I get that right?"`,
      };
    } catch (err) {
      logger.error({ err, tenantId, section }, '[TenantAgent] update_section failed');
      return { success: false, error: String(err) };
    }
  },
});

// =============================================================================
// ADD INSIGHT TOOL
// =============================================================================

const AddInsightParams = z.object({
  category: z
    .enum(['voice', 'story', 'style', 'clients', 'business', 'quirks', 'rawInsights'])
    .describe('Category to add insight to'),
  insight: z
    .union([z.string(), z.record(z.string())])
    .describe('The insight to store. String for quirks/rawInsights, object for others.'),
});

export const addInsightTool = new FunctionTool({
  name: 'add_insight',
  description: `Store a personality insight in the tenant profile.

Use this when extracting valuable information from user conversation:
- voice: tone preferences, words to avoid
- story: origin story, why they do this work
- style: their unique approach, dislikes
- clients: ideal clients, demographics, red flags
- business: location, travel radius, pricing tier
- quirks: fun personal details (array of strings)
- rawInsights: verbatim quotes worth saving

Call this silently during conversation - no need to confirm with user.
Light acknowledgment: "Good FAQ material there—noted."`,

  parameters: AddInsightParams,

  execute: async (params, context: ToolContext | undefined) => {
    const parseResult = AddInsightParams.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Invalid parameters',
        details: parseResult.error.format(),
      };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { success: false, error: 'No tenant context' };
    }

    const { category, insight } = parseResult.data;

    logger.info({ tenantId, category }, '[TenantAgent] add_insight called');

    try {
      const result = await callMaisApi('/add-insight', tenantId, {
        category,
        insight,
      });

      return {
        success: true,
        category,
        profileSummary: result.profileSummary,
        version: result.version,
        // No dashboardAction - this is silent
      };
    } catch (err) {
      logger.error({ err, tenantId, category }, '[TenantAgent] add_insight failed');
      return { success: false, error: String(err) };
    }
  },
});

// =============================================================================
// MARK SECTION ACCEPTED TOOL
// =============================================================================

const MarkSectionAcceptedParams = z.object({
  section: z
    .enum(['hero', 'about', 'services', 'faq', 'reviews'])
    .describe('The section to mark as accepted'),
});

export const markSectionAcceptedTool = new FunctionTool({
  name: 'mark_section_accepted',
  description: `Mark a section as accepted after user confirms.

Call when user says: "looks good", "perfect", "yes", "that works", etc.
Moves section from DRAFT to ACCEPTED state.

Returns updated completion score.`,

  parameters: MarkSectionAcceptedParams,

  execute: async (params, context: ToolContext | undefined) => {
    const parseResult = MarkSectionAcceptedParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters' };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { success: false, error: 'No tenant context' };
    }

    const { section } = parseResult.data;

    logger.info({ tenantId, section }, '[TenantAgent] mark_section_accepted called');

    try {
      const result = await callMaisApi('/mark-section-accepted', tenantId, {
        section,
      });

      return {
        success: true,
        section,
        state: 'accepted',
        completionScore: result.completionScore,
        priority: result.priority,
        note: result.priority
          ? `Great! ${section} is locked in. Let's work on ${result.priority} next.`
          : 'All sections complete! Ready to publish.',
      };
    } catch (err) {
      logger.error({ err, tenantId, section }, '[TenantAgent] mark_section_accepted failed');
      return { success: false, error: String(err) };
    }
  },
});

// =============================================================================
// SKIP SECTION TOOL
// =============================================================================

const SkipSectionParams = z.object({
  section: z.enum(['faq', 'reviews']).describe('The optional section to skip'),
});

export const skipSectionTool = new FunctionTool({
  name: 'skip_section',
  description: `Skip an optional section (FAQ or Reviews only).

Use when user explicitly declines: "I don't have testimonials yet", "Skip the FAQ".
Only FAQ and Reviews can be skipped - hero, about, services cannot.`,

  parameters: SkipSectionParams,

  execute: async (params, context: ToolContext | undefined) => {
    const parseResult = SkipSectionParams.safeParse(params);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid parameters' };
    }

    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { success: false, error: 'No tenant context' };
    }

    const { section } = parseResult.data;

    try {
      const result = await callMaisApi('/update-section', tenantId, {
        section,
        content: { state: 'skipped' },
      });

      return {
        success: true,
        section,
        state: 'skipped',
        completionScore: result.completionScore,
        priority: result.priority,
        note: `Skipped ${section}. You can add it later anytime.`,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
```

#### Phase 4: Context Builder Updates

**Files to modify:**

- `server/src/agent-v2/deploy/tenant/src/context-builder.ts`

```typescript
// server/src/agent-v2/deploy/tenant/src/context-builder.ts

// Add to parallel fetch (around line 161)
const [
  tenantResult,
  segmentsResult,
  sectionsResult,
  projectsResult,
  websiteSchemaResult, // NEW
  tenantProfileResult, // NEW
] = await Promise.all([
  callMaisApi('/tenant-context', tenantId),
  callMaisApi('/tenant-segments', tenantId),
  callMaisApi('/tenant-sections', tenantId),
  callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
  callMaisApi('/website-schema', tenantId), // NEW
  callMaisApi('/tenant-profile', tenantId), // NEW
]);

// Add new function to format website schema for injection
function formatWebsiteSchemaForPrompt(schema: WebsiteSchema): string {
  const { completion, sections } = schema;

  const sectionLines = Object.entries(sections)
    .map(([name, section]) => {
      const stateEmoji = {
        accepted: '✓',
        draft: '(awaiting confirmation)',
        empty: '← needs content',
        skipped: '(skipped)',
      }[section.state];

      const isPriority = completion.priority === name;
      const priorityMarker = isPriority ? ' ← PRIORITY' : '';

      return `- ${capitalize(name)}: ${section.state} ${stateEmoji}${priorityMarker}`;
    })
    .join('\n');

  return `## Website Completion: ${completion.score}%

${sectionLines}

${completion.priority ? `Focus on: ${completion.priority} (required)` : 'All sections complete!'}`;
}

// Add new function to format tenant profile for injection
function formatTenantProfileForPrompt(profile: TenantProfile): string {
  const lines: string[] = [];

  if (profile.voice?.tone) {
    lines.push(`- Voice: ${profile.voice.tone}`);
    if (profile.voice.avoids?.length) {
      lines.push(`  - Avoids: ${profile.voice.avoids.join(', ')}`);
    }
  }

  if (profile.style?.approach) {
    lines.push(`- Style: ${profile.style.approach}`);
  }

  if (profile.clients?.ideal) {
    lines.push(`- Ideal client: ${profile.clients.ideal}`);
  }

  if (profile.business?.location) {
    lines.push(`- Location: ${profile.business.location}`);
  }

  if (profile.quirks?.length) {
    lines.push(`- Quirks: ${profile.quirks.join(', ')}`);
  }

  if (lines.length === 0) {
    return `## Tenant Profile

No insights stored yet. Listen for personality cues during conversation.`;
  }

  return `## Tenant Profile

${lines.join('\n')}`;
}

// Update buildContextPromptSection to include both schemas
function buildContextPromptSection(context: TenantAgentContext): string {
  return `
${formatWebsiteSchemaForPrompt(context.websiteSchema)}

${formatTenantProfileForPrompt(context.tenantProfile)}

## Current Storefront Sections
${context.sections.map((s) => `- ${s.id}: ${s.headline || '[placeholder]'}`).join('\n')}

## Active Projects (${context.projects.length})
${context.projects.map((p) => `- ${p.customerName}: ${p.status}`).join('\n') || 'No active projects'}
`;
}
```

#### Phase 5: System Prompt Updates

**Files to modify:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

Key changes to system prompt:

```markdown
## Core Behavior

### The Interview Pattern (Onboarding)

During onboarding, you're filling out two schemas:

1. **Website Schema** - Your 5 storefront sections (hero, about, services, FAQ, reviews)
2. **Tenant Profile** - Personality insights for future copy generation

**Your context shows:**

- Which sections are empty/draft/accepted
- Your completion score (weighted by importance)
- Your priority section to focus on
- Known profile insights

**EVERY TURN during onboarding:**

1. Check your context - you already know many things
2. Skip questions for information you already have
3. Extract insights from ANY answer - user might drop FAQ gold while answering about section
4. Light acknowledgment when routing: "Great FAQ material—noted. Keep going..."
5. After storing, generate content → show preview → get confirmation

### Conversational Sorting

Your superpower: extract value from rants.

User answers About question but mentions travel policy:
→ Call add_insight(business, {travelRadius: "100 miles"})
→ Call update_section(faq, {items: [{q: "Do you travel?", a: "..."}]})
→ Say: "Good FAQ material there—noted. Back to your story..."

**Route information to the right bucket:**

- Business facts → tenant profile
- Copy/content → website sections
- Personal quirks → profile.quirks
- Verbatim quotes → profile.rawInsights

### Section Tools

**update_section(section, content):**

- Updates section, sets to DRAFT
- Returns completion score, priority
- Always scroll to show: "Take a look"
- Ask for confirmation: "Did I get that right?"

**mark_section_accepted(section):**

- Call when user confirms ("looks good", "perfect", "yes")
- Moves DRAFT → ACCEPTED
- Returns new priority

**add_insight(category, insight):**

- Silently stores personality insights
- Categories: voice, story, style, clients, business, quirks, rawInsights
- Light acknowledgment only

**skip_section(section):**

- For FAQ/reviews only
- Use when user explicitly declines

### Completion Flow

1. Services (40%) - REQUIRED, can't publish without
2. Hero (25%) - Strongly recommended
3. About (20%) - Strongly recommended
4. FAQ (10%) - Optional, suggest
5. Reviews (5%) - Optional, suggest

When completion = 100%: "Your storefront is ready! Want to publish?"
```

#### Phase 6: Frontend Confirmation Flow

**Files to modify:**

- `apps/web/src/components/agent/AgentPanel.tsx`
- `apps/web/src/hooks/useConciergeChat.ts`

Add UI for section confirmation:

```typescript
// apps/web/src/components/agent/SectionConfirmation.tsx

interface SectionConfirmationProps {
  section: string;
  onConfirm: () => void;
  onEdit: () => void;
}

export function SectionConfirmation({ section, onConfirm, onEdit }: SectionConfirmationProps) {
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-sage/10 rounded-lg">
      <span className="text-sm text-text-muted">
        {capitalize(section)} section updated
      </span>
      <Button
        size="sm"
        variant="sage"
        onClick={onConfirm}
        className="ml-auto"
      >
        <Check className="w-4 h-4 mr-1" />
        Looks good
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
      >
        Edit
      </Button>
    </div>
  );
}
```

### Migration Strategy

**Existing tenants:**

1. On first agent session after deploy, check if `websiteSchema` is null
2. If null, initialize from existing `landingPageConfig`:
   - Parse current sections
   - Set state = 'accepted' for sections with non-placeholder content
   - Set state = 'empty' for placeholder sections
   - Calculate initial completion score

3. Migrate `branding.discoveryFacts` to `tenantProfile`:
   - Map existing fact keys to profile categories
   - Move `businessType` → `business.type`
   - Move `dreamClient` → `clients.ideal`
   - etc.

**Migration script:**

```typescript
// scripts/migrate-to-dual-schema.ts

async function migrateTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  // Initialize website schema from landing page config
  const websiteSchema = initializeWebsiteSchemaFromConfig(tenant.landingPageConfig);

  // Migrate discovery facts to profile
  const discoveryFacts = tenant.branding?.discoveryFacts || {};
  const tenantProfile = migrateFactsToProfile(discoveryFacts);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      websiteSchema,
      websiteSchemaVersion: 1,
      tenantProfile,
      tenantProfileVersion: 1,
    },
  });
}
```

## Acceptance Criteria

### Functional Requirements

- [ ] Agent never asks questions it already has answers to (context injection works)
- [ ] Onboarding completes with ≤5 focused questions
- [ ] Completion score accurately reflects storefront state
- [ ] Section updates show in preview immediately
- [ ] Confirmation flow works (chat "looks good" OR UI click)
- [ ] Profile captures insights from natural conversation
- [ ] Light acknowledgment when routing info ("Good FAQ—noted")

### Non-Functional Requirements

- [ ] Context builder adds <100ms latency (parallel fetch)
- [ ] Optimistic locking prevents race conditions
- [ ] Schema validation catches malformed data
- [ ] Migration handles all existing tenants

### Quality Gates

- [ ] Unit tests for completion score calculation
- [ ] Unit tests for priority determination
- [ ] Integration tests for tool → API → database flow
- [ ] E2E test: Complete onboarding in <5 turns

## Success Metrics

| Metric              | Target      | Measurement                                |
| ------------------- | ----------- | ------------------------------------------ |
| Repeated questions  | 0           | Count same question asked twice in session |
| Onboarding turns    | ≤5          | Turns to reach 80% completion              |
| Completion accuracy | 100%        | Score matches actual section states        |
| Profile richness    | ≥5 insights | Insights captured per onboarding session   |

## Dependencies & Prerequisites

- [ ] Database migration for new columns
- [ ] Contracts package updated with schema types
- [ ] Context builder refactored for parallel fetch
- [ ] System prompt updated for new behavior

## Risk Analysis & Mitigation

| Risk                             | Likelihood | Impact | Mitigation                                     |
| -------------------------------- | ---------- | ------ | ---------------------------------------------- |
| Migration corrupts existing data | Low        | High   | Backup before migration, test on staging       |
| Performance regression           | Medium     | Medium | Profile parallel fetch, add caching            |
| Agent still loops                | Medium     | High   | Thorough testing, fallback to tool-based check |
| Optimistic lock conflicts        | Low        | Low    | Retry logic in frontend                        |

## Future Considerations

- **Profile-informed generation:** Use profile insights to generate copy in user's voice
- **Pattern learning:** Track successful patterns across sessions
- **Memory Bank integration:** Persist cross-session with Vertex AI Memory Bank
- **A/B testing:** Compare onboarding completion rates

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-01-31-dual-schema-agent-architecture-brainstorm.md`
- Migration debt: `docs/issues/2026-01-31-phase-4-migration-debt.md`
- Reality baseline: `docs/design/REALITY_BASELINE_AI_AGENT_EXPERIENCE.md`
- Context builder: `server/src/agent-v2/deploy/tenant/src/context-builder.ts:161-166`
- Discovery tools: `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts`

### External Research

- Amazon PARSE Framework: Schema optimization for LLM extraction
- Slot Filling Pattern: Guide conversation to fill structured data
- LangGraph State Machines: Completion tracking patterns
- Vertex AI ADK: Session state prefixes (user:, app:, temp:)

### Compound Engineering References

- `agent-native-architecture` skill: Context injection patterns
- `agent-native-reviewer` agent: Action parity checklist
- `be-clear-and-direct` reference: Prompt clarity guidelines
- `agent-execution-patterns` reference: Completion signals

---

_Plan ready for implementation. Run `/workflows:work` to begin._
