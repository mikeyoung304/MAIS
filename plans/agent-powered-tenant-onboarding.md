# Agent-Powered Tenant Onboarding System

> Transform signup from "fill out forms" to "have a conversation with your AI business consultant"

**Created**: 2025-12-31
**Status**: Draft - Pending Review
**Complexity**: A LOT (Major Feature - Multi-Phase Implementation)

---

## Executive Summary

Replace passive dashboard onboarding with an **AI-guided conversational journey** where the Growth Assistant acts as a business consultant, helping tenants:

1. **Discover** their business identity and ideal clients
2. **Research** their local market (competitors, pricing, opportunities)
3. **Design** their service offerings (segments, tiers, packages)
4. **Price** strategically based on market data
5. **Position** with marketing messaging and storefront copy
6. **Activate** when ready (Stripe connection as final step, not first)

**The key shift**: Instead of "here's your empty dashboard, figure it out," we say "let's build your business together."

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
Signup → Welcome Modal → Agent-Guided Conversation → Configured Business → Go Live
```

**The experience:**

1. **Welcome modal** sets expectations and introduces the AI assistant
2. **Discovery phase** — Agent learns about their business through conversation
3. **Market research** — Agent researches local competition and pricing
4. **Service design** — Agent helps structure offerings (segments + tiers)
5. **Pricing strategy** — Agent recommends prices based on market data
6. **Marketing positioning** — Agent generates storefront copy
7. **Activation** — Stripe connect only when ready to accept bookings

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ONBOARDING AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐         ┌─────────────────┐                   │
│  │   Next.js UI    │────────▶│  Express API    │                   │
│  │                 │         │                 │                   │
│  │ OnboardingChat  │         │ /v1/agent/chat  │                   │
│  │ WelcomeModal    │         │ /v1/agent/onb   │                   │
│  │ ProgressTracker │         │                 │                   │
│  └─────────────────┘         └────────┬────────┘                   │
│                                       │                            │
│                                       ▼                            │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  AGENT ORCHESTRATOR                         │   │
│  │                                                             │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │   │
│  │  │  Discovery  │──▶│   Market    │──▶│   Service   │       │   │
│  │  │   Phase     │   │  Research   │   │   Design    │       │   │
│  │  └─────────────┘   └─────────────┘   └─────────────┘       │   │
│  │         │                │                  │               │   │
│  │         ▼                ▼                  ▼               │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │   │
│  │  │   Pricing   │──▶│  Marketing  │──▶│ Activation  │       │   │
│  │  │  Strategy   │   │ Positioning │   │             │       │   │
│  │  └─────────────┘   └─────────────┘   └─────────────┘       │   │
│  │                                                             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                     TOOL LAYER                              │   │
│  │                                                             │   │
│  │  Read Tools          Write Tools          External Tools    │   │
│  │  ─────────────       ─────────────        ─────────────     │   │
│  │  get_onboarding_     store_discovery      web_search_       │   │
│  │    state             create_segment         market          │   │
│  │  get_tenant_         create_package       get_pricing_      │   │
│  │    profile           update_branding        benchmarks      │   │
│  │  get_market_         update_storefront                      │   │
│  │    research          complete_onboarding                    │   │
│  │                                                             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase State Machine

```
                    ┌──────────────┐
                    │   SIGNUP     │
                    │   COMPLETE   │
                    └──────┬───────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         DISCOVERY                                     │
│                                                                       │
│  Inputs:                        Outputs:                              │
│  • Business type                • discoveryData.businessType          │
│  • Location                     • discoveryData.location              │
│  • Ideal clients                • discoveryData.niche                 │
│  • Experience level             • discoveryData.experience            │
│  • Goals                        • discoveryData.idealClient           │
│                                                                       │
│  Agent Actions:                                                       │
│  • Ask guided questions                                               │
│  • Store responses via store_discovery_response tool                  │
│  • Summarize understanding before proceeding                          │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      MARKET_RESEARCH                                  │
│                                                                       │
│  Inputs:                        Outputs:                              │
│  • discoveryData                • marketResearch.competitors[]        │
│                                 • marketResearch.pricingRange         │
│  Agent Actions:                 • marketResearch.insights[]           │
│  • web_search_market tool       • marketResearch.opportunities        │
│  • Analyze competitors                                                │
│  • Identify pricing ranges                                            │
│  • Find market gaps                                                   │
│  • Present findings to user                                           │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SERVICE_DESIGN                                   │
│                                                                       │
│  Inputs:                        Outputs:                              │
│  • discoveryData                • serviceDesign.segmentStrategy       │
│  • marketResearch               • serviceDesign.segments[]            │
│                                 • serviceDesign.tierNames             │
│  Agent Actions:                                                       │
│  • Recommend segment structure (single vs multiple)                   │
│  • Help name segments and tiers                                       │
│  • Create via create_segment, create_package tools                    │
│  • Show live preview of storefront                                    │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         PRICING                                       │
│                                                                       │
│  Inputs:                        Outputs:                              │
│  • marketResearch.pricingRange  • pricing.strategy                    │
│  • serviceDesign                • pricing.packages[]                  │
│                                                                       │
│  Agent Actions:                                                       │
│  • Present market pricing data                                        │
│  • Ask positioning preference (value/market/premium)                  │
│  • Calculate recommended prices                                       │
│  • Update packages via update_package_pricing tool                    │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        MARKETING                                      │
│                                                                       │
│  Inputs:                        Outputs:                              │
│  • discoveryData                • marketing.positioning               │
│  • marketResearch               • marketing.heroTitle                 │
│  • serviceDesign                • marketing.heroSubtitle              │
│                                 • marketing.aboutText                 │
│  Agent Actions:                 • marketing.contentIdeas[]            │
│  • Generate unique positioning statement                              │
│  • Create hero copy, about text                                       │
│  • Suggest marketing channels                                         │
│  • Update storefront via update_storefront_copy tool                  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ACTIVATION                                     │
│                                                                       │
│  Inputs:                        Actions:                              │
│  • All previous phases          • Show final summary                  │
│  • Storefront preview           • Preview storefront                  │
│                                 • Offer Stripe connection             │
│  Completion:                    • Mark onboarding complete            │
│  • onboardingState.phase = 'complete'                                 │
│  • onboardingState.completedAt = now()                                │
│                                                                       │
│  Note: Stripe is optional here — can connect later                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### 1. Database Schema Changes

