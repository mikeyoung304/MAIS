---
status: resolved
priority: p1
issue_id: "229"
tags: [security, code-review, landing-page, xss, images]
dependencies: []
source: "code-review-landing-page-visual-editor"
resolved_at: "2025-12-04"
resolved_by: "feat/landing-page-editor-p1-security branch"
---

# TODO-229: Re-validate Image URLs in Repository Layer

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: Security Review - Landing Page Visual Editor Plan

## Problem Statement

The plan stores image URLs in landing page configuration but doesn't re-validate stored URLs in the repository layer. An attacker could inject `data:text/html` or `javascript:` URLs that bypass initial schema validation.

**Why It Matters:**
- Protocol-based XSS via data: URIs
- Background image inline styles execute malicious code
- Schema validation only runs at route boundary, not in repository

## Findings

**Attack Vector:**
1. Initial schema validation passes for legitimate image URL
2. Attacker modifies draft state via browser console
3. Auto-save sends malicious URL bypassing schema validation
4. Public landing page renders dangerous `backgroundImage: url('data:...')`

**Evidence:**
- Plan (lines 420-426): Background image inline style renders URL without re-validation
- `landing-page.ts` (lines 30-43): `SafeUrlSchema` validates protocol but only during initial parse
- Plan (line 269): Auto-save doesn't re-validate URLs

## Proposed Solutions

### Option A: Re-validate in Repository (Recommended)
Add URL validation in repository methods before storage.

**Pros:** Defense in depth, catches bypassed schema validation
**Cons:** Slight code duplication
**Effort:** Small (30 min)
**Risk:** Low

```typescript
async saveLandingPageDraft(tenantId: string, config: LandingPageConfig): Promise<LandingPageConfig> {
  // Re-validate all image URLs before storage
  if (config.hero?.backgroundImageUrl) {
    SafeImageUrlSchema.parse(config.hero.backgroundImageUrl);
  }
  if (config.about?.imageUrl) {
    SafeImageUrlSchema.parse(config.about.imageUrl);
  }
  // ... validate other image URLs ...

  return await prisma.tenant.update({...});
}
```

### Option B: Validate in Middleware
Create URL validation middleware for all landing page routes.

**Pros:** Centralized validation
**Cons:** More complex middleware
**Effort:** Medium (1 hour)
**Risk:** Low

## Recommended Action

**Option A** - Re-validate in repository as defense-in-depth.

## Technical Details

**Affected Files:**
- `server/src/adapters/prisma/tenant.repository.ts` - Add URL re-validation
- Image fields: `hero.backgroundImageUrl`, `about.imageUrl`, `gallery.images[].url`, `testimonials.items[].imageUrl`

## Acceptance Criteria

- [ ] All image URLs validated against SafeImageUrlSchema before storage
- [ ] data: and javascript: protocols rejected
- [ ] Unit test: Malicious URL blocked in repository
- [ ] E2E test: Browser-modified URL rejected by server

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Security review of landing page visual editor plan |

## Tags

security, code-review, landing-page, xss, images
