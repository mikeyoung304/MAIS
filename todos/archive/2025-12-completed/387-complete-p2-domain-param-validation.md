---
status: complete
priority: p2
issue_id: '387'
tags: [code-review, security, validation]
dependencies: []
---

# P2: Domain Parameter Without Validation

**Priority:** P2 (Important)
**Category:** Security
**Source:** Code Review - Security Sentinel Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The domain parameter from searchParams is used directly without validation. While the database lookup will fail for invalid domains, explicit validation provides better error messages and prevents potential issues.

## Location

- `apps/web/src/app/t/_domain/*/page.tsx` - All pages using searchParams.domain

## Risk

- SQL injection unlikely (Prisma parameterizes) but defense-in-depth is good
- No clear error message for malformed domains
- Potential for verbose error logging with random domain values
- Open redirect potential if domain is used in redirects (future risk)

## Solution

Add domain validation before database lookup:

```typescript
// apps/web/src/lib/tenant.ts
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;

export function validateDomain(domain: string | undefined): string {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain parameter is required');
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length > 253) {
    throw new Error('Domain too long');
  }

  if (!DOMAIN_PATTERN.test(sanitized)) {
    throw new Error('Invalid domain format');
  }

  return sanitized;
}

// Usage in pages:
export default async function ContactPage({ searchParams }) {
  const { domain } = await searchParams;

  let validatedDomain: string;
  try {
    validatedDomain = validateDomain(domain);
  } catch {
    notFound();
  }

  const tenant = await getTenantByDomain(validatedDomain);
  // ...
}
```

## Acceptance Criteria

- [ ] Create domain validation helper function
- [ ] Apply validation in all domain route pages
- [ ] Return 404 for invalid domains (not 500)
- [ ] Log suspicious domain attempts for monitoring
- [ ] Add unit tests for domain validation

## Related Files

- `apps/web/src/lib/tenant.ts`
- `apps/web/src/app/t/_domain/*/page.tsx`
