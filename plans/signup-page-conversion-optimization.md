# Signup Page Conversion Optimization

> **Priority:** P0-P3 (Instrumentation → Core → Polish → Data-Driven)
> **Estimated Effort:** 3-4 hours (Phases 0-3)
> **Impact:** High — addresses the "conversion cliff" between homepage and signup
> **Review Status:** ✅ Approved by 4 reviewers (DHH, Kieran, Simplicity, Frontend Design)

---

## Problem Statement

The homepage builds significant momentum with transformation-focused copy, social proof, and specific value propositions. The signup page drops ALL of this and presents a generic 4-field form with "Create your account."

**Current State:**

- Generic card: "Create your account" / "Start growing your business with HANDLED"
- URL params (`?tier=handled`, `?tier=fully-handled`) are **ignored**
- No value reinforcement from homepage
- No trust signals
- 4 form fields (including Confirm Password)
- Generic CTA: "Create Account"
- Light mode styling (inconsistent with dark homepage)

**The Conversion Cliff:**
Research shows signup abandonment rates are 50-70% when the form doesn't continue the narrative from the landing page.

---

## Proposed Solution

Transform the signup page into a **tier-aware, conversion-optimized experience** that:

1. Honors the user's pricing tier selection
2. Reinforces value propositions with proper visual hierarchy
3. Reduces form friction (3 fields, not 4)
4. Uses transformation-focused copy aligned with brand voice
5. Matches dark theme from homepage

---

## Reviewer Consensus

| Reviewer            | Verdict                    | Key Contribution                                 |
| ------------------- | -------------------------- | ------------------------------------------------ |
| **DHH**             | ✅ Approve with Notes      | "Ship Phase 1, measure, then decide on Phase 2"  |
| **Kieran**          | ✅ Approve with Notes      | Type safety, accessibility, edge cases           |
| **Simplicity**      | ✅ Approve with Notes      | Plain object over function, defer two-column     |
| **Frontend Design** | ✅ Approve with Amendments | Visual hierarchy, dark theme, micro-interactions |

**Key Insight (unanimous):** 80% of conversion improvement comes from tier-aware copy and visual hierarchy, not layout complexity. The two-column sidebar should be deferred until metrics prove the need.

---

## Technical Approach

### Architecture

The signup page is already a client component (`'use client'`), which means we can use `useSearchParams()` from `next/navigation` to read URL params. This requires no backend changes.

**Key Pattern (from login page):**

```tsx
import { useSearchParams } from 'next/navigation';

function SignupForm() {
  const searchParams = useSearchParams();
  const rawTier = searchParams.get('tier');
  const tier = rawTier || null; // Normalize empty string to null

  const content = getTierContent(tier);
  // ...
}
```

**Existing Pattern Reference:** `apps/web/src/app/login/page.tsx:25` already uses `useSearchParams()` correctly with Suspense boundary.

---

## Implementation Phases

### Phase 0: Instrumentation (1 hour)

**Goal:** Establish baseline metrics before any UI changes

**Files to modify:**

- `apps/web/src/app/signup/page.tsx`

**Tasks:**

1. **Add analytics events**

   ```tsx
   // On component mount
   useEffect(() => {
     trackEvent('signup_page_view', { tier: tier || 'none' });
   }, [tier]);

   // On first field focus
   const handleFirstInteraction = () => {
     if (!hasInteracted) {
       trackEvent('signup_form_interaction', { tier: tier || 'none' });
       setHasInteracted(true);
     }
   };

   // On submit attempt
   trackEvent('signup_submit_attempt', { tier: tier || 'none' });

   // On success
   trackEvent('signup_success', { tier: tier || 'none', tenantId: data.tenantId });
   ```

2. **Track form abandonment** (optional: use beforeunload)

**Acceptance Criteria:**

- [ ] Page view events fire with tier parameter
- [ ] First interaction tracked
- [ ] Submit attempts tracked
- [ ] Success/failure tracked

---

### Phase 1: Core Conversion + Visual Hierarchy (1-1.5 hours)

