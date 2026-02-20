# julik-frontend-races-reviewer Findings — Google Calendar Integration Context

**Reviewed:** 2026-02-20
**Reviewer:** julik-frontend-races-reviewer
**Scope:** Tenant settings UI, existing settings forms (Stripe/billing), Next.js App Router patterns in settings pages, API key/secret input patterns, OAuth connection flow design for Google Calendar

---

## Summary

- P1: 2 (missing Suspense boundaries around `useSearchParams` in billing/revenue pages; race condition in Stripe create+onboard chain)
- P2: 4 (clipboard API called without error handling; `isCreating` / `isOnboarding` flags do not prevent double-submit; stale `fetchStatus` inside `handleCreateAccount`; settings page shows mock API key without fetching real data)
- P3: 4 (no `loading.tsx` for billing or revenue; Payments/billing pages are re-exported as components then mounted conditionally causing remount churn; settings page lacks any integration section; Google Calendar backend uses service-account model, not OAuth — but UI will need to communicate this clearly)

Total: 10 findings (2 P1, 4 P2, 4 P3)

---

## Context: Current State of Tenant Settings

The settings page at `/tenant/settings` is minimal:

- Account info (read-only email + tenantId display)
- API key display (mock key derived from `tenantId.slice(0, 8)` — not fetched from API)
- Business settings (stub, "coming soon")
- Danger zone (Sign Out + disabled Delete Account)

There is no "Integrations" section and no mention of Google Calendar anywhere in the frontend. The backend has a complete service-account-based Google Calendar API at:

- `GET /v1/tenant-admin/calendar/status`
- `POST /v1/tenant-admin/calendar/config`
- `DELETE /v1/tenant-admin/calendar/config`
- `POST /v1/tenant-admin/calendar/test`

The billing page at `/tenant/billing` and the payments page at `/tenant/payments` represent the only existing "integration setup" patterns. The revenue page at `/tenant/revenue` wraps both as tabs. These are the best reference points for what a new Google Calendar settings section should look like.

---

## P1 Findings

### P1-01 — Missing Suspense Boundary: `useSearchParams` in Billing and Revenue Pages

**Files:**

- `apps/web/src/app/(protected)/tenant/billing/page.tsx:67`
- `apps/web/src/app/(protected)/tenant/revenue/page.tsx:39`

**Finding:**

Both `BillingPage` and `RevenuePage` call `useSearchParams()` at the top level of their component functions without wrapping in a `<Suspense>` boundary. In Next.js 14 App Router, `useSearchParams()` opts the entire route segment into client-side rendering, and when called outside a Suspense boundary it will throw a warning (dev) and can fail static rendering (production build).

Contrast: `ResetPasswordPage` (`apps/web/src/app/reset-password/page.tsx`) does this correctly — it wraps the inner component that calls `useSearchParams` in `<Suspense fallback={<ResetPasswordSkeleton />}>`. The login page follows the same pattern.

`BillingPage` and `RevenuePage` have no `loading.tsx` fallback files either (see P3-01). This means if Next.js attempts any prerendering for these routes, the missing Suspense boundary causes the build to fail with `useSearchParams() should be wrapped in a Suspense tag` or causes a waterfall on the client.

**Reproduction path:** Run `npm run --workspace=apps/web build` — the build may warn or fail for these routes. Alternatively, navigate cold to `/tenant/billing?success=true` — the page may flash or throw a hydration error.

**Fix for new Calendar settings page:** When Google Calendar adds an OAuth callback with a `?code=...` or `?state=...` query parameter, the component reading that param will need a Suspense boundary. Use the same pattern as `reset-password/page.tsx`:

```tsx
// apps/web/src/app/(protected)/tenant/settings/page.tsx (or a new integrations page)
export default function IntegrationsPage() {
  return (
    <Suspense fallback={<IntegrationsSkeleton />}>
      <IntegrationsContent /> {/* contains useSearchParams() */}
    </Suspense>
  );
}
```

---

### P1-02 — Race Condition: Stripe `handleCreateAccount` Calls `handleOnboard` Without Awaiting Fresh State

**File:** `apps/web/src/app/(protected)/tenant/payments/page.tsx:130-132`

**Finding:**

```tsx
if (response.ok || response.status === 201) {
  await fetchStatus(); // re-fetches status, updates `status` state
  await handleOnboard(); // immediately calls onboard endpoint
}
```

