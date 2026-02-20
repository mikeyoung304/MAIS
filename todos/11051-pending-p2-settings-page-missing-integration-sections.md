---
issue_id: 11051
status: pending
priority: p2
tags: [frontend, ux, settings]
effort: Medium
---

# P2: Settings Page Missing Integrations Section

## Problem Statement

The tenant settings page has a "Business Settings coming soon" placeholder but no integrations section. The full integrations surface — Google Calendar, Stripe Connect, webhook subscriptions, API key management — is entirely invisible to tenants in the UI. This is the container that all integration management features build into.

## Findings

- File: `apps/web/src/app/(protected)/tenant/settings/page.tsx`
- Current state: placeholder content, no integrations tab or section.
- Integrations that need a home in settings:
  - Google Calendar (connect/disconnect, status, calendar ID config)
  - Stripe Connect (connect/disconnect, account status)
  - Webhook subscriptions (list, create, delete — see todo 11052)
  - API key management (view public key, regenerate secret key)
- This is the foundational container work that other integration todos (11052, etc.) build their UI into.

## Proposed Solutions

Add an "Integrations" tab or section to the settings page. Each integration should have its own card with:

- Connection status (connected / not connected)
- Connect / Disconnect action
- Relevant configuration fields (visible only when connected)

Tab structure suggestion:

- General (existing business settings placeholder)
- Integrations (new — calendar, stripe, webhooks, API keys)
- Notifications (future)

Follow the established design system: `rounded-3xl shadow-lg` cards, sage accent for connected state, generous whitespace (`py-32` section padding).

## Acceptance Criteria

- [ ] Settings page has an "Integrations" section or tab.
- [ ] Google Calendar integration card shows connection status and connect/disconnect action.
- [ ] Stripe Connect integration card shows connection status and connect/disconnect action.
- [ ] API key management section shows public key and a "Regenerate" action for secret key.
- [ ] Placeholder for webhook subscriptions (links to full management — see 11052).
- [ ] Page is responsive and follows brand design system.
- [ ] TypeScript typecheck passes.

## Work Log

_(empty)_
