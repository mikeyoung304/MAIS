# Storefront Section ID Pattern

> Stable, human-readable identifiers for AI chatbot storefront editing

---

category: patterns
subcategories:

- agent-tools
- agent-architecture
  date_created: 2026-01-08
  status: reference
  confidence: high
  applies_to:
- storefront-editor
- agent-orchestration
- multi-tenant-defaults
  keywords:
- section-ids
- agent-tools
- stable-identifiers
- placeholder-content
- human-readable-ids
- migration-strategy
- trust-tiers
- id-generation
- reserved-patterns
- tenant-isolation
  cross_references:
- build-mode-storefront-editor-patterns-MAIS-20260105
- AGENT_TOOLS_PREVENTION_INDEX
- chatbot-proposal-execution-flow-MAIS-20251229

---

## Problem Statement

When an AI chatbot edits landing page sections, referencing them by array index (`sections[0]`, `sections[1]`) is inherently fragile:

| Issue                         | Impact                                             |
| ----------------------------- | -------------------------------------------------- |
| **Index Drift**               | Deleting section 1 shifts all subsequent indices   |
| **Concurrent Edits**          | Multiple edits leave chatbot with stale references |
| **Cross-Session Persistence** | Indices change between conversations               |
| **Error-Prone Updates**       | "Update section 3" overwrites wrong content        |

**Example failure:**

```
User: "Update the testimonials section"
Chatbot: (remembers index 2 from earlier)
User: (deleted section 1 in the meantime)
Chatbot: Updates what is now the FAQ section 💥
```

## Solution: Section ID System

### ID Format: `{page}-{type}-{qualifier}`

```
home-hero-main      # Primary hero on home page
about-text-2        # Second text section on about page
services-pricing-main  # Pricing section on services page
faq-faq-main        # FAQ section on FAQ page
```

**Components:**

- **page**: One of 7 page types (`home`, `about`, `services`, `faq`, `contact`, `gallery`, `testimonials`)
- **type**: One of 7 section types (`hero`, `text`, `gallery`, `testimonials`, `faq`, `contact`, `cta`, `pricing`, `features`)
- **qualifier**: `main` for primary, or number (`2`, `3`) for additional sections

### Why Human-Readable (Not UUIDs)

| Approach       | Chatbot Says                    | User Clarity          |
| -------------- | ------------------------------- | --------------------- |
| UUID           | "Updating section 7f3a2b4c-..." | ❌ Opaque             |
| Index          | "Updating section 2"            | ⚠️ Position-dependent |
| **Section ID** | "Updating home-hero-main"       | ✅ Self-documenting   |

Human-readable IDs enable natural conversation:

> "I've updated the **about-text-main** section with your new bio."

## Core Implementation

### 1. Schema Definition

**File:** `packages/contracts/src/landing-page.ts`

```typescript
/**
 * Section ID validation with prototype pollution prevention
 */
const RESERVED_PATTERNS = ['__proto__', 'constructor', 'prototype'] as const;

export const SectionIdSchema = z
  .string()
  .max(50, 'Section ID must not exceed 50 characters')
  .regex(
    /^(home|about|services|faq|contact|gallery|testimonials)-(hero|text|gallery|testimonials|faq|contact|cta|pricing|features)-(main|[a-z]+|[0-9]+)$/,
    'Section ID must be {page}-{type}-{qualifier} format'
  )
  .refine((id) => !RESERVED_PATTERNS.some((pattern) => id.includes(pattern)), {
    message: 'Section ID contains reserved JavaScript pattern',
  });

export type SectionId = z.infer<typeof SectionIdSchema>;
```

**Security layers:**

1. Max 50 characters (DoS prevention)
2. Strict regex (injection prevention)
3. Reserved pattern blocklist (prototype pollution prevention)

### 2. Monotonic Counter for ID Generation

**Critical:** Never reuse deleted IDs to prevent ghost references.

