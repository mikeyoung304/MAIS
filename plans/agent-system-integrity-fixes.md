# Agent System Integrity Fixes

> **Status:** ALL PHASES COMPLETED (2026-01-12)
> **Branch:** `feat/agent-system-integrity-fixes`
> **Note:** Phase 5.2 (packages as section type) deferred - current approach works well

> **Status:** Draft → **Reviewed** | **Created:** 2026-01-12 | **Type:** Bug Fix + Enhancement
> **Review Date:** 2026-01-12 | **Reviewers:** 5 specialized agents (Trust, Migration, Reliability, UX, Docs)

---

## ⚠️ Review Findings (Pre-Implementation Blockers)

This plan was reviewed by 5 specialized agents focused on enterprise AI quality. **3 blockers** and **6 high-priority recommendations** were identified.

### 🚫 BLOCKERS (Must Address Before Implementation)

#### Blocker 1: Branding Safety Gap (CRITICAL)

**Issue:** `update_storefront_branding` applies immediately to the **live site** (bypasses draft system) but is T1 (auto-execute). The plan proposes "clear messaging only" which is insufficient.

**Required Fix:** Add `revert_branding` tool (see Phase 1 additions below) OR add branding to draft system.

**Business Impact:** Users could accidentally change their live site's branding with no undo. Enterprise customers will not accept this.

#### Blocker 2: Data Migration Rollback Strategy Missing (HIGH)

**Issue:** The `normalizeToPages()` merge logic could corrupt legacy tenant configs with no recovery path.

**Critical Edge Cases:**

- Duplicate sections if IDs are inconsistent
- Empty `sections: []` (intentional removal) gets defaults re-added
- Section ID collisions between custom and generated IDs

**Required Fix:** Add backup column and feature flag before Phase 4 deployment (see Phase 0 below).

#### Blocker 3: Trust Tier Documentation Mismatch

**Issue:** System prompt line 223 lists `discard` as T2, but code has `discard_draft` at **T3**. The Appendix table in this plan also had this wrong.

**Required Fix:** Appendix table corrected below. System prompt fix added to Phase 1.

---

### ⚡ High-Priority Recommendations

| #   | Area    | Issue                                              | Resolution                                        |
| --- | ------- | -------------------------------------------------- | ------------------------------------------------- |
| 1   | Phase 1 | Plan proposes `setInterval` cleanup                | Keep existing count-based cleanup (more reliable) |
| 2   | Phase 3 | Browser fingerprinting raises GDPR/CCPA concerns   | Use session cookies instead                       |
| 3   | Phase 2 | No visual indicator when section is highlighted    | Add CSS glow/pulse effect                         |
| 4   | Phase 2 | 500ms highlight stagger causes overlapping scrolls | Increase to 800ms                                 |
| 5   | Phase 4 | No dry-run mode for migration preview              | Add preview API endpoint                          |
| 6   | All     | Missing observability for 72-hour stability test   | Add session map metrics                           |

---

### ✅ What the Plan Gets Right

1. **Trust tier alignment direction** - Aligning prompts to T1 (not reverting code to T2) is correct for the "paintbrush effect" UX
2. **Tool existence claims** - All three "missing tools" (publish_draft, discard_draft, get_landing_page_draft) verified to exist
3. **Highlight pipeline fix** - Correctly identifies the missing `onSectionHighlight` prop gap
4. **Section selection handler** - Correctly identifies the empty `BUILD_MODE_SECTION_SELECTED` handler
5. **Phase ordering** - P0 → P1 → P2 dependency chain is correct

---

## Overview

This plan addresses **19 interconnected issues** across three domains:

1. **Agent System (8 issues):** Trust-tier drift, UI pipeline gaps, safety & hygiene
2. **Landing Page Configuration (8 issues):** Default template seeding, legacy migration, preview/live mismatch
3. **Build Mode Modernization (3 issues):** Section IDs for legacy, packages as section type

The fixes restore system integrity, ensure Build Mode works end-to-end for **both new and legacy tenants**, and establish guardrails to prevent regression.

**Impact:** Build Mode UX, new tenant onboarding, legacy tenant experience, agent reliability, SEO, security

## Problem Statement

The MAIS agent system has accumulated technical debt across **four layers**:

1. **Trust Layer Drift:** Tools execute at T1 (auto-confirm) but documentation/prompts promise T2/T3 (user confirmation). This breaks user expectations and consent semantics.

2. **UI Pipeline Gaps:** Two critical paths are broken:
   - Agent highlights → never reach the preview (missing callback prop)
   - User section clicks → never reach the agent (message dropped)

3. **Safety & Hygiene:** Branding changes bypass draft safety, circuit breaker lacks time-based cleanup (memory leak risk), and documentation is dangerously out of date.

4. **Landing Page Configuration:** New tenants see a minimal public site (missing sections), preview differs from live, legacy tenants stuck on partial layouts, and SEO metadata reads wrong fields.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Current State (Broken)                      │
├─────────────────────────────────────────────────────────────────┤
│  Agent says         Tools execute as    User expects            │
│  "T2 - say wait"    T1 (auto-exec)      confirmation            │
│         ↓                  ↓                   ↓                │
│    MISMATCH ────────── MISMATCH ────────── BROKEN UX            │
├─────────────────────────────────────────────────────────────────┤
│  Agent highlights    PanelAgentChat      Preview iframe         │
│  [home-hero-main]    parses correctly    never receives         │
│         ↓                  ↓                   ↓                │
│      WORKS ─────────── WORKS ─────────── BROKEN (no callback)   │
├─────────────────────────────────────────────────────────────────┤
│  User clicks         PreviewPanel        Agent context          │
│  section in iframe   receives message    never updated          │
│         ↓                  ↓                   ↓                │
│      WORKS ─────────── DROPPED ─────────── BROKEN               │
├─────────────────────────────────────────────────────────────────┤
│  NEW TENANT           PROVISIONING         PUBLIC SITE          │
│  created              no config seeded     shows minimal page   │
│         ↓                  ↓                   ↓                │
│      WORKS ─────────── MISSING ────────── BROKEN (3 sections)   │
├─────────────────────────────────────────────────────────────────┤
│  BUILD MODE           DEFAULT_PAGES        PUBLIC SITE          │
│  preview shows        CONFIG used          legacy path renders  │
│         ↓                  ↓                   ↓                │
│    FULL SITE ─────── NOT SAVED ─────────── MISMATCH             │
├─────────────────────────────────────────────────────────────────┤
│  LEGACY TENANT        normalizeToPages()   MISSING SECTIONS     │
│  has old config       doesn't merge        no About/Contact     │
│         ↓                  ↓                   ↓                │
│    PARTIAL ─────────── NO MERGE ─────────── STUCK FOREVER       │
└─────────────────────────────────────────────────────────────────┘
```

## Proposed Solution

Fix all 19 issues in five phases, prioritized by risk and dependency order:

| Phase | Issues                                                     | Risk Level | Effort  |
| ----- | ---------------------------------------------------------- | ---------- | ------- |
| 1     | Trust tier alignment, Circuit breaker cleanup              | Critical   | 4-6 hrs |
| 2     | Highlight pipeline, Section selection, Duplicate IDs       | High       | 3-4 hrs |
| 3     | Branding clarity, Public chat hardening, Doc updates       | Medium     | 2-3 hrs |
| 4     | Landing page config: provisioning, legacy migration, SEO   | High       | 5-7 hrs |
| 5     | Build Mode modernization: section IDs, packages as section | Medium     | 3-4 hrs |

## Technical Approach

### Phase 0: Pre-Implementation Setup (ADDED BY REVIEW)

> **Added 2026-01-12:** These steps must be completed before any Phase 1-5 work begins.

#### Fix 0.1: Data Backup Column for Rollback

**Problem:** Phase 4 normalization could corrupt legacy configs with no recovery path.

**Solution:**

```sql
-- Run before deploying any Phase 4 changes
ALTER TABLE branding ADD COLUMN IF NOT EXISTS landing_page_config_backup JSONB;
UPDATE branding SET landing_page_config_backup = landing_page_config
WHERE landing_page_config IS NOT NULL;
```

**Acceptance Criteria:**

- [ ] Backup column exists on `branding` table
- [ ] All existing configs backed up
- [ ] Rollback script tested: `UPDATE branding SET landing_page_config = landing_page_config_backup WHERE id = ?`

---

#### Fix 0.2: Feature Flag for Normalization

**Problem:** Need ability to disable normalization if issues arise in production.

**Solution:**

```typescript
// Add to server/src/config/feature-flags.ts
export const FEATURE_FLAGS = {
  ENABLE_CONFIG_NORMALIZATION: process.env.ENABLE_CONFIG_NORMALIZATION === 'true',
  ENABLE_LEGACY_SECTION_MERGE: process.env.ENABLE_LEGACY_SECTION_MERGE === 'true',
};