```prisma
// schema.prisma additions

model Tenant {
  // ... existing fields

  // NEW: Onboarding state storage
  onboardingState    Json?     @default("{}")  // OnboardingState object
  onboardingPhase    String?   @default("discovery")  // Current phase
  onboardingStartedAt DateTime?
  onboardingCompletedAt DateTime?
}

// Type definition (for reference - stored as JSON)
// interface OnboardingState {
//   phase: 'discovery' | 'market_research' | 'service_design' | 'pricing' | 'marketing' | 'activation' | 'complete';
//   discovery?: {
//     businessType: string;
//     location: { city: string; state: string; country?: string };
//     niche: string;
//     experience: string;
//     idealClient: string;
//     goals: string[];
//   };
//   marketResearch?: {
//     competitors: { name: string; priceRange?: string; strengths?: string }[];
//     pricingBenchmarks: { low: number; mid: number; high: number };
//     insights: string[];
//     opportunities: string[];
//     searchedAt: Date;
//   };
//   serviceDesign?: {
//     segmentStrategy: 'single' | 'multiple';
//     segments: { id: string; name: string; description: string }[];
//     tierNames: Record<string, string[]>;
//   };
//   pricing?: {
//     strategy: 'value' | 'market' | 'premium';
//     packages: { id: string; name: string; price: number }[];
//   };
//   marketing?: {
//     positioning: string;
//     heroTitle: string;
//     heroSubtitle: string;
//     aboutText: string;
//     contentIdeas: string[];
//   };
// }
```

### 2. New Agent Tools

#### Read Tools (server/src/agent/tools/onboarding-read-tools.ts)

```typescript
// Tool: get_onboarding_state
{
  name: 'get_onboarding_state',
  description: 'Get the current onboarding progress and stored data for this tenant',
  parameters: {},
  execute: async ({ tenantId }) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        onboardingState: true,
        onboardingPhase: true,
        businessName: true,
        slug: true
      }
    });
    return { state: tenant.onboardingState, phase: tenant.onboardingPhase };
  }
}

// Tool: get_tenant_profile
// Already exists - reuse

// Tool: get_market_research_cache
{
  name: 'get_market_research_cache',
  description: 'Get cached market research if still fresh (within 7 days)',
  parameters: {},
  execute: async ({ tenantId }) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingState: true }
    });
    const state = tenant.onboardingState as OnboardingState;

    if (state?.marketResearch?.searchedAt) {
      const searchDate = new Date(state.marketResearch.searchedAt);
      const daysSinceSearch = (Date.now() - searchDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSearch < 7) {
        return { cached: true, data: state.marketResearch };
      }
    }
    return { cached: false };
  }
}
```

#### Write Tools (server/src/agent/tools/onboarding-write-tools.ts)

