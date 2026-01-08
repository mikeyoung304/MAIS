# Storefront Section IDs Prevention Strategies

**Prevention strategies from Storefront AI-Chatbot Integration code review (Issues #659-666).**

This document captures the 8 issues found during multi-agent code review and provides prevention strategies to avoid similar issues in future development.

---

## Executive Summary

| Priority | Count | Categories                                   |
| -------- | ----- | -------------------------------------------- |
| P1       | 1     | TOCTOU race condition (data integrity)       |
| P2       | 4     | DRY violations, API inconsistency, test gaps |
| P3       | 3     | YAGNI, defense-in-depth, magic strings       |

**Key insight:** Agent tool development requires consistent patterns across all tools in a feature set. Inconsistency between tools (one supporting `sectionId`, another only `sectionIndex`) creates friction for the AI and users.

---

## The 8 Issues Found

| ID  | Priority | Issue                                          | Category         |
| --- | -------- | ---------------------------------------------- | ---------------- |
| 659 | P1       | TOCTOU race condition in section ID uniqueness | Data Integrity   |
| 660 | P2       | Duplicated sectionId resolution logic          | DRY              |
| 661 | P2       | reorder tool missing sectionId support         | API Consistency  |
| 662 | P2       | Missing test coverage for edge cases           | Testing          |
| 663 | P2       | Migration uses local SECTION_TYPES constant    | DRY              |
| 664 | P3       | Unused isSectionWithId type guard              | YAGNI            |
| 665 | P3       | Executor missing server-side ID generation     | Defense-in-Depth |
| 666 | P3       | Legacy suffix magic string repeated            | Magic Strings    |

---

## Prevention Strategy 1: TOCTOU Race Conditions in JSON Fields

**Problem:** Check-then-write patterns on JSON fields without transaction isolation allow concurrent requests to pass validation against stale data.

**Root Cause (Issue #659):** The executor reads draft config, validates uniqueness in memory, then writes. Two concurrent requests can both pass validation.

### Prevention Checklist

Before implementing any tool that validates + writes JSON field data:

- [ ] Identify check-then-write pattern
- [ ] Wrap entire operation in `$transaction`
- [ ] Add advisory lock for tenant-scoped operations
- [ ] Test with concurrent requests (or document why not needed)

### Code Pattern

```typescript
// WRONG: Read-validate-write without isolation
const { pages } = await getDraftConfig(prisma, tenantId);
if (isIdUnique(pages, newId)) {
  // Another request could have written same ID between read and write!
  await saveDraftConfig(prisma, tenantId, updatedPages);
}

// CORRECT: Transaction with advisory lock
await prisma.$transaction(async (tx) => {
  // Lock prevents concurrent storefront edits for this tenant
  const lockId = hashString(`storefront:${tenantId}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Now safe to read-validate-write
  const { pages } = await getDraftConfig(tx, tenantId);
  if (!isIdUnique(pages, newId)) {
    throw new DuplicateIdError(newId);
  }
  await saveDraftConfig(tx, tenantId, updatedPages);
});
```

### When This Pattern Applies

- JSON field validation (landing page config, storefront config)
- Any "check uniqueness then create" operation
- Multiple concurrent agent sessions editing same tenant data

### Test Pattern

```typescript
it('should prevent duplicate IDs under concurrent requests', async () => {
  // Hard to test true concurrency, but verify transaction + lock are present
  const executor = getExecutor('update_page_section');

  // Verify implementation uses $transaction
  // Verify advisory lock is acquired
  // Trust PostgreSQL serialization
});
```

---

## Prevention Strategy 2: DRY in Agent Tools

**Problem:** Logic duplicated between related tools diverges over time, causing inconsistent behavior and bugs.

**Root Cause (Issues #660, #663, #666):**

- Same sectionId resolution logic in `update_page_section` and `remove_page_section`
- Section types list duplicated in migration script
- Legacy ID suffix string repeated 4 times

### Prevention Checklist

Before implementing a new agent tool:

- [ ] Search for similar logic in existing tools (`grep -r "pattern" server/src/agent/`)
- [ ] Extract shared logic to `server/src/agent/utils/` DURING implementation, not after
- [ ] Import constants from `@macon/contracts`, never duplicate
- [ ] Extract magic strings to named constants immediately

### Code Pattern

```typescript
// WRONG: Inline logic duplicated across tools
// In update tool:
if (sectionId && sectionIndex === undefined) {
  const foundIndex = page.sections.findIndex((s) => 'id' in s && s.id === sectionId);
  // ... 20 lines of error handling
}

