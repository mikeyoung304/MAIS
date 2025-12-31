---
status: complete
priority: p2
issue_id: '399'
tags:
  - performance
  - nextjs
  - code-review
dependencies: []
---

# TenantLandingPage Marked 'use client' Unnecessarily

## Problem Statement

The `TenantLandingPage.tsx` component is marked with `'use client'` directive but contains no client-side interactivity (no useState, useEffect, event handlers). This forces the entire component tree to be sent as JavaScript and hydrated on the client, increasing bundle size and Time to Interactive.

## Findings

**Found by:** Performance Oracle agent

**Location:** `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx`

```tsx
'use client'; // <- Unnecessary

import Link from 'next/link';
import Image from 'next/image';
// ... rest is just static JSX rendering
```

**Analysis:**

- No `useState` or `useReducer` hooks
- No `useEffect` hooks
- No `onClick` or other event handlers
- No browser-only APIs
- Only interactivity is `href="#packages"` anchor links which work without JS

**Impact:**

- Larger JavaScript bundle (~10-20KB for this component tree)
- Slower Time to Interactive (TTI)
- Unnecessary hydration overhead
- Images not optimized for pure SSR

## Proposed Solutions

### Option 1: Remove 'use client' directive (Recommended)

- Delete the `'use client'` line
- Component becomes a Server Component by default
- All static content rendered server-side

**Pros:** Immediate bundle size reduction, faster TTI, pure SSR
**Cons:** None identified
**Effort:** Trivial (1 line change)
**Risk:** Very Low

### Option 2: Split into Server + Client parts

- Keep 'use client' if future interactivity planned
- Extract static parts to Server Component

**Pros:** Prepared for future features
**Cons:** Over-engineering for current state
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option 1 - Remove 'use client' directive.

## Technical Details

**File to modify:**

- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx` - Line 1

**Before:**

```tsx
'use client';

import Link from 'next/link';
```

**After:**

```tsx
import Link from 'next/link';
```

## Acceptance Criteria

- [ ] 'use client' directive removed
- [ ] Page renders correctly as Server Component
- [ ] Anchor links (`#packages`) still work
- [ ] Bundle size reduced (verify with `next build`)
- [ ] TypeScript compiles without errors

## Work Log

| Date       | Action                                | Learnings                                    |
| ---------- | ------------------------------------- | -------------------------------------------- |
| 2025-12-25 | Created from performance review       | 'use client' should only be used when needed |
| 2025-12-25 | **Approved for work** - Status: ready | P2 - Trivial fix                             |

## Resources

- Performance Oracle report
- Next.js Server Components documentation
