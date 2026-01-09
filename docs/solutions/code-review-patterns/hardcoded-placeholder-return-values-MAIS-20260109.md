---
category: code-review-patterns
project: MAIS
date: 2026-01-09
tags:
  - code-review
  - placeholder
  - bug-pattern
  - static-analysis
  - convergent-findings
severity: P1
detection_difficulty: high
---

# Hardcoded Placeholder Return Values

**Date:** 2026-01-09
**Project:** MAIS Multi-Tenant Platform
**Context:** Build Mode UX enhancements (commit f1645a82)
**Detection Method:** 6-agent parallel code review (4/6 flagged independently)

---

## Problem Statement

Functions that parse input to extract meaningful values but return hardcoded placeholders instead of the parsed results. The function signature and implementation appear correct, types check, and tests pass for the first element - but the function silently ignores its input.

**The Pattern:**

```typescript
// BUG: Parses input but returns hardcoded value
function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;
  const pageId = parts[0] as PageName;
  // Parses pageId correctly, but...
  return { pageId, sectionIndex: 0 }; // Always returns 0!
}
```

**Expected behavior:** `resolveSectionId('home-hero-2')` should return `{ pageId: 'home', sectionIndex: 2 }`

**Actual behavior:** Returns `{ pageId: 'home', sectionIndex: 0 }` regardless of input

---

## Why This Bug Is Hard to Catch

### 1. Types Check Correctly

The return type `{ pageId: PageName; sectionIndex: number }` is satisfied by `{ pageId, sectionIndex: 0 }`. TypeScript cannot detect that the value should come from the input.

### 2. Tests Pass for Index 0

Any test that uses the first section (`sectionIndex: 0`) will pass:

```typescript
// This test PASSES despite the bug
test('resolves home-hero-0', () => {
  const result = resolveSectionId('home-hero-0');
  expect(result).toEqual({ pageId: 'home', sectionIndex: 0 }); // Correct by accident
});
```

### 3. The Function Looks Complete

The implementation has:

- Input validation (`parts.length < 2`)
- Parsing logic (`sectionId.split('-')`)
- Proper return type
- No obvious TODO comments

A quick scan sees "parses input, returns structured data" and moves on.

### 4. IDE Autocomplete Reinforces Correctness

When writing the return statement, autocomplete shows `{ pageId, sectionIndex: ... }`. The developer types `0` as a placeholder intending to fix it, then forgets.

---

## Detection Strategy

### Code Review Checklist

Add these items to code review checklists:

```markdown
## Return Value Verification

- [ ] **Parsed values used:** If function parses input, are ALL parsed values used in return?
- [ ] **No hardcoded numbers in returns:** Is any return value a literal (0, 1, '', []) when it should come from parsing?
- [ ] **Index extraction complete:** If parsing array indices, is parseInt/Number actually called?
- [ ] **Test coverage beyond index 0:** Do tests use values other than first element?
```

### Static Analysis Patterns

Look for these warning signs:

```typescript
// WARNING: Parsing input but not using all parts
const parts = input.split('-');
// ... uses parts[0]
// ... does NOT use parts[1] or parts[2]

// WARNING: Return contains literal where variable expected
return { extracted: parsed[0], index: 0 }; // Why literal 0?

// WARNING: Function name implies extraction but returns constant
function getIndexFromId(id: string): number {
  const match = id.match(/\d+/);
  return 0; // Should be parseInt(match[0])
}
```

### Test Coverage Requirements

For any parsing function, require tests that:

1. **Use non-zero values:** Test with indices 1, 2, 5
2. **Use boundary values:** Test with max expected index
3. **Verify round-trip:** Parse then use result to access original data

```typescript
// Good test coverage for resolveSectionId
test.each([
  ['home-hero-0', { pageId: 'home', sectionIndex: 0 }],
  ['home-hero-1', { pageId: 'home', sectionIndex: 1 }], // Catches the bug!
  ['about-text-5', { pageId: 'about', sectionIndex: 5 }],
])('resolves %s correctly', (input, expected) => {
  expect(resolveSectionId(input)).toEqual(expected);
});
```