```typescript
// Tool: store_discovery_response (T1 - auto)
{
  name: 'store_discovery_response',
  description: 'Store user answers from discovery phase',
  trustTier: 'T1',
  parameters: {
    businessType: z.string().describe('Type of business (e.g., "wedding photographer")'),
    location: z.object({
      city: z.string(),
      state: z.string(),
      country: z.string().optional()
    }).describe('Business location'),
    niche: z.string().describe('Specific niche or specialty'),
    experience: z.string().describe('Years of experience'),
    idealClient: z.string().describe('Description of ideal client'),
    goals: z.array(z.string()).describe('Business goals')
  },
  execute: async ({ tenantId, input }) => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingPhase: 'market_research',
        onboardingState: {
          ...(await getCurrentState(tenantId)),
          phase: 'market_research',
          discovery: input
        }
      }
    });
    return { success: true, nextPhase: 'market_research' };
  }
}

// Tool: store_market_research (T1 - auto)
{
  name: 'store_market_research',
  description: 'Store market research findings',
  trustTier: 'T1',
  parameters: {
    competitors: z.array(z.object({
      name: z.string(),
      priceRange: z.string().optional(),
      strengths: z.string().optional()
    })),
    pricingBenchmarks: z.object({
      low: z.number(),
      mid: z.number(),
      high: z.number()
    }),
    insights: z.array(z.string()),
    opportunities: z.array(z.string())
  },
  execute: async ({ tenantId, input }) => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingPhase: 'service_design',
        onboardingState: {
          ...(await getCurrentState(tenantId)),
          phase: 'service_design',
          marketResearch: { ...input, searchedAt: new Date() }
        }
      }
    });
    return { success: true, nextPhase: 'service_design' };
  }
}

// Tool: create_segment_with_packages (T2 - soft confirm)
{
  name: 'create_segment_with_packages',
  description: 'Create a service segment with initial packages',
  trustTier: 'T2',
  parameters: {
    segmentName: z.string(),
    segmentDescription: z.string(),
    packages: z.array(z.object({
      name: z.string(),
      description: z.string(),
      tierOrder: z.number().min(1).max(10)
    }))
  },
  execute: async ({ tenantId, input }) => {
    // Create segment
    const segment = await prisma.segment.create({
      data: {
        tenantId,
        name: input.segmentName,
        slug: slugify(input.segmentName),
        description: input.segmentDescription,
        heroTitle: input.segmentName
      }
    });

    // Create packages (prices set to $0 initially)
    await prisma.package.createMany({
      data: input.packages.map(pkg => ({
        tenantId,
        segmentId: segment.id,
        name: pkg.name,
        slug: slugify(pkg.name),
        description: pkg.description,
        basePrice: 0, // Pricing phase will set this
        groupingOrder: pkg.tierOrder,
        active: true
      }))
    });

    return {
      success: true,
      segmentId: segment.id,
      packageCount: input.packages.length
    };
  }
}

// Tool: update_package_pricing (T2 - soft confirm)
{
  name: 'update_package_pricing',
  description: 'Set pricing for packages based on strategy',
  trustTier: 'T2',
  parameters: {
    packages: z.array(z.object({
      packageId: z.string(),
      price: z.number().min(0)
    }))
  },
  execute: async ({ tenantId, input }) => {
    for (const pkg of input.packages) {
      await prisma.package.update({
        where: { id: pkg.packageId, tenantId }, // Tenant isolation!
        data: { basePrice: pkg.price }
      });
    }

    // Update onboarding state
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingPhase: 'marketing',
        onboardingState: {
          ...(await getCurrentState(tenantId)),
          phase: 'marketing',
          pricing: {
            strategy: 'custom', // Will be set by conversation
            packages: input.packages
          }
        }
      }
    });

    return { success: true, updatedCount: input.packages.length };
  }
}

// Tool: update_storefront_copy (T2 - soft confirm)
{
  name: 'update_storefront_copy',
  description: 'Update storefront hero and about sections',
  trustTier: 'T2',
  parameters: {
    heroTitle: z.string().max(100),
    heroSubtitle: z.string().max(200),
    aboutText: z.string().max(1000)
  },
  execute: async ({ tenantId, input }) => {
    // Get current landing page config
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true }
    });

    const config = tenant.landingPageConfig || { pages: [] };
    // Update hero section in home page
    // ... (implementation details)

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: config,
        onboardingPhase: 'activation',
        onboardingState: {
          ...(await getCurrentState(tenantId)),
          phase: 'activation',
          marketing: {
            heroTitle: input.heroTitle,
            heroSubtitle: input.heroSubtitle,
            aboutText: input.aboutText
          }
        }
      }
    });

    return { success: true };
  }
}

// Tool: complete_onboarding (T1 - auto)
{
  name: 'complete_onboarding',
  description: 'Mark onboarding as complete',
  trustTier: 'T1',
  parameters: {},
  execute: async ({ tenantId }) => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingPhase: 'complete',
        onboardingCompletedAt: new Date(),
        onboardingState: {
          ...(await getCurrentState(tenantId)),
          phase: 'complete',
          completedAt: new Date().toISOString()
        }
      }
    });
    return { success: true, completedAt: new Date() };
  }
}
```

#### External Tools (server/src/agent/tools/external-tools.ts)