// In normalizeToPages()
if (!FEATURE_FLAGS.ENABLE_CONFIG_NORMALIZATION) {
  return config?.pages ?? DEFAULT_PAGES_CONFIG.pages;
}
```

**Acceptance Criteria:**

- [ ] Feature flags defined
- [ ] Normalization respects flags
- [ ] Flags default to `false` (opt-in rollout)

---

#### Fix 0.3: Add Observability Metrics

**Problem:** Missing metrics for 72-hour stability test.

**Solution:**

```typescript
// Add to server/src/agent/orchestrator/metrics.ts
export const agentMemoryMetrics = {
  sessionMapSize: new Gauge({
    name: 'agent_session_map_size',
    help: 'Number of entries in session maps',
    labelNames: ['map_type', 'agent_type'],
    registers: [agentRegistry],
  }),

  sessionEvictionsTotal: new Counter({
    name: 'agent_session_evictions_total',
    help: 'Total session evictions by reason',
    labelNames: ['reason', 'agent_type'],
    registers: [agentRegistry],
  }),
};
```

**Acceptance Criteria:**

- [ ] `agent_session_map_size` gauge exposed
- [ ] `agent_session_evictions_total` counter exposed
- [ ] Grafana dashboard created for memory monitoring

---

### Phase 1: Critical Fixes (P0)

#### Fix 1.1: Trust-Tier Alignment

**Problem:** `onboarding-system-prompt.ts` tells the agent that `update_page_section`, `remove_page_section`, and `update_storefront_branding` are T2 ("say wait to undo"), but these tools now execute as T1 (auto-confirm) after the paintbrush effect fix.

**Root Cause:** When tools were changed from T2→T1 in `storefront-tools.ts`, the prompt and capability registry weren't updated.

**Files:**

- `server/src/agent/prompts/onboarding-system-prompt.ts:221-226`
- `apps/web/src/lib/agent-capabilities.ts` (trust tier metadata)

**Solution:**

```typescript
// onboarding-system-prompt.ts - BEFORE (lines 221-226)
## Tools

**T1 (just do it):** get_market_research, list_section_ids, get_*, update_onboarding_state, reorder, toggle
**T2 (do it, "say wait to undo"):** upsert_services, update_page_section, remove_page_section, branding, discard
**T3 (ask first):** publish_draft

// onboarding-system-prompt.ts - AFTER
## Tools

**T1 (just do it):** get_market_research, list_section_ids, get_*, update_onboarding_state, reorder, toggle, update_page_section, remove_page_section, update_storefront_branding
**T2 (do it, "say wait to undo"):** upsert_services
**T3 (ask first):** publish_draft, discard_draft

Use section IDs (e.g., "home-hero-main"), not indices.
```

**Acceptance Criteria:**

- [ ] `onboarding-system-prompt.ts` trust tier list matches `storefront-tools.ts` definitions
- [ ] `agent-capabilities.ts` trust tier metadata updated for all affected tools
- [ ] Unit test: trust tier in tool definition === tier in createProposal call
- [ ] E2E test: `update_page_section` executes without proposal pending

---

#### Fix 1.2: Circuit Breaker Idle Timeout (REVISED BY REVIEW)

**Problem:** Circuit breaker only uses count-based limits (turns, tokens). Sessions that stay under limits but idle for hours are never cleaned up, causing memory leaks in long-running production servers.

**Files:**

- `server/src/agent/orchestrator/circuit-breaker.ts`
- `server/src/agent/orchestrator/base-orchestrator.ts`

> **REVIEW NOTE:** The original plan proposed adding `setInterval` for cleanup. However, the codebase **already has count-based cleanup** (runs every 100 chat calls) which is more reliable because:
>
> 1. Self-regulating: Cleanup frequency scales with load
> 2. No zombie intervals on hot reload
> 3. No startup overhead until first usage
>
> **Revised approach:** Add idle check to existing count-based cleanup, don't add new interval.

**Solution:**

```typescript
// circuit-breaker.ts - Add idle timeout config (NO new interval)

export interface CircuitBreakerConfig {
  maxTurnsPerSession: number;
  maxTokensPerSession: number;
  maxTimePerSessionMs: number;
  maxIdleTimeMs: number;        // NEW: 30 minutes default
}

export class CircuitBreaker {
  private lastActivityTime: number = Date.now();

  check(): CircuitBreakerCheckResult {
    const now = Date.now();

    // Existing checks...

    // NEW: Idle timeout check
    const idleTime = now - this.lastActivityTime;
    if (idleTime >= this.config.maxIdleTimeMs) {
      return {
        allowed: false,
        reason: 'session_idle_timeout',
        message: 'Session expired due to inactivity. Please start a new conversation.',
      };
    }

    return { allowed: true };
  }

  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }
}

// base-orchestrator.ts - ENHANCE existing cleanup (DO NOT add setInterval)
private cleanupOldCircuitBreakers(): void {
  const CIRCUIT_BREAKER_TTL_MS = 65 * 60 * 1000; // 65 minutes
  const now = Date.now();
  let evictionCount = 0;

  for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
    const state = circuitBreaker.getState();
    const ageMs = now - state.startTime;
    const idleMs = now - state.lastActivityTime; // NEW: Check idle time

    if (ageMs > CIRCUIT_BREAKER_TTL_MS || idleMs > this.config.maxIdleTimeMs) {
      this.circuitBreakers.delete(sessionId);
      evictionCount++;
      logger.info({ sessionId, reason: idleMs > this.config.maxIdleTimeMs ? 'idle' : 'age' },
        'Session cleaned up');
    }
  }

  // NEW: Record metrics for observability
  if (evictionCount > 0) {
    agentMemoryMetrics.sessionEvictionsTotal.inc({ reason: 'cleanup', agent_type: this.agentType }, evictionCount);
  }
  agentMemoryMetrics.sessionMapSize.set({ map_type: 'circuit_breakers', agent_type: this.agentType },
    this.circuitBreakers.size);
}
```

**Acceptance Criteria:**

- [ ] Sessions idle >30 minutes are cleaned up on next cleanup cycle
- [ ] ~~Cleanup runs on 1-minute interval~~ **REMOVED:** Keep count-based trigger
- [ ] Memory usage stable over 72-hour test
- [ ] Metrics: session count, eviction rate logged via Prometheus
- [ ] Cleanup wrapped in try-catch (don't fail user requests on cleanup error)

---

#### Fix 1.3: Branding Revert Tool (ADDED BY REVIEW - BLOCKER)

**Problem:** `update_storefront_branding` applies immediately to the **live site** (bypasses draft system) but is T1 (auto-execute). Users have no way to undo accidental branding changes.

> **REVIEW BLOCKER:** This is a consent gap. The plan originally proposed "clear messaging only" which is insufficient for enterprise customers.

**Files:**

- `server/src/agent/tools/storefront-tools.ts`
- `server/src/agent/prompts/onboarding-system-prompt.ts`

**Solution:**

```typescript
// storefront-tools.ts - Add revert_branding tool