```typescript
/**
 * Generate unique section ID using monotonic counter.
 * If home-text-2 is deleted, next text section becomes home-text-3 (not 2).
 */
export function generateSectionId(
  pageName: PageName,
  sectionType: SectionTypeName,
  existingIds: Set<string>
): SectionId {
  const baseId = `${pageName}-${sectionType}-main`;

  // Try main variant first
  if (!existingIds.has(baseId)) {
    return baseId as SectionId;
  }

  // Find highest existing number suffix
  let maxCounter = 1;
  const counterPattern = new RegExp(`^${pageName}-${sectionType}-(\\d+)$`);

  for (const id of existingIds) {
    const match = id.match(counterPattern);
    if (match && match[1]) {
      maxCounter = Math.max(maxCounter, parseInt(match[1], 10));
    }
  }

  return `${pageName}-${sectionType}-${maxCounter + 1}` as SectionId;
}
```

### 3. ID Collection Across Pages

```typescript
/**
 * Collect all section IDs from entire tenant config.
 * Used for uniqueness validation and ID generation.
 */
export function collectAllIds(pages: Record<PageName, PageConfig>): Set<string> {
  const ids = new Set<string>();

  for (const pageConfig of Object.values(pages)) {
    for (const section of pageConfig.sections) {
      if ('id' in section && typeof section.id === 'string') {
        ids.add(section.id);
      }
    }
  }

  return ids;
}
```

## Agent Tool Integration

### Trust Tier Classification

| Tier   | Tools                                                                 | Behavior                                 |
| ------ | --------------------------------------------------------------------- | ---------------------------------------- |
| **T1** | `list_section_ids`, `get_section_by_id`, `get_unfilled_placeholders`  | Auto-confirmed (read-only)               |
| **T2** | `update_page_section`, `remove_page_section`, `reorder_page_sections` | Soft-confirm (AI executes after preview) |
| **T3** | `publish_draft`                                                       | Requires explicit user approval          |

### Discovery-First Workflow

**System prompt guidance (MARKETING phase):**

```markdown
### Section-Based Editing Workflow

**Step 1: Discover Sections**
ALWAYS call `list_section_ids` first to see what sections exist.

**Step 2: Target by ID**
Use `sectionId` parameter (preferred) instead of `sectionIndex`.

**Step 3: Handle Ambiguity**
When user says "update the hero":

1. Call `list_section_ids` with sectionType filter
2. If 1 match → proceed with sectionId
3. If multiple → ask for clarification with options
```

### Tool Parameter Pattern

All update tools support dual addressing:

```typescript
// PREFERRED: Use sectionId
await updatePageSection({
  pageName: 'home',
  sectionId: 'home-hero-main',  // ← Stable reference
  sectionData: { ... }
});

// FALLBACK: Use sectionIndex (for legacy compatibility)
await updatePageSection({
  pageName: 'home',
  sectionIndex: 0,  // ← Fragile, avoid
  sectionData: { ... }
});
```

### ID Resolution in Tools

```typescript
// Resolve sectionId to sectionIndex
if (sectionId && sectionIndex === undefined) {
  const foundIndex = page.sections.findIndex((s) => 'id' in s && s.id === sectionId);

  if (foundIndex === -1) {
    // Check other pages for helpful error message
    for (const [otherPage, otherConfig] of Object.entries(pages)) {
      if (otherPage === pageName) continue;
      const idxInOther = otherConfig.sections.findIndex((s) => 'id' in s && s.id === sectionId);
      if (idxInOther !== -1) {
        return {
          success: false,
          error: `Section "${sectionId}" exists on page "${otherPage}", not "${pageName}".`,
        };
      }
    }
    return {
      success: false,
      error: `Section "${sectionId}" not found on page "${pageName}".`,
    };
  }
  sectionIndex = foundIndex;
}
```

## Audit Logging

Every section modification logs structured data:

```typescript
logger.info(
  {
    tenantId,
    pageName,
    sectionIndex: resultIndex,
    sectionType: sectionData.type,
    sectionId, // ← Human-readable for debugging
    action: sectionIndex === -1 ? 'CREATE' : 'UPDATE',
  },
  'Page section modified via Build Mode'
);
```

## Migration Strategy

### Backfill Script

