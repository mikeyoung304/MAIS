---
status: pending
priority: p2
issue_id: 611
tags: [code-review, security, pii, agent-eval]
dependencies: []
created: 2026-01-02
---

# Incomplete PII Pattern Coverage in pii-redactor.ts

## Problem Statement

The PII redactor is missing patterns for several common PII types that could leak through the evaluation pipeline.

## Findings

**Source:** security-sentinel review

**Location:** `server/src/lib/pii-redactor.ts` lines 22-54

**Missing patterns:**

1. IP addresses - Could identify users
2. Dates of birth - Common in forms (e.g., "DOB: 01/15/1990")
3. International phone numbers - Pattern only covers US format
4. Bank account/routing numbers
5. Passport numbers

**Current patterns:** Email, Phone (US), Card, SSN, Address, Name

## Proposed Solutions

### Option 1: Add missing high-priority patterns (Recommended)

**Pros:** Better PII coverage
**Cons:** More regex complexity, potential false positives
**Effort:** Medium
**Risk:** Low (patterns are additive)

```typescript
// Add to PII_PATTERNS
// IP addresses
{ pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },

// International phone (E.164 format)
{ pattern: /\+\d{7,15}\b/g, replacement: '[PHONE]' },

// Date of birth patterns
{ pattern: /\b(?:DOB|Date of Birth|Birthday)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi, replacement: '[DOB]' },
```

### Option 2: Document current limitations

**Pros:** No code change, sets expectations
**Cons:** PII could still leak
**Effort:** Small
**Risk:** Compliance gap

### Option 3: Use dedicated PII library

**Pros:** Comprehensive, maintained by experts
**Cons:** External dependency, performance overhead
**Effort:** Large
**Risk:** Medium (integration complexity)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/lib/pii-redactor.ts`
- `server/test/agent-eval/adversarial.test.ts` (add tests)

## Acceptance Criteria

- [ ] IP addresses are redacted as [IP]
- [ ] International phone numbers (E.164) are redacted as [PHONE]
- [ ] Test coverage for new patterns
- [ ] No false positives on legitimate business content

## Work Log

| Date       | Action                           | Learnings                             |
| ---------- | -------------------------------- | ------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by security-sentinel agent |

## Resources

- [PII patterns reference](https://owasp.org/www-community/OWASP_Validation_Regex_Repository)
