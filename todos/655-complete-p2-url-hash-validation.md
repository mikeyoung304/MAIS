---
status: pending
priority: p2
issue_id: 655
tags: [code-review, security, validation]
dependencies: []
---

# URL Hash Validation is Minimal

## Problem Statement

The URL hash is read with minimal validation. While the current implementation validates against existing segments, edge cases around URL encoding and length aren't handled.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 214-241

**Current code:**

```typescript
const hash = window.location.hash.slice(1); // Remove #
if (hash.startsWith('segment-')) {
  const slug = hash.replace('segment-', '');
  const segment = segments.find((s) => s.slug === slug);
  if (segment) {
    setSelectedSegmentId(segment.id);
  }
}
```

**Issues:**

1. No URL decoding (`%20` won't match space in slug)
2. No length limit (extremely long hashes could cause performance issues)
3. No try/catch for malformed URI encoding

**Source:** security-sentinel agent

## Proposed Solutions

### Option 1: Add Defensive Validation (Recommended)

Add decoding and length limit:

```typescript
const hash = window.location.hash.slice(1);
if (hash.startsWith('segment-') && hash.length < 200) {
  try {
    const slug = decodeURIComponent(hash.replace('segment-', ''));
    const segment = segments.find((s) => s.slug === slug);
    if (segment) {
      setSelectedSegmentId(segment.id);
    }
  } catch {
    // Invalid URI encoding, ignore
  }
}
```

**Pros:**

- Handles encoded characters
- Prevents performance issues from long hashes
- Graceful error handling

**Cons:**

- Slightly more code

**Effort:** Small (10 min)
**Risk:** Low

## Recommended Action

Option 1 - Add defensive validation

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

## Acceptance Criteria

- [ ] URL-encoded slugs are decoded before matching
- [ ] Hash length is capped at reasonable limit
- [ ] Malformed URIs don't throw errors
- [ ] Normal navigation still works

## Work Log

| Date       | Action                   | Learnings                                      |
| ---------- | ------------------------ | ---------------------------------------------- |
| 2026-01-08 | Created from code review | Defensive validation for user-controlled input |

## Resources

- Code review: Segment-first browsing implementation