`handleOnboard` is called immediately after `fetchStatus()`, but `fetchStatus()` only schedules a React state update — it does not synchronously change `status`. The `handleOnboard()` function does not depend on `status` (it just calls the onboard-link endpoint), so this is benign today. However, the intent is fragile: if `handleOnboard` were ever refactored to guard on `status.accountId`, it would read stale state because the `fetchStatus` update has not yet been committed by React.

More concretely: if the POST to create the account is slow, the user can click "Continue to Stripe" multiple times before `isCreating` returns to `false`. The dialog is hidden (`setShowDialog(false)`) before `setIsCreating(true)`, so the user could reopen the dialog and click again.

**Fix pattern:** The dialog `Continue to Stripe` button should be disabled while any operation is in-flight. The current code disables `isCreating` correctly on the CTA button in the empty state, but the dialog button only disables if `!dialogEmail || !dialogBusinessName`, not if `isCreating` is true:

```tsx
// Current (line 321) — bug:
disabled={!dialogEmail || !dialogBusinessName}

// Should be:
disabled={!dialogEmail || !dialogBusinessName || isCreating}
```

**Impact for Google Calendar:** The same pattern — "save config, then test connection" — should not chain `saveConfig → testConnection` as direct sequential awaits on state-updating functions. Use a returned value from the fetch call directly, not React state.

---

## P2 Findings

### P2-01 — Clipboard API Called Without Error Handling

**File:** `apps/web/src/app/(protected)/tenant/settings/page.tsx:28`

**Finding:**

```tsx
const handleCopyKey = (key: string, keyType: string) => {
  navigator.clipboard.writeText(key); // Promise ignored, no try/catch
  setCopiedKey(keyType);
  setTimeout(() => setCopiedKey(null), 2000);
};
```

`navigator.clipboard.writeText()` returns a `Promise<void>`. It rejects if:

1. The page is not served over HTTPS (e.g., `http://localhost` without special flags)
2. The user denies the clipboard permission
3. The document is not focused

The current code ignores the promise entirely. If the write fails silently, the UI shows a checkmark ("copied!") but nothing was actually copied to the clipboard. This is a false-positive success state.

**Fix:**

```tsx
const handleCopyKey = async (key: string, keyType: string) => {
  try {
    await navigator.clipboard.writeText(key);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2000);
  } catch {
    // Fallback: show an error or use execCommand
    setError('Could not copy to clipboard');
  }
};
```

**Impact for Google Calendar:** The calendar config page will likely want a "copy calendar ID" button similar to the API key display. Apply this pattern there.

---

### P2-02 — Settings Page Shows Fabricated Mock API Key, Not Real Data

**File:** `apps/web/src/app/(protected)/tenant/settings/page.tsx:25`

**Finding:**

```tsx
// Mock API keys for display (in production these would come from the API)
const apiKeyPublic = tenantId ? `pk_live_${tenantId.slice(0, 8)}...` : 'Not available';
```

This is not a truncated display of a real API key — it is a fabricated placeholder that looks like a real key. This pattern:

1. Misleads tenants who may copy and try to use this key — it will not work
2. The `CLAUDE.md` notes that valid API key format is `pk_live_{slug}_{random}` but this generates `pk_live_{tenantId_prefix}` which does not match
3. No actual fetch from `/api/tenant-admin/...` happens on the settings page

Either the settings page should fetch the real key from the API and display a masked version (like the calendar config endpoint does with `maskCalendarId`), or it should show a placeholder with a clear "Not yet generated" state.

**Impact for Google Calendar:** When showing the masked calendar ID on the settings/integrations page, do not fabricate it client-side. Always fetch from `/api/tenant-admin/calendar/status` and display the server-masked value.

---

### P2-03 — Double-Submit Not Prevented on Stripe Dialog Continue Button

**File:** `apps/web/src/app/(protected)/tenant/payments/page.tsx:321`

**Finding:** (Related to P1-02 but a distinct UX issue.)

The "Continue to Stripe" button inside the dialog disables only when fields are empty. If the user clicks the button while a previous in-flight request is processing (e.g., network is slow), `handleCreateAccount` will be called twice. The first call sets `setIsCreating(true)` but only after hiding the dialog (`setShowDialog(false)`) and after the validation passes.

The window of opportunity is small (dialog hides before `setIsCreating(true)`) but not zero on slow networks where React batches updates across async boundaries.

**Fix:** Add `isCreating` to the disabled guard on the dialog button, and consider using an `AbortController` to cancel the in-flight request if the component unmounts.

---

### P2-04 — `fetchStatus` Inside `useCallback` Creates Stale Closure in `handleCreateAccount`

