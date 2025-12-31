# Agent-Powered Tenant Onboarding System

> Transform signup from "fill out forms" to "have a conversation with your AI business consultant"

**Created**: 2025-12-31
**Updated**: 2025-12-31 (Post-Review: Quality-First Revision)
**Status**: Ready for Implementation
**Complexity**: A LOT (Major Feature - Quality-First Implementation)

---

## Executive Summary

Replace passive dashboard onboarding with an **AI-guided conversational journey** where the Growth Assistant acts as a business consultant, helping tenants:

1. **Discover** their business identity and ideal clients
2. **Research** their local market (competitors, pricing, opportunities)
3. **Design & Price** their service offerings (combined for natural flow)
4. **Position** with marketing messaging and storefront copy
5. **Celebrate** when ready (Stripe decoupled — connect later)

**The key shift**: Instead of "here's your empty dashboard, figure it out," we say "let's build your business together."

**Quality-First Principles** (from review):

- Build industry benchmarks first, web search as enhancement
- Event sourcing for complete audit trail and debugging
- Formal state machine for provable correctness
- Live preview panel for magical UX
- Advisor memory across sessions

---

## Problem Statement

### Current State

When a tenant signs up today:

```
Signup → Empty Dashboard → Amber "Connect Stripe" warning → Confusion
```

**Pain points:**

