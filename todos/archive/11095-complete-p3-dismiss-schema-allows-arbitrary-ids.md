---
status: pending
priority: p3
issue_id: '11095'
tags: [code-review, data-integrity]
pr: 68
---

# F-031: DismissChecklistItemSchema allows arbitrary item IDs

## Problem Statement

The `DismissChecklistItemSchema` accepts any string as an `itemId` instead of validating against an enum of known checklist item IDs. This means the frontend (or an attacker) could dismiss non-existent items, and the backend would silently accept them. This also makes it impossible to catch typos or stale item references at the contract level.

## Location

`packages/contracts/src/schemas/onboarding.schema.ts:543-545`

## Proposed Solution

1. Define a `ChecklistItemId` enum or `z.enum([...])` with all valid checklist item IDs (e.g., `'customize_storefront'`, `'upload_photos'`, `'connect_stripe'`, etc.).
2. Use this enum in `DismissChecklistItemSchema` instead of `z.string()`.
3. Export the enum for use in both frontend and backend.

## Effort

Small — ~30 minutes. Define enum, update schema, verify existing tests.