**Goal:** Tier-aware copy with proper visual hierarchy (title OUTSIDE card)

**Files to modify:**

- `apps/web/src/app/signup/page.tsx`

**Key Visual Change (per Frontend Design review):**

Move tier title/subtitle OUTSIDE the card for proper visual hierarchy:

```tsx
// BEFORE (buried in card)
<Card>
  <CardHeader>
    <CardTitle>Create your account</CardTitle>
    <CardDescription>Start growing...</CardDescription>
  </CardHeader>
  <CardContent>
    <form>...</form>
  </CardContent>
</Card>

// AFTER (proper hierarchy)
<div className="w-full max-w-md">
  {/* Logo */}
  <div className="mb-8 text-center">
    <Link href="/" className="font-serif text-3xl font-bold text-text-primary">
      HANDLED
    </Link>
  </div>

  {/* Trial Badge - with border for pop */}
  <div className="flex justify-center mb-6">
    <div className="inline-flex items-center gap-2 bg-sage/15 text-sage text-sm font-medium px-4 py-2 rounded-full border border-sage/30">
      <Sparkles className="w-4 h-4" aria-hidden="true" />
      14 days free — no credit card
    </div>
  </div>

  {/* Tier Title - PRIMARY hierarchy, OUTSIDE card */}
  <h1
    id="signup-heading"
    className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-3 leading-[1.15]"
  >
    {content.title}
  </h1>

  {/* Tier Subtitle - SECONDARY hierarchy */}
  <p className="text-text-muted text-center mb-8 leading-relaxed">
    {content.subtitle}
  </p>

  {/* Card - Form only, reduced header */}
  <Card className="bg-surface-alt border border-neutral-800 rounded-3xl">
    <CardContent className="pt-6">
      <form aria-labelledby="signup-heading">
        {/* Form fields only */}
      </form>
    </CardContent>
  </Card>
</div>
```

**Type-Safe Tier Content (per Kieran + Simplicity):**

```tsx
// Use plain object with const assertion (not function with switch)
const SIGNUP_TIERS = ['handled', 'fully-handled'] as const;
type SignupTier = (typeof SIGNUP_TIERS)[number];

function isValidTier(tier: string | null): tier is SignupTier {
  return tier !== null && (SIGNUP_TIERS as readonly string[]).includes(tier);
}

interface TierContent {
  title: string;
  subtitle: string;
  cta: string;
  loadingCta: string;
}

const TIER_CONTENT: Record<SignupTier | 'default', TierContent> = {
  handled: {
    title: "Let's build your storefront.",
    subtitle: 'Done-for-you website + booking. 14 days free, no credit card.',
    cta: 'Start my storefront',
    loadingCta: 'Setting up your storefront...',
  },
  'fully-handled': {
    title: "Let's get you more clients.",
    subtitle: 'AI chatbot + auto-responder. One booking pays for itself.',
    cta: 'Start growing',
    loadingCta: 'Preparing your growth system...',
  },
  default: {
    title: 'Bring your passion.',
    subtitle: 'The rest is handled. 14 days free, no credit card.',
    cta: 'Get Handled',
    loadingCta: 'Setting up your storefront...',
  },
};

function getTierContent(tier: string | null): TierContent {
  if (isValidTier(tier)) {
    return TIER_CONTENT[tier];
  }
  return TIER_CONTENT.default;
}
```

**CTA Button with ArrowRight (per Frontend Design):**

```tsx
<Button
  type="submit"
  variant="sage"
  className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl hover:shadow-sage/20 transition-all duration-300"
  disabled={isLoading}
>
  {isLoading ? (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      {content.loadingCta}
    </span>
  ) : (
    <span className="flex items-center justify-center gap-2">
      {content.cta}
      <ArrowRight className="h-4 w-4" />
    </span>
  )}
</Button>
```

**Acceptance Criteria:**

