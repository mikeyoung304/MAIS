---
status: complete
priority: p3
issue_id: '069'
tags: [code-review, code-quality, react, simplicity]
dependencies: []
---

# useCallback Overuse in ImageUploadField Component

## Problem Statement

The ImageUploadField component wraps every handler in `useCallback`, adding 50+ lines of boilerplate with no performance benefit. The component doesn't pass handlers to memoized children, so `useCallback` provides zero optimization.

**Why This Matters:**

- 50+ lines of unnecessary code
- Cognitive overhead (dependency arrays to track)
- Cargo-culting React patterns
- Obscures simple logic

## Findings

### Evidence from Code Review

**Current Over-Engineering:**

```typescript
// 7 useCallback wrappers, none necessary
const validateFile = useCallback((file: File): string | null => { ... }, [maxSizeMB]);
const uploadFile = useCallback(async (file: File) => { ... }, [uploadEndpoint, onChange, validateFile]);
const handleDragOver = useCallback((e: React.DragEvent) => { ... }, [disabled, isUploading]);
const handleDragLeave = useCallback((e: React.DragEvent) => { ... }, []);
const handleDrop = useCallback((e: React.DragEvent) => { ... }, [disabled, isUploading, uploadFile]);
const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { ... }, [uploadFile]);
const handleRemove = useCallback(() => { ... }, [onChange]);
const handleClick = useCallback(() => { ... }, [disabled, isUploading]);
```

**When useCallback IS needed:**

- Passing callbacks to `React.memo` wrapped children
- Using callbacks in `useEffect` dependencies
- Neither applies here

### Code Simplicity Reviewer Assessment

- SEVERE: "Pure cargo-culting React optimization patterns"
- No child components receive these handlers
- Same runtime performance without useCallback

## Proposed Solutions

### Option A: Remove All useCallbacks (Recommended)

**Description:** Use regular functions, inline trivial handlers.

**Pros:**

- 50+ lines removed
- Clearer code
- No dependency arrays to maintain
- Identical performance

**Cons:**

- None (purely beneficial)

**Effort:** Small (30 minutes)
**Risk:** None

```typescript
function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  if (!disabled && !isUploading) setIsDragging(true);
}

function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);
  if (disabled || isUploading) return;
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
}

// Or inline for trivial cases
<div onDragLeave={() => setIsDragging(false)}>
```

## Recommended Action

**Option A: Remove All useCallbacks** - Zero risk, pure improvement.

## Technical Details

**Affected Files:**

- `client/src/components/ImageUploadField.tsx`

## Acceptance Criteria

- [x] No `useCallback` in ImageUploadField
- [x] Regular functions or inline handlers used
- [x] Component still works correctly
- [x] Lines reduced by ~50

## Work Log

| Date       | Action    | Notes                                                          |
| ---------- | --------- | -------------------------------------------------------------- |
| 2025-11-29 | Created   | Found during code review - Code Simplicity Reviewer            |
| 2025-12-02 | Completed | Verified component already refactored to use regular functions |

## Resources

- When to useCallback: https://react.dev/reference/react/useCallback#should-you-add-usecallback-everywhere
- Kent C. Dodds on useCallback: https://kentcdodds.com/blog/usememo-and-usecallback