```typescript
// Tool: web_search_market
{
  name: 'web_search_market',
  description: 'Search the web for local market intelligence about competitors and pricing',
  parameters: {
    businessType: z.string().describe('Type of business'),
    location: z.string().describe('City, State format'),
    searchFocus: z.enum(['pricing', 'competitors', 'trends']).describe('What to focus on')
  },
  execute: async ({ input }) => {
    // Use Tavily or built-in WebSearch
    const queries = [
      `${input.businessType} ${input.location} pricing`,
      `${input.businessType} near ${input.location}`,
      `${input.businessType} rates ${input.location} 2025`
    ];

    const results = await Promise.all(
      queries.map(q => webSearchTool.execute({ query: q }))
    );

    return {
      searchResults: results.flat(),
      searchedAt: new Date()
    };
  }
}
```

### 3. System Prompt for Onboarding Mode

```typescript
// server/src/agent/prompts/onboarding-system-prompt.ts

export const ONBOARDING_SYSTEM_PROMPT = `
You are a business consultant helping a new HANDLED member set up their business.
Your goal is to guide them through a conversational onboarding experience.

## Your Personality
- Warm, encouraging, and knowledgeable
- Like talking to a smart friend who happens to know business
- Celebrate their wins, acknowledge their expertise
- Never condescending or robotic

## Current Onboarding Phase: {phase}
{phaseSpecificInstructions}

## Phase-Specific Instructions

### DISCOVERY
Goal: Understand their business deeply before doing anything.

Ask these questions naturally (not as a list):
1. What kind of services do you offer? (get specific)
2. Where are you based? (city, state for market research)
3. Who is your ideal client? (help them articulate this)
4. How long have you been doing this?
5. What are your main goals? (more clients? higher prices? less admin?)

After gathering all info, use store_discovery_response to save it.
Summarize what you learned before moving on.

### MARKET_RESEARCH
Goal: Research their local market and present findings.

1. Use web_search_market to find competitors and pricing
2. Analyze the results for patterns
3. Present findings in a clear format:
   - Pricing ranges (low/mid/high)
   - Key competitors (2-3)
   - Market opportunities
4. Use store_market_research to save findings
5. Ask if this matches their experience

### SERVICE_DESIGN
Goal: Help them structure their offerings.

Based on discovery and research:
1. Recommend segment strategy (single vs multiple categories)
2. Help name segments if multiple
3. Design tier structure (usually 3 tiers per segment)
4. Create via create_segment_with_packages tool
5. Show what was created

### PRICING
Goal: Set strategic prices based on market data.

1. Present market pricing data from research phase
2. Ask about positioning: value, market rate, or premium
3. Factor in their experience level
4. Calculate recommended prices for each tier
5. Update via update_package_pricing tool
6. Confirm prices look right

### MARKETING
Goal: Create compelling storefront messaging.

Based on all previous phases:
1. Craft a unique positioning statement
2. Write hero section copy (headline + subheadline)
3. Write about section text
4. Suggest marketing channels and content ideas
5. Update via update_storefront_copy tool
6. Offer to preview storefront

### ACTIVATION
Goal: Celebrate and offer next steps.

1. Summarize everything created:
   - Segments and packages
   - Pricing strategy
   - Storefront messaging
2. Show storefront preview link
3. Explain Stripe connection (optional, for when ready)
4. Mark complete via complete_onboarding tool
5. Transition to growth assistant mode

## Key Rules
- One question at a time in discovery
- Always confirm before creating/updating
- Show progress: "Great! Now let's..."
- If they want to skip a phase, that's okay
- Never mention "onboarding" - it's just "getting set up"
- Stripe is NOT required to complete onboarding
`;
```

### 4. Frontend Components

#### Welcome Modal (apps/web/src/components/onboarding/WelcomeModal.tsx)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface WelcomeModalProps {
  businessName: string;
  isFirstLogin: boolean;
}