// Store previous branding before changes
const BRANDING_HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const brandingHistory = new Map<string, { previous: BrandingConfig; timestamp: number }>();

export const revertBrandingTool: AgentTool = {
  name: 'revert_branding',
  trustTier: 'T1',
  description: 'Revert to previous branding (available for 24 hours after last change)',
  parameters: z.object({
    tenantId: z.string(),
  }),
  execute: async ({ tenantId }, context) => {
    const history = brandingHistory.get(tenantId);

    if (!history) {
      return {
        success: false,
        message: 'No previous branding to revert to. Changes older than 24 hours are permanent.',
      };
    }

    const ageMs = Date.now() - history.timestamp;
    if (ageMs > BRANDING_HISTORY_TTL_MS) {
      brandingHistory.delete(tenantId);
      return {
        success: false,
        message: 'Previous branding expired (24-hour window). Current branding is now permanent.',
      };
    }

    // Restore previous branding
    await context.services.branding.update(tenantId, history.previous);
    brandingHistory.delete(tenantId);

    return {
      success: true,
      message: 'Branding reverted to previous state.',
      revertedTo: history.previous,
    };
  },
};

// Modify updateStorefrontBrandingTool to save history before changes
// In execute function, before applying new branding:
const currentBranding = await context.services.branding.get(tenantId);
brandingHistory.set(tenantId, {
  previous: currentBranding,
  timestamp: Date.now(),
});
```

```typescript
// onboarding-system-prompt.ts - Update branding guidance

## Branding Changes

**Important:** Branding changes (colors, fonts, logo) apply **immediately** to your live site.

After making branding changes:
1. Tell the user: "I've updated your branding. Say 'revert branding' within 24 hours if you want to go back."
2. The `revert_branding` tool is available for 24 hours after each change.
3. After 24 hours, branding changes become permanent.
```

**Acceptance Criteria:**

- [ ] `revert_branding` tool implemented at T1
- [ ] Previous branding stored before each update
- [ ] 24-hour TTL on revert window
- [ ] Clear messaging in prompt about immediacy and revert option
- [ ] E2E test: change branding → revert → verify restored

---

### Phase 2: UI Pipeline Fixes (P1)

#### Fix 2.1: Highlighting Pipeline End-to-End

**Problem:** `PanelAgentChat` parses `[highlight section-id]` correctly and renders `HighlightTrigger`, but `AgentPanel` never passes the `onSectionHighlight` callback prop, so highlights are parsed but never sent to the preview.

**Files:**

- `apps/web/src/components/agent/AgentPanel.tsx:~line 241`
- `apps/web/src/components/agent/PanelAgentChat.tsx:~line 293`

**Solution:**

```tsx
// AgentPanel.tsx - Pass callback to PanelAgentChat

// Find where PanelAgentChat is rendered (around line 400+)
<PanelAgentChat
  messages={messages}
  isLoading={isLoading}
  onSendMessage={handleSendMessage}
  onSectionHighlight={(sectionId) => {
    // Route to Zustand store action
    agentUIActions.highlightSection(sectionId);
  }}
/>
```

```tsx
// PanelAgentChat.tsx - Already accepts prop, verify it's used

interface PanelAgentChatProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onSectionHighlight?: (sectionId: string) => void; // Verify this exists
}

// In render, verify HighlightTrigger receives callback:
{
  highlights.length > 0 && (
    <HighlightTrigger
      highlights={highlights}
      onSectionHighlight={onSectionHighlight} // Must be passed
    />
  );
}
```

**Acceptance Criteria:**

- [ ] `onSectionHighlight` prop passed from `AgentPanel` to `PanelAgentChat`
- [ ] Agent message with `[highlight home-hero-main]` → preview scrolls to section
- [ ] Invalid section ID → graceful no-op (no crash) + console.warn for debugging
- [ ] E2E test: highlight flow end-to-end

---

#### Fix 2.1b: Visual Highlight Effect (ADDED BY REVIEW)

**Problem:** Agent highlights scroll to section, but there's no visual indicator showing which section is highlighted. Users can't tell "what the agent is talking about" after scroll completes.

> **REVIEW NOTE:** This was identified as a UX quality gap. Scroll-only feedback is insufficient.

**Files:**

- `apps/web/src/components/tenant/SectionRenderer.tsx`
- `apps/web/src/styles/build-mode.css` (or equivalent)

**Solution:**

```css
/* build-mode.css - Add highlight effect */

[data-highlighted='true'] {
  position: relative;
  box-shadow:
    0 0 0 3px var(--sage),
    0 0 20px rgba(var(--sage-rgb), 0.3);
  transition: box-shadow 0.3s ease;
}

[data-highlighted='true']::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid var(--sage);
  border-radius: inherit;
  animation: highlight-pulse 1.5s ease-in-out 2;
  pointer-events: none;
}

@keyframes highlight-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.01);
  }
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  [data-highlighted='true']::before {
    animation: none;
  }
}
```

```tsx
// SectionRenderer.tsx - Add data attribute for highlighted state
<div
  data-section-id={section.id}
  data-highlighted={highlightedSectionId === section.id}
  className={cn(/* existing classes */)}
>
```

```typescript
// useBuildModeSync.ts - Increase stagger timing
// Change from 500ms to 800ms to prevent overlapping scrolls
const HIGHLIGHT_STAGGER_MS = 800; // Was 500ms
```

**Acceptance Criteria:**

- [ ] Highlighted sections have visible glow/pulse effect
- [ ] Effect respects `prefers-reduced-motion`
- [ ] Highlight stagger increased to 800ms (prevent scroll overlap)
- [ ] Effect clears when highlight is removed

---

#### Fix 2.2: Section Selection Event Handler

**Problem:** When user clicks a section in the preview iframe, `BUILD_MODE_SECTION_SELECTED` is sent via postMessage, but `PreviewPanel.tsx` just logs it without taking action.

**Files:**

- `apps/web/src/components/preview/PreviewPanel.tsx:178-185`
- `apps/web/src/hooks/useBuildModeSync.ts`

**Solution:**

```tsx
// PreviewPanel.tsx - Handle section selection

case 'BUILD_MODE_SECTION_SELECTED':
  // User clicked a section in preview
  const { pageId, sectionIndex } = message.data;

  // Convert to section ID format
  const sectionId = `${pageId}-section-${sectionIndex}`;

  // Update agent UI state to show selected section
  agentUIActions.setSelectedSection(sectionId);

  // Optionally: Send context to agent chat
  // This could auto-suggest: "I see you selected the hero section. What would you like to change?"
  if (onSectionSelected) {
    onSectionSelected(sectionId);
  }
  break;