**File:** `server/scripts/migrate-section-ids.ts`

```typescript
async function migrateTenant(tenant: Tenant): Promise<void> {
  const config = tenant.landingPageConfigDraft || tenant.landingPageConfig;
  const pages = config?.pages;

  // Per-tenant ID tracking (tenant isolation)
  const tenantIds = new Set<string>();
  let modified = false;

  for (const [pageName, pageConfig] of Object.entries(pages)) {
    for (const section of pageConfig.sections) {
      if (!('id' in section) || !section.id) {
        section.id = generateSectionId(pageName as PageName, section.type, tenantIds);
        tenantIds.add(section.id);
        modified = true;
      } else {
        tenantIds.add(section.id);
      }
    }
  }

  if (modified) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfigDraft: config },
    });
  }
}
```

### Dry-Run Support

```bash
# Preview changes without modifying database
npm run migrate:section-ids -- --dry-run

# Apply to specific tenant
npm run migrate:section-ids -- --tenant-id=abc123

# Full migration
npm run migrate:section-ids
```

## Prevention Strategies

### 1. TOCTOU Race Conditions (P1)

**Problem:** Check-then-write on JSON fields without transaction isolation.

**Solution:**

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashString(`storefront:${tenantId}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Read-validate-write inside transaction
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  const existingIds = collectAllIds(tenant.landingPageConfigDraft.pages);

  if (existingIds.has(newSectionId)) {
    throw new Error(`Section ID "${newSectionId}" already exists`);
  }

  // Safe to write
  await tx.tenant.update({ ... });
});
```

### 2. DRY Violations

**Problem:** Section ID resolution duplicated across tools.

**Solution:** Extract to `server/src/agent/utils/section-utils.ts`:

```typescript
export function resolveSectionId(
  pages: Record<PageName, PageConfig>,
  pageName: PageName,
  sectionId: string
): { index: number } | { error: string } {
  // Single implementation for all tools
}
```

### 3. Magic Strings

**Problem:** `-legacy` suffix hardcoded in 4+ places.

**Solution:**

```typescript
// In contracts or utils
export const LEGACY_ID_SUFFIX = 'legacy';

export function getLegacySectionId(page: PageName, type: SectionTypeName): string {
  return `${page}-${type}-${LEGACY_ID_SUFFIX}`;
}
```

## Success Metrics

| Metric             | Target | Measurement                                        |
| ------------------ | ------ | -------------------------------------------------- |
| ID stability       | 100%   | No "section not found" errors after reordering     |
| Chatbot accuracy   | >95%   | Correct section targeted in edit operations        |
| Migration coverage | 100%   | All existing tenants have section IDs              |
| Test coverage      | >90%   | Edge cases covered (cross-page, legacy, collision) |

## Key Files

| File                                                   | Purpose                           |
| ------------------------------------------------------ | --------------------------------- |
| `packages/contracts/src/landing-page.ts`               | Schema, ID generation, validation |
| `server/src/agent/tools/storefront-tools.ts`           | AI tools with trust tiers         |
| `server/src/agent/executors/storefront-executors.ts`   | Executor with audit logging       |
| `server/src/agent/proposals/executor-schemas.ts`       | Shared Zod schemas (DRY)          |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | Discovery workflow guidance       |
| `server/scripts/migrate-section-ids.ts`                | Backfill migration script         |

## Related Documentation

- [STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md](./STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md) - Detailed prevention patterns
- [STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md](./STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md) - Print & pin checklist
- [build-mode-storefront-editor-patterns-MAIS-20260105.md](./build-mode-storefront-editor-patterns-MAIS-20260105.md) - Build Mode architecture
- [AGENT_TOOLS_PREVENTION_INDEX.md](./AGENT_TOOLS_PREVENTION_INDEX.md) - Agent tool checklist
- [chatbot-proposal-execution-flow-MAIS-20251229.md](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - Proposal lifecycle

## Compounding Value

**First time:** Research stable ID strategies → 4+ hours
**With this doc:** Lookup pattern, adapt → 30 minutes
**Knowledge compounds:** Team builds on proven pattern