**File:** `apps/web/src/app/(protected)/tenant/payments/page.tsx:69-90`, 130-131

**Finding:**

`fetchStatus` is defined with `useCallback([isAuthenticated])`. `handleCreateAccount` is a regular (non-memoized) function that calls `fetchStatus`. This is fine because `handleCreateAccount` is redefined on each render and will close over the current `fetchStatus`.

However, if the component is extended to memoize `handleCreateAccount` (e.g., via `useCallback` to pass to a child button), the dependency array must include `fetchStatus`. This is a latent bug that would be introduced by a straightforward refactor.

More concrete today: after `await fetchStatus()`, React state is updated asynchronously. The call to `await handleOnboard()` on line 131 executes within the same closure — if `handleOnboard` were to read `status` (the React state), it would see the pre-fetch value. This is currently safe because `handleOnboard` does not read `status`, but it is a fragile dependency.

---

## P3 Findings

### P3-01 — No `loading.tsx` for Billing or Revenue Routes

**Directories:**

- `apps/web/src/app/(protected)/tenant/billing/` (only `error.tsx` + `page.tsx`)
- `apps/web/src/app/(protected)/tenant/revenue/` (only `error.tsx` + `page.tsx`)

**Finding:**

Both billing and revenue have `error.tsx` but no `loading.tsx`. In Next.js App Router, `loading.tsx` provides the automatic Suspense fallback for the route segment while the page data loads. Without it, there is no skeleton shown during initial load or navigation — the user sees a blank area.

Compare: `/tenant/scheduling/` and sub-routes all have `loading.tsx` skeletons. The billing pages skip this.

**Impact for Google Calendar:** The new integrations section (whether on `/tenant/settings` or a dedicated page) should have a `loading.tsx` to show a skeleton while the calendar status is fetched. The fetch is async and has non-trivial latency (fetches from backend, which decrypts config from DB).

---

### P3-02 — Revenue Page Mounts Full Page Components as Tab Children (Remount Churn)

**File:** `apps/web/src/app/(protected)/tenant/revenue/page.tsx:80-82`

**Finding:**

```tsx
{
  activeTab === 'payments' && <PaymentsContent />;
}
{
  activeTab === 'billing' && <BillingContent />;
}
```

`PaymentsContent` and `BillingContent` are the default exports of the `payments/page.tsx` and `billing/page.tsx` files, imported directly and re-rendered as children of `RevenuePage`. This causes a full remount (and re-fetch) every time the user switches tabs because React unmounts the component when `activeTab !== 'payments'`.

`BillingPage` calls `useSubscription()` which fetches `GET /api/tenant-admin/billing/status` on mount. Switching from Payments to Billing and back will re-fetch three times total. Neither tab uses `display: none` / CSS visibility — they are fully unmounted.

**Fix for a new integrations tab:** Use `display` toggling (keep both tabs mounted) or a stable shared QueryClient cache key with TanStack Query so re-mounting reads from cache without network refetch.

---

### P3-03 — Settings Page Has No Integrations Section and No Calendar Entry Point

**File:** `apps/web/src/app/(protected)/tenant/settings/page.tsx`

**Finding:**

The settings page currently has: Account Information, API Keys, Business Settings (stub), and Danger Zone. There is no "Integrations" section. The Google Calendar API backend exists (`/v1/tenant-admin/calendar/`) but there is no frontend route or component that surfaces it.

For the Google Calendar integration to be discoverable:

1. The settings page needs a new "Integrations" card section
2. Or a dedicated `/tenant/settings/integrations` sub-route
3. Or the scheduling section gets a "Calendar Sync" sub-nav entry alongside Availability/Blackouts

The scheduling sub-nav in `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx` is the most contextually appropriate home. Calendar sync belongs next to availability rules.

**Recommended structure:**

```
/tenant/scheduling/calendar   ← new sub-route
```

With a sub-nav entry:

```tsx
{
  href: '/tenant/scheduling/calendar',
  label: 'Calendar Sync',
  icon: <CalendarCheck className="h-4 w-4" />,
}
```

---

### P3-04 — Backend Uses Service Account Model, Not OAuth — UI Must Communicate This Clearly

**File:** `server/src/routes/tenant-admin-calendar.routes.ts`

**Finding:**

The backend calendar integration is service-account-based (the tenant provides a Google service account JSON key and a calendar ID), not OAuth-based (there is no OAuth redirect flow). This means:

1. There is no "Connect with Google" OAuth popup flow to implement
2. The UX is a form with two fields: a Calendar ID text input and a service account JSON file upload
3. There is a "Test Connection" endpoint (`POST /v1/tenant-admin/calendar/test`) which should be surfaced as a "Test" button after save