export function WelcomeModal({ businessName, isFirstLogin }: WelcomeModalProps) {
  const [open, setOpen] = useState(isFirstLogin);
  const router = useRouter();

  const handleStartOnboarding = () => {
    setOpen(false);
    // Open Growth Assistant panel and trigger onboarding mode
    router.push('/tenant/dashboard?onboarding=true');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="sr-only">Welcome to HANDLED</DialogTitle>

        <div className="text-center space-y-6 py-4">
          {/* Celebration emoji/icon */}
          <div className="text-6xl">🎉</div>

          <div>
            <h2 className="text-2xl font-serif font-bold text-text-primary">
              Welcome to HANDLED, {businessName}!
            </h2>
            <p className="text-text-secondary mt-2">
              You're about to have a lot more time for what you love.
            </p>
          </div>

          {/* Steps preview */}
          <div className="bg-sage-50 rounded-2xl p-6 text-left">
            <p className="text-sm font-medium text-sage-700 mb-3">
              Here's how we'll get you set up:
            </p>
            <ol className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Build your storefront (your public face)
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Set your packages & pricing
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                Connect payments (when you're ready to book)
              </li>
            </ol>
          </div>

          <p className="text-sm text-text-secondary">
            Your AI assistant is here to help every step.
          </p>

          <Button
            onClick={handleStartOnboarding}
            className="w-full bg-sage hover:bg-sage-hover text-white rounded-full py-6 text-lg"
          >
            Let's Build Your Storefront →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### Onboarding Progress Tracker (apps/web/src/components/onboarding/OnboardingProgress.tsx)

```tsx
'use client';

import { cn } from '@/lib/utils';

type Phase =
  | 'discovery'
  | 'market_research'
  | 'service_design'
  | 'pricing'
  | 'marketing'
  | 'activation'
  | 'complete';

interface OnboardingProgressProps {
  currentPhase: Phase;
  className?: string;
}

const PHASES: { key: Phase; label: string; shortLabel: string }[] = [
  { key: 'discovery', label: 'Tell us about you', shortLabel: 'Discovery' },
  { key: 'market_research', label: 'Market research', shortLabel: 'Research' },
  { key: 'service_design', label: 'Design services', shortLabel: 'Services' },
  { key: 'pricing', label: 'Set pricing', shortLabel: 'Pricing' },
  { key: 'marketing', label: 'Storefront copy', shortLabel: 'Copy' },
  { key: 'activation', label: 'Go live!', shortLabel: 'Launch' },
];

export function OnboardingProgress({ currentPhase, className }: OnboardingProgressProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);
  const progress = currentPhase === 'complete' ? 100 : ((currentIndex + 1) / PHASES.length) * 100;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">Your Setup Progress</span>
        <span className="text-text-secondary">{Math.round(progress)}%</span>
      </div>

      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Phase indicators */}
      <div className="flex justify-between">
        {PHASES.map((phase, index) => {
          const isComplete = index < currentIndex || currentPhase === 'complete';
          const isCurrent = phase.key === currentPhase;

          return (
            <div
              key={phase.key}
              className={cn(
                'flex flex-col items-center gap-1',
                isComplete && 'text-sage-600',
                isCurrent && 'text-sage-700 font-medium',
                !isComplete && !isCurrent && 'text-text-tertiary'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                  isComplete && 'bg-sage-100',
                  isCurrent && 'bg-sage text-white',
                  !isComplete && !isCurrent && 'bg-neutral-100'
                )}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span className="text-xs hidden sm:block">{phase.shortLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### Enhanced Growth Assistant for Onboarding Mode

```tsx
// Modifications to apps/web/src/components/agent/GrowthAssistantPanel.tsx

// Add onboarding mode detection
const { data: tenant } = useQuery(['tenant'], fetchTenant);
const isOnboarding = tenant?.onboardingPhase !== 'complete';

// In render, show progress tracker when onboarding
{
  isOnboarding && (
    <div className="px-4 py-3 border-b">
      <OnboardingProgress currentPhase={tenant.onboardingPhase} />
    </div>
  );
}

// Update initial greeting based on onboarding state
const getInitialGreeting = () => {
  if (isOnboarding) {
    return `Hey! 👋 I'm your Growth Assistant. I'm here to help you build your business on HANDLED.

Let's start by learning about you. What kind of services do you offer?`;
  }
  return `Welcome back! How can I help you grow your business today?`;
};
```

### 5. API Route Changes

```typescript
// server/src/routes/agent.routes.ts additions

// GET /v1/agent/onboarding-state
router.get('/onboarding-state', authenticateTenant, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantAuth.tenantId },
    select: {
      onboardingPhase: true,
      onboardingState: true,
      onboardingStartedAt: true,
      onboardingCompletedAt: true,
    },
  });

  return res.json({
    phase: tenant.onboardingPhase || 'discovery',
    state: tenant.onboardingState || {},
    isComplete: tenant.onboardingPhase === 'complete',
    completedAt: tenant.onboardingCompletedAt,
  });
});

// POST /v1/agent/skip-onboarding
router.post('/skip-onboarding', authenticateTenant, async (req, res) => {
  await prisma.tenant.update({
    where: { id: req.tenantAuth.tenantId },
    data: {
      onboardingPhase: 'complete',
      onboardingCompletedAt: new Date(),
    },
  });

  return res.json({ success: true });
});
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Database schema + basic state tracking

**Tasks**:

- [ ] Add `onboardingState`, `onboardingPhase` to Tenant model
- [ ] Create migration: `npx prisma migrate dev --name add_onboarding_state`
- [ ] Add GET `/v1/agent/onboarding-state` endpoint
- [ ] Add POST `/v1/agent/skip-onboarding` endpoint
- [ ] Update tenant creation to set `onboardingPhase: 'discovery'`

**Files to create/modify**:

- `server/prisma/schema.prisma`
- `server/src/routes/agent.routes.ts`
- `server/src/services/tenant-onboarding.service.ts`

**Success criteria**:

- [ ] New tenants have `onboardingPhase: 'discovery'`
- [ ] API returns onboarding state correctly
- [ ] Skip onboarding marks phase as complete

---

### Phase 2: Discovery Tools (Week 1-2)

**Goal**: Agent can gather and store discovery data

**Tasks**:

- [ ] Create `get_onboarding_state` read tool
- [ ] Create `store_discovery_response` write tool (T1)
- [ ] Register tools in tool registry
- [ ] Create executor for store_discovery_response
- [ ] Write unit tests for discovery tools

