---
module: MAIS
date: 2026-01-09
problem_type: architecture_mismatch
component: storefront, agent, repository
symptoms:
  - AI says content is "live" but public storefront shows placeholders
  - Schema validation fails silently on ID format mismatch
  - Different code paths write incompatible data formats
root_cause: Multiple code paths (AI executor vs admin API) disagreed on storage format
resolution_type: prevention_strategy
severity: P1
tags: [architecture, draft-system, validation, AI-communication, multi-path]
issues: ['#697', '#699']
---

# Dual Draft System Prevention Strategies

**Prevention strategies from storefront draft/live confusion bug (#697, #699)**

This document captures critical patterns to prevent similar issues where multiple code paths disagree on data format expectations.

---

## Executive Summary

| Pattern                       | Risk     | Impact                                           |
| ----------------------------- | -------- | ------------------------------------------------ |
| Schema validation mismatch    | High     | Silent failures, data appears valid but unusable |
| Read/write path inconsistency | Critical | Data written correctly but read incorrectly      |
| AI communication gaps         | Medium   | Users told operations succeeded when they didn't |

**Key Insight:** When multiple code paths (AI tools, admin API, public API) interact with the same data, ALL paths must agree on format. Format mismatches fail silently - validation passes but data is unusable.

---

## The Bug Pattern

### What Happened

1. **Zod schema used wrong ID format**: `TenantPublicDtoSchema` validated `id: z.string().uuid()` but Prisma generates CUIDs
2. **Write path vs read path mismatch**: AI executor wrote raw config to `landingPageConfig`, but public API's `extractPublishedLandingPage()` expected `{published: config}` wrapper
3. **Missing AI communication rules**: Tools returned data but no guidance on whether content was draft or live

### The Cascade

```
AI writes content → landingPageConfigDraft ✓
AI publishes → landingPageConfig = raw config ✓
                                   (should be {published: config})
Public API reads → looks for landingPageConfig.published ✗
                   → Returns null → Shows placeholders
User sees: "Published!" but storefront empty
```

---

## Prevention Strategy 1: Schema Validation Alignment

**Problem:** Zod schema validates one ID format, but database generates another.

**Root Cause:** `z.string().uuid()` used when Prisma generates CUIDs (25-char alphanumeric).

### Prevention Checklist

Before adding ID validation to any schema:

- [ ] Check how the ID is generated (Prisma default, UUID v4, CUID, custom)
- [ ] Match Zod validator to actual generation method
- [ ] Test with real database-generated IDs, not mock UUIDs
- [ ] Document ID format in schema comments

### Decision Tree

```
What generates the ID?
├── Prisma @default(cuid()) → z.string().cuid() or z.string()
├── Prisma @default(uuid()) → z.string().uuid()
├── Custom prefix (pk_live_*) → z.string().startsWith('pk_live_')
├── External system → z.string() (don't validate format)
└── Unknown/multiple sources → z.string() (safest)
```

### Code Pattern

```typescript
// WRONG: Assumes UUID when Prisma uses CUID
export const TenantPublicDtoSchema = z.object({
  id: z.string().uuid(), // ❌ Fails on CUIDs like "clo0a1b2c3d4e5f6g7h8i9j0k"
  ...
});

// CORRECT: Match actual ID format or use permissive string
export const TenantPublicDtoSchema = z.object({
  id: z.string(), // ✅ Accepts any string ID
  // OR be explicit:
  // id: z.string().cuid(), // ✅ If you know it's CUID
  ...
});
```

### Test Pattern

```typescript
describe('TenantPublicDtoSchema', () => {
  // Test with real database ID format
  it('should accept CUID format from Prisma', () => {
    const realTenantId = 'clo0a1b2c3d4e5f6g7h8i9j0k'; // Actual CUID format
    const result = TenantPublicDtoSchema.safeParse({
      id: realTenantId,
      ...validData,
    });
    expect(result.success).toBe(true);
  });

  // Regression test for UUID assumption bug
  it('should NOT require UUID format', () => {
    // This would fail if schema uses z.string().uuid()
    const cuidId = 'cm1234567890abcdefghijk';
    const result = TenantPublicDtoSchema.shape.id.safeParse(cuidId);
    expect(result.success).toBe(true);
  });
});
```

---

## Prevention Strategy 2: Read/Write Path Consistency

**Problem:** Write path stores data in one format, read path expects another format.

**Root Cause:** Multiple code paths (AI executor, admin API, public API) evolved independently without shared abstraction.

### Prevention Checklist

Before implementing a new write path for shared data:

- [ ] Document existing read paths that consume this data
- [ ] Verify write format matches what read paths expect
- [ ] Write integration test: write via new path → read via all existing paths
- [ ] Consider creating a service abstraction for multi-path data

### Detection Questions

Ask these during code review:

1. "What code reads this data after it's written?"
2. "Is the format I'm writing what the reader expects?"
3. "Are there multiple write paths? Do they all write the same format?"
4. "Is there a wrapper/envelope format the reader expects?"

### Code Pattern

```typescript
// WRONG: Direct copy bypassing expected format
registerProposalExecutor('publish_draft', async (tenantId, payload) => {
  await prisma.tenant.update({
    data: {
      landingPageConfig: tenant.landingPageConfigDraft, // ❌ Raw config
    },
  });
});

// CORRECT: Match format expected by read path
registerProposalExecutor('publish_draft', async (tenantId, payload) => {
  // Document what read path expects
  // extractPublishedLandingPage() looks for landingPageConfig.published
  const publishedWrapper = {
    draft: null,
    draftUpdatedAt: null,
    published: tenant.landingPageConfigDraft, // ✅ Wrapped in expected format
    publishedAt: new Date().toISOString(),
  };

  await prisma.tenant.update({
    data: {
      landingPageConfig: publishedWrapper,
    },
  });
});
```

### Multi-Path Data Consistency Checklist

For any data with multiple read/write paths:

```markdown
## [Data Field] Multi-Path Audit

### Write Paths

| Path            | Location                    | Format Written      |
| --------------- | --------------------------- | ------------------- |
| AI Executor     | storefront-executors.ts:606 | {published: config} |
| Admin API       | tenant.repository.ts:937    | {published: config} |
| [Add all paths] |                             |                     |

### Read Paths

| Path            | Location                 | Format Expected     |
| --------------- | ------------------------ | ------------------- |
| Public API      | tenant.repository.ts:710 | {published: config} |
| Preview API     | tenant.routes.ts:XX      | {draft: config}     |
| [Add all paths] |                          |                     |

### Consistency Check

- [ ] All write paths produce same format
- [ ] Read paths can handle format from all write paths
- [ ] Integration test covers: each write path → each read path
```

### Service Abstraction Pattern

When multiple paths read/write the same data, create a service:

```typescript
// server/src/services/landing-page.service.ts
export class LandingPageService {
  /**
   * Single source of truth for landing page data format.
   * Both AI tools and admin API use this service.
   */

  async publishDraft(tenantId: string): Promise<void> {
    // Encapsulates format knowledge
    const draft = await this.getDraft(tenantId);
    const wrapper = this.createPublishedWrapper(draft);
    await this.saveLive(tenantId, wrapper);
  }

  async getDraft(tenantId: string): Promise<LandingPageConfig | null> {
    // Single implementation
  }

  async getLive(tenantId: string): Promise<LandingPageConfig | null> {
    // Extracts from wrapper format
  }

  private createPublishedWrapper(config: LandingPageConfig): LandingPageWrapper {
    return {
      draft: null,
      draftUpdatedAt: null,
      published: config,
      publishedAt: new Date().toISOString(),
    };
  }
}
```

---

## Prevention Strategy 3: AI Communication Clarity

**Problem:** AI tools return data without guidance on how to communicate state to users.

**Root Cause:** Tool responses showed content but didn't indicate if it was draft or live, leading AI to say "on your storefront" when content was unpublished.

### Prevention Checklist

For any tool that returns state-dependent data:

- [ ] Include state indicator in response (`hasDraft`, `status`, `isLive`)
- [ ] Add explicit `note` field with communication guidance
- [ ] Use clear conditional phrasing rules
- [ ] Test that AI follows the communication rules

### Communication Rules Pattern

```typescript
export const getLandingPageDraftTool: AgentTool = {
  name: 'get_landing_page_draft',
  description: `Get the current draft state of the landing page.

Returns:
- Whether a draft exists (hasDraft)
- The current pages and sections

COMMUNICATION RULES:
- If hasDraft=true: Say "In your unpublished draft..." or "Your draft shows..."
- If hasDraft=false: Say "On your live storefront..." or "Visitors currently see..."
- NEVER say "live" or "on your storefront" when hasDraft=true`,

  async execute(context, params) {
    const { hasDraft, pages } = await getDraftConfig(...);

    return {
      success: true,
      data: {
        hasDraft,
        pages,
        // Explicit guidance in response
        note: hasDraft
          ? 'DRAFT content shown above. Say "In your draft..." when discussing. Never say "live" or "on your storefront" - this is unpublished.'
          : 'LIVE content shown above. Say "On your live storefront..." when discussing - visitors see this now.',
      },
    };
  },
};
```

### State-Dependent Response Template

```typescript
interface StateAwareResponse {
  success: true;
  data: {
    // Actual data
    content: T;

    // State indicator (REQUIRED)
    state: 'draft' | 'live' | 'pending';

    // Communication guidance (REQUIRED for user-facing tools)
    note: string;

    // Preview URL when applicable
    previewUrl?: string;
  };
}

// Helper to generate consistent notes
function getStateNote(state: 'draft' | 'live'): string {
  const notes = {
    draft: 'DRAFT content shown. Say "In your draft..." - NOT live yet.',
    live: 'LIVE content shown. Say "On your storefront..." - visitors see this.',
  };
  return notes[state];
}
```

### Test Pattern for AI Communication

```typescript
describe('AI communication rules', () => {
  it('should include communication guidance when draft exists', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      landingPageConfigDraft: { pages: { home: { sections: [] } } },
    });

    const result = await getLandingPageDraftTool.execute(context, {});

    expect(result.data.hasDraft).toBe(true);
    expect(result.data.note).toContain('DRAFT');
    expect(result.data.note).toContain('In your draft');
    expect(result.data.note).not.toContain('on your storefront');
  });

  it('should include live guidance when no draft', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      landingPageConfigDraft: null,
      landingPageConfig: { pages: { home: { sections: [] } } },
    });

    const result = await getLandingPageDraftTool.execute(context, {});

    expect(result.data.hasDraft).toBe(false);
    expect(result.data.note).toContain('LIVE');
    expect(result.data.note).toContain('On your storefront');
  });
});
```

---

## Code Review Checklist

Add these items to code review when touching multi-path data:

### Schema Validation

```markdown
- [ ] ID validation matches actual ID generation method
- [ ] Tested with real database-generated IDs (not mocks)
- [ ] Schema comments document expected ID format
```

### Multi-Path Data

```markdown
- [ ] All write paths documented
- [ ] All read paths documented
- [ ] Write format matches read expectations
- [ ] Integration test: each write path → each read path
- [ ] Consider service abstraction if >2 paths exist
```

### AI Tool Responses

```markdown
- [ ] State indicator included (hasDraft, status, isLive)
- [ ] Communication guidance in `note` field
- [ ] Tool description includes communication rules
- [ ] Tested that response guides correct user-facing language
```

---

## Quick Reference

```
DUAL DRAFT SYSTEM - QUICK REFERENCE

1. Schema Validation Alignment
   - Check: What generates the ID?
   - Match: z.string().cuid() for Prisma default
   - Test: Use real database IDs, not mock UUIDs

2. Read/Write Path Consistency
   - Ask: "What reads this data after I write it?"
   - Ask: "Is my format what the reader expects?"
   - Document: All read and write paths for shared data
   - Consider: Service abstraction for multi-path data

3. AI Communication Clarity
   - Include: state indicator (hasDraft, isLive)
   - Include: communication note ("Say 'In your draft...'")
   - Document: rules in tool description
   - Test: Response guides correct language

4. Warning Signs (code smell)
   - JSON field written in multiple places
   - "Works in AI" but "broken in public API"
   - Schema validation passes but data is empty
   - AI says "published" but nothing changed
```

---

## Related Documentation

- **STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md** - Section ID patterns
- **build-mode-storefront-editor-patterns-MAIS-20260105.md** - Build mode patterns
- **chatbot-proposal-execution-flow-MAIS-20251229.md** - Proposal execution patterns
- **Todo #704** - Landing page service abstraction (recommended follow-up)

---

## Document Maintenance

**Created:** 2026-01-09
**Source:** Issues #697, #699 - Draft/live confusion in storefront tools
**Commit:** 4607f2f3
**Status:** Active prevention strategy

Update this document when:

- New data formats with multiple code paths are added
- AI communication patterns evolve
- Service abstractions are created for multi-path data
