---
status: open
priority: p2
issue_id: '587'
tags: [code-review, architecture, dry, security]
dependencies: []
created_at: 2026-01-02
---

# P2: Duplicate PII Redaction Logic Across Modules

> **Architecture Review:** PII patterns and redaction functions are duplicated in pipeline.ts and review-queue.ts with slight differences.

## Problem Statement

PII redaction patterns are defined in two places with variations:

**File 1:** `/server/src/agent/evals/pipeline.ts` (lines 56-144)

- 6 patterns: email, phone, card, SSN, address, name

**File 2:** `/server/src/agent/feedback/review-queue.ts` (lines 86-103)

- 4 patterns: email, phone, card, SSN (missing address, name)

**Impact:**

- Security risk if patterns diverge
- Maintenance burden
- Violation of DRY principle

## Findings

| Reviewer            | Finding                                           |
| ------------------- | ------------------------------------------------- |
| Architecture Review | P1: PII redaction logic duplicated across modules |
| Security Review     | P2: Incomplete PII redaction patterns             |
| Performance Review  | P2: Duplicate PII regex patterns                  |
| Security Review     | P2: Review Queue missing PII patterns             |

## Proposed Solution

Extract to shared module:

```typescript
// server/src/lib/pii-redactor.ts
export const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CARD]' },
  { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '[SSN]' },
  {
    pattern:
      /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|circle|cir|boulevard|blvd)\b/gi,
    replacement: '[ADDRESS]',
  },
  {
    pattern: /\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
    replacement: 'my name is [NAME]',
  },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
];

export function redactPII(text: string): string {
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function redactObjectPII(obj: unknown): unknown {
  // ... recursive redaction
}
```

Then import in both files:

```typescript
import { redactPII, redactObjectPII, PII_PATTERNS } from '../../lib/pii-redactor';
```

## Acceptance Criteria

- [ ] Create `server/src/lib/pii-redactor.ts`
- [ ] Update pipeline.ts to use shared module
- [ ] Update review-queue.ts to use shared module
- [ ] Add missing patterns (IP, etc.) to shared list
- [ ] Tests verify all patterns work

## Work Log

| Date       | Action                         | Learnings                                 |
| ---------- | ------------------------------ | ----------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Multiple reviewers identified duplication |