```

```tsx
// Add to agent-ui-store.ts
setSelectedSection: (sectionId: string | null) =>
  set((state) => {
    state.selectedSection = sectionId;
    // Could trigger agent suggestion here
  }),
```

**Acceptance Criteria:**

- [ ] Click section in preview → `agentUIActions.setSelectedSection` called
- [ ] Selected section highlighted in preview
- [ ] Agent chat receives context about selection (optional enhancement)
- [ ] Debounce rapid clicks (500ms)

---

#### Fix 2.3: Duplicate Capability IDs

**Problem:** `update_page_section` appears twice in `agent-capabilities.ts`, potentially causing confusion in command palette ranking.

**Files:**

- `apps/web/src/lib/agent-capabilities.ts`

**Solution:**

```typescript
// Find and remove duplicate entries
// Add compile-time uniqueness check:

const CAPABILITY_IDS = [
  'update_page_section',
  'remove_page_section',
  // ... all IDs
] as const;

type CapabilityId = (typeof CAPABILITY_IDS)[number];

// TypeScript will error if duplicates exist in the array
// Add runtime check for safety:
const uniqueIds = new Set(CAPABILITY_IDS);
if (uniqueIds.size !== CAPABILITY_IDS.length) {
  throw new Error('Duplicate capability IDs detected');
}
```

**Acceptance Criteria:**

- [ ] All duplicate capability IDs removed
- [ ] Compile-time check prevents future duplicates
- [ ] Unit test verifies ID uniqueness

---

### Phase 3: Safety & Documentation (P2)

#### Fix 3.1: Branding Immediacy Clarification

**Problem:** `update_storefront_branding` applies changes immediately (not draft), but prompt messaging implies draft safety ("make changes, preview, then publish").

**Files:**

- `server/src/agent/prompts/onboarding-system-prompt.ts`
- `server/src/agent/tools/storefront-tools.ts`

**Solution:** Update messaging to be explicit about immediate application:

```typescript
// In onboarding-system-prompt.ts, add clarity:

## Branding Changes

**Important:** Branding changes (colors, fonts, logo) apply **immediately** to your live site.
Unlike section edits which can be drafted and discarded, branding is tenant-level configuration.

If you want to preview branding changes safely:
1. Use the preview panel to see changes
2. Note current values before changing
3. Tell me to "revert branding" if you don't like the result
```

**Acceptance Criteria:**

- [ ] Prompt clearly states branding is immediate
- [ ] Agent explains immediacy before making branding changes
- [ ] Add `revert_branding` tool or undo mechanism (enhancement)

---

#### Fix 3.2: Public Chatbot Rate Limiting Enhancement (REVISED BY REVIEW)

**Problem:** Public chat only uses IP-based rate limiting. Users behind NAT share limits; mobile users with rotating IPs bypass limits.

**Files:**

- `server/src/routes/public-customer-chat.routes.ts`
- `server/src/middleware/rateLimiter.ts`

> **REVIEW NOTE:** The original plan proposed browser fingerprinting using User-Agent, Accept-Language, and Accept-Encoding headers. This raises **GDPR/CCPA privacy concerns**:
>
> - Browser fingerprinting constitutes "unique identifiers" under both regulations
> - Requires privacy policy disclosure and potentially user consent
> - High collision rates with common browser configs
>
> **Revised approach:** Use session cookies instead of fingerprinting. More privacy-compliant and more reliable.

**Solution:** Add session-based rate limiting via cookies:

```typescript
// rateLimiter.ts - Add dual-layer limiting with COOKIES (not fingerprinting)

import { v4 as uuidv4 } from 'uuid';