**Files to create**:

- `server/src/agent/tools/onboarding-read-tools.ts`
- `server/src/agent/tools/onboarding-write-tools.ts`
- `server/src/agent/executors/onboarding-executors.ts`
- `server/test/agent/onboarding-tools.test.ts`

**Success criteria**:

- [ ] Agent can ask discovery questions
- [ ] Responses stored in `onboardingState.discovery`
- [ ] Phase advances to `market_research` after discovery

---

### Phase 3: Market Research Integration (Week 2)

**Goal**: Agent can research local markets

**Tasks**:

- [ ] Create `web_search_market` external tool
- [ ] Create `store_market_research` write tool (T1)
- [ ] Add caching for market research (7-day TTL)
- [ ] Create fallback for when search returns sparse data
- [ ] Test with real market searches

**Files to create/modify**:

- `server/src/agent/tools/external-tools.ts`
- `server/src/agent/tools/onboarding-write-tools.ts`

**Success criteria**:

- [ ] Agent can search for competitors and pricing
- [ ] Results stored in `onboardingState.marketResearch`
- [ ] Graceful fallback when data is sparse
- [ ] Cache prevents redundant searches

---

### Phase 4: Service Design Tools (Week 2-3)

**Goal**: Agent can create segments and packages

**Tasks**:

- [ ] Create `create_segment_with_packages` write tool (T2)
- [ ] Create proposal + executor for segment creation
- [ ] Update existing `upsert_segment` tool for onboarding context
- [ ] Add live preview capability (return storefront URL)
- [ ] Test segment + package creation flow

**Files to create/modify**:

- `server/src/agent/tools/onboarding-write-tools.ts`
- `server/src/agent/executors/onboarding-executors.ts`

**Success criteria**:

- [ ] Agent can create segments with initial packages
- [ ] Packages created with $0 price (set in pricing phase)
- [ ] Soft-confirm (T2) works for segment creation
- [ ] Phase advances to `pricing`

---

### Phase 5: Pricing Tools (Week 3)

**Goal**: Agent can set strategic pricing

**Tasks**:

- [ ] Create `update_package_pricing` write tool (T2)
- [ ] Create pricing recommendation logic
- [ ] Create executor for bulk price updates
- [ ] Test pricing flow with market data

**Files to create/modify**:

- `server/src/agent/tools/onboarding-write-tools.ts`
- `server/src/agent/executors/onboarding-executors.ts`

**Success criteria**:

- [ ] Agent can recommend prices based on market research
- [ ] Agent can set prices for multiple packages at once
- [ ] Soft-confirm (T2) works for price changes
- [ ] Phase advances to `marketing`

---

### Phase 6: Marketing Tools (Week 3-4)

**Goal**: Agent can generate and apply storefront copy

**Tasks**:

- [ ] Create `update_storefront_copy` write tool (T2)
- [ ] Integrate with existing landing page config structure
- [ ] Create executor for storefront updates
- [ ] Test copy generation based on discovery data

**Files to create/modify**:

- `server/src/agent/tools/onboarding-write-tools.ts`
- `server/src/agent/executors/onboarding-executors.ts`

**Success criteria**:

- [ ] Agent generates compelling hero copy
- [ ] Agent generates about section text
- [ ] Storefront updates visible in preview
- [ ] Phase advances to `activation`

---

### Phase 7: Activation & Completion (Week 4)

**Goal**: Smooth completion and transition to growth mode

**Tasks**:

- [ ] Create `complete_onboarding` write tool (T1)
- [ ] Add storefront preview link generation
- [ ] Update Growth Assistant to detect completion
- [ ] Create transition messaging

**Files to create/modify**:

- `server/src/agent/tools/onboarding-write-tools.ts`
- `server/src/agent/prompts/onboarding-system-prompt.ts`

**Success criteria**:

- [ ] Agent can mark onboarding complete
- [ ] Dashboard shows completion celebration
- [ ] Growth Assistant switches to growth mode
- [ ] Stripe connection offered but not required

---

### Phase 8: Frontend Polish (Week 4-5)

**Goal**: Beautiful, intuitive UI

**Tasks**:

- [ ] Create WelcomeModal component
- [ ] Create OnboardingProgress component
- [ ] Update GrowthAssistantPanel for onboarding mode
- [ ] Add first-login detection
- [ ] Add live storefront preview panel
- [ ] Test full E2E flow

**Files to create**:

- `apps/web/src/components/onboarding/WelcomeModal.tsx`
- `apps/web/src/components/onboarding/OnboardingProgress.tsx`
- `apps/web/src/components/onboarding/StorefrontPreview.tsx`

**Files to modify**:

