---
status: complete
priority: p1
issue_id: '5206'
tags: [code-review, security, section-content-migration]
dependencies: []
completed_at: '2026-02-04'
---

# P1: Missing XSS Sanitization in SectionContentService

## Problem Statement

The `SectionContentService.updateSection()` method accepts user-provided content and stores it directly in the database without sanitization. This content is later rendered in tenant storefronts, creating a stored XSS vulnerability.

**Why it matters:** Malicious agents or compromised tenant accounts could inject scripts that execute in visitor browsers, stealing cookies, redirecting to phishing sites, or defacing the storefront.

## Findings

**Source:** Security Sentinel Agent Review

**Location:** `server/src/services/section-content.service.ts` - `updateSection()` method

**Evidence:**

- Content is passed directly to repository without sanitization
- Content is rendered in storefront pages via React components
- No DOMPurify or similar sanitization library in use for section content

**Attack vector:**

1. Agent or tenant provides content like: `{"title": "<script>alert('xss')</script>"}`
2. Content stored in SectionContent table
3. Storefront renders content, script executes in visitor browser

## Proposed Solutions

### Option A: Server-side DOMPurify (Recommended)

**Approach:** Sanitize content in `updateSection()` before storage

```typescript
import DOMPurify from 'isomorphic-dompurify';

async updateSection(tenantId: string, sectionId: string, content: SectionContent) {
  const sanitizedContent = this.sanitizeContent(content);
  return this.repository.update(tenantId, sectionId, sanitizedContent);
}

private sanitizeContent(content: SectionContent): SectionContent {
  // Deep sanitize string fields
  return JSON.parse(
    JSON.stringify(content, (key, value) =>
      typeof value === 'string' ? DOMPurify.sanitize(value) : value
    )
  );
}
```

**Pros:** Single point of enforcement, protects all consumers
**Cons:** Requires `isomorphic-dompurify` dependency (~12KB gzipped)
**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Client-side sanitization only

**Approach:** Sanitize in React components before rendering

**Pros:** No server changes needed
**Cons:** Easy to miss a rendering location, defense-in-depth violation
**Effort:** Medium (multiple components to update)
**Risk:** Medium - incomplete coverage

## Recommended Action

**Option A: Server-side DOMPurify** - Implement sanitization in `updateSection()` and `addSection()` using isomorphic-dompurify. Single enforcement point, defense-in-depth.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Security vulnerability, quality-first approach

## Technical Details

**Affected Files:**

- `server/src/services/section-content.service.ts`
- All storefront section components that render content

**Database Changes:** None

**Testing:**

- Add test: "should sanitize script tags from content"
- Add test: "should sanitize event handlers from content"

## Acceptance Criteria

- [x] Content is sanitized before storage in `updateSection()`
- [x] Content is sanitized before storage in `addSection()`
- [x] Unit test verifies XSS payloads are stripped
- [x] Unit test verifies event handlers are stripped
- [x] Unit test verifies nested content sanitization

## Work Log

| Date       | Action                       | Learnings                                                       |
| ---------- | ---------------------------- | --------------------------------------------------------------- |
| 2026-02-02 | Created from code review     | Identified by security-sentinel agent                           |
| 2026-02-04 | Verified already implemented | XSS sanitization was already complete with isomorphic-dompurify |

## Resources

- PR: `feat/section-content-migration`
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- DOMPurify: https://github.com/cure53/DOMPurify