The billing/payments flow (Stripe Connect button → dialog → redirect to Stripe → return) is the wrong mental model for this integration. The correct model is:

**Save secrets form pattern** (like an API key save):

1. Tenant opens settings/calendar page
2. Sees current status: "Not configured" or "Connected: `calendarid@g...e.com`"
3. Fills Calendar ID + uploads/pastes service account JSON
4. Clicks "Save" → POST to `/v1/tenant-admin/calendar/config`
5. On success, status updates to show masked calendar ID
6. Tenant clicks "Test Connection" → POST to `/v1/tenant-admin/calendar/test`
7. Shows success with calendar name, or error message

**Important UX guidance for the form:**

- The service account JSON input should use `<textarea>` or file upload, not `<Input>`. It is ~2KB of JSON.
- The JSON should never be echoed back to the UI after save (the backend only returns the masked calendar ID).
- Use `type="password"` semantics (or a show/hide toggle) for the JSON textarea — it contains a private key.
- Validate that the pasted text is valid JSON client-side before submitting (prevents unnecessary round-trips).
- The 50KB server-side size guard is defensive but should also be enforced client-side (`serviceAccountJson.length > 50 * 1024`).

**No OAuth popup flow is needed.** Do not build a popup/`window.open` flow. The `validateStripeUrl` pattern in payments is irrelevant here. The Google Calendar integration is entirely credential-based.

---

## Summary Table

| ID    | Severity | File                                                 | Issue                                                                                                    |
| ----- | -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P1-01 | P1       | `tenant/billing/page.tsx`, `tenant/revenue/page.tsx` | `useSearchParams` without Suspense boundary                                                              |
| P1-02 | P1       | `tenant/payments/page.tsx:130-132`                   | Race: `fetchStatus` → `handleOnboard` chains on stale state; dialog button not disabled during in-flight |
| P2-01 | P2       | `tenant/settings/page.tsx:28`                        | `navigator.clipboard.writeText` promise ignored (false-positive success)                                 |
| P2-02 | P2       | `tenant/settings/page.tsx:25`                        | Fabricated mock API key displayed instead of real fetched data                                           |
| P2-03 | P2       | `tenant/payments/page.tsx:321`                       | Dialog `Continue` button missing `isCreating` in disabled guard                                          |
| P2-04 | P2       | `tenant/payments/page.tsx:130-131`                   | Stale closure risk: `fetchStatus` update not committed before `handleOnboard` call                       |
| P3-01 | P3       | `tenant/billing/`, `tenant/revenue/`                 | No `loading.tsx` for these route segments                                                                |
| P3-02 | P3       | `tenant/revenue/page.tsx:80-82`                      | Full remount of page components on tab switch causes re-fetches                                          |
| P3-03 | P3       | `tenant/settings/page.tsx`                           | No integrations section; no calendar entry point                                                         |
| P3-04 | P3       | n/a (architecture)                                   | Backend is service-account model not OAuth — UI form design must differ from Stripe flow                 |

---

## Recommended: Google Calendar Settings Page Architecture

Based on the review, here is the recommended frontend structure for the calendar integration:

**Route:** `apps/web/src/app/(protected)/tenant/scheduling/calendar/page.tsx`

**Component pattern** (based on what works well in AvailabilityRuleForm and payments page):

```tsx
'use client';

// 1. On mount: fetch /api/tenant-admin/calendar/status
// 2. Render status card:
//    - Not configured: show form with Calendar ID + JSON textarea
//    - Configured: show masked calendar ID, "Test Connection" button, "Remove" button
// 3. Save flow:
//    - Validate JSON parse client-side before submit
//    - POST /api/tenant-admin/calendar/config
//    - On success: refetch status, show success message
// 4. Test flow:
//    - POST /api/tenant-admin/calendar/test
//    - Show success with calendarName or error message
// 5. Remove flow:
//    - Confirm dialog → DELETE /api/tenant-admin/calendar/config
//    - On success: refetch status
```

**No OAuth popup. No `window.location.href` redirect. No postMessage. Pure form + fetch.**

Add to scheduling sub-nav in `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx`:

```tsx
{
  href: '/tenant/scheduling/calendar',
  label: 'Calendar Sync',
  icon: <CalendarCheck className="h-4 w-4" />,
}
```

Fix P1-01 while building: the new page must wrap any `useSearchParams` usage in Suspense if a callback query param is added later (even if not needed today, add the pattern proactively).