- Generic "Welcome back" greeting (not a true welcome moment)
- Stripe pushed immediately (creates pressure before they've built anything)
- Growth Assistant waits passively for user to engage
- No guidance on service design, pricing, or positioning
- Users must figure out packages, pricing, and messaging alone
- High cognitive load → low activation → churn

### Desired State

```
Signup → Welcome Message → Agent-Guided Conversation → Configured Business → Celebrate!
```

**The experience:**

1. **Welcome message** in Growth Assistant (inline, not modal)
2. **Discovery phase** — Agent learns about their business through conversation
3. **Market research** — Agent researches local competition and pricing
4. **Service design with pricing** — Combined for natural flow
5. **Marketing positioning** — Agent generates storefront copy
6. **Celebration** — Storefront preview, Stripe offered but not required

---

## Architecture Overview

### Quality-First Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ONBOARDING AGENT SYSTEM (Quality-First)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐         ┌──────────────────────┐                 │
│  │    Next.js UI        │────────▶│    Express API       │                 │
│  │                      │         │                      │                 │
│  │ • GrowthAssistant    │         │ /v1/agent/chat       │                 │
│  │ • LivePreviewPanel   │◀───────▶│ /v1/agent/onboarding │                 │
│  │ • AdvisorMemoryCtx   │   WS    │                      │                 │
│  └──────────────────────┘         └──────────┬───────────┘                 │
│                                              │                              │
│                                              ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      ORCHESTRATOR + STATE MACHINE                     │  │
│  │                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────┐    │  │
│  │   │                    XState Formal Machine                     │    │  │
│  │   │                                                              │    │  │
│  │   │  discovery ──▶ market_research ──▶ service_design ──▶ done  │    │  │
│  │   │      │              │                    │              │    │    │  │
│  │   │      └──── SKIP ────┴────── SKIP ───────┴──── SKIP ────┘    │    │  │
│  │   │                                                              │    │  │
│  │   │  • Guards validate transitions                               │    │  │
│  │   │  • Actions persist state + emit events                       │    │  │
│  │   │  • Retries with exponential backoff                          │    │  │
│  │   └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────┐    │  │
│  │   │                    Event Sourcing Layer                      │    │  │
│  │   │                                                              │    │  │
│  │   │  OnboardingEvent[] → projectState() → OnboardingState       │    │  │
│  │   │                                                              │    │  │
│  │   │  • Complete audit trail of every decision                    │    │  │
│  │   │  • Replay for debugging production issues                    │    │  │
│  │   │  • Analytics: "What questions take longest?"                 │    │  │
│  │   └─────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                              │                              │
│                                              ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         TOOL LAYER (Consolidated)                     │  │
│  │                                                                       │  │
│  │   Core Tools (3)              External Tools           Support Tools  │  │
│  │   ─────────────────           ──────────────           ─────────────  │  │
│  │   • update_onboarding_state   • search_market          • get_state    │  │
│  │   • upsert_services           • get_benchmarks         • get_preview  │  │
│  │   • update_storefront                                                 │  │
│  │                                                                       │  │
│  │   All tools use discriminated unions for exhaustive error handling   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                              │                              │
│                                              ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      OBSERVABILITY (OpenTelemetry)                    │  │
│  │                                                                       │  │
│  │   • Trace entire onboarding sessions across API calls                │  │
│  │   • Span per tool execution with timing                              │  │
│  │   • Connect frontend interactions to backend operations              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Simplified Phase Flow (4 User Phases, Not 6)

Based on reviewer feedback, we've consolidated phases for more natural conversation:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         USER EXPERIENCE FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SIGNUP                                                                     │
│      │                                                                       │
│      ▼                                                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                         1. DISCOVERY                                  │  │
│   │                                                                       │  │
│   │   "Tell me about your business..."                                   │  │
│   │   • Business type, location, niche                                   │  │
│   │   • Ideal client, experience, goals                                  │  │
│   │   • Store via update_onboarding_state tool                           │  │
│   │                                                                       │  │
│   │   Advisor Memory: Summarize and embed for future reference           │  │
│   └──────────────────────────────────────┬───────────────────────────────┘  │
│                                          │                                   │
│                                          ▼                                   │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      2. MARKET RESEARCH                               │  │
│   │                                                                       │  │
│   │   "Let me research your local market..."                             │  │
│   │                                                                       │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │  FALLBACK-FIRST ARCHITECTURE                                 │   │  │
│   │   │                                                              │   │  │
│   │   │  1. Load industry benchmarks (ALWAYS available)              │   │  │
│   │   │  2. Attempt web search (enhancement)                         │   │  │
│   │   │  3. Merge results, prefer local data when available          │   │  │
│   │   │                                                              │   │  │
│   │   │  "I couldn't find specific Austin data, but wedding          │   │  │
│   │   │   photographers typically charge $2-8k nationally."          │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                       │  │
│   │   Live Preview: Show competitor examples if available                │  │
│   └──────────────────────────────────────┬───────────────────────────────┘  │
│                                          │                                   │
│                                          ▼                                   │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                 3. SERVICE DESIGN + PRICING (Combined)                │  │
│   │                                                                       │  │
│   │   "Let's design your packages. For elopements, I'm thinking          │  │
│   │    a 'Micro' package at $1,500 based on the Austin market..."        │  │
│   │                                                                       │  │
│   │   • Recommend segment structure                                      │  │
│   │   • Design tiers with pricing IN THE SAME CONVERSATION              │  │
│   │   • Create via upsert_services tool (atomic segment + packages)      │  │
│   │                                                                       │  │
│   │   Live Preview: Storefront updates in real-time as packages created  │  │
│   └──────────────────────────────────────┬───────────────────────────────┘  │
│                                          │                                   │
│                                          ▼                                   │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    4. MARKETING + CELEBRATION                         │  │
│   │                                                                       │  │
│   │   "Let me write some copy for your storefront..."                    │  │
│   │   • Generate hero, about sections                                    │  │
│   │   • Apply via update_storefront tool                                 │  │
│   │                                                                       │  │
│   │   "Your storefront is ready! Take a look: [preview link]             │  │
│   │    When you're ready to accept bookings, just say 'connect           │  │
│   │    payments' and I'll help you with Stripe."                         │  │
│   │                                                                       │  │
│   │   NOTE: Stripe is DECOUPLED. Onboarding complete when storefront     │  │
│   │   looks good. Payments are a separate, lower-pressure conversation.  │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### 1. Database Schema (Event Sourcing)

```prisma
// schema.prisma additions

model Tenant {
  // ... existing fields

  // Onboarding tracking (simple fields for queries)
  onboardingPhase       String?   @default("discovery")
  onboardingCompletedAt DateTime?
  onboardingVersion     Int       @default(0)  // Optimistic locking

  // Events are the source of truth
  onboardingEvents      OnboardingEvent[]
}

// Event sourcing: Every decision is an event
model OnboardingEvent {
  id        String   @id @default(cuid())
  tenantId  String
  eventType String   // DISCOVERY_ANSWER, MARKET_SEARCH_COMPLETE, SEGMENT_CREATED, etc.
  payload   Json     // Event-specific data
  timestamp DateTime @default(now())
  version   Int      // For ordering

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, timestamp])
  @@index([tenantId, version])
}
```

### 2. Type System (Zod Schemas + Discriminated Unions)

```typescript
// packages/contracts/src/schemas/onboarding.schema.ts

import { z } from 'zod';

// ============ Phase Enum ============
export const OnboardingPhaseSchema = z.enum([
  'discovery',
  'market_research',
  'service_design', // Includes pricing
  'marketing',
  'complete',
]);
export type OnboardingPhase = z.infer<typeof OnboardingPhaseSchema>;

// ============ Discovery Data ============
export const DiscoveryDataSchema = z.object({
  businessType: z.string(),
  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string().default('US'),
  }),
  niche: z.string(),
  experience: z.string(),
  idealClient: z.string(),
  goals: z.array(z.string()),
});
export type DiscoveryData = z.infer<typeof DiscoveryDataSchema>;

// ============ Market Research Data ============
export const MarketResearchDataSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      priceRange: z.string().optional(),
      strengths: z.string().optional(),
      source: z.enum(['web_search', 'industry_benchmark']),
    })
  ),
  pricingBenchmarks: z.object({
    low: z.number(),
    mid: z.number(),
    high: z.number(),
    source: z.enum(['local_search', 'industry_average']),
  }),
  insights: z.array(z.string()),
  opportunities: z.array(z.string()),
  searchedAt: z.coerce.date(),
  isFallback: z.boolean().default(false),
});
export type MarketResearchData = z.infer<typeof MarketResearchDataSchema>;

// ============ Tool Result Types (Discriminated Unions) ============

// Every tool result is exhaustively typed
export type UpdateOnboardingStateResult =
  | { success: true; phase: OnboardingPhase; summary: string }
  | { success: false; error: 'INCOMPLETE_DATA'; missingFields: string[] }
  | { success: false; error: 'INVALID_LOCATION'; suggestion: string }
  | { success: false; error: 'CONCURRENT_MODIFICATION'; currentVersion: number };

export type SearchMarketResult =
  | { success: true; data: MarketResearchData }
  | { success: false; error: 'SEARCH_FAILED'; fallbackData: MarketResearchData }
  | { success: false; error: 'RATE_LIMITED'; retryAfter: number };

export type UpsertServicesResult =
  | {
      success: true;
      segmentId: string;
      packages: { id: string; name: string; price: number }[];
      previewUrl: string;
    }
  | { success: false; error: 'SEGMENT_EXISTS'; existingSlug: string }
  | { success: false; error: 'INVALID_TIER_COUNT'; allowed: { min: number; max: number } }
  | { success: false; error: 'DUPLICATE_PACKAGE_NAME'; duplicateName: string };

export type UpdateStorefrontResult =
  | { success: true; previewUrl: string }
  | { success: false; error: 'INVALID_COPY_LENGTH'; field: string; maxLength: number }
  | { success: false; error: 'LANDING_PAGE_CONFIG_CORRUPT'; recoveryAction: string };

// ============ Event Types ============
export const OnboardingEventTypeSchema = z.enum([
  // Discovery
  'DISCOVERY_QUESTION_ASKED',
  'DISCOVERY_ANSWER_RECEIVED',
  'DISCOVERY_COMPLETED',

  // Market Research
  'MARKET_SEARCH_INITIATED',
  'MARKET_SEARCH_COMPLETED',
  'MARKET_SEARCH_FAILED_WITH_FALLBACK',

  // Service Design
  'SEGMENT_CREATED',
  'PACKAGE_CREATED',
  'PRICE_SET',
  'SERVICE_DESIGN_COMPLETED',

  // Marketing
  'STOREFRONT_COPY_GENERATED',
  'STOREFRONT_COPY_APPLIED',

  // Lifecycle
  'PHASE_SKIPPED',
  'ONBOARDING_COMPLETED',
  'ONBOARDING_RESUMED',
]);
```

### 3. State Machine (XState)

```typescript
// server/src/agent/onboarding/state-machine.ts

import { createMachine, assign } from 'xstate';
import { OnboardingPhase, DiscoveryData, MarketResearchData } from '@macon/contracts';

interface OnboardingContext {
  tenantId: string;
  version: number;
  discovery: DiscoveryData | null;
  marketResearch: MarketResearchData | null;
  createdSegments: string[];
  createdPackages: string[];
  errors: { phase: string; error: string; timestamp: Date }[];
}

type OnboardingEvent =
  | { type: 'COMPLETE_DISCOVERY'; data: DiscoveryData }
  | { type: 'COMPLETE_MARKET_RESEARCH'; data: MarketResearchData }
  | { type: 'COMPLETE_SERVICE_DESIGN'; segmentIds: string[]; packageIds: string[] }
  | { type: 'COMPLETE_MARKETING' }
  | { type: 'SKIP_PHASE' }
  | { type: 'GO_BACK' }
  | { type: 'ERROR'; error: string };

export const onboardingMachine = createMachine({
  id: 'onboarding',
  initial: 'discovery',
  context: {
    tenantId: '',
    version: 0,
    discovery: null,
    marketResearch: null,
    createdSegments: [],
    createdPackages: [],
    errors: [],
  } as OnboardingContext,

  states: {
    discovery: {
      on: {
        COMPLETE_DISCOVERY: {
          target: 'market_research',
          actions: [assign({ discovery: (_, event) => event.data }), 'persistState', 'emitEvent'],
        },
        SKIP_PHASE: {
          target: 'market_research',
          actions: ['emitSkipEvent'],
        },
      },
      onEntry: ['loadAdvisorMemory'],
    },

    market_research: {
      initial: 'loading_benchmarks',
      states: {
        loading_benchmarks: {
          invoke: {
            src: 'loadIndustryBenchmarks',
            onDone: {
              target: 'searching',
              actions: assign({ marketResearch: (_, event) => event.data }),
            },
            onError: { target: 'searching' }, // Continue without benchmarks
          },
        },
        searching: {
          invoke: {
            src: 'searchMarket',
            onDone: {
              target: 'presenting',
              actions: assign({
                marketResearch: (ctx, event) => ({
                  ...ctx.marketResearch,
                  ...event.data,
                  // Prefer local data when available
                  isFallback: event.data.source === 'industry_average',
                }),
              }),
            },
            onError: { target: 'presenting' }, // Use benchmarks as fallback
          },
        },
        presenting: {
          on: {
            COMPLETE_MARKET_RESEARCH: '#onboarding.service_design',
          },
        },
      },
      on: {
        GO_BACK: 'discovery',
        SKIP_PHASE: {
          target: 'service_design',
          actions: ['emitSkipEvent'],
        },
      },
    },

    service_design: {
      // Includes pricing - combined for natural conversation flow
      on: {
        COMPLETE_SERVICE_DESIGN: {
          target: 'marketing',
          actions: [
            assign({
              createdSegments: (_, event) => event.segmentIds,
              createdPackages: (_, event) => event.packageIds,
            }),
            'persistState',
            'emitEvent',
          ],
        },
        GO_BACK: 'market_research',
        SKIP_PHASE: {
          target: 'marketing',
          actions: ['emitSkipEvent'],
        },
      },
    },

    marketing: {
      on: {
        COMPLETE_MARKETING: {
          target: 'complete',
          actions: ['persistState', 'emitCompletionEvent'],
        },
        GO_BACK: 'service_design',
        SKIP_PHASE: {
          target: 'complete',
          actions: ['emitSkipEvent', 'emitCompletionEvent'],
        },
      },
    },

    complete: {
      type: 'final',
      onEntry: ['celebrateCompletion'],
    },
  },
});
```

### 4. Consolidated Tools (3 Core + 2 External)

Based on DHH's feedback, we consolidate 8+ tools into 3 core tools:

```typescript
// server/src/agent/tools/onboarding-tools.ts

import { z } from 'zod';
import {
  UpdateOnboardingStateResult,
  UpsertServicesResult,
  UpdateStorefrontResult,
  DiscoveryDataSchema,
} from '@macon/contracts';

// ============ TOOL 1: update_onboarding_state ============
// Handles all state updates: discovery, market research storage
export const updateOnboardingStateTool = {
  name: 'update_onboarding_state',
  description: 'Store onboarding data (discovery answers, market research, etc.)',
  trustTier: 'T1' as const,

  inputSchema: z.object({
    phase: z.enum(['discovery', 'market_research']),
    data: z.union([DiscoveryDataSchema, MarketResearchDataSchema]),
  }),

  async execute(
    context: OnboardingToolContext,
    input: z.infer<typeof this.inputSchema>
  ): Promise<UpdateOnboardingStateResult> {
    return withOnboardingSpan('tool.update_onboarding_state', { phase: input.phase }, async () => {
      // Transaction with optimistic locking
      return await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: context.tenantId },
          select: { onboardingVersion: true },
        });

        // Append event (source of truth)
        await tx.onboardingEvent.create({
          data: {
            tenantId: context.tenantId,
            eventType:
              input.phase === 'discovery' ? 'DISCOVERY_COMPLETED' : 'MARKET_SEARCH_COMPLETED',
            payload: input.data,
            version: tenant.onboardingVersion + 1,
          },
        });

        // Update phase pointer (for queries)
        const nextPhase = input.phase === 'discovery' ? 'market_research' : 'service_design';
        await tx.tenant.update({
          where: { id: context.tenantId, onboardingVersion: tenant.onboardingVersion },
          data: {
            onboardingPhase: nextPhase,
            onboardingVersion: tenant.onboardingVersion + 1,
          },
        });

        return {
          success: true,
          phase: nextPhase,
          summary: `Saved ${input.phase} data. Moving to ${nextPhase}.`,
        };
      });
    });
  },
};

// ============ TOOL 2: upsert_services ============
// Creates segment + packages with pricing in one atomic operation
export const upsertServicesTool = {
  name: 'upsert_services',
  description: 'Create a service segment with packages and pricing (atomic operation)',
  trustTier: 'T2' as const,

  inputSchema: z.object({
    segment: z.object({
      name: z.string().min(2).max(50),
      description: z.string().max(200),
    }),
    packages: z
      .array(
        z.object({
          name: z.string().min(2).max(50),
          description: z.string().max(500),
          price: z.number().min(0), // Price included! Not a separate phase
          tierOrder: z.number().min(1).max(10),
          duration: z.string().optional(), // "2 hours", "Full day"
        })
      )
      .min(1)
      .max(10),
  }),

  async execute(
    context: OnboardingToolContext,
    input: z.infer<typeof this.inputSchema>
  ): Promise<UpsertServicesResult> {
    return withOnboardingSpan(
      'tool.upsert_services',
      { segmentName: input.segment.name },
      async () => {
        const slug = slugify(input.segment.name);

        // Check for existing segment
        const existing = await prisma.segment.findFirst({
          where: { tenantId: context.tenantId, slug },
        });
        if (existing) {
          return { success: false, error: 'SEGMENT_EXISTS', existingSlug: slug };
        }

        // Atomic creation
        const segment = await prisma.$transaction(async (tx) => {
          const seg = await tx.segment.create({
            data: {
              tenantId: context.tenantId,
              name: input.segment.name,
              slug,
              description: input.segment.description,
              heroTitle: input.segment.name,
            },
          });

          const packages = await Promise.all(
            input.packages.map((pkg) =>
              tx.package.create({
                data: {
                  tenantId: context.tenantId,
                  segmentId: seg.id,
                  name: pkg.name,
                  slug: slugify(pkg.name),
                  description: pkg.description,
                  basePrice: pkg.price,
                  groupingOrder: pkg.tierOrder,
                  active: true,
                },
              })
            )
          );

          // Emit events
          await tx.onboardingEvent.create({
            data: {
              tenantId: context.tenantId,
              eventType: 'SEGMENT_CREATED',
              payload: { segmentId: seg.id, name: seg.name },
              version: await getNextVersion(tx, context.tenantId),
            },
          });

          for (const pkg of packages) {
            await tx.onboardingEvent.create({
              data: {
                tenantId: context.tenantId,
                eventType: 'PACKAGE_CREATED',
                payload: { packageId: pkg.id, name: pkg.name, price: pkg.basePrice },
                version: await getNextVersion(tx, context.tenantId),
              },
            });
          }

          return { segment: seg, packages };
        });

        return {
          success: true,
          segmentId: segment.segment.id,
          packages: segment.packages.map((p) => ({ id: p.id, name: p.name, price: p.basePrice })),
          previewUrl: `${config.webUrl}/t/${context.tenantSlug}`,
        };
      }
    );
  },
};

// ============ TOOL 3: update_storefront ============
// Updates hero, about, and other storefront copy
export const updateStorefrontTool = {
  name: 'update_storefront',
  description: 'Update storefront copy (hero, about sections)',
  trustTier: 'T2' as const,

  inputSchema: z.object({
    heroTitle: z.string().max(100),
    heroSubtitle: z.string().max(200),
    aboutText: z.string().max(1000),
  }),

  async execute(
    context: OnboardingToolContext,
    input: z.infer<typeof this.inputSchema>
  ): Promise<UpdateStorefrontResult> {
    // Implementation updates landingPageConfig
    // See existing landing page patterns

    // Emit event
    await prisma.onboardingEvent.create({
      data: {
        tenantId: context.tenantId,
        eventType: 'STOREFRONT_COPY_APPLIED',
        payload: input,
        version: await getNextVersion(prisma, context.tenantId),
      },
    });

    return {
      success: true,
      previewUrl: `${config.webUrl}/t/${context.tenantSlug}`,
    };
  },
};
```

### 5. Industry Benchmarks (Fallback-First)

Build reliable fallbacks BEFORE web search integration:

```typescript
// server/src/agent/onboarding/industry-benchmarks.ts

// Static, reliable data that works when web search fails
export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  wedding_photographer: {
    pricingRange: { low: 1500, mid: 4000, high: 8000 },
    typicalPackages: [
      { name: 'Elopement', priceRange: '1000-2500', hours: '2-4' },
      { name: 'Half Day', priceRange: '2000-4000', hours: '4-6' },
      { name: 'Full Day', priceRange: '3500-8000', hours: '8-10' },
    ],
    marketInsights: [
      'Most couples book 8-12 months in advance',
      'Engagement sessions are popular add-ons',
      'Second shooters typically add $500-1000',
    ],
  },
  portrait_photographer: {
    pricingRange: { low: 200, mid: 500, high: 1500 },
    typicalPackages: [
      { name: 'Mini Session', priceRange: '150-300', hours: '0.5' },
      { name: 'Standard Session', priceRange: '300-600', hours: '1-2' },
      { name: 'Extended Session', priceRange: '500-1500', hours: '2-4' },
    ],
    marketInsights: [
      'Family sessions peak in fall for holiday cards',
      'Mini sessions are great for building portfolio',
      'Print sales can double session revenue',
    ],
  },
  therapist: {
    pricingRange: { low: 100, mid: 175, high: 300 },
    typicalPackages: [
      { name: 'Individual Session', priceRange: '100-200', duration: '50 min' },
      { name: 'Couples Session', priceRange: '150-300', duration: '75 min' },
      { name: 'Intake Assessment', priceRange: '175-350', duration: '90 min' },
    ],
    marketInsights: [
      'Sliding scale options increase accessibility',
      'Package deals (6 sessions) improve retention',
      'Insurance reimbursement affects pricing strategy',
    ],
  },
  life_coach: {
    pricingRange: { low: 100, mid: 250, high: 500 },
    typicalPackages: [
      { name: 'Discovery Call', priceRange: '0-50', duration: '30 min' },
      { name: 'Single Session', priceRange: '100-300', duration: '60 min' },
      { name: 'Monthly Package', priceRange: '400-1500', duration: '4 sessions' },
    ],
    marketInsights: [
      'Free discovery calls convert at 30-50%',
      '3-month packages have best retention',
      'Group coaching scales income effectively',
    ],
  },
  wedding_planner: {
    pricingRange: { low: 2000, mid: 5000, high: 15000 },
    typicalPackages: [
      { name: 'Day-of Coordination', priceRange: '1500-3000', scope: 'Final month + day' },
      { name: 'Partial Planning', priceRange: '3000-6000', scope: '3-6 months' },
      { name: 'Full Planning', priceRange: '5000-15000', scope: '12+ months' },
    ],
    marketInsights: [
      'Day-of coordination is entry point for many',
      'Venue partnerships drive referrals',
      'Luxury market has higher margins',
    ],
  },
};

// Get benchmarks for a business type
export function getIndustryBenchmarks(businessType: string): IndustryBenchmark {
  const normalized = normalizeBusinessType(businessType);
  return INDUSTRY_BENCHMARKS[normalized] || getGenericBenchmarks();
}

function normalizeBusinessType(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('wedding') && lower.includes('photo')) return 'wedding_photographer';
  if (lower.includes('portrait') || lower.includes('headshot')) return 'portrait_photographer';
  if (lower.includes('therap') || lower.includes('counsel')) return 'therapist';
  if (lower.includes('coach')) return 'life_coach';
  if (lower.includes('wedding') && lower.includes('plan')) return 'wedding_planner';

  return 'generic';
}
```

### 6. Market Search with Graceful Fallback

```typescript
// server/src/agent/onboarding/market-search.ts

export async function searchMarketWithFallback(
  businessType: string,
  location: { city: string; state: string }
): Promise<MarketResearchData> {
  // ALWAYS start with benchmarks (reliable baseline)
  const benchmarks = getIndustryBenchmarks(businessType);

  // Attempt web search (enhancement, not dependency)
  try {
    const searchResults = await Promise.allSettled([
      webSearch(`${businessType} ${location.city} ${location.state} pricing 2025`),
      webSearch(`${businessType} rates ${location.city}`),
      webSearch(`${businessType} near ${location.city} ${location.state}`),
    ]);

    const successful = searchResults
      .filter(
        (r): r is PromiseFulfilledResult<SearchResult[]> =>
          r.status === 'fulfilled' && r.value.length > 0
      )
      .flatMap((r) => r.value);

    if (successful.length === 0) {
      // Graceful fallback: use benchmarks with clear messaging
      return {
        competitors: benchmarks.typicalPackages.map((p) => ({
          name: `Typical ${p.name}`,
          priceRange: p.priceRange,
          source: 'industry_benchmark' as const,
        })),
        pricingBenchmarks: {
          ...benchmarks.pricingRange,
          source: 'industry_average' as const,
        },
        insights: benchmarks.marketInsights,
        opportunities: [
          `Local market data unavailable - these are industry averages`,
          `Consider researching ${location.city} competitors directly`,
        ],
        searchedAt: new Date(),
        isFallback: true,
      };
    }

    // Merge local search results with benchmarks
    const localData = analyzeSearchResults(successful, businessType);

    return {
      competitors: localData.competitors.map((c) => ({ ...c, source: 'web_search' as const })),
      pricingBenchmarks: {
        low: localData.pricingRange?.low ?? benchmarks.pricingRange.low,
        mid: localData.pricingRange?.mid ?? benchmarks.pricingRange.mid,
        high: localData.pricingRange?.high ?? benchmarks.pricingRange.high,
        source: localData.pricingRange ? ('local_search' as const) : ('industry_average' as const),
      },
      insights: [...localData.insights, ...benchmarks.marketInsights.slice(0, 2)],
      opportunities: localData.opportunities,
      searchedAt: new Date(),
      isFallback: false,
    };
  } catch (error) {
    logger.warn({ error, businessType, location }, 'Market search failed, using benchmarks');

    // Graceful degradation
    return {
      competitors: [],
      pricingBenchmarks: {
        ...benchmarks.pricingRange,
        source: 'industry_average' as const,
      },
      insights: benchmarks.marketInsights,
      opportunities: ['Market search unavailable - using industry averages'],
      searchedAt: new Date(),
      isFallback: true,
    };
  }
}
```

### 7. Advisor Memory (Cross-Session Context)

```typescript
// server/src/agent/onboarding/advisor-memory.ts

/**
 * Advisor Memory: The agent remembers context across sessions
 *
 * "Welcome back! Last time we were designing your elopement packages -
 *  you liked 'Adventure' and 'All-Day Adventure' but weren't sure
 *  about the entry-level name. Any thoughts?"
 */

interface AdvisorMemory {
  // Short-term: recent messages
  recentMessages: ChatMessage[];

  // Long-term: summarized context
  summaries: {
    discovery: string; // "Wedding photographer in Austin, 5 years, specializes in elopements"
    marketContext: string; // "Mid-market positioning, $3-5k range, limited elopement competition"
    preferences: string; // "Prefers adventurous naming, wants premium but accessible"
    decisions: string; // "Created Elopements segment with 3 packages"
    pendingQuestions: string; // "Still deciding on entry-level package name"
  };
}

export class AdvisorMemoryService {
  async getMemory(tenantId: string): Promise<AdvisorMemory> {
    // Load events and project into memory
    const events = await prisma.onboardingEvent.findMany({
      where: { tenantId },
      orderBy: { version: 'asc' },
    });

    return this.projectMemory(events);
  }

  async summarizeForResume(tenantId: string): Promise<string> {
    const memory = await this.getMemory(tenantId);

    if (!memory.summaries.discovery) {
      return "Let's start by learning about your business. What kind of services do you offer?";
    }

    const parts = [];

    if (memory.summaries.discovery) {
      parts.push(`I remember: ${memory.summaries.discovery}`);
    }

    if (memory.summaries.decisions) {
      parts.push(`So far we've: ${memory.summaries.decisions}`);
    }

    if (memory.summaries.pendingQuestions) {
      parts.push(`We were working on: ${memory.summaries.pendingQuestions}`);
    }

    return `Welcome back! ${parts.join(' ')} Ready to continue?`;
  }

  private projectMemory(events: OnboardingEvent[]): AdvisorMemory {
    const memory: AdvisorMemory = {
      recentMessages: [],
      summaries: {
        discovery: '',
        marketContext: '',
        preferences: '',
        decisions: '',
        pendingQuestions: '',
      },
    };

    for (const event of events) {
      switch (event.eventType) {
        case 'DISCOVERY_COMPLETED':
          const d = event.payload as DiscoveryData;
          memory.summaries.discovery =
            `${d.businessType} in ${d.location.city}, ${d.location.state}. ` +
            `${d.experience} experience. Specializes in ${d.niche}. ` +
            `Ideal client: ${d.idealClient}.`;
          break;

        case 'MARKET_SEARCH_COMPLETED':
          const m = event.payload as MarketResearchData;
          memory.summaries.marketContext =
            `Pricing range: $${m.pricingBenchmarks.low}-${m.pricingBenchmarks.high}. ` +
            `${m.competitors.length} competitors found. ` +
            `Opportunities: ${m.opportunities.slice(0, 2).join(', ')}.`;
          break;

        case 'SEGMENT_CREATED':
          memory.summaries.decisions += `Created "${event.payload.name}" segment. `;
          break;

        case 'PACKAGE_CREATED':
          memory.summaries.decisions += `Added "${event.payload.name}" package at $${event.payload.price}. `;
          break;
      }
    }

    return memory;
  }
}
```

### 8. Live Preview Panel

```tsx
// apps/web/src/components/onboarding/LivePreviewPanel.tsx