- `apps/web/src/components/agent/GrowthAssistantPanel.tsx`
- `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

**Success criteria**:

- [ ] Welcome modal appears on first login
- [ ] Progress tracker shows current phase
- [ ] Live preview updates as agent makes changes
- [ ] Full onboarding flow completes successfully

---

### Phase 9: System Prompt & Conversation Flow (Week 5)

**Goal**: Natural, effective agent conversation

**Tasks**:

- [ ] Write comprehensive onboarding system prompt
- [ ] Add phase-specific prompt sections
- [ ] Test conversation flow for each phase
- [ ] Add fallback responses for edge cases
- [ ] Create conversation examples for testing

**Files to create/modify**:

- `server/src/agent/prompts/onboarding-system-prompt.ts`
- `server/src/agent/orchestrator/orchestrator.ts` (add onboarding mode)

**Success criteria**:

- [ ] Agent conversation feels natural
- [ ] Phase transitions are smooth
- [ ] Edge cases handled gracefully
- [ ] User can skip phases if desired

---

### Phase 10: Testing & Refinement (Week 5-6)

**Goal**: Production-ready quality

**Tasks**:

- [ ] Write E2E tests for full onboarding flow
- [ ] Test with real market searches (various business types)
- [ ] Test resume capability (user leaves mid-onboarding)
- [ ] Performance testing (web search latency)
- [ ] Security review (tenant isolation in all tools)

**Test files to create**:

- `server/test/agent/onboarding-flow.integration.test.ts`
- `e2e/tests/onboarding-flow.spec.ts`

**Success criteria**:

- [ ] All E2E tests pass
- [ ] Onboarding completes in < 15 minutes
- [ ] Resume works after browser close
- [ ] No tenant data leakage

---

## Alternative Approaches Considered

### Option A: Separate Onboarding Orchestrator (Rejected)

**Approach**: Create a dedicated `OnboardingOrchestrator` class
**Why rejected**: Would duplicate 90% of existing orchestrator code. Better to extend current orchestrator with "onboarding mode" flag.

### Option B: Wizard UI Instead of Chat (Rejected)

**Approach**: Traditional step-by-step form wizard
**Why rejected**: Misses the opportunity for AI personalization. Chat allows market research, intelligent recommendations, and feels more like having a business consultant.

### Option C: Pre-built Templates Only (Rejected)

**Approach**: Let users pick from industry templates
**Why rejected**: Too generic. A wedding photographer in Austin has different needs than one in NYC. Market research enables true personalization.

---

## Acceptance Criteria

### Functional Requirements

- [ ] New tenants see welcome modal on first login
- [ ] Agent guides through 6 onboarding phases
- [ ] Web search returns market data for major US cities
- [ ] Agent creates segments, packages, and storefront copy
- [ ] User can skip any phase or entire onboarding
- [ ] Onboarding state persists across sessions
- [ ] Progress tracker shows current phase
- [ ] Stripe connection is optional (last step)

### Non-Functional Requirements

- [ ] Onboarding completes in < 15 minutes average
- [ ] Web search responds in < 5 seconds
- [ ] No tenant data leakage (100% tenant isolation)
- [ ] Works on mobile (responsive chat UI)
- [ ] Graceful degradation if web search fails

### Quality Gates

- [ ] 90%+ test coverage for onboarding tools
- [ ] E2E test passes for complete flow
- [ ] Security review completed
- [ ] UX review with 3+ real users
- [ ] Performance benchmarks met

---

## Success Metrics

| Metric                       | Current     | Target   | Measurement            |
| ---------------------------- | ----------- | -------- | ---------------------- |
| Onboarding completion rate   | ~40% (est.) | 80%      | Completed / Started    |
| Time to first package        | Unknown     | < 10 min | Timestamp delta        |
| Time to storefront live      | Unknown     | < 20 min | Timestamp delta        |
| User satisfaction            | Unknown     | 4.5/5    | Post-onboarding survey |
| Support tickets (onboarding) | Unknown     | -50%     | Ticket volume          |

---

## Dependencies & Prerequisites

### Technical Dependencies

- [ ] Existing Growth Assistant infrastructure (DONE)
- [ ] Proposal system with T1/T2/T3 trust tiers (DONE)
- [ ] Landing page config system (DONE)
- [ ] Segment + Package models (DONE)

### External Dependencies

- [ ] Web search API (Tavily or built-in WebSearch tool)
- [ ] Claude API with tool use capability (DONE)

### Team Dependencies

- [ ] UX review of conversation flow
- [ ] Copywriting review for system prompts

---

## Risk Analysis & Mitigation

| Risk                           | Likelihood | Impact   | Mitigation                                                  |
| ------------------------------ | ---------- | -------- | ----------------------------------------------------------- |
| Web search returns poor data   | Medium     | Medium   | Fallback to industry benchmarks; allow manual override      |
| Onboarding takes too long      | Medium     | High     | Phase skip capability; progress persistence                 |
| Agent gives bad pricing advice | Low        | High     | Frame as "starting point"; easy to change; disclaimers      |
| Users abandon mid-onboarding   | Medium     | Medium   | Resume capability; progress persistence; email reminders    |
| Tenant isolation bug           | Low        | Critical | Security review; test all tools with multi-tenant scenarios |

---

## Future Considerations

### Phase 2 Enhancements

- **Photo upload integration**: Agent helps curate portfolio
- **Calendar setup**: Connect Google Calendar during onboarding
- **Email template customization**: Agent writes confirmation emails
- **Competitor monitoring**: Weekly market updates

### Long-term Vision

- **Industry-specific agents**: Photographer agent, coach agent, therapist agent
- **Peer benchmarking**: "Photographers like you charge..."
- **A/B test pricing**: Agent suggests price experiments
- **Revenue optimization**: Agent recommends upsells

---

## Documentation Plan

### User-Facing

- [ ] Help article: "Getting started with HANDLED"
- [ ] Video walkthrough of onboarding flow
- [ ] FAQ: Common onboarding questions

### Developer-Facing

- [ ] ADR for onboarding agent architecture
- [ ] Tool documentation in code comments
- [ ] System prompt documentation

---

## References & Research

### Internal References

- `server/src/agent/orchestrator/orchestrator.ts` - Existing orchestrator pattern
- `server/src/agent/tools/write-tools.ts` - Tool definition patterns
- `server/src/agent/proposals/proposal.service.ts` - Proposal lifecycle
- `docs/design/BRAND_VOICE_GUIDE.md` - Voice for agent copy

### External References

- [AI User Onboarding Best Practices (Userpilot)](https://userpilot.com/blog/ai-user-onboarding/)
- [How an AI Onboarding Agent Doubled Activation (GrowthMates)](https://www.growthmates.news/p/how-an-ai-powered-user-onboarding)
- [Wizard UI Pattern Best Practices (Eleken)](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained)
- [Conversational UI Design Rules](https://www.webdesignerdepot.com/2017/06/3-ux-rules-for-conversational-ui-design/)
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)

### Related Work

- Existing Growth Assistant implementation
- Customer chatbot implementation
- Tenant self-signup flow (completed)

---

## Appendix: Example Conversation Flow

```
AGENT: Hey! 👋 I'm your Growth Assistant. I'm here to help you build
       your business on HANDLED.

       Let's start by learning about you. What kind of services
       do you offer?

