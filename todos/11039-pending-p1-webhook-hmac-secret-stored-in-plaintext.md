---
status: pending
priority: p1
issue_id: '11039'
tags: [code-review, security, webhooks, encryption, data-integrity]
---

# Webhook HMAC Secrets Stored in Plaintext in PostgreSQL

## Problem Statement

`WebhookSubscription.secret` is stored as a plaintext `String` in PostgreSQL. All other tenant secrets (Stripe, Google Calendar) use AES-256-GCM encryption via `EncryptionService`. Webhook secrets are functionally equivalent to API keys — if the database is compromised, attackers can forge webhook requests.

## Findings

- **Flagged by:** security-sentinel
- `prisma/schema.prisma`: `WebhookSubscription.secret String` — plaintext
- `Tenant.secrets` with AES-256-GCM is the correct pattern
- Migration required: encrypt existing rows before changing access pattern

## Proposed Solutions

### Option A: Encrypt at Application Layer (Medium)

Encrypt when writing, decrypt when reading. Migration: script to encrypt existing rows.

- **Effort:** Medium
- **Risk:** Medium (migration required)

## Acceptance Criteria

- [ ] New webhook secrets encrypted with `EncryptionService` before storage
- [ ] Existing secrets migrated (encrypted in place)
- [ ] HMAC verification still works after decrypt

## Work Log

- 2026-02-20: Flagged by security-sentinel. Parity gap with other credential types.
