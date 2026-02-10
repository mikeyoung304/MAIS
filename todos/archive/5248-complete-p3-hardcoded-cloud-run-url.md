---
status: pending
priority: p3
issue_id: 5248
tags: [code-review, architecture, pr-44, naming, opus-verified]
dependencies: []
---

# Marketing Domain Name Misrepresents Content

## Problem Statement

File named `internal-agent-marketing.routes.ts` but contains mixed concerns: content generation (4 endpoints), package CRUD (1), section variants (1), vocabulary resolution (1). The 793 LOC suggests room for cleaner separation.

**Why this matters:** "Marketing" implies campaigns, emails, automation—but actual content is AI text generation + product catalog. Misleading names slow onboarding and obscure architecture.

**Opus Verification (2026-02-10):** Downgraded P2 → P3. Actual endpoints: 4 marketing/copy-gen, 1 storefront variant-gen, 1 catalog CRUD, 1 vocabulary. "Marketing" is the plurality (4/7). Name isn't perfect but isn't actively harmful.

**Impact:** P3 NICE-TO-HAVE - Cosmetic naming improvement.

## Findings

### Code Simplicity Review

**File:** `server/src/routes/internal-agent-marketing.routes.ts` (793 LOC)

**Actual endpoint breakdown:**

1. **Content Generation (4 endpoints):**
   - `POST /generate-section` - AI generates section text
   - `POST /generate-hero-variants` - AI generates hero variants
   - `POST /generate-package-description` - AI generates package descriptions
   - `POST /generate-section-content` - AI generates section content

2. **Product Catalog (1 endpoint):**
   - `POST /packages` - CRUD for service packages

3. **Section Variants (1 endpoint):**
   - `POST /section-variants` - Store multiple content variations

4. **Vocabulary (1 endpoint):**
   - `GET /vocabulary/:tenantId` - Resolve tenant vocabulary

**What "Marketing" typically means:** Email campaigns, SEO optimization, analytics dashboards, A/B testing, customer segmentation.

**What this file actually does:** AI-powered content generation + product catalog management.

### Architecture Review

**Domain cohesion check:**

- Content generation tools: 4 endpoints (57%)
- Catalog management: 1 endpoint (14%)
- Section variants: 1 endpoint (14%)
- Vocabulary: 1 endpoint (14%)

The file is dominated by AI generation (4/7 endpoints) but also contains unrelated catalog CRUD.

## Proposed Solutions

### Solution 1: Rename to `content-generation.routes.ts` (RECOMMENDED for minimal effort)

**Pros:**

- Accurate description of primary function
- No architectural changes needed
- Simple rename + import updates
  **Cons:**
- Still contains mixed concerns (packages, vocabulary)
  **Effort:** Small (15 minutes)
  **Risk:** Very Low

**Implementation:**

```bash
# Rename file
mv internal-agent-marketing.routes.ts internal-agent-content-generation.routes.ts

# Update imports in aggregator
sed -i '' 's/marketing/content-generation/g' internal-agent.routes.ts
```

### Solution 2: Split into Two Domain Files (RECOMMENDED for clean architecture)

**Pros:**

- Clear separation of concerns
- AI generation isolated from catalog CRUD
- Easier to test and maintain
  **Cons:**
- More files to navigate
- Requires updating aggregator
  **Effort:** Medium (45 minutes)
  **Risk:** Low - routes are independent

**Implementation:**

```typescript
// content-generation.routes.ts (4 endpoints, ~500 LOC)
- POST /generate-section
- POST /generate-hero-variants
- POST /generate-package-description
- POST /generate-section-content

// catalog.routes.ts (3 endpoints, ~300 LOC)
- POST /packages
- POST /section-variants
- GET /vocabulary/:tenantId
```

### Solution 3: Keep "Marketing" Name (Current State)

**Pros:**

- No changes needed
  **Cons:**
- Misleading name
- Mixed concerns remain
- Cognitive load on new developers
  **Effort:** Zero
  **Risk:** Medium - compounds over time

## Recommended Action

**Start with Solution 1** (rename to `content-generation.routes.ts`). If catalog CRUD grows beyond 1 endpoint in future work, then apply Solution 2 to split files.

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent-marketing.routes.ts` → rename
- `server/src/routes/internal-agent.routes.ts` (update import)
- Any agent tools importing this file

**Line count impact:** Zero (rename only)

**Related Patterns:**

- Single Responsibility Principle
- Ubiquitous Language (Domain-Driven Design)

## Acceptance Criteria

### For Solution 1 (Rename):

- [ ] File renamed to `internal-agent-content-generation.routes.ts`
- [ ] Aggregator import updated
- [ ] All agent tool imports updated
- [ ] File header comment reflects new name
- [ ] `npm run --workspace=server typecheck` passes

### For Solution 2 (Split):

- [ ] `content-generation.routes.ts` created (4 endpoints)
- [ ] `catalog.routes.ts` created (3 endpoints)
- [ ] Both files mounted in aggregator
- [ ] All endpoints still functional
- [ ] Tests pass
- [ ] Agent tools updated to call correct URLs

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review analyzed endpoint breakdown
- Confirmed "marketing" is misleading vs actual content
- Architecture Review verified 57% is AI generation
- Assessed two-phase approach: rename now, split if needed

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent-marketing.routes.ts` (793 LOC, 7 endpoints)
  - `internal-agent.routes.ts` (aggregator)
- **DDD Ubiquitous Language:** https://martinfowler.com/bliki/UbiquitousLanguage.html