---

## Prevention Pattern

### 1. Complete the Parsing

```typescript
// CORRECT: All parsed values used
function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  const parts = sectionId.split('-');
  if (parts.length < 3) return null;

  const pageId = parts[0] as PageName;
  const sectionIndex = parseInt(parts[2], 10); // Actually parse the index!

  if (isNaN(sectionIndex)) return null;

  return { pageId, sectionIndex };
}
```

### 2. Use TypeScript to Enforce

Create a helper type that requires all fields to be non-literal:

```typescript
// When writing parsing functions, use descriptive variable names
// that make hardcoded values obvious during review
function resolveSectionId(sectionId: string) {
  const [pageId, sectionType, indexString] = sectionId.split('-');
  const parsedIndex = parseInt(indexString, 10);
  //    ^^^^^^^^^^^ Variable name makes clear this should be used

  return { pageId, sectionIndex: parsedIndex }; // Not sectionIndex: 0
}
```

### 3. Self-Documenting Return Statements

```typescript
// Pattern: Destructure then return same names
const { pageId, sectionIndex } = parseId(sectionId);
return { pageId, sectionIndex }; // Harder to accidentally use literal

// vs error-prone pattern
return { pageId, sectionIndex: 0 }; // Easy to type placeholder
```

---

## Example From This Session

### The Bug

In the Build Mode inline editing feature, `resolveSectionId` was added to map section IDs like `home-hero-main` to page indices for highlighting:

```typescript
// apps/web/src/components/storefront/edit/StorefrontPreviewFrame.tsx

function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;
  const pageId = parts[0] as PageName;
  return { pageId, sectionIndex: 0 }; // BUG: Always 0
}
```

### The Impact

- First section on any page: Highlighting works (index 0 is correct by accident)
- Second section or later: Wrong section highlighted
- User clicks "About Text" section: Hero section gets highlighted instead

### How It Was Caught

4 out of 6 independent code review agents flagged this same issue:

1. **DHH Persona:** "This function parses a section ID but always returns index 0"
2. **TypeScript Reviewer:** "Return value doesn't use all parsed components"
3. **Simplicity Reviewer:** "Function does unnecessary work if it ignores the result"
4. **Architecture Reviewer:** "Index should be extracted from the ID format"

**Convergent findings from independent reviewers are high-signal.** When multiple reviewers with different focuses flag the same code, it almost certainly indicates a real issue.

### The Fix

```typescript
function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  // New ID format: "home-hero-main" or legacy "home-0"
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;

  const pageId = parts[0] as PageName;

  // Try to extract numeric index from last part
  const lastPart = parts[parts.length - 1];
  const sectionIndex = parseInt(lastPart, 10);

  // If not numeric (e.g., "main", "intro"), look up by section type
  if (isNaN(sectionIndex)) {
    // For named sections, find index by querying current page state
    return { pageId, sectionIndex: findSectionIndexByName(pageId, lastPart) };
  }

  return { pageId, sectionIndex };
}
```

---

## Related Patterns

- **Dead code that isn't dead:** Code that runs but produces no effect
- **Silent failures:** Functions that return default values instead of throwing
- **Test blind spots:** Tests that only exercise the happy path

---

## Checklist for AI Agents

When reviewing parsing functions, verify:

```markdown
- [ ] Every split/match/parse result is used in the return value
- [ ] No literal numbers (0, 1, -1) in return statements where parsed values expected
- [ ] Tests include non-zero/non-empty cases
- [ ] Variable names match their usage (parsedIndex -> sectionIndex, not 0)
```

---

## Tags

`code-review` `placeholder` `bug-pattern` `parsing` `return-values` `convergent-findings` `multi-agent-review`
