# Agent-First Architecture Specification

> **Status:** LOCKED
> **Decision Date:** 2026-02-01
> **Authority:** Mike Young
> **Decisive Answer:** "The agent is the canonical author of business reality, with UI as a view."

---

## Implementation Status

> **Note (February 2, 2026):** Phase 2's planned `storefrontDraft`/`storefrontPublished` columns were superseded by the Phase 5 Section Content Migration. The `SectionContent` table now serves as canonical storage with `isDraft` boolean for draft/publish workflow. See CLAUDE.md "Storefront Storage (Phase 5)" section.

| Phase       | Status        | Description                                                             |
| ----------- | ------------- | ----------------------------------------------------------------------- |
| **Phase 0** | ✅ Complete   | Legacy deletion (XState, AdvisorMemoryService, archive)                 |
| **Phase 1** | ✅ Complete   | Context injection with `forbiddenSlots` slot-policy                     |
| **Phase 2** | ✅ Superseded | `SectionContent` table replaced planned `storefrontDraft` columns       |
| **Phase 3** | ⏳ Pending    | Agent prompt hardening                                                  |
| **Phase 4** | ⏳ Pending    | Evaluation pipeline restoration                                         |
| **Phase 5** | ✅ Complete   | Visual editor simplification (via SectionContent migration, Feb 2 2026) |

**Phase 1 Key Files:**

- `server/src/services/context-builder.service.ts` - Single source of truth
- `server/src/services/context-builder.service.test.ts` - 10 regression tests
- `server/src/services/vertex-agent.service.ts` - Session creation with bootstrap
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Slot-policy instructions

---

## Foundational Invariants

These are non-negotiable. Any code violating these is automatically wrong.

### 1. Context Is Injected, Never Inferred

The agent receives a complete context object at session start. It never asks questions to discover information that exists in storage.

```typescript
// CORRECT: Context injected at session creation
const context = await contextBuilder.build(tenantId);
const session = await adk.createSession({
  state: {
    tenantId,
    knownFacts: context.knownFacts,
    storefrontState: context.storefrontState,
    constraints: context.constraints,
  },
});

// WRONG: Agent discovers context through conversation
Agent: 'What do you do?'; // FORBIDDEN if answer exists in storage
```

### 2. One Memory Read Path

All agent context comes from a single `ContextBuilder` module. No scattered reads.

```typescript
// The ONLY way to read agent context
class ContextBuilder {
  async build(tenantId: string): Promise<AgentContext> {
    // Single source of truth for all context reads
  }
}
```

### 3. One Draft Write Path

Agent writes to one canonical location. No parallel draft systems.

```typescript
// The ONLY draft location (as of Phase 5 Section Content Migration)
SectionContent table with isDraft: true  // Agent writes here via SectionContentService

// DELETED: These no longer exist
// tenant.storefrontDraft        ← SUPERSEDED by SectionContent (this spec was itself outdated)
// tenant.storefrontPublished    ← SUPERSEDED by SectionContent (isDraft: false)
// tenant.landingPageConfig.draft  ← DELETED
// tenant.landingPageConfigDraft   ← DELETED
```

### 4. Agent Owns Business Reality

When the agent modifies state, that IS the new reality. UI subscribes and renders.

```
User Input → Agent Processing → Canonical State → UI Render
                    ↓
              (state change)
                    ↓
              UI auto-updates
```

The visual editor becomes a view into agent-authored state, not an independent authoring system.

### 5. Evaluation Is First-Class

Every session is scored. Certain failures block progression.

```typescript
// Hard gates (automatic failure)
const HARD_GATES = {
  askedKnownFact: true, // Asked question whose answer exists
  exceededTurnBudget: true, // More than N turns without progress
  exceededTokenBudget: true, // Cost exceeded threshold
  usedForbiddenWord: true, // Off-brand language
};

// Soft scoring (trend analysis)
const SOFT_METRICS = {
  helpfulness: 1 - 5,
  toneConsistency: 1 - 5,
  taskCompletionRate: 0 - 100,
};
```

