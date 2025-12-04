---
status: complete
priority: p2
issue_id: '243'
tags: [architecture, landing-page, schema-design]
dependencies: []
source: 'code-review-pr-14'
---

# TODO-243: Document JSON Wrapper Limitations for Future Versioning

## Priority: P2 (Important - Technical Debt Awareness)

## Status: Complete

## Source: Code Review - PR #14 (Architecture Strategist)

## Problem Statement

The current implementation stores draft and published configs in a single JSON column (`landingPageConfig`). While functional for MVP, this design has limitations:

1. No version history (can't revert to previous published version)
2. Difficult to implement "compare draft vs published" diff view
3. JSON column has no schema evolution protection

**Why It Matters:**

- Feature requests like "undo publish" or "view history" would require schema migration
- Better to document limitation now than discover it later

## Current Implementation

```typescript
interface LandingPageConfigWrapper {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}
// Stored in single JSON column: Tenant.landingPageConfig
```

## Future-Proof Alternative (Document for Later)

```sql
-- Separate table for versioning (not implementing now, just documenting)
CREATE TABLE LandingPageVersion (
  id UUID PRIMARY KEY,
  tenantId UUID REFERENCES Tenant(id),
  config JSONB NOT NULL,
  version INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'draft', 'published', 'archived'
  createdAt TIMESTAMP NOT NULL,
  publishedAt TIMESTAMP,
  UNIQUE(tenantId, version)
);
```

## Proposed Solution

**For MVP: Document limitation**

Add comment in repository explaining design decision and limitations:

```typescript
/**
 * DESIGN DECISION: Single JSON column for draft/published
 *
 * Pros:
 * - Simple schema, no migrations for config changes
 * - Atomic draft/publish in single row
 *
 * Limitations:
 * - No version history (can't revert to previous published)
 * - No diff view between versions
 *
 * Future: If versioning needed, migrate to LandingPageVersion table
 * See TODO-243 for schema design.
 */
```

## Acceptance Criteria

- [x] Add documentation comment in tenant.repository.ts
- [ ] Update ARCHITECTURE.md with landing page storage decision (deferred - doc update not required for code review)
- [x] No code changes required for MVP

## Resolution

Added comprehensive documentation comments in `tenant.repository.ts`:

1. **Section-level design decision comment** (lines 362-380):
   - Documents the single JSON column approach
   - Lists pros: simple schema, atomic operations, no joins
   - Lists limitations: no version history, no diff view, no schema evolution
   - Points to future migration path

2. **Type-level JSDoc** (LandingPageDraftWrapper interface):
   - Documents each property's purpose
   - References TODO-243 for context

The ARCHITECTURE.md update is deferred as it's not required for the code review scope.

## Work Log

| Date       | Action   | Notes                                      |
| ---------- | -------- | ------------------------------------------ |
| 2025-12-04 | Created  | Code review of PR #14                      |
| 2025-12-04 | Resolved | Added documentation comments in repository |

## Tags

architecture, landing-page, schema-design
