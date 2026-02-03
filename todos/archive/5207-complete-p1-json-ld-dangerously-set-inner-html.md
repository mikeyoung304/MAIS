---
status: ready
priority: p1
issue_id: '5207'
tags: [code-review, security, xss, frontend]
dependencies: []
---

# P1: JSON-LD dangerouslySetInnerHTML XSS Risk

## Problem Statement

The tenant storefront page uses `dangerouslySetInnerHTML` to inject JSON-LD structured data, creating a potential XSS vector if tenant data contains unescaped characters.

**Why it matters:** JSON-LD scripts execute in the page context. If tenant business name or description contains `</script>`, it could break out of the JSON-LD and inject arbitrary JavaScript.

## Findings

**Source:** Security Sentinel Agent Review

**Location:** `apps/web/src/app/t/[slug]/(site)/page.tsx`

**Evidence:**

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(structuredData),
  }}
/>
```

**Attack vector:**

1. Tenant sets business name: `Acme</script><script>alert('xss')//`
2. JSON.stringify creates: `"name":"Acme</script><script>alert('xss')//"`
3. Browser interprets `</script>` as closing tag
4. Malicious script executes

## Proposed Solutions

### Option A: HTML-escape the JSON string (Recommended)

**Approach:** Escape `</script>` sequences before injection

```typescript
function safeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')   // Escape < to prevent </script>
    .replace(/>/g, '\\u003e')   // Escape > for completeness
    .replace(/&/g, '\\u0026');  // Escape & for safety
}

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: safeJsonLd(structuredData),
  }}
/>
```

**Pros:** Minimal change, no new dependencies
**Cons:** Manual escaping requires careful maintenance
**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: Use Next.js built-in JSON-LD support

**Approach:** Use the `next/script` component or native metadata API

**Pros:** Framework-maintained security
**Cons:** May require restructuring metadata handling
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Option A: HTML-escape the JSON string** - Create `safeJsonLd()` helper that escapes `</script>` sequences before injection. Minimal change, no dependencies.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Security vulnerability, quality-first approach

## Technical Details

**Affected Files:**

- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- Any other pages with JSON-LD structured data

**Database Changes:** None

## Acceptance Criteria

- [ ] JSON-LD content is properly escaped
- [ ] Test with business name containing `</script>` - no XSS
- [ ] Structured data still validates in Google's testing tool

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2026-02-02 | Created from code review | Identified by security-sentinel agent |

## Resources

- PR: `feat/section-content-migration`
- Safe JSON-LD pattern: https://github.com/vercel/next.js/discussions/38256
