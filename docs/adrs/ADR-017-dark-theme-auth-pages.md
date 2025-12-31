# ADR-017: Dark Theme for Authentication Pages

**Status:** Accepted
**Date:** 2025-12-30
**Deciders:** Mike Young, Claude Code Review Agents
**Context:** Visual design system for auth pages vs marketing site

---

## Context

HANDLED has two distinct user-facing experiences:

1. **Marketing site** (landing page, pricing, about) - Light theme with white backgrounds
2. **Authentication pages** (signup, login) - Require their own visual treatment

The authentication pages are a critical conversion point. Users arriving from marketing pages need a design that:

- Creates a sense of progress ("you're taking action")
- Reduces visual fatigue during form completion
- Stands out from the marketing site to signal a new context
- Maintains brand cohesion with Electric Sage accent color

---

## Decision

**Use a dark graphite theme for authentication pages** while the main marketing site uses a light theme.

### Color System

| Token          | Value     | Purpose                             |
| -------------- | --------- | ----------------------------------- |
| `surface`      | `#18181B` | Primary background (dark graphite)  |
| `surface-alt`  | `#27272A` | Card backgrounds (slightly lighter) |
| `text-primary` | `#FAFAFA` | Primary text (near-white)           |
| `text-muted`   | `#A1A1AA` | Secondary text (muted gray)         |
| `sage`         | `#45B37F` | Electric Sage accent (pops on dark) |

### Design Rationale

1. **Context Shift** - Dark background signals "you're entering the app" vs browsing marketing content
2. **Focus** - Dark mode reduces visual noise, keeps attention on the form
3. **Modern SaaS Convention** - Many B2B SaaS products use dark auth flows (Vercel, Linear, Stripe)
4. **Brand Accent Pop** - Electric Sage (#45B37F) has higher perceived vibrancy on dark vs light
5. **Reduced Eye Strain** - Form completion involves focused reading; dark mode reduces fatigue

### Alternatives Considered

| Option                                     | Rejected Because                                                 |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Light theme everywhere                     | No visual differentiation for action-oriented auth pages         |
| System preference (`prefers-color-scheme`) | Inconsistent experience, harder to design for both               |
| Sage-heavy theme                           | Too much brand color causes fatigue; sage works better as accent |

---

## Implementation Details

### Affected Pages

- `/signup` - Tenant registration
- `/login` - User authentication
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset completion

### Key Components

1. **SignupForm** (`apps/web/src/app/signup/page.tsx`)
   - Uses `bg-surface` for page background
   - Uses `bg-surface-alt` for card
   - Uses `text-sage` for accent elements

2. **Chrome Autofill Override** (`apps/web/src/styles/globals.css`)
   - Custom styles to match dark theme when browser autofills credentials

### Accessibility

- All text meets WCAG 2.1 AA contrast (4.5:1 minimum)
- Trial badge: `text-sage` on `bg-sage/15` achieves ~4.9:1 ratio
- Error states: `text-danger-500` on dark surface achieves >7:1 ratio

---

## Consequences

### Positive

- Clear visual separation between marketing and auth flows
- Modern, premium aesthetic aligns with "done-for-you" positioning
- Sage accent color has maximum impact on dark background
- Consistent with broader SaaS design trends

### Negative

- Two theme contexts to maintain (light marketing, dark auth)
- Potential user expectation mismatch if they prefer light mode everywhere
- Chrome autofill requires special CSS handling

### Risks

- **Future dark mode request for marketing site:** Would need to decide if auth pages should remain darker or match
- **Brand evolution:** If brand moves away from dark themes, auth pages need redesign

---

## References

- Design tokens: `apps/web/tailwind.config.js`
- Autofill styles: `apps/web/src/styles/globals.css`
- Related: ADR-014 (Next.js migration for these pages)