export const publicChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 20,
  keyGenerator: (req, res) => {
    // Primary: IP-based
    const ip = normalizeIp(req.ip);

    // Secondary: Session cookie (NOT fingerprint)
    let sessionId = req.cookies?.chatSession;
    if (!sessionId) {
      sessionId = uuidv4();
      res.cookie('chatSession', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }

    // Dual key: limits apply to BOTH
    return `${ip}:${sessionId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limited',
      message: 'Too many messages. Please wait a moment.',
      retryAfter: 60,
    });
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});
```

**Why Cookies Instead of Fingerprinting:**
| Aspect | Fingerprinting | Session Cookies |
|--------|---------------|-----------------|
| Privacy | GDPR/CCPA concerns | Standard, well-understood |
| User control | Cannot opt-out | User can clear cookies |
| Collision rate | High (common configs) | Zero (UUID) |
| Reliability | Varies by browser | Consistent |

**Acceptance Criteria:**

- [ ] Rate limiting uses IP + session cookie
- [ ] ~~Uses browser fingerprinting~~ **REMOVED:** Privacy concerns
- [ ] Session cookie set with secure flags (httpOnly, secure, sameSite)
- [ ] Multiple sessions from same IP get separate limits
- [ ] E2E tests bypass rate limiter (`isTestEnvironment` check)
- [ ] 429 response includes `retryAfter` header and standard rate limit headers

---

#### Fix 3.3: Documentation Repair

**Problem:** Two docs contain incorrect claims:

1. `BUILD_MODE_CURRENT_STATE_AND_ISSUES.md` says `publish_draft`, `discard_draft`, `get_landing_page_draft` are missing — they exist
2. `AI_HYGIENE_REPORT.md` claims "NO production AI/LLM integration" — completely false

**Files:**

- `BUILD_MODE_CURRENT_STATE_AND_ISSUES.md`
- `AI_HYGIENE_REPORT.md`

**Solution:**

```markdown
<!-- BUILD_MODE_CURRENT_STATE_AND_ISSUES.md -->
<!-- Find "Agent Parity Gap" section and update: -->

## Agent Tools Status

✅ **All core tools implemented:**

- `update_page_section` (T1)
- `remove_page_section` (T1)
- `reorder_page_sections` (T1)
- `toggle_page_enabled` (T1)
- `update_storefront_branding` (T1)
- `publish_draft` (T3)
- `discard_draft` (T3)
- `get_landing_page_draft` (T1)

<!-- AI_HYGIENE_REPORT.md -->
<!-- Complete rewrite needed - current report is obsolete -->

# AI Integration Status

**Status:** MAIS has a **production-ready AI agent system**.

## Components

- Customer chatbot (`/t/[slug]` public chat)
- Admin onboarding agent (Build Mode)
- Tool orchestration with trust tiers
- Proposal system with T1/T2/T3 consent

## Files

- `server/src/agent/` - Agent orchestrators, tools, prompts
- `apps/web/src/components/agent/` - Agent UI components
- `packages/contracts/src/agent.ts` - Agent API contracts
```

**Acceptance Criteria:**

- [ ] `BUILD_MODE_CURRENT_STATE_AND_ISSUES.md` reflects actual tool inventory
- [ ] `AI_HYGIENE_REPORT.md` accurately describes AI integration
- [ ] Add CI check: tool inventory generated from code vs docs

---

### Phase 4: Landing Page Configuration (P1)

#### Fix 4.1: Seed Default Template on Tenant Provisioning

**Problem:** New tenants get no `landingPageConfig` or `landingPageConfigDraft`, causing the public site to fall into a legacy render path that shows only Hero → Packages → CTA. Missing: About, Testimonials, FAQ, Contact.

**Root Cause:** `tenant-provisioning.service.ts` creates tenants but doesn't seed the default landing page config.

**Files:**

- `server/src/services/tenant-provisioning.service.ts`
- `packages/contracts/src/landing-page.ts` (DEFAULT_PAGES_CONFIG)

**Solution:**

```typescript
// tenant-provisioning.service.ts

import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

async createTenant(input: CreateTenantInput): Promise<Tenant> {
  const tenant = await this.prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      // ... existing fields

      // NEW: Seed default landing page config
      branding: {
        create: {
          // ... existing branding defaults
          landingPageConfig: DEFAULT_PAGES_CONFIG,
          landingPageConfigDraft: DEFAULT_PAGES_CONFIG,
        },
      },
    },
  });

  return tenant;
}
```

**Acceptance Criteria:**

- [ ] New tenants have `landingPageConfig` populated with DEFAULT_PAGES_CONFIG
- [ ] New tenants have `landingPageConfigDraft` populated (same as config)
- [ ] Public site for new tenant shows all 6+ default sections
- [ ] Build Mode preview matches public site for new tenants

---

#### Fix 4.2: Preview vs Live Consistency

**Problem:** Build Mode preview uses `DEFAULT_PAGES_CONFIG` even when the tenant has no saved config, but the public site uses the legacy render path. This creates a jarring mismatch.

**Files:**

- `apps/web/src/components/tenant/TenantLandingPageClient.tsx`
- `apps/web/src/components/tenant/TenantLandingPage.tsx`

**Solution:**

```typescript
// TenantLandingPage.tsx - Update public render to use DEFAULT_PAGES_CONFIG when no config exists

export function TenantLandingPage({ tenant, branding }: Props) {
  // Use page-based config if it exists, otherwise use DEFAULT
  const pagesConfig = branding.landingPageConfig?.pages
    ?? DEFAULT_PAGES_CONFIG.pages;

  // Render using page-based logic (not legacy path)
  return (
    <PageBasedLandingPage
      pages={pagesConfig}
      branding={branding}
      tenant={tenant}
    />
  );
}
```

**Acceptance Criteria:**

- [ ] Public site uses DEFAULT_PAGES_CONFIG when `landingPageConfig` is null
- [ ] Preview and public site render identical sections
- [ ] No "legacy path" fallback for null configs

---

#### Fix 4.3: Legacy Tenant Migration with Section Merge

**Problem:** `normalizeToPages()` converts legacy data format to page-based, but if `pages` already exists with incomplete sections, there's no merge with DEFAULT_PAGES_CONFIG. Legacy tenants are permanently stuck with partial layouts.

**Files:**

- `apps/web/src/lib/tenant.client.ts`
- `packages/contracts/src/landing-page.ts`

**Solution:**

```typescript
// tenant.client.ts - Enhance normalizeToPages to merge with defaults

export function normalizeToPages(config: LandingPageConfig): NormalizedPagesConfig {
  // If already has pages, merge with defaults to fill gaps
  if (config.pages) {
    return mergeWithDefaults(config.pages, DEFAULT_PAGES_CONFIG.pages);
  }

  // Convert legacy to pages format
  return convertLegacyToPages(config);
}

function mergeWithDefaults(existing: PagesConfig, defaults: PagesConfig): PagesConfig {
  const merged = { ...defaults };

  for (const [pageName, defaultPage] of Object.entries(defaults)) {
    const existingPage = existing[pageName];

    if (existingPage) {
      // Merge sections: keep existing, add missing defaults
      merged[pageName] = {
        ...defaultPage,
        ...existingPage,
        sections: mergeSections(existingPage.sections, defaultPage.sections),
      };
    }
  }

  return merged;
}

function mergeSections(existing: Section[], defaults: Section[]): Section[] {
  const existingIds = new Set(existing.map((s) => s.id));
  const missingDefaults = defaults.filter((d) => !existingIds.has(d.id));

  // Add missing default sections at appropriate positions
  return [...existing, ...missingDefaults];
}
```

**Acceptance Criteria:**

- [ ] Legacy tenants with partial `pages` get missing sections from defaults
- [ ] Merge preserves existing customizations
- [ ] Missing About/Contact sections are added for legacy tenants
- [ ] Unit test: partial config → merged config with all sections

---

#### Fix 4.4: Remove Hard-Coded Section ID Dependency

**Problem:** `TenantLandingPage.tsx` specifically looks for `home-text-about` section ID to position the About section before packages. If legacy configs don't have that exact ID, About renders after packages.

**Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx`

**Solution:**

```typescript
// TenantLandingPage.tsx - Use section type, not ID

// BEFORE (brittle)
const aboutSection = sections.find((s) => s.id === 'home-text-about');

// AFTER (robust)
const aboutSection =
  sections.find((s) => s.type === 'text' && s.id.includes('about')) ||
  sections.find((s) => s.type === 'about');

// Better yet: respect section order from config, don't hard-code positions
const orderedSections = pages.home.sections; // Already in correct order
```

**Acceptance Criteria:**

- [ ] About section position determined by config order, not ID matching
- [ ] Legacy configs with different About IDs still render correctly
- [ ] No hard-coded section ID lookups in render logic

---

#### Fix 4.5: Add Contact Section for Legacy Configs

**Problem:** Legacy schema never stored Contact as a section type. Only page-based config has it. Legacy tenants permanently miss Contact.

**Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx`
- `packages/contracts/src/landing-page.ts`

**Solution:**

```typescript
// In normalizeToPages() or mergeWithDefaults()

// Ensure Contact section exists for all tenants
function ensureContactSection(sections: Section[]): Section[] {
  const hasContact = sections.some((s) => s.type === 'contact' || s.id.includes('contact'));

  if (!hasContact) {
    sections.push({
      id: 'home-contact-main',
      type: 'contact',
      enabled: true,
      content: DEFAULT_CONTACT_CONTENT,
    });
  }

  return sections;
}
```

**Acceptance Criteria:**

- [ ] Legacy tenants get Contact section added via normalization
- [ ] Contact appears at end of page by default
- [ ] No duplicate Contact sections if already exists

---

#### Fix 4.6: Fix SEO Metadata for Page-Based Configs

**Problem:** SEO metadata in `page.tsx` reads from `landingConfig.hero`, but for page-based configs, hero is inside `pages.home.sections[]`. New tenants get wrong/empty SEO descriptions.

**Files:**

- `apps/web/src/app/t/[slug]/(site)/page.tsx`

**Solution:**

```typescript
// page.tsx - Extract hero from correct location

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenant = await getTenantBySlug(params.slug);
  const branding = tenant.branding;

  // Try page-based hero first, fallback to legacy
  const heroSection = branding.landingPageConfig?.pages?.home?.sections?.find(
    (s) => s.type === 'hero'
  );

  const heroContent = heroSection?.content ?? branding.landingConfig?.hero;

  return {
    title: tenant.name,
    description: heroContent?.subheadline || heroContent?.description || '',
    // ... rest of metadata
  };
}
```

**Acceptance Criteria:**

- [ ] SEO description extracted from page-based hero section
- [ ] Fallback to legacy hero if page-based not available
- [ ] New tenants have correct SEO metadata
- [ ] Test: page-based config → correct meta description

---

#### Fix 4.7: Agent Completion Tracking

**Problem:** The onboarding prompt suggests starting with Hero, but there's no enforced "completion" tracking. `get_unfilled_placeholders` tool exists but isn't referenced in prompts or context building.

**Files:**

- `server/src/agent/prompts/onboarding-system-prompt.ts`
- `server/src/agent/context/context-builder.ts`
- `server/src/agent/tools/storefront-tools.ts`

**Solution:**

```typescript
// context-builder.ts - Add completion status to agent context

export function buildOnboardingContext(tenant: Tenant): OnboardingContext {
  const config = tenant.branding.landingPageConfigDraft ?? DEFAULT_PAGES_CONFIG;

  // Calculate completion status
  const completionStatus = calculateCompletionStatus(config);

  return {
    tenant,
    config,
    completionStatus: {
      heroComplete: !hasPlaceholders(config.pages.home.sections.find(s => s.type === 'hero')),
      servicesComplete: config.pages.services?.sections?.length > 0,
      aboutComplete: !hasPlaceholders(findAboutSection(config)),
      contactComplete: !hasPlaceholders(findContactSection(config)),
      overallProgress: calculateProgress(completionStatus),
      nextSuggestedSection: getNextIncompleteSection(completionStatus),
    },
  };
}

// onboarding-system-prompt.ts - Reference completion in prompt

## Website Completion

Current progress: {{completionStatus.overallProgress}}%

**Completed:** {{completionStatus.completed.join(', ')}}
**Needs attention:** {{completionStatus.incomplete.join(', ')}}

Start with {{completionStatus.nextSuggestedSection}} if the user hasn't specified.
```

**Acceptance Criteria:**

- [ ] Agent context includes completion status
- [ ] Prompt references completion progress
- [ ] `get_unfilled_placeholders` output used in context
- [ ] Agent suggests next incomplete section

---

#### Fix 4.8: Runtime Legacy Migration (Optional Enhancement)

**Problem:** The migration script `migrate-to-page-config.ts` is a one-off script, not runtime. Existing legacy tenants aren't auto-updated unless the script is manually run.

**Files:**

- `server/scripts/migrate-to-page-config.ts`
- `apps/web/src/lib/tenant.client.ts`

**Solution Options:**

**Option A: Runtime normalization (simpler, no migration needed)**

```typescript
// Already handled by Fix 4.3 - normalizeToPages() merges with defaults
// Legacy tenants get normalized on read, no write required
```

**Option B: Background migration job (more thorough)**

```typescript
// Add migration job that runs on server startup
// Converts all legacy configs to page-based format

async function migrateAllLegacyConfigs() {
  const legacyTenants = await prisma.tenant.findMany({
    where: {
      branding: {
        landingPageConfig: null,
      },
    },
  });

  for (const tenant of legacyTenants) {
    const migrated = migrateLegacyToPageConfig(tenant.branding);
    await prisma.branding.update({
      where: { tenantId: tenant.id },
      data: { landingPageConfig: migrated },
    });
  }
}
```

**Recommendation:** Use Option A (runtime normalization) for simplicity. Option B can be run manually for data cleanup.

**Acceptance Criteria:**

- [ ] Legacy tenants work via runtime normalization (no migration required)
- [ ] Migration script documented for optional one-time cleanup
- [ ] No breaking changes to existing tenant data

---

### Phase 5: Build Mode Modernization (P2 - Enhancement)

#### Fix 5.1: Add Section IDs to Legacy Normalized Sections

**Problem:** Legacy configs converted via `normalizeToPages()` may not have proper section IDs (e.g., `home-hero-main`), causing highlight and edit tools to fail on these sections.

**Files:**

- `apps/web/src/lib/tenant.client.ts`

**Solution:**

```typescript
// tenant.client.ts - Ensure all sections have proper IDs

function ensureSectionIds(page: string, sections: Section[]): Section[] {
  return sections.map((section, index) => {
    // If section has no ID or generic ID, generate proper one
    if (!section.id || section.id.startsWith('section-')) {
      return {
        ...section,
        id: generateSectionId(page, section.type, index),
      };
    }
    return section;
  });
}

function generateSectionId(page: string, type: string, index: number): string {
  // Format: {page}-{type}-{qualifier}
  // e.g., home-hero-main, home-text-about, services-packages-main
  const qualifier = index === 0 ? 'main' : `${index + 1}`;
  return `${page}-${type}-${qualifier}`;
}

// Apply in normalizeToPages()
export function normalizeToPages(config: LandingPageConfig): NormalizedPagesConfig {
  const normalized = mergeWithDefaults(config.pages, DEFAULT_PAGES_CONFIG.pages);

  // Ensure all sections have proper IDs
  for (const [pageName, page] of Object.entries(normalized)) {
    page.sections = ensureSectionIds(pageName, page.sections);
  }

  return normalized;
}
```

**Acceptance Criteria:**

- [ ] All legacy sections have proper IDs after normalization
- [ ] ID format follows `{page}-{type}-{qualifier}` pattern
- [ ] Highlight tool works on legacy normalized sections
- [ ] Edit tool can target legacy sections by ID

---

#### Fix 5.2: Packages as a Section Type

**Problem:** Packages are currently rendered separately from the section config system. They can't be reordered, disabled, or highlighted like other sections. This creates inconsistent editing UX.

**Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx`
- `packages/contracts/src/landing-page.ts`
- `server/src/agent/tools/storefront-tools.ts`

**Solution:**

```typescript
// landing-page.ts - Add packages section type

export type SectionType = 'hero' | 'text' | 'testimonials' | 'faq' | 'contact' | 'cta' | 'packages'; // NEW

export interface PackagesSectionContent {
  headline?: string;
  subheadline?: string;
  // Packages data comes from tenant.packages, not stored in section
  // Section just controls placement and visibility
}

// DEFAULT_PAGES_CONFIG update
export const DEFAULT_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [
      { id: 'home-hero-main', type: 'hero', enabled: true, content: DEFAULT_HERO },
      { id: 'home-text-about', type: 'text', enabled: true, content: DEFAULT_ABOUT },
      { id: 'home-packages-main', type: 'packages', enabled: true, content: {} }, // NEW
      {
        id: 'home-testimonials-main',
        type: 'testimonials',
        enabled: true,
        content: DEFAULT_TESTIMONIALS,
      },
      { id: 'home-faq-main', type: 'faq', enabled: true, content: DEFAULT_FAQ },
      { id: 'home-contact-main', type: 'contact', enabled: true, content: DEFAULT_CONTACT },
      { id: 'home-cta-main', type: 'cta', enabled: true, content: DEFAULT_CTA },
    ],
  },
  // ...
};
```

```tsx
// TenantLandingPage.tsx - Render packages as a section

