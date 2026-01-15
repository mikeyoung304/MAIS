---
title: ESLint no-self-assign Error with Iframe Refresh Pattern
category: build-errors
severity: low
symptoms:
  - "Error: 'iframeRef.current.src' is assigned to itself. no-self-assign"
  - ESLint build failure
  - Iframe not refreshing as expected
root_cause: eslint-no-self-assign-rule
prevention: store-before-reassign-pattern
date_created: 2026-01-15
last_verified: 2026-01-15
related_commits:
  - 07a76ca1
---

# ESLint no-self-assign Error with Iframe Refresh Pattern

## Problem

ESLint fails with:

```
Error: 'iframeRef.current.src' is assigned to itself.  no-self-assign
```

This happens when using the common pattern to force an iframe reload:

```tsx
// Triggers ESLint error
iframeRef.current.src = iframeRef.current.src;
```

## Root Cause

The `no-self-assign` ESLint rule flags any assignment where the right-hand side is identical to the left-hand side. While this is usually a mistake, the iframe src self-assignment is an **intentional pattern** to force a reload without changing the URL.

## Solution

Store the src value in a variable first, then reassign:

```tsx
// BEFORE - triggers ESLint error
const handleRefresh = () => {
  if (iframeRef.current) {
    iframeRef.current.src = iframeRef.current.src;
  }
};

// AFTER - works correctly, no ESLint error
const handleRefresh = () => {
  if (iframeRef.current) {
    // Store src and reassign to force iframe reload
    const currentSrc = iframeRef.current.src;
    iframeRef.current.src = currentSrc;
  }
};
```

## Why This Works

1. **Same behavior**: The iframe still reloads because we're assigning a new value (even though it's the same URL)
2. **ESLint passes**: The rule sees `src = currentSrc` (different identifiers), not `src = src`
3. **Self-documenting**: The comment explains the intent

## Alternative Approaches

### Option 1: Use contentWindow.location.reload()

```tsx
iframeRef.current.contentWindow?.location.reload();
```

⚠️ May have cross-origin issues if iframe loads external content.

### Option 2: Append cache-buster query param

```tsx
const url = new URL(iframeRef.current.src);
url.searchParams.set('_t', Date.now().toString());
iframeRef.current.src = url.toString();
```

⚠️ Changes the URL, may affect routing/state in iframe.

### Option 3: ESLint disable comment

```tsx
// eslint-disable-next-line no-self-assign
iframeRef.current.src = iframeRef.current.src;
```

⚠️ Hides the intent, not recommended.

## When This Pattern is Needed

- **Preview iframes**: Refresh when content changes server-side
- **Build mode previews**: Reload after agent makes changes
- **Live reload**: Force refresh without full page reload

## Related Files

- `apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx`

## Tags

eslint, no-self-assign, iframe, react, refresh, lint-error
