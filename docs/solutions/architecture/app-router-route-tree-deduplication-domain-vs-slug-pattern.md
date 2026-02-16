---
title: Route tree deduplication and remaining issues cleanup pattern
category: architecture
severity: P2
component: 'Next.js App Router routes ([slug]/(site)/ and _domain/), agent system prompt, adversarial test suite'
symptoms: '12+ duplicated sub-page route files with identical logic differing only in tenant resolution; scattered implicit repetition prevention in agent prompts; missing adversarial test categories'
root_cause: 'Parallel route tree implementations created code duplication; agent system prompt lacked centralized repetition prevention guidance; only basic prompt injection tests existed'
date_resolved: 2026-02-16
pr: '#55'
tags:
  [
    route-deduplication,
    repetition-prevention,
    agent-safety,
    adversarial-testing,
    architecture-cleanup,
  ]
related:
  - docs/solutions/architecture/NEXT_APP_ROUTER_DUAL_ROUTE_DEDUPLICATION.md
  - docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md
  - docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md
  - docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md
---

# Route Tree Deduplication + Remaining Issues Cleanup

## Problem

Three distinct issues accumulated across the MAIS codebase:

1. **Route tree bloat:** Next.js App Router requires route files in both `[slug]/(site)/` and `_domain/` directories for slug-based and domain-based tenant storefronts. Over time, 12 sub-page files (about, contact, faq, gallery, services, testimonials x2) accumulated ~20 lines of boilerplate each, with only the redirect URL differing.

2. **Agent repetition:** The tenant agent re-asked questions users had already answered in their brain dump (e.g., "What do you do?"). The system prompt had only 4 lines of vague guidance scattered across sections.

3. **Adversarial test gaps:** Only basic prompt injection tests existed (49 tests). Missing coverage for indirect injection via tool outputs, encoding bypass, context exhaustion, and multi-turn escalation.

**Bonus discovery:** A P1 handoff doc (`HANDOFF-section-types-sync.md`) describing 6 fixes for section type drift was stale — all fixes had already been applied in prior PRs. Verified via code inspection + typecheck.

## Root Cause

- **Route duplication:** No shared utility existed for the redirect pattern. Each sub-page was copy-pasted.
- **Repetition:** LLMs follow explicit checklists better than scattered prose. The 4-line guidance was too vague.
- **Test gaps:** Initial adversarial tests focused on direct injection only. Real-world attacks are more sophisticated.

## Solution

### 1. Route Deduplication via Shared Redirect Utility

Created `apps/web/src/lib/tenant-redirect.ts`:

```typescript
import { permanentRedirect, notFound } from 'next/navigation';

export function redirectSlugSubPage(slug: string, section: string): never {
  permanentRedirect(`/t/${slug}#${section}`);
}

export function redirectDomainSubPage(domain: string | undefined, section: string): never {
  if (!domain) notFound();
  permanentRedirect(`/?domain=${encodeURIComponent(domain)}#${section}`);
}
```

Each of the 12 sub-page files reduced from ~20 lines to a 3-line wrapper:

```typescript
// apps/web/src/app/t/[slug]/(site)/about/page.tsx
import { redirectSlugSubPage } from '@/lib/tenant-redirect';

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirectSlugSubPage(slug, 'about');
}
```

Also normalized 6 domain error boundary context strings (removed "(domain)" suffix).

**Impact:** 20 files changed, -118 net lines. Redirect behavior is now single-source-of-truth.

### 2. Repetition Prevention Checklist

Added dedicated section to `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`:

```
## Repetition Prevention (CRITICAL)

Before asking ANY question, run this checklist:

1. **Did I already ask this?** Scan conversation history.
2. **Did the user already provide this?** Check brain dump, prior messages.
3. **Does the preview already show real content?** Call get_known_facts.

If YES to any -> DO NOT ask. Move to next missing piece.

**Common traps:**
- Asking "What do you do?" when brain dump already said it
- Asking about pricing after user described tiers
- Re-asking business name/location from signup data
```

### 3. Adversarial Test Expansion (33 New Tests)

Added 4 attack vector categories to `server/src/agent-v2/__tests__/adversarial-edge-cases.test.ts`:

| Category              | Tests | Example                                             |
| --------------------- | ----- | --------------------------------------------------- |
| Indirect injection    | 6     | Fake booking data with embedded system instructions |
| Encoding bypass       | 6     | Base64 markers, unicode homoglyphs, mixed encoding  |
| Context exhaustion    | 5     | Token flooding with injection hidden after padding  |
| Multi-turn escalation | 8     | Trust-building then role shift, conversation reset  |

**Key principle:** Each category includes false-positive tests ensuring legitimate business descriptions pass as safe.

## Key Decisions

1. **Utility module over middleware:** `tenant-redirect.ts` is a simple function module, not middleware. Every sub-page explicitly imports and calls it — no magic.
2. **Checklist over prose:** The repetition prevention section uses a numbered checklist because LLMs follow structured instructions more reliably than paragraphs.
3. **False-positive balance:** Adversarial tests include "I help new photographers find their style" as a must-pass-safe case. Overzealous detection blocks real users.
4. **Handoff doc verification:** Always verify current state before executing handoff docs. Issue 1 (section types sync) was already fully resolved.

## Prevention Strategies

### When Adding New Tenant Sub-Pages

1. Add redirect to `tenant-redirect.ts` if new section type
2. Create both route files as 3-line wrappers
3. Never copy-paste existing page.tsx files — use the utility
4. If both files aren't near-identical in git diff, something is wrong

### When Modifying Agent System Prompts

1. If guidance > 2 sentences, create dedicated section with severity marker
2. Use numbered checklists with concrete domain examples
3. Add "Common traps" anti-patterns
4. Read aloud — if you'd explain it differently, rewrite

### When Extending Adversarial Tests

Organize by layer:

- **Layer 1:** Robustness (unicode, edge cases)
- **Layer 2:** Evasion (encoding bypass)
- **Layer 3:** Supply chain (tool output injection)
- **Layer 4:** Resource (context exhaustion)
- **Layer 5:** Social engineering (multi-turn escalation)

Each layer needs both attack detection AND false-positive prevention tests.

## Related Documentation

- `docs/solutions/architecture/NEXT_APP_ROUTER_DUAL_ROUTE_DEDUPLICATION.md` — Prior route dedup analysis
- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` — Constants drift pattern
- `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md` — Agent security patterns
- `docs/solutions/testing-patterns/AGENT_V2_SAFETY_TESTS_IMPLEMENTATION_PATTERN.md` — Safety test patterns