function renderSection(section: Section, tenant: Tenant) {
  switch (section.type) {
    case 'hero':
      return <HeroSection content={section.content} />;
    case 'packages':
      // Packages data from tenant, placement from section config
      return (
        <PackagesSection
          packages={tenant.packages}
          headline={section.content?.headline}
          enabled={section.enabled}
        />
      );
    // ... other cases
  }
}

// Render sections in config order (packages included)
{
  sections.map(
    (section) =>
      section.enabled && (
        <div key={section.id} data-section-id={section.id}>
          {renderSection(section, tenant)}
        </div>
      )
  );
}
```

**Benefits:**

- Packages can be reordered via `reorder_page_sections` tool
- Packages can be disabled via section toggle
- Packages section can be highlighted in Build Mode
- Consistent UX for all section types

**Acceptance Criteria:**

- [ ] `packages` is a valid section type in schema
- [ ] DEFAULT_PAGES_CONFIG includes packages section
- [ ] Packages render at position defined in config
- [ ] Agent can reorder packages relative to other sections
- [ ] Agent can highlight packages section
- [ ] Packages section respects `enabled` flag

---

## Alternative Approaches Considered

### Trust Tier Alignment

| Approach                          | Pros                             | Cons                            | Decision                                |
| --------------------------------- | -------------------------------- | ------------------------------- | --------------------------------------- |
| Update prompts to match code (T1) | Simple, matches current behavior | Users lose confirmation safety  | **Selected** - behavior already shipped |
| Update code to match prompts (T2) | Restores user confirmations      | Breaks paintbrush effect fix    | Rejected                                |
| Context-dependent tiers           | Most flexible                    | Complex, harder to reason about | Future consideration                    |

### Section Selection UX

| Approach                  | Pros                   | Cons                   | Decision             |
| ------------------------- | ---------------------- | ---------------------- | -------------------- |
| Auto-suggest edit         | Proactive, guides user | Could be annoying      | Phase 2 enhancement  |
| Just highlight + log      | Simple, non-intrusive  | User must type request | **Selected for MVP** |
| Open section editor panel | Rich UX                | Architecture change    | Deferred             |

### Branding Safety

| Approach             | Pros                    | Cons                       | Decision             |
| -------------------- | ----------------------- | -------------------------- | -------------------- |
| Add to draft system  | Consistent safety model | Breaking change, complex   | Future consideration |
| Clear messaging only | Simple, no code change  | Still immediate            | **Selected**         |
| Add undo mechanism   | Best of both worlds     | Additional tool complexity | Phase 2 enhancement  |

### Landing Page Default Seeding

| Approach                       | Pros                   | Cons                         | Decision            |
| ------------------------------ | ---------------------- | ---------------------------- | ------------------- |
| Seed on provisioning           | Guaranteed consistency | Requires provisioning change | **Selected**        |
| Runtime default fallback       | No data changes needed | Inconsistent behavior        | Combined with above |
| Lazy migration on first access | Gradual rollout        | Complex, race conditions     | Rejected            |

### Legacy Tenant Migration

| Approach                         | Pros                           | Cons                         | Decision            |
| -------------------------------- | ------------------------------ | ---------------------------- | ------------------- |
| Runtime normalization            | No migration needed, immediate | Performance overhead on read | **Selected**        |
| One-time batch migration         | Clean data, no runtime cost    | Requires coordination, risk  | Optional cleanup    |
| Hybrid (normalize + async write) | Best of both                   | More complex                 | Future optimization |

### Section ID Handling

| Approach               | Pros          | Cons                   | Decision         |
| ---------------------- | ------------- | ---------------------- | ---------------- |
| Hard-coded ID lookup   | Explicit      | Brittle, breaks legacy | Current (broken) |
| Type-based lookup      | More flexible | Still assumes types    | Fallback option  |
| Config order respected | Most robust   | Requires full refactor | **Selected**     |

---

## Acceptance Criteria

### Functional Requirements

- [ ] Trust tier alignment: prompt matches tool definitions
- [ ] Highlighting: agent `[highlight X]` → preview scrolls to section
- [ ] Section selection: click section → agent context updated
- [ ] Circuit breaker: idle sessions cleaned up after 30 minutes
- [ ] Branding: prompt explicitly states immediate application
- [ ] Rate limiting: dual IP + session layer
- [ ] Docs: accurate tool inventory and AI status
- [ ] New tenants: public site shows all default sections (6+)
- [ ] New tenants: preview matches public site exactly
- [ ] Legacy tenants: missing sections added via normalization
- [ ] SEO: metadata reads from correct hero source
- [ ] Agent: completion tracking in context and prompt

### Non-Functional Requirements

- [ ] Memory stable over 72-hour production run
- [ ] No E2E test regressions
- [ ] Type safety maintained (no new `any` casts)
- [ ] All changes have unit test coverage

### Quality Gates

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] E2E tests for highlight and section selection flows
- [ ] Code review approval

---

## Success Metrics

| Metric                     | Current | Target | Measurement                                 |
| -------------------------- | ------- | ------ | ------------------------------------------- |
| Trust tier consistency     | 60%     | 100%   | Audit script comparing tool defs to prompts |
| Highlight success rate     | 0%      | 95%    | E2E test pass rate                          |
| Section selection handling | 0%      | 100%   | Event logged + state updated                |
| Memory growth (72hr)       | Unknown | <10%   | Heap snapshot comparison                    |
| Doc accuracy               | ~50%    | 100%   | Manual review                               |
| New tenant section count   | 3       | 6+     | Count sections on fresh tenant public site  |
| Preview/live match rate    | ~60%    | 100%   | Visual regression test                      |
| Legacy tenant sections     | Varies  | 6+     | Section count after normalization           |
| SEO metadata accuracy      | ~50%    | 100%   | Meta description matches hero subheadline   |
| Agent completion tracking  | 0%      | 100%   | Context includes completionStatus           |

---

## Dependencies & Prerequisites

1. **Phase 1 blocks Phase 2:** Trust tier fix must land before highlight/selection work (ensures consistent behavior)
2. **No external dependencies:** All fixes are internal code changes
3. **Test environment:** E2E tests require Playwright setup (already configured)

---

## Risk Analysis & Mitigation

| Risk                                      | Severity | Mitigation                                              |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| Trust tier change breaks user workflows   | Medium   | Document change, no actual behavior change (already T1) |
| Highlight callback causes render loop     | Low      | useCallback with stable deps, test thoroughly           |
| Memory leak fix causes session loss       | Medium   | Warn users before idle timeout, allow extension         |
| Rate limiter blocks legitimate users      | Medium   | Monitor 429 rates, adjust thresholds                    |
| Provisioning change affects existing flow | Medium   | Test tenant creation E2E, feature flag if needed        |
| Normalization changes legacy display      | High     | Thorough testing on legacy tenants before deploy        |
| SEO metadata change affects rankings      | Medium   | Verify change improves SEO, not breaks it               |
| Runtime normalization performance hit     | Low      | Cache normalized config, lazy evaluation                |

---

## Implementation Checklist

> **Updated 2026-01-12:** Added Phase 0 and new fixes from review.

### Phase 0 (Pre-Implementation - MUST DO FIRST)

- [ ] Add `landing_page_config_backup` column to branding table
- [ ] Backup all existing configs
- [ ] Add feature flags (`ENABLE_CONFIG_NORMALIZATION`, `ENABLE_LEGACY_SECTION_MERGE`)
- [ ] Add observability metrics (`agent_session_map_size`, `agent_session_evictions_total`)
- [ ] Create Grafana dashboard for memory monitoring
- [ ] Test rollback script

### Phase 1 (P0 - Critical)

- [ ] Update `onboarding-system-prompt.ts` trust tier list (including `discard` → T3)
- [ ] Update `agent-capabilities.ts` trust tier metadata
- [ ] Add `maxIdleTimeMs` to circuit breaker config
- [ ] ~~Implement session cleanup job~~ **REVISED:** Enhance existing count-based cleanup
- [ ] Wrap cleanup in try-catch (don't fail user requests)
- [ ] **NEW (Fix 1.3):** Implement `revert_branding` tool
- [ ] **NEW (Fix 1.3):** Store branding history before updates (24-hour TTL)
- [ ] Add unit tests for trust tier consistency
- [ ] Add integration test for idle cleanup
- [ ] Add E2E test for branding revert flow

### Phase 2 (P1 - UI Pipeline)

- [ ] Pass `onSectionHighlight` prop in `AgentPanel.tsx`
- [ ] Verify `PanelAgentChat` uses the callback
- [ ] Add console.warn for invalid section IDs (debugging aid)
- [ ] **NEW (Fix 2.1b):** Add visual highlight CSS (glow/pulse effect)
- [ ] **NEW (Fix 2.1b):** Add `data-highlighted` attribute to SectionRenderer
- [ ] **NEW (Fix 2.1b):** Increase highlight stagger from 500ms to 800ms
- [ ] **NEW (Fix 2.1b):** Add `prefers-reduced-motion` check for scrolling
- [ ] Handle `BUILD_MODE_SECTION_SELECTED` in `PreviewPanel.tsx`
- [ ] Add `setSelectedSection` action to agent-ui-store
- [ ] Remove duplicate capability IDs
- [ ] Add uniqueness check for capability IDs
- [ ] Add E2E tests for highlight and selection flows

### Phase 3 (P2 - Safety & Docs)

- [ ] Update branding messaging in prompt (reference `revert_branding` tool)
- [ ] ~~Add session fingerprint to rate limiter~~ **REVISED:** Add session **cookie** (not fingerprint - privacy)
- [ ] Set secure cookie flags (httpOnly, secure, sameSite)
- [ ] Update `BUILD_MODE_CURRENT_STATE_AND_ISSUES.md` (mark Agent Parity Gap as ✅ FIXED)
- [ ] Rewrite `AI_HYGIENE_REPORT.md` (completely outdated)
- [ ] Add tool inventory CI check (see Documentation Verifier report for implementation)

### Phase 4 (P1 - Landing Page Configuration)

> **IMPORTANT:** Ensure Phase 0 backup column and feature flags are deployed first!

- [ ] Seed DEFAULT_PAGES_CONFIG in `tenant-provisioning.service.ts`
- [ ] Update `TenantLandingPage.tsx` to use DEFAULT when config null
- [ ] **NEW:** Respect `ENABLE_CONFIG_NORMALIZATION` feature flag
- [ ] Enhance `normalizeToPages()` to merge with defaults (use `preserve_custom` strategy)
- [ ] **NEW:** Add merge conflict detection - log warnings, don't silently overwrite
- [ ] **NEW:** Add dry-run API endpoint: `GET /api/admin/landing-page/normalize-preview?tenantId=xxx`
- [ ] Remove hard-coded `home-text-about` ID lookup
- [ ] Add `ensureContactSection()` to normalization
- [ ] Fix SEO metadata to read from page-based hero
- [ ] Add completion status to agent context builder
- [ ] Update prompt with completion tracking
- [ ] Document migration script for optional cleanup

### Phase 5 (P2 - Build Mode Modernization)

- [ ] Add `ensureSectionIds()` to normalization pipeline
- [ ] Generate proper IDs for legacy sections (format: `{page}-{type}-{qualifier}`)
- [ ] Add `packages` to SectionType enum
- [ ] Add `PackagesSectionContent` interface
- [ ] Update DEFAULT_PAGES_CONFIG to include packages section
- [ ] Refactor `TenantLandingPage.tsx` to render packages as section
- [ ] Test highlight tool on legacy normalized sections
- [ ] Test reorder tool with packages section

---

## Documentation Updates Required

| Document                                  | Update Needed                  |
| ----------------------------------------- | ------------------------------ |
| `BUILD_MODE_CURRENT_STATE_AND_ISSUES.md`  | Remove "missing tools" claim   |
| `AI_HYGIENE_REPORT.md`                    | Complete rewrite               |
| `CLAUDE.md`                               | Add trust tier quick reference |
| `docs/architecture/AGENT_SYSTEM_INDEX.md` | Create (new)                   |

---

## Test Plan

### Unit Tests

- [ ] Trust tier: tool.trustTier === createProposal tier
- [ ] Circuit breaker: idle timeout triggers cleanup
- [ ] Capability IDs: no duplicates
- [ ] Rate limiter: fingerprint generation

### Integration Tests

- [ ] Highlight flow: agent → store → preview
- [ ] Selection flow: preview → store → agent context
- [ ] Session cleanup: create session, wait 31min, verify deleted

### E2E Tests

- [ ] Full highlight cycle in Build Mode
- [ ] Section click triggers agent acknowledgment
- [ ] Rate limiter allows legitimate traffic, blocks abuse
- [ ] New tenant public site shows all default sections
- [ ] Legacy tenant gets missing sections via normalization
- [ ] SEO metadata correct for page-based configs

---

## References & Research

### Internal References

- Trust tier definitions: `server/src/agent/tools/storefront-tools.ts:7-10`
- Proposal creation: `server/src/agent/orchestrator/proposal.ts`
- Highlight parsing: `apps/web/src/lib/parseHighlights.ts:28-48`
- Section selection protocol: `apps/web/src/lib/build-mode/protocol.ts:115-121`
- Circuit breaker: `server/src/agent/orchestrator/circuit-breaker.ts`
- Tenant provisioning: `server/src/services/tenant-provisioning.service.ts`
- Landing page normalization: `apps/web/src/lib/tenant.client.ts`
- Default pages config: `packages/contracts/src/landing-page.ts`
- Public landing page: `apps/web/src/components/tenant/TenantLandingPage.tsx`
- SEO metadata: `apps/web/src/app/t/[slug]/(site)/page.tsx`
- Agent context builder: `server/src/agent/context/context-builder.ts`
- Migration script: `server/scripts/migrate-to-page-config.ts`

### External References

- 2026 Agent Trust Patterns: [Anthropic MCP Spec](https://modelcontextprotocol.io/specification/2025-11-25)
- Rate Limiting Best Practices: [Redis Sliding Window](https://redis.io/learn/develop/dotnet/aspnetcore/rate-limiting/sliding-window)
- Circuit Breaker Patterns: [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html)

### Related Work

- Paintbrush effect fix: Recent commit `0398b42f`
- Build Mode vision: `docs/architecture/BUILD_MODE_VISION.md`
- Agent eval review: `docs/reviews/agent-eval-system-review-2026-01-02.md`

---

## ERD: No Schema Changes Required

This plan involves only application code changes. No database migrations needed.

---

## Appendix: Trust Tier Reference

> **Updated 2026-01-12:** Corrected `discard_draft` row after review verification.

| Tool                         | Current Code | Current Prompt | Target | Action                                                                 |
| ---------------------------- | ------------ | -------------- | ------ | ---------------------------------------------------------------------- |
| `update_page_section`        | T1           | T2             | T1     | Align prompt to code                                                   |
| `remove_page_section`        | T1           | T2             | T1     | Align prompt to code                                                   |
| `update_storefront_branding` | T1           | T2             | T1     | Align prompt to code                                                   |
| `upsert_services`            | T2           | T2             | T2     | No change needed                                                       |
| `publish_draft`              | T3           | T3             | T3     | No change needed                                                       |
| `discard_draft`              | **T3**       | T2             | T3     | **Align prompt to code** (was incorrectly listed as T2→T3 code change) |
| `revert_branding`            | N/A          | N/A            | T1     | **NEW TOOL** (see Fix 1.3)                                             |

---

## Future Work (Deferred)

Enterprise-grade features that require this plan to be completed first:

- **JSON Patch for config updates** - Replace full-config pushes with patches
- **Config versioning** - Track changes, enable conflict detection
- **Edit lock / multi-tab safety** - Prevent concurrent edit data loss
- **Undo/redo stack** - Granular change history
- **Real-time collaborative editing** - Multi-user simultaneous editing

See: `docs/roadmap/ENTERPRISE_BUILD_MODE.md` for full details.

---

_Generated with Claude Code workflows:plan_