- [ ] `/signup?tier=handled` shows Foundation-specific copy
- [ ] `/signup?tier=fully-handled` shows System-specific copy
- [ ] `/signup` (no tier) shows default copy
- [ ] `/signup?tier=invalid` shows default copy (graceful fallback)
- [ ] `/signup?tier=` (empty string) shows default copy
- [ ] Title is OUTSIDE card with proper visual weight
- [ ] Trial badge has `border-sage/30` for pop
- [ ] CTA includes ArrowRight icon
- [ ] Type guard validates tier parameter

---

### Phase 2: Form Friction Reduction (30-45 min)

**Goal:** Remove Confirm Password, add inline validation, dark theme inputs

**Files to modify:**

- `apps/web/src/app/signup/page.tsx`
- `apps/web/src/app/globals.css` (Chrome autofill override)

**Tasks:**

1. **Remove confirmPassword state and field**
   - Delete `confirmPassword` state variable
   - Delete `showConfirmPassword` state variable
   - Delete "Confirm Password" form field JSX
   - Remove confirmPassword validation from `validateForm()`

2. **Add inline password validation with live feedback**

   ```tsx
   {
     /* Password with inline validation hint */
   }
   <div className="space-y-2">
     <Label htmlFor="password" className="text-text-primary">
       Password
     </Label>
     <div className="relative">
       <Lock
         className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
         aria-hidden="true"
       />
       <Input
         id="password"
         type={showPassword ? 'text' : 'password'}
         placeholder="Create a password"
         value={password}
         onChange={(e) => {
           setPassword(e.target.value);
           if (fieldErrors.password) {
             setFieldErrors((prev) => ({ ...prev, password: '' }));
           }
         }}
         className="pl-10 pr-12 bg-surface border-neutral-700 text-text-primary placeholder:text-text-muted/60 focus:border-sage focus:ring-2 focus:ring-sage/20"
         required
         autoComplete="new-password"
         disabled={isLoading}
         aria-describedby="password-hint"
       />
       <button
         type="button"
         onClick={() => setShowPassword(!showPassword)}
         className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
         aria-label={showPassword ? 'Hide password' : 'Show password'}
         tabIndex={-1}
       >
         {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
       </button>
     </div>
     {/* Inline validation hint */}
     {!fieldErrors.password && (
       <p id="password-hint" className="text-xs text-text-muted flex items-center gap-1">
         {password.length >= 8 ? (
           <>
             <Check className="w-3 h-3 text-sage" aria-hidden="true" />
             <span className="text-sage">8+ characters</span>
           </>
         ) : (
           <span>Min 8 characters</span>
         )}
       </p>
     )}
     {fieldErrors.password && (
       <p className="text-sm text-danger-500" role="alert">
         {fieldErrors.password}
       </p>
     )}
   </div>;
   ```

3. **Add Chrome autofill override to globals.css**

   ```css
   /* Chrome autofill override for dark theme */
   input:-webkit-autofill,
   input:-webkit-autofill:hover,
   input:-webkit-autofill:focus {
     -webkit-box-shadow: 0 0 0 1000px #18181b inset !important;
     -webkit-text-fill-color: #fafafa !important;
     caret-color: #fafafa;
     transition: background-color 5000s ease-in-out 0s;
   }
   ```

4. **Add "What's next" copy below CTA**

   ```tsx
   <p className="text-sm text-text-muted text-center mt-4">
     You'll set up your storefront next. Takes about 5 minutes.
   </p>
   ```

5. **Update all inputs for dark theme**

   ```tsx
   const inputDarkStyles = `
     bg-surface
     border-neutral-700
     text-text-primary
     placeholder:text-text-muted/60
     focus:border-sage
     focus:ring-2
     focus:ring-sage/20
     focus:outline-none
     hover:border-neutral-600
     transition-colors duration-200
   `;
   ```

6. **Fix error states to use design tokens**
   ```tsx
   // BEFORE: border-red-500
   // AFTER:  border-danger-500 focus:border-danger-500 focus:ring-danger-500/20
   ```

**Acceptance Criteria:**

- [ ] Only 3 form fields: Business Name, Email, Password
- [ ] Password field has live validation hint (checkmark when valid)
- [ ] Password toggle has 44px touch target
- [ ] Chrome autofill doesn't break dark theme
- [ ] Error states use `border-danger-500`
- [ ] "What's next" copy appears below CTA

