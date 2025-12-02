---
status: complete
priority: p1
issue_id: "027"
tags: [code-review, ux, feature-incomplete, stripe]
dependencies: []
---

# Stripe Connect Onboarding Uses prompt() Dialogs

## Problem Statement

The Stripe Connect onboarding component uses browser `prompt()` dialogs for collecting email and business name instead of proper form inputs. This creates a poor user experience and bypasses React's form handling.

**Why this matters:** Users see jarring popup dialogs, cannot preview input, and the flow feels unprofessional. This is a critical business feature for tenant payment setup.

## Findings

### Code Evidence

**Location:** `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx:72-73`

```typescript
let email = "admin@example.com";
let businessName = "My Business";

// Uses browser prompt() instead of proper form
const promptEmail = prompt("Enter your email for Stripe:", email);
const promptBusiness = prompt("Enter your business name:", businessName);
```

### Problems

1. **Browser prompts are blocking** - User cannot interact with page
2. **No validation** - Empty input accepted
3. **No error recovery** - If API fails, must restart entire flow
4. **Hardcoded defaults** - Should pull from tenant data
5. **Missing guidance** - No explanation of what Stripe Connect is
6. **No step-by-step progress** - User doesn't know what happens next

### Impact

- Users may abandon onboarding flow
- Support requests about payment setup
- Professional appearance diminished
- Conversion rate likely affected

## Proposed Solutions

### Option A: Replace with Proper Form Modal (Recommended)
**Effort:** Medium | **Risk:** Low

Create a proper modal with form fields:

```typescript
const StripeConnectModal = ({ isOpen, onClose }) => {
  const { data: tenant } = useTenantProfile();
  const [email, setEmail] = useState(tenant?.email || '');
  const [businessName, setBusinessName] = useState(tenant?.name || '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Up Stripe Payments</DialogTitle>
          <DialogDescription>
            Connect your Stripe account to receive payments from customers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField label="Business Email" required>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
            />
          </FormField>

          <FormField label="Business Name" required>
            <Input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Continue to Stripe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

**Pros:**
- Professional appearance
- Proper validation
- Pre-populated with tenant data
- Error handling built-in
- Consistent with rest of app

**Cons:**
- More code than prompt()

## Recommended Action

Implement **Option A** - Create proper modal with form validation.

## Technical Details

**Files to Update:**
- `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`

**New Components:**
- `StripeConnectModal.tsx` (or inline in StripeConnectCard)

**Data Flow:**
1. User clicks "Complete Setup"
2. Modal opens with email/name pre-filled from tenant profile
3. User confirms/edits and submits
4. API call to create Stripe account
5. Success: Show next steps / Redirect to Stripe onboarding
6. Error: Show error message with retry option

## Acceptance Criteria

- [ ] No browser prompt() dialogs used
- [ ] Modal form with proper validation
- [ ] Email pre-populated from tenant profile
- [ ] Business name pre-populated from tenant name
- [ ] Loading state during API call
- [ ] Error handling with retry option
- [ ] Success state shows next steps
- [ ] E2E test for Stripe Connect setup flow

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- Feature Completeness analysis
- Existing Dialog/Form components in UI library
- Stripe Connect best practices
