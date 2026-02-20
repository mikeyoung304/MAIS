---
issue_id: 11052
status: complete
priority: p2
tags: [frontend, webhooks, integrations]
effort: Medium
---

# P2: Webhook Subscriptions Have No Management UI

## Problem Statement

The `WebhookSubscription` table and associated server routes exist, but there is no frontend UI for tenants to manage their webhook subscriptions. The Zapier/webhook integration surface is entirely invisible to tenants — they cannot create, view, or delete webhook subscriptions without direct API access.

## Findings

- The `WebhookSubscription` Prisma model exists with fields for URL, events, secret, active state.
- Server-side routes for CRUD operations on webhook subscriptions are implemented.
- No frontend component or page exposes this functionality to tenants.
- This blocks Zapier integration, custom automation workflows, and any third-party event consumption.

## Proposed Solutions

Add a webhook subscriptions management UI within the settings Integrations section (see todo 11051). The UI should include:

1. **List view:** Table of existing webhook subscriptions showing URL, subscribed events, active state, created date.
2. **Create form:** Fields for endpoint URL, event selection (multi-select from available event types), secret (auto-generated or user-provided).
3. **Delete action:** With confirmation dialog.
4. **Toggle active:** Enable/disable a subscription without deleting it.
5. **Secret reveal:** One-time display of the webhook secret on creation, with copy-to-clipboard.

Available event types to expose in the UI (derive from contract): `booking.created`, `booking.confirmed`, `booking.cancelled`, `payment.completed`, etc.

## Acceptance Criteria

- [ ] Webhook subscriptions list is displayed in the Integrations settings section.
- [ ] Tenant can create a new webhook subscription with URL and event selection.
- [ ] Tenant can delete a webhook subscription (with confirmation).
- [ ] Tenant can toggle a subscription active/inactive.
- [ ] Webhook secret is shown once on creation with copy-to-clipboard.
- [ ] Empty state is clear and actionable ("No webhooks yet. Add one to connect external tools.").
- [ ] API calls use the existing ts-rest contract for webhook subscriptions.
- [ ] TypeScript typecheck passes.

## Work Log

- 2026-02-20: Resolved. WebhookSubscriptionsCard component: list existing webhooks, create with URL + event multi-select, toggle active/inactive via Switch, delete with AlertDialog confirmation, one-time secret reveal with copy-to-clipboard. All API calls via /api/tenant-admin/webhooks proxy. Typecheck passes.