'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface LivePreviewPanelProps {
  tenantSlug: string;
  isOnboarding: boolean;
}

/**
 * Live Preview Panel
 *
 * Shows the storefront updating in real-time as the agent creates packages.
 * "Magical UX" - users see their business come to life.
 */
export function LivePreviewPanel({ tenantSlug, isOnboarding }: LivePreviewPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for storefront updates via WebSocket or polling
  useEffect(() => {
    if (!isOnboarding) return;

    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 3000); // Refresh every 3s during onboarding

    return () => clearInterval(interval);
  }, [isOnboarding]);

  if (!isOnboarding) return null;

  return (
    <div className="fixed left-0 top-16 bottom-0 w-1/2 border-r bg-neutral-50 overflow-hidden hidden lg:block">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Live Preview</span>
          <span className="text-xs text-text-tertiary">Updates as you build</span>
        </div>
      </div>

      <iframe
        key={refreshKey}
        src={`/t/${tenantSlug}?preview=true`}
        className="w-full h-full border-0"
        title="Storefront Preview"
      />
    </div>
  );
}
```

### 9. System Prompt (Single, Unified)

Based on DHH's feedback — one excellent prompt, not phase-specific prompts:

```typescript
// server/src/agent/prompts/onboarding-system-prompt.ts

export function buildOnboardingPrompt(
  phase: OnboardingPhase,
  memory: AdvisorMemory,
  benchmarks: IndustryBenchmark | null
): string {
  return `
You are a business consultant helping a new HANDLED member set up their business.
Your goal is to guide them through a natural conversation that results in a complete storefront.

## Your Personality
- Warm, encouraging, and knowledgeable
- Like talking to a smart friend who happens to know business
- Celebrate their wins, acknowledge their expertise
- Never condescending or robotic
- Ask ONE question at a time
- Confirm before creating anything

## What You Know About This Business
${memory.summaries.discovery || 'Still learning - start by asking about their business.'}

## Market Context
${memory.summaries.marketContext || 'Market research pending.'}

## What We've Done Together
${memory.summaries.decisions || 'Just getting started!'}

## Current Phase: ${phase}
${getPhaseGuidance(phase)}

## Available Tools
- update_onboarding_state: Save discovery/research data
- upsert_services: Create segment with packages AND prices (combined!)
- update_storefront: Apply hero and about copy
- search_market: Research local competition (has reliable fallbacks)

## Key Rules
1. Discovery: Ask about business, location, ideal client, experience, goals
2. Market Research: ALWAYS works - benchmarks are fallback if search fails
3. Service Design: Combine packages AND pricing in same conversation
4. Marketing: Generate copy based on everything learned
5. Completion: Celebrate! Stripe is optional - they can connect later.

## Conversation Starters by Phase
${getConversationStarters(phase, memory)}

## When They Return Mid-Onboarding
${
  memory.summaries.pendingQuestions
    ? `Pick up where you left off: "${memory.summaries.pendingQuestions}"`
    : 'Continue naturally from the current phase.'
}

## Never
- Mention "onboarding" - it's just "getting set up"
- Push Stripe before they're ready
- Create things without confirming first
- Give pricing advice without context (use benchmarks)
`.trim();
}

