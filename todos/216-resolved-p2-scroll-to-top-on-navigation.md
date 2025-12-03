# TODO-216: Missing Scroll-to-Top on Landing Page Navigation

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Resolution Date: 2025-12-03

## Implementation
Implemented Option C (Layout-Level Scroll Reset) in `TenantStorefrontLayout.tsx`:
- Added `useLocation` hook to detect route changes
- Added scroll reset logic with hash fragment support
- Used `behavior: 'instant'` for immediate scroll without animation
- Preserves hash navigation (e.g., `#faq`, `#experiences`)

## Description

When navigating to the landing page from another route, the scroll position may persist from the previous page, causing users to land in the middle of the page instead of the top.

## Current Behavior

React Router doesn't reset scroll position by default. If user was scrolled down on `/t/tenant/s/segment` and navigates back to `/t/tenant`, they may still be scrolled down.

## Fix Required

### Option A: ScrollRestoration Component

```typescript
// client/src/app/Router.tsx
import { ScrollRestoration } from 'react-router-dom';

function App() {
  return (
    <RouterProvider router={router}>
      <ScrollRestoration />
    </RouterProvider>
  );
}
```

### Option B: useEffect in LandingPage

```typescript
// LandingPage.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function LandingPageContent({ tenant }: LandingPageProps) {
  const location = useLocation();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ...
}
```

### Option C: Layout-Level Scroll Reset

```typescript
// TenantStorefrontLayout.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function TenantStorefrontLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // ...
}
```

## Considerations

- Hero section should be visible immediately on navigation
- Smooth scroll to top may feel slow - prefer instant
- Respect hash fragments (e.g., `/t/tenant#faq` should scroll to FAQ)

```typescript
useEffect(() => {
  if (location.hash) {
    // Let browser handle hash navigation
    const element = document.getElementById(location.hash.slice(1));
    element?.scrollIntoView();
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}, [location]);
```

## Acceptance Criteria

- [x] Landing page loads at top of page
- [x] Navigation between routes resets scroll
- [x] Hash navigation still works (#faq, #experiences)
- [x] No jarring scroll jump on initial load

## Tags

ux, navigation, scroll, landing-page
