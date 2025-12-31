---
status: complete
priority: p1
issue_id: '098'
tags: [code-review, security, ux, ui-redesign]
dependencies: []
---

# Browser prompt() Used for User Input - XSS Risk and Poor UX

## Problem Statement

The StripeConnectCard component uses browser `prompt()` to collect email and business name. This is:

1. A security risk (no client-side validation before API submission)
2. Poor UX (blocking, unstyled, not accessible)
3. Cannot be styled to match the application design

**Why it matters:** Stored XSS risk if backend validation is bypassed. Critical accessibility violation.

## Findings

### From security-sentinel and code-quality agents:

**File:** `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`
**Lines:** 74-82

```typescript
const emailInput = prompt('Enter your business email:');
const nameInput = prompt('Enter your business name:');

if (!emailInput || !nameInput) {
  setCreating(false);
  return;
}

email = emailInput;
businessName = nameInput;
```

**Issues:**

- Browser `prompt()` is blocking and not accessible
- No email format validation
- No input sanitization
- Cannot be styled
- Poor screen reader support

## Proposed Solutions

### Solution 1: Radix Dialog with Form (Recommended)

**Pros:** Accessible, styled, validates input
**Cons:** More code to write
**Effort:** Medium (2-3 hours)
**Risk:** Low

Create a proper modal dialog using Radix UI Dialog with form validation:

```typescript
// StripeOnboardingDialog.tsx
export function StripeOnboardingDialog({ open, onOpenChange, onSubmit }) {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [errors, setErrors] = useState({});

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateName = (name: string) => /^[a-zA-Z0-9\s\-&.,()]+$/.test(name) && name.length <= 100;

  const handleSubmit = () => {
    const newErrors = {};
    if (!validateEmail(email)) newErrors.email = "Valid email required";
    if (!validateName(businessName)) newErrors.businessName = "Invalid characters";

    if (Object.keys(newErrors).length === 0) {
      onSubmit({ email, businessName });
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Up Stripe Connect</DialogTitle>
        </DialogHeader>
        {/* Form fields */}
      </DialogContent>
    </Dialog>
  );
}
```

### Solution 2: Inline Form in Card

**Pros:** No modal needed
**Cons:** Changes UI layout
**Effort:** Medium
**Risk:** Low

## Recommended Action

Implement Solution 1 - Create proper dialog component with validation.

## Technical Details

**Affected files:**

- `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`
- New: `client/src/features/tenant-admin/TenantDashboard/StripeOnboardingDialog.tsx`

## Acceptance Criteria

- [ ] Browser prompt() replaced with Radix Dialog
- [ ] Email format validated client-side
- [ ] Business name validated (alphanumeric + common chars only)
- [ ] Form is keyboard accessible
- [ ] Screen reader announces dialog properly
- [ ] Error messages shown inline

## Work Log

| Date       | Action                   | Learnings                      |
| ---------- | ------------------------ | ------------------------------ |
| 2025-11-30 | Created from code review | Security + accessibility issue |

## Resources

- Radix UI Dialog: https://www.radix-ui.com/primitives/docs/components/dialog
