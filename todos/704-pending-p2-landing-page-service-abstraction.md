---
status: pending
priority: p2
issue_id: '704'
tags: [code-review, architecture, refactoring, dry]
dependencies: ['697']
---

# Create LandingPageService Abstraction Layer

## Problem Statement

No single service encapsulates all landing page operations. Current access patterns:

1. **AI Tools** - Direct Prisma access via utils.ts
2. **REST API** - Uses `PrismaTenantRepository` with wrapper format
3. **Executors** - Direct Prisma access, different write patterns
4. **Public API** - Uses `findBySlugPublic` with extractPublishedLandingPage

**No single source of truth** for:

- "What is the current draft?"
- "What is the current published/live config?"
- "How do I publish?"

## Findings

### Current Code Duplication

Draft reading logic exists in:

- `getDraftConfig()` in tools/utils.ts
- `getLandingPageWrapper()` in tenant.repository.ts
- `extractPublishedLandingPage()` in tenant.repository.ts

Publish logic exists in:

- `publish_draft` executor in storefront-executors.ts
- `publishLandingPageDraft()` in tenant.repository.ts

**These implementations are incompatible** (see #697).

## Proposed Solutions

### Option A: Create LandingPageService

**Effort:** Large (2-3 days)
**Risk:** Medium

```typescript
// server/src/services/landing-page.service.ts
export class LandingPageService {
  constructor(private prisma: PrismaClient) {}

  async getDraft(tenantId: string): Promise<LandingPageConfig | null>;
  async getPublished(tenantId: string): Promise<LandingPageConfig | null>;
  async saveDraft(tenantId: string, config: LandingPageConfig): Promise<void>;
  async publish(tenantId: string): Promise<void>;
  async discard(tenantId: string): Promise<void>;
}
```

- All AI tools and repository methods use this service
- Single place for format translation
- Clear contract for all operations

### Option B: Move All Logic to Repository

**Effort:** Medium
**Risk:** Low

- Add methods to TenantRepository for all operations
- Update AI tools to use repository instead of direct Prisma

## Recommended Action

After fixing #697 (immediate bug), create LandingPageService for long-term maintainability.

## Acceptance Criteria

- [ ] Single service handles all draft/publish operations
- [ ] AI tools and REST API use same service
- [ ] Data format is consistent regardless of access path
- [ ] Clear API documentation for service methods

## Resources

- Architecture review: agent a31637a
- Depends on: #697 (immediate fix)
