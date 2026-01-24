---
status: complete
priority: p2
issue_id: '674'
tags:
  - code-review
  - build-mode
  - react
  - performance
dependencies: []
---

# HighlightTrigger useEffect Has Unstable Array Dependency

## Problem Statement

The `HighlightTrigger` component's useEffect depends on the `highlights` array, which is created fresh each render during message parsing. This causes the effect to re-run on every parent re-render, potentially triggering duplicate highlights.

**Why it matters:** Each re-render could trigger the highlight callbacks again, causing visual glitches or unnecessary PostMessage traffic to the iframe.

## Findings

**Location:** `apps/web/src/components/agent/PanelAgentChat.tsx` (lines 594-611)

```typescript
function HighlightTrigger({ highlights, onSectionHighlight }) {
  useEffect(() => {
    // This runs every time highlights array changes...
    const timeouts = highlights.map((sectionId, index) =>
      setTimeout(() => onSectionHighlight(sectionId), index * 500)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [highlights, onSectionHighlight]); // highlights is new array each render!
```

**Root cause:** On line 338, `highlights` is assigned from `parseHighlights().highlights`, which creates a new array every render. Even if the content is identical, React sees it as a different reference.

## Proposed Solutions

### Option 1: Stringify Array for Comparison

Use `JSON.stringify(highlights)` as the dependency instead of the array itself.

```typescript
const highlightsKey = JSON.stringify(highlights);
useEffect(() => {
  const parsed = JSON.parse(highlightsKey) as string[];
  // ... trigger logic
}, [highlightsKey, onSectionHighlight]);
```

**Effort:** Small (15 min)
**Risk:** Low

---

### Option 2: useMemo to Stabilize Array

Memoize the highlights array based on message content.

```typescript
const highlights = useMemo(() => {
  if (message.role !== 'assistant') return [];
  return parseHighlights(message.content).highlights;
}, [message.content, message.role]);
```

**Effort:** Small (15 min)
**Risk:** Low

---

### Option 3: Track Message ID Instead

Only trigger highlights when the message ID changes (new message), not on every render.

```typescript
const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);
useEffect(() => {
  if (message.id === lastProcessedId) return;
  setLastProcessedId(message.id);
  // ... trigger logic
}, [message.id]);
```

**Effort:** Small (20 min)
**Risk:** Low

## Recommended Action

**Option 2** (useMemo) is cleanest - it stabilizes the array reference while keeping the logic readable.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/PanelAgentChat.tsx`

## Acceptance Criteria

- [ ] Highlights only trigger once when a new message arrives
- [ ] Re-renders don't cause duplicate highlight callbacks
- [ ] Existing highlight behavior unchanged

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-01-09 | Created from code review | TypeScript reviewer flagged |
