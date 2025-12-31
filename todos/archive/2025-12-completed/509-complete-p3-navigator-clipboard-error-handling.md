# P3: navigator.clipboard Without Error Handling

## Status

- **Priority:** P3 (Low - Robustness)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - TypeScript Reviewer

## Problem

The copy-to-clipboard functionality doesn't wrap `navigator.clipboard` in try/catch.

**File:** `apps/web/src/app/(protected)/admin/tenants/new/page.tsx` (line 45)

```typescript
const handleCopyKey = async () => {
  if (secretKey) {
    await navigator.clipboard.writeText(secretKey); // Can throw!
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
};
```

**Scenarios where this fails:**

- Non-HTTPS contexts (except localhost)
- Older browsers without clipboard API
- Some iframe restrictions
- User denies clipboard permission

## Impact

Low - most modern browsers in HTTPS support this. But error could surface as unhandled rejection.

## Solution

Wrap in try/catch with fallback:

```typescript
const handleCopyKey = async () => {
  if (!secretKey) return;

  try {
    await navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    // Fallback or show error toast
    console.error('Failed to copy:', err);
    // Could show toast: "Copy failed - please select and copy manually"
  }
};
```

## Tags

`error-handling`, `clipboard`, `robustness`
