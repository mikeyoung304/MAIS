---
issue_id: 11046
status: pending
priority: p2
tags: [frontend, stripe, race-condition, ux]
effort: Small
---

# P2: Stripe Create+Onboard Race Condition on Double-Click

## Problem Statement

In the Stripe Connect setup flow, the submit button is not disabled during in-flight requests for the create+onboard chain. A user who double-clicks (or clicks again after a slow response) sends duplicate API requests, potentially creating multiple Stripe Connect accounts or triggering onboarding multiple times. This is a standard frontend race condition.

## Findings

- The button that triggers the Stripe Connect create+onboard flow lacks a loading/disabled state.
- The flow is sequential: create account → get onboard URL → redirect. Each step makes an API call.
- A second click while the first request is in flight will start a parallel execution of the same chain.
- Stripe may or may not deduplicate account creation, but the onboarding redirect race can cause UX confusion.

## Proposed Solutions

Track a loading state (`isLoading`) in the component. Set it to `true` on submit and `false` in the finally block (both success and error paths). Pass `disabled={isLoading}` and appropriate visual feedback to the button.

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleConnect = async () => {
  setIsLoading(true);
  try {
    // create + onboard chain
  } finally {
    setIsLoading(false);
  }
};

<Button onClick={handleConnect} disabled={isLoading}>
  {isLoading ? 'Connecting...' : 'Connect Stripe'}
</Button>;
```

## Acceptance Criteria

- [ ] Button is disabled immediately on first click and remains disabled until the request resolves.
- [ ] Button shows a loading indicator or text change while in-flight.
- [ ] On error, button re-enables so the user can retry.
- [ ] On success (redirect), button stays disabled (page is navigating away).
- [ ] No duplicate API calls are possible via rapid clicking.

## Work Log

_(empty)_
