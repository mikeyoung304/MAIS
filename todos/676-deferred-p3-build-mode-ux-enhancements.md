---
status: deferred
priority: p3
issue_id: '676'
tags:
  - code-review
  - build-mode
  - deferred
  - batch
dependencies:
  - '673'
  - '674'
  - '675'
---

# Build Mode UX Enhancements - Deferred P3 Items

## Overview

These P3 items were identified during code review of commit `f1645a82` (Build Mode UX Enhancements). They are nice-to-have improvements that don't affect functionality. Deferred until P1/P2 items are resolved.

## Deferred Items

### 1. Unsafe `as PageName` Type Assertion

**File:** `apps/web/src/components/build-mode/BuildModeChat.tsx` (line 40)

```typescript
const pageId = parts[0] as PageName; // No validation before cast
```

**Fix:** Validate against PageName union before casting:

```typescript
const validPages = ['home', 'about', 'services', 'contact', 'faq', 'gallery', 'testimonials'];
if (!validPages.includes(parts[0])) return null;
```

**Effort:** 10 min

---

### 2. QuickActionChip Not Memoized

**File:** `apps/web/src/components/build-mode/BuildModeChat.tsx` (lines 173-192)

Since chip props rarely change and there are 5 chips, `React.memo` would prevent unnecessary re-renders.

**Effort:** 5 min

---

### 3. Parsers Could Share Location

**Files:**

- `apps/web/src/lib/parseHighlights.ts`
- `apps/web/src/lib/parseQuickReplies.ts`

Both follow same pattern. Consider co-locating in `lib/agent/parseAgentMarkers.ts`.

**Effort:** 30 min

---

### 4. Highlight Auto-Clear Not Implemented

**File:** `apps/web/src/app/(protected)/tenant/build/page.tsx`

Highlights persist until explicitly cleared. Should auto-clear after 3 seconds per the plan.

```typescript
const handleSectionHighlight = (pageId, sectionIndex) => {
  setHighlightedSection(sectionIndex);
  setTimeout(() => setHighlightedSection(null), 3000); // Add this
};
```

**Effort:** 10 min

---

### 5. Magic 500ms Stagger Number

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx` (line 601)

```typescript
setTimeout(() => onSectionHighlight(sectionId), index * 500); // Why 500?
```

Consider making configurable or documenting rationale.

**Effort:** 5 min

---

### 6. Section ID Validation Could Be Stricter

**File:** `apps/web/src/lib/parseHighlights.ts`

For defense-in-depth, validate section IDs against expected pattern:

```typescript
const SECTION_ID_PATTERN = /^[a-z]+-[a-z]+-[a-z0-9]+$/i;
```

**Effort:** 10 min

---

### 7. Regex Runs Twice in parseHighlights

**File:** `apps/web/src/lib/parseHighlights.ts` (lines 37-42)

```typescript
while ((match = pattern.exec(content)) !== null) { ... }
const message = content.replace(pattern, '').trim();  // Runs regex again
```

Could capture both in single pass with `replaceAll` callback.

**Effort:** 15 min

---

### 8. HighlightTrigger Could Be Inlined

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx` (lines 587-611)

The effect-only component pattern (renders null) could be simplified to inline useEffect.

**Effort:** 20 min

---

## Total Estimated Effort

~105 minutes for all P3 items. Low priority - address during cleanup sprint.

## Work Log

| Date       | Action                         | Learnings                    |
| ---------- | ------------------------------ | ---------------------------- |
| 2026-01-09 | Created as batch deferred todo | From code review of f1645a82 |