// In remove tool: (same 25 lines copied)
if (sectionId && sectionIndex === undefined) {
  const foundIndex = page.sections.findIndex((s) => 'id' in s && s.id === sectionId);
  // ... 20 lines of error handling
}

// CORRECT: Extract to utility
// server/src/agent/utils/section-resolver.ts
export function resolveSectionIdToIndex(
  pages: PagesConfig,
  pageName: PageName,
  sectionId: string
): { index: number } | { error: string } {
  const page = pages[pageName];
  const foundIndex = page.sections.findIndex((s) => 'id' in s && s.id === sectionId);

  if (foundIndex !== -1) {
    return { index: foundIndex };
  }

  // Cross-page check for helpful error
  for (const [otherPage, config] of Object.entries(pages)) {
    if (otherPage === pageName) continue;
    const found = config.sections.find((s) => 'id' in s && s.id === sectionId);
    if (found) {
      return { error: `Section "${sectionId}" exists on page "${otherPage}", not "${pageName}"` };
    }
  }

  const availableIds = page.sections.filter((s) => 'id' in s).map((s) => s.id);
  return { error: `Section "${sectionId}" not found. Available: ${availableIds.join(', ')}` };
}

// Both tools use the same helper
import { resolveSectionIdToIndex } from '../utils/section-resolver';
```

### DRY Extraction Triggers

Extract immediately when you see:

1. **Same validation logic** in 2+ tools
2. **Same error message construction** in 2+ places
3. **Same constant list** (section types, page names, etc.)
4. **Same string literal** used 3+ times

### Where to Put Shared Code

| Shared Code Type | Location                           |
| ---------------- | ---------------------------------- |
| Tool utilities   | `server/src/agent/utils/`          |
| Schema constants | `packages/contracts/src/`          |
| Type guards      | `packages/contracts/src/`          |
| Error helpers    | `server/src/agent/utils/errors.ts` |

---

## Prevention Strategy 3: API Consistency Across Related Tools

**Problem:** Tools in the same feature set have inconsistent parameters, forcing users/agents to learn different patterns.

**Root Cause (Issue #661):** `update_page_section` and `remove_page_section` support `sectionId`, but `reorder_page_sections` only accepts indices.

### Prevention Checklist

When adding a new tool to an existing feature set:

- [ ] List all related tools in the feature
- [ ] Document the parameters each tool accepts
- [ ] Ensure new tool follows same patterns as existing tools
- [ ] If preferred parameter exists (e.g., `sectionId`), support it in ALL tools

### Consistency Matrix Example

Before implementing, create this matrix:

| Tool                  | pageName | sectionId   | sectionIndex | Notes             |
| --------------------- | -------- | ----------- | ------------ | ----------------- |
| update_page_section   | Required | Preferred   | Fallback     | Good              |
| remove_page_section   | Required | Preferred   | Fallback     | Good              |
| reorder_page_sections | Required | **Missing** | Required     | **Inconsistent!** |
| add_page_section      | Required | Generated   | N/A          | Good              |

### Code Pattern

```typescript
// WRONG: Inconsistent parameters
// reorder tool only accepts indices
inputSchema: {
  properties: {
    pageName: { type: 'string' },
    fromIndex: { type: 'number' },  // Only index!
    toIndex: { type: 'number' },
  },
  required: ['pageName', 'fromIndex', 'toIndex'],
}

