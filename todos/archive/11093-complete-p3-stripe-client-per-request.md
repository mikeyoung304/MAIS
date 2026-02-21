---
status: pending
priority: p3
issue_id: '11093'
tags: [code-review, performance]
pr: 68
---

# F-029: New Stripe client instance created per checkout request

## Problem Statement

The onboarding checkout route creates a new `Stripe` client instance on every request instead of using a DI singleton. Five review agents independently flagged this. While Stripe's SDK is lightweight, repeated instantiation wastes memory, bypasses connection pooling, and is inconsistent with the existing `stripe-connect.service.ts` pattern which uses a shared instance.

## Location

`server/src/routes/tenant-admin-onboarding.routes.ts:98-101`

## Proposed Solution

1. Inject the Stripe client via DI (already available in `di.ts` via `stripe-connect.service.ts`).
2. Alternatively, create a thin `StripeClientProvider` that caches the instance and inject it.
3. Remove the inline `new Stripe(...)` call from the route handler.

## Effort

Small — ~30 minutes. Wire up existing DI pattern, remove inline instantiation.
