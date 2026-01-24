---
status: ready
priority: p2
issue_id: '5183'
tags: [code-review, testing, security, multi-tenant]
dependencies: []
---

# Storefront Tools Tests - Security Test Coverage Gaps

## Problem Statement

The storefront-tools tests have basic tenant isolation tests but lack comprehensive security testing for critical attack vectors. The implementation comments mention security features (prototype pollution prevention, injection filtering) that aren't verified by tests.

**Why it matters:** Without security tests, we can't verify that protections actually work. A regression could silently introduce vulnerabilities.

## Findings

### 1. No Prototype Pollution Tests

Source code comments (Line 24) mention: "Section IDs validated against reserved patterns (prototype pollution prevention)"
But there are NO tests verifying this works.

### 2. No Injection Attack Tests

No tests for:

- SQL/NoSQL injection via content fields
- XSS payloads in section content
- Command injection patterns

### 3. No Cross-Tenant Parameter Injection Tests

No test verifying that `tenantId` in params cannot override `context.tenantId`.

### 4. No Trust Tier Bypass Tests

No tests verifying that tools can't be tricked into using lower trust tiers via params.

### 5. No Oversized Input Tests

No DoS protection tests for extremely large inputs.

### 6. No Error Message Sanitization Tests

No verification that error messages don't leak sensitive info.

## Proposed Solutions

### Option 1: Security-Focused Test Suite (Recommended)

Add a dedicated `Security Attack Prevention` describe block:

```typescript
describe('Security Attack Prevention', () => {
  describe('Prototype Pollution', () => {
    it('should reject sectionId containing __proto__', async () => {
      const maliciousIds = [
        '__proto__',
        'constructor',
        'prototype',
        'home-hero-__proto__',
        '__proto__-hero-main',
      ];
      for (const id of maliciousIds) {
        const result = await getSectionByIdTool.execute(mockContext, { sectionId: id });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Parameter Injection', () => {
    it('should ignore tenantId in params', async () => {
      await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'hero',
        headline: 'Test',
        tenantId: 'attacker-tenant', // Should be ignored
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-tenant-123' }, // Context tenantId only
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized content', async () => {
      const result = await updatePageSectionTool.execute(mockContext, {
        pageName: 'home',
        sectionType: 'text',
        content: 'x'.repeat(1000000), // 1MB
      });
      expect(result.success).toBe(false);
    });
  });
});
```

**Pros:** Comprehensive, explicitly documents security guarantees
**Cons:** Requires significant work
**Effort:** Large (4-6 hours)
**Risk:** Low - adding tests only

### Option 2: Inline Security Assertions

Add security checks to existing tests rather than new suite.

**Pros:** Faster, less code
**Cons:** Security tests scattered, easy to miss
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option 3: Property-Based Security Tests

Use a library like `fast-check` for fuzzing security inputs.

**Pros:** Better coverage, catches edge cases
**Cons:** New dependency, more complex
**Effort:** Large (5+ hours)
**Risk:** Medium - new patterns

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/agent/tools/storefront-tools.test.ts`

**Security Features to Test:**

1. `SectionIdSchema` regex validation (prototype pollution)
2. `sanitizeForContext()` in types.ts (injection filtering)
3. Zod schema max lengths (DoS prevention)
4. Context isolation (tenantId/sessionId)

## Acceptance Criteria

- [ ] Prototype pollution attack test exists
- [ ] Cross-tenant parameter injection test exists
- [ ] Trust tier bypass attempt test exists
- [ ] Oversized input handling test exists
- [ ] Error message sanitization test exists

## Work Log

| Date       | Action                   | Learnings                                               |
| ---------- | ------------------------ | ------------------------------------------------------- |
| 2026-01-15 | Created from code review | Implementation has security features that aren't tested |

## Resources

- Test file: `server/test/agent/tools/storefront-tools.test.ts`
- Section ID schema: `packages/contracts/src/landing-page.ts` (Lines 79-88)
- Injection patterns: `server/src/agent/tools/types.ts` (INJECTION_PATTERNS)