// CORRECT: Consistent with other tools
inputSchema: {
  properties: {
    pageName: { type: 'string' },
    fromSectionId: {
      type: 'string',
      description: 'PREFERRED: Section ID to move'
    },
    fromIndex: {
      type: 'number',
      description: 'FALLBACK: Index if ID not known'
    },
    toIndex: { type: 'number' },
  },
  required: ['pageName', 'toIndex'], // Either fromSectionId OR fromIndex
}
```

### Tool Description Template

Document the preferred pattern in tool descriptions:

```typescript
description: `Move a section to a different position on a page.

Parameters (in order of preference):
1. fromSectionId (PREFERRED) - Use the section's stable ID (e.g., "home-hero-main")
2. fromIndex (FALLBACK) - Use 0-based index if ID not available

Always use sectionId when possible - indices can change when sections are added/removed.`;
```

---

## Prevention Strategy 4: Test Coverage for Error Paths

**Problem:** Happy path tests pass, but error handling paths are untested. Regressions in error messages go unnoticed.

**Root Cause (Issue #662):** Cross-page section detection and legacy ID fallback have no tests.

### Prevention Checklist

For each tool, ensure tests cover:

- [ ] Happy path (normal operation)
- [ ] Validation errors (bad input)
- [ ] Not found errors (missing resource)
- [ ] **Cross-reference errors** (resource exists but wrong location)
- [ ] **Backward compatibility** (legacy data formats)
- [ ] Authorization errors (wrong tenant)

### Test Template for Agent Tools

```typescript
describe('update_page_section', () => {
  // Happy path
  it('should update section by ID', async () => { ... });
  it('should update section by index', async () => { ... });

  // Validation errors
  it('should reject invalid section type', async () => { ... });
  it('should reject invalid page name', async () => { ... });

  // Not found errors
  it('should return error when section ID not found', async () => { ... });

  // Cross-reference errors (often missed!)
  it('should return helpful error when sectionId exists on different page', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      landingPageConfigDraft: {
        pages: {
          home: { enabled: true, sections: [] },
          about: { enabled: true, sections: [{ id: 'about-hero-main', type: 'hero' }] },
        }
      }
    });

    const result = await updatePageSectionTool.execute(mockContext, {
      pageName: 'home',
      sectionId: 'about-hero-main',  // Wrong page!
      sectionType: 'hero',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exists on page "about"');
  });

  // Backward compatibility (often missed!)
  it('should handle legacy sections without IDs', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      landingPageConfig: {
        pages: {
          home: { sections: [{ type: 'hero', headline: 'Test' }] }  // No ID!
        }
      }
    });

    const result = await listSectionIdsTool.execute(mockContext, {});
    expect(result.data.sections[0].id).toBe('home-hero-legacy');
  });

  // Authorization
  it('should not return sections from other tenants', async () => { ... });
});
```

### Coverage Metrics for Agent Tools

| Category          | Minimum Coverage | Notes                     |
| ----------------- | ---------------- | ------------------------- |
| Happy path        | 100%             | All normal operations     |
| Validation errors | 80%              | Input validation          |
| Not found         | 100%             | Critical for UX           |
| Cross-reference   | 100%             | Helpful error messages    |
| Legacy compat     | 100%             | Don't break existing data |
| Cross-tenant      | 100%             | Security requirement      |

---

## Prevention Strategy 5: YAGNI and Dead Code

**Problem:** Code is written "just in case" but never used, adding maintenance burden.

**Root Cause (Issues #664):** Type guard `isSectionWithId` exported and tested but not used in production code.

### Prevention Checklist

Before adding utility code:

- [ ] Is there an immediate use case? If no, don't add it
- [ ] Will at least 2 places use this? If no, inline it
- [ ] After writing, search for usages. If 0, delete or use it

### Decision Tree

```
New utility function needed?
├── Used immediately in this PR?
│   ├── Yes → Add it
│   └── No → Don't add it (YAGNI)
│
└── Already exists but unused?
    ├── Will this PR use it?
    │   ├── Yes → Use it, don't duplicate
    │   └── No → Consider deleting it
    │
    └── Is it tested but unused?
        ├── Yes → Either use it or delete both code and tests
        └── No → Delete it