---

### Phase 3: Accessibility + Final Polish (30 min)

**Goal:** WCAG AA compliance, screen reader support, skeleton dark mode

**Files to modify:**

- `apps/web/src/app/signup/page.tsx`

**Tasks:**

1. **Add accessible form attributes**

   ```tsx
   <form
     onSubmit={handleSubmit}
     className="space-y-4"
     aria-labelledby="signup-heading"
     aria-busy={isLoading}
   >
   ```

2. **Add screen reader loading announcement**

   ```tsx
   {
     isLoading && (
       <span className="sr-only" aria-live="polite">
         Creating your account, please wait.
       </span>
     );
   }
   ```

3. **Update error alert with ARIA**

   ```tsx
   {
     error && (
       <Alert variant="destructive" role="alert" aria-live="polite">
         <AlertCircle className="h-4 w-4" aria-hidden="true" />
         <AlertDescription>{error}</AlertDescription>
       </Alert>
     );
   }
   ```

4. **Add aria-hidden to decorative icons**

   ```tsx
   <Building2 className="..." aria-hidden="true" />
   <Mail className="..." aria-hidden="true" />
   <Lock className="..." aria-hidden="true" />
   <Sparkles className="..." aria-hidden="true" />
   ```

5. **Update skeleton for dark mode and proper dimensions**

   ```tsx
   function SignupFormSkeleton() {
     return (
       <div className="w-full max-w-md mx-auto">
         {/* Logo skeleton */}
         <div className="mb-8 text-center">
           <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700" />
         </div>

         {/* Badge skeleton */}
         <div className="flex justify-center mb-6">
           <div className="h-9 w-52 animate-pulse rounded-full bg-neutral-700" />
         </div>

         {/* Title + subtitle skeleton */}
         <div className="text-center mb-8">
           <div className="h-10 w-64 mx-auto animate-pulse rounded bg-neutral-700 mb-3" />
           <div className="h-5 w-80 mx-auto animate-pulse rounded bg-neutral-700" />
         </div>

         {/* Card skeleton */}
         <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-6">
           <div className="space-y-4">
             {[1, 2, 3].map((i) => (
               <div key={i} className="space-y-2">
                 <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
                 <div className="h-12 animate-pulse rounded-full bg-neutral-700" />
               </div>
             ))}
             <div className="h-12 animate-pulse rounded-full bg-sage/30 mt-6" />
           </div>
         </div>
       </div>
     );
   }
   ```

**Acceptance Criteria:**

- [ ] Form has `aria-labelledby` linking to heading
- [ ] Loading state has `sr-only` announcement
- [ ] Error alert has `role="alert" aria-live="polite"`
- [ ] All decorative icons have `aria-hidden="true"`
- [ ] Skeleton uses `bg-neutral-700` (dark mode)
- [ ] Skeleton dimensions match actual form (no CLS)
- [ ] Lighthouse accessibility score > 90

---

### Phase 4: Deferred (Data-Driven)

**Status:** ⏸️ Wait for metrics from Phases 0-3

**Items deferred per reviewer consensus:**

| Feature                 | Why Deferred                      | Trigger to Reconsider              |
| ----------------------- | --------------------------------- | ---------------------------------- |
| Two-column layout       | High effort, unproven impact      | If conversion < 5% after 2 weeks   |
| ValueSidebar component  | Premature abstraction             | If two-column is needed            |
| Mobile condensed banner | May add clutter                   | If mobile conversion underperforms |
| Trust signal row        | Redundant with "what's next" copy | If trust is identified as issue    |

---

## Edge Cases to Handle

| Edge Case               | Expected Behavior     | Implementation                    |
| ----------------------- | --------------------- | --------------------------------- |
| `?tier=handled`         | Foundation content    | `TIER_CONTENT['handled']`         |
| `?tier=fully-handled`   | System content        | `TIER_CONTENT['fully-handled']`   |
| `?tier=` (empty)        | Default content       | Normalize to `null`               |
| `?tier=invalid`         | Default content       | `isValidTier()` returns false     |
| `?tier=fully%2Dhandled` | System content        | URL decodes automatically         |
| No tier param           | Default content       | `searchParams.get()` returns null |
| Already authenticated   | Redirect to dashboard | Existing behavior preserved       |