USER: I'm a wedding photographer

AGENT: Wedding photography — that's such meaningful work!
       Where are you based? I'll research your local market.

USER: Austin, Texas

AGENT: Great! A few more questions to help me understand your business:

       Who's your ideal client? (Luxury weddings, budget-conscious
       couples, elopements, etc.)

USER: I focus on intimate weddings and elopements - couples who
      want something more personal

AGENT: Love it! That's a clear niche. And how long have you been
       doing this?

USER: About 5 years

AGENT: Perfect! Let me save what I've learned...

       [Storing discovery data...]

       ✅ Got it! Here's what I understand:

       📍 Wedding photographer in Austin, TX
       🎯 Specializing in intimate weddings & elopements
       💼 5 years experience
       👥 Ideal client: couples wanting authenticity over production

       Sound right? I'm about to research your local market.

USER: Yes, that's right!

AGENT: [Searching Austin wedding photography market...]

       📊 **Austin Wedding Photography Market**

       I looked at your local competition. Here's what I found:

       **Pricing Ranges:**
       - Budget tier: $1,500 - $2,500
       - Mid-market: $3,000 - $5,000
       - Premium: $6,000 - $10,000+

       **Elopement-Specific:**
       - Hourly: $300-500/hr
       - Half-day packages: $1,200-2,000
       - Full-day adventure: $3,000-5,000

       **Market Opportunity:**
       Only 3-4 Austin photographers explicitly specialize in
       elopements. That's your edge!

       Does this match your experience?

USER: Yeah, that seems about right. Maybe the high end is even
      higher for luxury.

AGENT: Good to know! With 5 years experience and a niche focus,
       you have room to price mid-to-premium.

       Now let's design your service structure. Based on your niche,
       I see two natural segments:

       1. **Elopements** — Adventure shoots, courthouse ceremonies
       2. **Intimate Weddings** — Small guest lists, meaningful venues

       Does having two categories make sense for how you think
       about your business?

USER: Yes! They really are different types of shoots.

AGENT: Perfect! Let's name your tiers within each.

       For **Elopements**, I'm thinking:
       - "Micro" — Quick ceremony, 2 hours
       - "Adventure" — Half-day, travel included
       - "All-Day Adventure" — Full day, unlimited locations

       Do these names resonate?

USER: I like those!

AGENT: Great! Let me create your Elopements segment...

       [Creating segment with packages...]

       ✅ Done! Created "Elopements" with 3 packages:
       - Micro (2 hours)
       - Adventure (4 hours)
       - All-Day Adventure (8 hours)

       Now let's do the same for Intimate Weddings...

[Conversation continues through pricing, marketing, activation...]
```

---

_Plan generated by Claude Code workflows:plan_
_Ready for review: /plan_review or proceed to /workflows:work_
