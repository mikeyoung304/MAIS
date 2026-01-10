---
status: pending
priority: p3
issue_id: '707'
tags: [code-review, documentation, prisma]
dependencies: ['697']
---

# Schema Comment Mismatch for landingPageConfigDraft

## Problem Statement

The Prisma schema comment is misleading:

```prisma
landingPageConfigDraft Json? // Draft version for Build Mode editing (published via copy to landingPageConfig)
```

The comment says "published via copy to landingPageConfig" but:

- REST API's `publishLandingPageDraft` uses wrapper structure INSIDE `landingPageConfig`
- AI executor copies ENTIRE draft to `landingPageConfig` column (different behavior)

## Proposed Solution

After fixing #697, update comment to reflect actual behavior:

```prisma
landingPageConfigDraft Json? // Draft version for Build Mode/AI editing. Published by wrapping in {published: draft} format in landingPageConfig column.
```

## Acceptance Criteria

- [ ] Schema comment accurately describes publish behavior
- [ ] Comment updated after #697 consolidation

## Resources

- Data integrity review: agent a4342eb
- Depends on: #697 (consolidation determines final behavior)