---

## Testing Strategy

### Unit Tests (Vitest)

```tsx
// signup-tier-content.test.ts
import { getTierContent, isValidTier, TIER_CONTENT } from './signup-tier-content';

describe('getTierContent', () => {
  it('returns handled content for "handled" tier', () => {
    expect(getTierContent('handled').cta).toBe('Start my storefront');
  });

  it('returns fully-handled content for "fully-handled" tier', () => {
    expect(getTierContent('fully-handled').cta).toBe('Start growing');
  });

  it('returns default content for null tier', () => {
    expect(getTierContent(null).cta).toBe('Get Handled');
  });

  it('returns default content for invalid tier', () => {
    expect(getTierContent('invalid-tier').cta).toBe('Get Handled');
  });

  it('returns default content for empty string tier', () => {
    expect(getTierContent('')).toBe(TIER_CONTENT.default);
  });
});

describe('isValidTier', () => {
  it('returns true for valid tiers', () => {
    expect(isValidTier('handled')).toBe(true);
    expect(isValidTier('fully-handled')).toBe(true);
  });

  it('returns false for invalid tiers', () => {
    expect(isValidTier(null)).toBe(false);
    expect(isValidTier('')).toBe(false);
    expect(isValidTier('invalid')).toBe(false);
  });
});
```

### E2E Tests (Playwright)

```tsx
// signup.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Signup Page - Tier Awareness', () => {
  test('shows Foundation tier content with ?tier=handled', async ({ page }) => {
    await page.goto('/signup?tier=handled');
    await expect(page.getByRole('heading', { name: /storefront/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start my storefront/i })).toBeVisible();
  });

  test('shows System tier content with ?tier=fully-handled', async ({ page }) => {
    await page.goto('/signup?tier=fully-handled');
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start growing/i })).toBeVisible();
  });

  test('shows default content with no tier param', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /passion/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /get handled/i })).toBeVisible();
  });

  test('shows default content with invalid tier param', async ({ page }) => {
    await page.goto('/signup?tier=invalid');
    await expect(page.getByRole('button', { name: /get handled/i })).toBeVisible();
  });

  test('shows default content with empty tier param', async ({ page }) => {
    await page.goto('/signup?tier=');
    await expect(page.getByRole('button', { name: /get handled/i })).toBeVisible();
  });
});

test.describe('Signup Page - Accessibility', () => {
  test('form meets accessibility requirements', async ({ page }) => {
    await page.goto('/signup');

    // Check form has accessible name
    const form = page.locator('form[aria-labelledby="signup-heading"]');
    await expect(form).toBeVisible();

    // Check all inputs have labels
    await expect(page.getByLabel(/business name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Check password has description
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('aria-describedby', 'password-hint');
  });
});
```

---

## Quality Gates

### Pre-Implementation

- [ ] Analytics/tracking setup documented
- [ ] Baseline metrics identified (or plan to collect them)

### During Implementation

- [ ] TypeScript compiles without errors
- [ ] All edge cases handled
- [ ] Dark theme consistent throughout

### Pre-Ship

- [ ] Unit tests for tier content logic pass
- [ ] E2E tests for all tier scenarios pass
- [ ] Lighthouse accessibility score > 90
- [ ] axe-core automated scan passes
- [ ] Manual keyboard navigation works
- [ ] Screen reader testing (VoiceOver) passes
- [ ] Tested with password managers (1Password, LastPass)
- [ ] Tested on mobile Safari
- [ ] Chrome autofill doesn't break styling
- [ ] No layout shift (skeleton matches form)
- [ ] Copy reviewed against BRAND_VOICE_GUIDE.md

---

## Success Metrics