### 6. Deletion Is A Feature

Dead code is tech debt. If something isn't used, delete it. Archive branches exist for archaeology.

---

## The Context Contract

Every agent session receives this structure. This is the API between backend and agent.

```typescript
interface AgentContext {
  // Identity
  tenantId: string;
  businessName: string;
  businessType: string; // e.g., "wedding_photographer"

  // Known Facts (agent must NOT ask about these)
  knownFacts: {
    businessDescription?: string;
    location?: string;
    serviceArea?: string;
    yearsInBusiness?: number;
    specializations?: string[];
    priceRange?: string;
    targetAudience?: string;
    uniqueSellingPoints?: string[];
    // ... extensible
  };

  // Editable Facts (user can correct, agent can propose changes)
  editableFacts: {
    brandVoice?: {
      tone: string; // "casual" | "professional" | "warm"
      avoids: string[]; // words/phrases to never use
      preferences: string[];
    };
    visualPreferences?: {
      style: string;
      colors?: string[];
    };
  };

  // Current Storefront State
  storefrontState: {
    completion: number; // 0-100
    sections: {
      hero: SectionState;
      about: SectionState;
      services: SectionState;
      faq: SectionState;
      reviews: SectionState;
    };
    hasDraft: boolean;
    lastPublished?: Date;
  };

  // Constraints
  constraints: {
    maxTurnsPerSession: number;
    maxTokensPerSession: number;
    forbiddenWords: string[];
    requiredSections: string[];
  };

  // Current Goals
  goals: {
    primary: string; // e.g., "complete_storefront"
    secondary: string[];
    blockers: string[];
  };

  // Open Tasks
  openTasks: {
    id: string;
    description: string;
    priority: number;
    status: 'pending' | 'in_progress' | 'blocked';
  }[];

  // Forbidden Questions (agent must NEVER ask these)
  forbiddenQuestions: string[];
}

interface SectionState {
  status: 'empty' | 'draft' | 'published';
  content?: Record<string, unknown>;
  lastModified?: Date;
}
```

---

## Canonical Storage Schema

> **Updated (February 2, 2026):** The original plan for `storefrontDraft`/`storefrontPublished` columns was superseded. `SectionContent` table became the canonical storage instead.

### What Exists Now (Post-Phase 5)

| Storage                           | Purpose                        | Owner                               |
| --------------------------------- | ------------------------------ | ----------------------------------- |
| `tenant.branding.discoveryFacts`  | Known facts about the business | Agent (via `store_discovery_fact`)  |
| `SectionContent` (isDraft: true)  | Agent-authored draft content   | Agent (via `SectionContentService`) |
| `SectionContent` (isDraft: false) | Live storefront content        | Agent (via `publishAll()`)          |
| `tenant.landingPageConfig`        | READ-ONLY legacy fallback      | Public routes during transition     |

### What Was Deleted

| Storage                          | Original Purpose              | Deletion Status                              |
| -------------------------------- | ----------------------------- | -------------------------------------------- |
| `tenant.landingPageConfig.draft` | Visual editor draft wrapper   | DELETED                                      |
| `tenant.landingPageConfigDraft`  | Agent draft (separate column) | DELETED                                      |
| `tenant.storefrontDraft`         | Planned in this spec          | NEVER CREATED - superseded by SectionContent |
| `tenant.storefrontPublished`     | Planned in this spec          | NEVER CREATED - superseded by SectionContent |
| `OnboardingEvent` table          | Event-sourced onboarding      | Kept (dual-source with discoveryFacts)       |
| XState machines                  | Onboarding flow control       | DELETED                                      |
| `AdvisorMemoryService`           | Legacy memory system          | DELETED                                      |

---

## Trust Tier Mapping

Memory mutations follow the trust tier system:

| Tier   | Behavior               | Examples                                    |
| ------ | ---------------------- | ------------------------------------------- |
| **T1** | Auto-execute           | Store discovery fact, read storefront state |
| **T2** | Propose + soft confirm | Update section copy, change headline        |
| **T3** | Explicit confirm       | Publish storefront, delete content          |

```typescript
// T1: Silent execution
await tools.storeDiscoveryFact({ key: 'location', value: 'Austin, TX' });

// T2: Agent proposes, shows preview, asks "look right?"
await tools.updateSection({
  section: 'about',
  content: newCopy,
  confirmationRequired: true, // Shows preview, awaits response
});

// T3: Explicit user action required
await tools.publishStorefront({
  requiresExplicitConfirmation: true, // User must click "Publish" or say "publish it"
});
```

---

## Evaluation Hard Gates

These cause immediate session failure:

```typescript
const HARD_GATES = {
  // Repetition (the P0 bug)
  askedKnownFact: {
    check: (turn, context) => {
      const question = extractQuestion(turn.agentResponse);
      if (!question) return false;
      return isAnsweredByContext(question, context.knownFacts);
    },
    severity: 'FATAL',
    action: 'END_SESSION_WITH_ERROR',
  },

  // Resource limits
  exceededTurnBudget: {
    check: (session) => session.turns.length > context.constraints.maxTurnsPerSession,
    severity: 'FATAL',
    action: 'GRACEFUL_HANDOFF',
  },

  exceededTokenBudget: {
    check: (session) => session.totalTokens > context.constraints.maxTokensPerSession,
    severity: 'FATAL',
    action: 'GRACEFUL_HANDOFF',
  },

  // Brand safety
  usedForbiddenWord: {
    check: (turn, context) => {
      return context.constraints.forbiddenWords.some((word) =>
        turn.agentResponse.toLowerCase().includes(word.toLowerCase())
      );
    },
    severity: 'ERROR',
    action: 'RETRY_GENERATION',
  },
};
```

---

## Migration Path

### Phase 0: Deletion Manifest

Files and systems to delete (see `DELETION_MANIFEST.md`).

### Phase 1: Context Builder

Build the single `ContextBuilder` module that produces `AgentContext`.

### Phase 2: Schema Migration

1. Migrate `landingPageConfigDraft` → `storefrontDraft`
2. Migrate `landingPageConfig.published` → `storefrontPublished`
3. Migrate `discoveryFacts` structure if needed
4. Delete old columns after verification

### Phase 3: Agent Prompt Update

Update tenant-agent system prompt to:

1. Receive `AgentContext` at session start
2. Reference `knownFacts` block
3. Never ask questions about known facts
4. Use trust tier for mutations

### Phase 4: Evaluation Pipeline

Restore and enhance the deleted LLM-as-Judge system:

1. Score every session
2. Enforce hard gates
3. Track trends
4. Alert on regressions

### Phase 5: Visual Editor Simplification

Convert visual editor from author → viewer:

1. Remove draft management
2. Subscribe to `storefrontDraft` changes
3. Provide "suggest edit" that routes to agent
4. Keep direct publish as T3 action

---

## Success Criteria

- [ ] Agent never asks a question whose answer exists in `knownFacts`
- [ ] One read path: `ContextBuilder.build(tenantId)`
- [ ] One write path: `storefrontDraft` + `storefrontPublished`
- [ ] Every session scored
- [ ] Repetition is a hard fail in evaluation
- [ ] XState onboarding fully deleted
- [ ] `AdvisorMemoryService` fully deleted
- [ ] Visual editor operates in view mode only

---

## References

- Decision source: Agent Ecosystem Master Report (`docs/reports/2026-02-01-agent-ecosystem-master-report.md`)
- P0 bug location: `server/src/services/vertex-agent.service.ts:265`
- Trust tier docs: `server/src/agent-v2/deploy/tenant/src/tools/index.ts`
- Current storage: `prisma/schema.prisma`