function getPhaseGuidance(phase: OnboardingPhase): string {
  switch (phase) {
    case 'discovery':
      return `
Gather information through natural conversation:
- What services do they offer? (get specific)
- Where are they based? (for market research)
- Who is their ideal client?
- How long have they been doing this?
- What are their main goals?

When you have everything, use update_onboarding_state to save and proceed.`;

    case 'market_research':
      return `
Research their local market:
- Use search_market tool (it has reliable fallbacks)
- Present pricing ranges clearly
- Highlight opportunities
- Ask if it matches their experience

Even if search fails, you'll have industry benchmarks to work with.`;

    case 'service_design':
      return `
Help design their offerings:
- Recommend segment structure (single vs multiple)
- Design packages WITH pricing in the same breath
- "For elopements, I'm thinking a 'Micro' package at $1,500..."
- Use upsert_services to create atomically
- Show the preview link after creation`;

    case 'marketing':
      return `
Generate storefront copy:
- Write hero section (headline + subheadline)
- Write about section
- Use update_storefront to apply
- Share preview link

Then celebrate! "Your storefront is ready!"`;

    case 'complete':
      return `
They're done!
- Show the storefront preview
- Offer to help with Stripe when THEY'RE ready
- Transition to growth assistant mode`;

    default:
      return '';
  }
}
```

---

## Implementation Phases (Consolidated: 4 Build Phases)

Based on reviewer feedback, we've collapsed 10 phases into 4:

### Build Phase 1: Foundation + State Machine

**Goal**: Event sourcing, XState, industry benchmarks

**Tasks**:

- [ ] Add `OnboardingEvent` model to Prisma schema
- [ ] Add `onboardingPhase`, `onboardingVersion` to Tenant
- [ ] Create migration: `npx prisma migrate dev --name add_onboarding_events`
- [ ] Implement XState state machine with guards and actions
- [ ] Create Zod schemas in `@macon/contracts`
- [ ] Build industry benchmarks data file
- [ ] Add GET `/v1/agent/onboarding-state` endpoint
- [ ] Add POST `/v1/agent/skip-onboarding` endpoint
- [ ] Add OpenTelemetry tracing setup

**Files to create**:

- `server/prisma/schema.prisma` (modify)
- `packages/contracts/src/schemas/onboarding.schema.ts`
- `server/src/agent/onboarding/state-machine.ts`
- `server/src/agent/onboarding/industry-benchmarks.ts`
- `server/src/agent/onboarding/tracing.ts`

**Success criteria**:

- [ ] Events persisted for every state transition
- [ ] State machine prevents invalid transitions
- [ ] Benchmarks available for all major business types
- [ ] Traces visible in observability tooling

---

### Build Phase 2: Tools + Market Research

**Goal**: 3 core tools + market search with fallbacks

**Tasks**:

- [ ] Implement `update_onboarding_state` tool
- [ ] Implement `upsert_services` tool (segment + packages + pricing atomic)
- [ ] Implement `update_storefront` tool
- [ ] Implement `searchMarketWithFallback` function
- [ ] Register tools in tool registry
- [ ] Create executors with proper error handling
- [ ] Add discriminated union result types
- [ ] Write unit tests with property-based testing

**Files to create**:

- `server/src/agent/tools/onboarding-tools.ts`
- `server/src/agent/onboarding/market-search.ts`
- `server/src/agent/executors/onboarding-executors.ts`
- `server/test/agent/onboarding-tools.test.ts`
- `server/test/agent/onboarding-properties.test.ts`

**Success criteria**:

- [ ] All tools return discriminated unions
- [ ] Market search gracefully falls back to benchmarks
- [ ] Atomic service creation works correctly
- [ ] Property tests pass for all edge cases

---

### Build Phase 3: Conversation + Memory

**Goal**: System prompt, advisor memory, orchestrator integration

**Tasks**:

- [ ] Build unified system prompt with phase injection
- [ ] Implement AdvisorMemoryService
- [ ] Integrate onboarding mode into existing orchestrator
- [ ] Add resume capability with context summary
- [ ] Test conversation flow for each phase
- [ ] Add LLM evaluation framework
- [ ] Create conversation test fixtures

**Files to create**:

- `server/src/agent/prompts/onboarding-system-prompt.ts`
- `server/src/agent/onboarding/advisor-memory.ts`
- `server/src/agent/orchestrator/orchestrator.ts` (modify)
- `server/test/agent/evaluation/evaluator.ts`
- `server/test/agent/evaluation/personas.ts`

**Success criteria**:

- [ ] Conversation flows naturally through phases
- [ ] Agent remembers context across sessions
- [ ] LLM evaluation scores > 0.8 for all quality dimensions
- [ ] Resume shows correct context summary

---

### Build Phase 4: Frontend + Polish

**Goal**: Live preview, welcome experience, E2E tests

**Tasks**:

- [ ] Create LivePreviewPanel component
- [ ] Update GrowthAssistantPanel for onboarding mode
- [ ] Add inline welcome message (not modal, per reviewer feedback)
- [ ] Add subtle progress indicator
- [ ] Implement WebSocket/polling for real-time preview updates
- [ ] Write E2E tests for full flow
- [ ] Test on mobile (responsive)
- [ ] Security review (tenant isolation)

**Files to create**:

- `apps/web/src/components/onboarding/LivePreviewPanel.tsx`
- `apps/web/src/components/onboarding/OnboardingProgress.tsx`
- `e2e/tests/onboarding-flow.spec.ts`

**Files to modify**:

- `apps/web/src/components/agent/GrowthAssistantPanel.tsx`
- `apps/web/src/app/(protected)/tenant/layout.tsx`

**Success criteria**:

- [ ] Live preview updates as packages created
- [ ] Welcome message feels natural, not modal-interruptive
- [ ] E2E tests pass for complete flow
- [ ] Mobile experience works
- [ ] No tenant data leakage

---

## Acceptance Criteria

### Functional Requirements

- [ ] New tenants see welcome message in Growth Assistant
- [ ] Agent guides through 4 user phases (not 6)
- [ ] Market research ALWAYS works (benchmarks as fallback)
- [ ] Agent creates segments + packages + pricing atomically
- [ ] User can skip any phase or entire onboarding
- [ ] Onboarding state persists via event sourcing
- [ ] Live preview shows storefront updating
- [ ] Stripe is decoupled — onboarding complete when storefront looks good

### Non-Functional Requirements

- [ ] Onboarding completes in < 15 minutes average
- [ ] Market search responds in < 5 seconds (fallback < 100ms)
- [ ] No tenant data leakage (100% tenant isolation)
- [ ] Works on mobile (responsive chat UI)
- [ ] Events provide complete audit trail
- [ ] OpenTelemetry traces available for debugging

### Quality Gates

- [ ] 90%+ test coverage for onboarding tools
- [ ] Property-based tests pass
- [ ] LLM evaluation scores > 0.8
- [ ] E2E test passes for complete flow
- [ ] Security review completed

---

## Success Metrics

| Metric                     | Current     | Target   | Measurement               |
| -------------------------- | ----------- | -------- | ------------------------- |
| Onboarding completion rate | ~40% (est.) | 80%      | Completed / Started       |
| Time to first package      | Unknown     | < 10 min | Event timestamps          |
| Time to storefront live    | Unknown     | < 20 min | Event timestamps          |
| User satisfaction          | Unknown     | 4.5/5    | Post-onboarding survey    |
| Resume success rate        | N/A         | 95%      | Users who return complete |

---

## Risk Analysis & Mitigation

| Risk                               | Likelihood | Impact   | Mitigation                                                    |
| ---------------------------------- | ---------- | -------- | ------------------------------------------------------------- |
| Web search returns poor data       | Medium     | Low      | Fallback-first architecture with industry benchmarks          |
| Onboarding takes too long          | Medium     | High     | Phase skip capability; combined service+pricing phase         |
| Agent gives bad pricing advice     | Low        | Medium   | Frame as "starting point"; benchmarks provide guardrails      |
| Users abandon mid-onboarding       | Medium     | Medium   | Advisor memory; resume with full context                      |
| Tenant isolation bug               | Low        | Critical | Event sourcing auditable; security review; multi-tenant tests |
| State machine enters invalid state | Very Low   | Medium   | XState provides provable correctness                          |

---

## Review Feedback Incorporated

### From DHH

- [x] Consolidated 10 build phases → 4 build phases
- [x] Reduced tools from 8+ → 3 core tools
- [x] Build benchmarks first, web search as enhancement
- [x] Single system prompt with phase injection
- [x] Combined service design + pricing phases

### From Kieran (Technical)

- [x] XState formal state machine
- [x] Event sourcing with audit trail
- [x] Discriminated union tool results
- [x] OpenTelemetry tracing
- [x] Zod schemas for all types
- [x] Property-based testing approach
- [x] LLM evaluation framework

### From Simplicity Reviewer

- [x] Live preview panel for magical UX
- [x] Advisor memory across sessions
- [x] Merged pricing + service design (user thinks of them together)
- [x] Decoupled Stripe from completion
- [x] Welcome message inline (not modal)

---

## References

### Internal

- `server/src/agent/orchestrator/orchestrator.ts` - Existing orchestrator
- `server/src/agent/tools/write-tools.ts` - Tool patterns
- `server/src/agent/proposals/proposal.service.ts` - Proposal lifecycle
- `docs/design/BRAND_VOICE_GUIDE.md` - Voice guidance

### External

- [AI User Onboarding Best Practices (Userpilot)](https://userpilot.com/blog/ai-user-onboarding/)
- [How an AI Onboarding Agent Doubled Activation (GrowthMates)](https://www.growthmates.news/p/how-an-ai-powered-user-onboarding)
- [XState Documentation](https://xstate.js.org/docs/)
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)

---

_Plan generated by Claude Code workflows:plan_
_Revised with quality-first feedback from DHH, Kieran, and Simplicity reviewers_
_Ready for implementation: `/workflows:work`_