```

### Code Review Question

> "I see `isSectionWithId` is exported and tested. Where is it used in production code?"

If the answer is "nowhere yet" or "we might need it later," that's a YAGNI violation.

---

## Prevention Strategy 6: Defense-in-Depth for Executors

**Problem:** Executors trust that tools have done proper validation. If a tool bug passes bad data, the executor propagates the error.

**Root Cause (Issue #665):** Executor trusts tool has assigned section ID; no server-side fallback.

### Prevention Checklist

Executors should validate critical invariants:

- [ ] Required fields are present (even if tool should have added them)
- [ ] IDs are unique (even if tool should have checked)
- [ ] Tenant ownership (even if tool already verified)

### Code Pattern

```typescript
// WRONG: Trust tool completely
async function executeUpdateSection(tenantId: string, payload: UpdateSectionPayload) {
  // Just write whatever the tool sent
  await saveDraftConfig(prisma, tenantId, payload.pages);
}

// CORRECT: Defense-in-depth
async function executeUpdateSection(tenantId: string, payload: UpdateSectionPayload) {
  const { sectionData, pageName, sectionIndex } = payload;

  // Defense: Ensure section has ID (tool SHOULD have assigned one)
  if (!('id' in sectionData) || !sectionData.id) {
    const { pages } = await getDraftConfig(prisma, tenantId);
    const existingIds = collectAllIds(pages);
    sectionData.id = generateSectionId(pageName, sectionData.type, existingIds);
    logger.warn('Executor generated ID - tool should have assigned one', {
      tenantId,
      pageName,
      generatedId: sectionData.id,
    });
  }

  // Defense: Verify tenant ownership (tool SHOULD have checked)
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error('Tenant not found'); // Should never happen
  }

  await saveDraftConfig(prisma, tenantId, payload.pages);
}
```

### When to Add Defense-in-Depth

| Scenario                  | Add Defense? | Reason                 |
| ------------------------- | ------------ | ---------------------- |
| Required field (e.g., ID) | Yes          | Data integrity         |
| Tenant ownership          | Yes          | Security               |
| Business rule validation  | Maybe        | Depends on criticality |
| Format validation         | No           | Tool's responsibility  |

---

## Prevention Strategy 7: Magic Strings

**Problem:** String literals repeated across files diverge when one is updated but others are forgotten.

**Root Cause (Issue #666):** `-legacy` suffix hardcoded in 4 places.

### Prevention Checklist

- [ ] Search for string before adding: `grep -r "string-value" server/src/`
- [ ] If found elsewhere, extract to constant
- [ ] If new string will be used again, extract immediately

### Code Pattern

```typescript
// WRONG: Magic strings scattered
// file1.ts
const id = `${page}-${type}-legacy`;

// file2.ts
const id = `${page}-${type}-legacy`;

// file3.ts
const id = `${page}-${type}-legacy`; // Typo: "legcay" won't be caught!

// CORRECT: Single constant
// constants.ts
export const LEGACY_SECTION_ID_SUFFIX = 'legacy';

export function getLegacySectionId(page: PageName, type: SectionTypeName): string {
  return `${page}-${type}-${LEGACY_SECTION_ID_SUFFIX}`;
}

// All files import from constants
import { getLegacySectionId } from './constants';
const id = getLegacySectionId(page, type);
```

### Common Magic Strings to Watch For

| Category       | Examples                                 |
| -------------- | ---------------------------------------- |
| ID suffixes    | `-legacy`, `-draft`, `-backup`           |
| Status strings | `'pending'`, `'completed'`, `'failed'`   |
| Error messages | Repeated error text                      |
| Config keys    | `'landingPageConfig'`, `'themeSettings'` |

---

## Code Review Checklist Additions

Add these items to code review checklists:

### Agent Tools Checklist

```markdown
## Storefront/Section Tools

- [ ] Check-then-write patterns use transaction + advisory lock
- [ ] sectionId resolution logic uses shared helper (not duplicated)
- [ ] All related tools support same parameter patterns (sectionId preferred)
- [ ] Tests cover cross-page error messages
- [ ] Tests cover legacy data (sections without IDs)
- [ ] Constants imported from @macon/contracts (not local copies)
- [ ] No magic strings (extracted to constants)
- [ ] Executor has defense-in-depth validation
```

### JSON Field Mutation Checklist

```markdown
## JSON Field Mutations (landingPageConfig, etc.)