| Metric                      | Baseline      | Target       | Measurement |
| --------------------------- | ------------- | ------------ | ----------- |
| Signup form completion rate | TBD (Phase 0) | +15-25%      | Analytics   |
| Time to first interaction   | TBD           | < 10 seconds | Analytics   |
| Form abandonment rate       | TBD           | < 40%        | Analytics   |
| Accessibility score         | TBD           | > 90         | Lighthouse  |

---

## Copy Reference (Quick Lookup)

| Tier                     | Title                        | Subtitle                                                      | CTA                 | Loading                         |
| ------------------------ | ---------------------------- | ------------------------------------------------------------- | ------------------- | ------------------------------- |
| Foundation (`handled`)   | Let's build your storefront. | Done-for-you website + booking. 14 days free, no credit card. | Start my storefront | Setting up your storefront...   |
| System (`fully-handled`) | Let's get you more clients.  | AI chatbot + auto-responder. One booking pays for itself.     | Start growing       | Preparing your growth system... |
| Default (no tier)        | Bring your passion.          | The rest is handled. 14 days free, no credit card.            | Get Handled         | Setting up your storefront...   |

---

## Visual Reference (ASCII Mockup)

### New Structure (Phases 1-3)

```
┌─────────────────────────────────────────┐
│                                         │
│              HANDLED                    │  ← Logo
│                                         │
│     ┌─────────────────────────────┐     │
│     │ ✨ 14 days free — no card  │     │  ← Trial Badge (with border)
│     └─────────────────────────────┘     │
│                                         │
│     Let's build your storefront.        │  ← TITLE (outside card, primary)
│                                         │
│     Done-for-you website + booking.     │  ← Subtitle (outside card)
│     14 days free, no credit card.       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  Business Name                    │  │  ← Card (form only)
│  │  ┌───────────────────────────┐    │  │
│  │  │ Your Business Name        │    │  │
│  │  └───────────────────────────┘    │  │
│  │                                   │  │
│  │  Email                            │  │
│  │  ┌───────────────────────────┐    │  │
│  │  │ you@example.com           │    │  │
│  │  └───────────────────────────┘    │  │
│  │                                   │  │
│  │  Password                         │  │
│  │  ┌───────────────────────────┐    │  │
│  │  │ ••••••••              👁  │    │  │
│  │  └───────────────────────────┘    │  │
│  │  ✓ 8+ characters                  │  │  ← Live validation hint
│  │                                   │  │
│  │  ┌───────────────────────────┐    │  │
│  │  │  Start my storefront  →   │    │  │  ← CTA with ArrowRight
│  │  └───────────────────────────┘    │  │
│  │                                   │  │
│  │  You'll set up your storefront    │  │  ← "What's next" copy
│  │  next. Takes about 5 minutes.     │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Already have an account? Sign in       │
│                                         │
│  By signing up, you agree to our        │
│  Terms of Service and Privacy Policy    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Files to Modify

| File                               | Changes                          |
| ---------------------------------- | -------------------------------- |
| `apps/web/src/app/signup/page.tsx` | Main implementation (all phases) |
| `apps/web/src/app/globals.css`     | Chrome autofill override         |

## New Files (Optional)

| File                                           | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `apps/web/src/lib/signup-tier-content.ts`      | Extract tier content for testability |
| `apps/web/src/lib/signup-tier-content.test.ts` | Unit tests                           |

---

## References

### Internal

- `apps/web/src/app/login/page.tsx:25` - useSearchParams pattern
- `apps/web/src/app/page.tsx:130-187` - Tier definitions on homepage
- `docs/design/BRAND_VOICE_GUIDE.md` - Copy constraints

### External

- Next.js useSearchParams: Must wrap in Suspense for static rendering
- WCAG 2.1 AA: Form accessibility requirements

### Reviewer Notes

- DHH: "Ship Phase 1, measure for 2 weeks, then decide on Phase 2"
- Kieran: "Add type guard for tier validation, handle empty string"
- Simplicity: "Use plain object, not function with switch"
- Frontend Design: "Move title outside card for visual hierarchy"

---

_Plan created: December 30, 2025_
_Last updated: December 30, 2025_
_Review status: Approved by 4 reviewers with amendments incorporated_