- [ ] Read-validate-write wrapped in $transaction
- [ ] Advisory lock acquired for concurrent protection
- [ ] Validation happens inside transaction (not before)
- [ ] Error messages include available options (helpful for debugging)
```

---

## Test Patterns to Enforce

### Required Test Categories

Every agent tool test file should have these sections:

```typescript
describe('tool_name', () => {
  describe('happy path', () => {
    // Normal operations
  });

  describe('validation errors', () => {
    // Bad input handling
  });

  describe('not found errors', () => {
    // Missing resources
  });

  describe('cross-reference errors', () => {
    // Resource exists but wrong context
    // Example: sectionId on wrong page
  });

  describe('backward compatibility', () => {
    // Legacy data formats
    // Example: sections without IDs
  });

  describe('tenant isolation', () => {
    // Cross-tenant access prevention
  });
});
```

### Test Naming Convention

```typescript
// Good: Describes expected behavior
it('should return helpful error when sectionId exists on different page');
it('should generate legacy ID format for sections without ID property');

// Bad: Describes implementation
it('should call findIndex correctly');
it('should set the id property');
```

---

## DRY Principles for Agent Tools

### Level 1: Within a Tool File

Extract repeated logic into local helpers:

```typescript
// Before: Repeated in multiple handlers
function extractSectionIndex(sections, id) { ... }
function extractSectionIndex(sections, id) { ... }  // Duplicate!

// After: Single helper
function resolveSectionTarget(sections, idOrIndex) { ... }
// Used by all handlers in file
```

### Level 2: Across Tool Files

Extract to `server/src/agent/utils/`:

```typescript
// server/src/agent/utils/section-resolver.ts
export function resolveSectionIdToIndex(...) { ... }

// Used by: storefront-tools.ts, landing-page-tools.ts, etc.
```

### Level 3: Across Packages

Extract to `@macon/contracts`:

```typescript
// packages/contracts/src/landing-page.ts
export const SECTION_TYPES = ['hero', 'text', ...] as const;
export const PAGE_TYPES = ['home', 'about', ...] as const;
export function generateSectionId(...) { ... }

// Used by: server, apps/web, scripts, migrations
```

### DRY Decision Tree

```
Is this logic/constant used in...
├── Same file only → Local helper (function/const)
├── Multiple files in server/src/agent/ → server/src/agent/utils/
├── Server + Client or Scripts → @macon/contracts
└── Truly universal (logging, errors) → @macon/shared
```

---

## Quick Reference Card

Print this and keep handy during agent tool development:

```
STOREFRONT SECTION IDS - QUICK REFERENCE

1. TOCTOU Prevention
   - Wrap read-validate-write in $transaction
   - Add pg_advisory_xact_lock(hashString(`storefront:${tenantId}`))

2. DRY
   - Before adding logic: grep -r "similar code" server/src/agent/
   - Extract shared logic to server/src/agent/utils/
   - Import constants from @macon/contracts

3. API Consistency
   - All related tools support same parameters
   - sectionId = PREFERRED, sectionIndex = FALLBACK
   - Document preference in tool description

4. Test Coverage
   - Cross-page error messages
   - Legacy data (no IDs)
   - Helpful error messages with available options

5. Defense-in-Depth
   - Executor validates critical invariants
   - Generate ID if tool didn't provide one
   - Log warning, don't fail silently

6. Magic Strings
   - Search before adding: grep -r "string" .
   - Extract to constant immediately
   - getLegacySectionId() not hardcoded strings
```

---

## Related Documentation

- **AGENT_TOOLS_PREVENTION_INDEX.md** - Master index for agent tool patterns
- **BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md** - Similar patterns from booking links
- **ADR-013** - Advisory locks pattern
- **build-mode-storefront-editor-patterns-MAIS-20260105.md** - Build mode patterns

---

## Document Maintenance

**Created:** 2026-01-08
**Source:** Issues #659-666 from Storefront AI-Chatbot Integration code review
**Status:** Active prevention strategy
**Applies to:** All storefront/section agent tools

Update this document when:

- New section-related tools are added
- New patterns emerge from code review
- Related ADRs are created
