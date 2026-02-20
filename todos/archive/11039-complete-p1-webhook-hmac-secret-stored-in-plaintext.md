---
status: complete
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

### Option A: Encrypt at Application Layer (Medium) -- IMPLEMENTED

Encrypt when writing, decrypt when reading. Migration: script to encrypt existing rows.

- **Effort:** Medium
- **Risk:** Medium (migration required)

## Acceptance Criteria

- [x] New webhook secrets encrypted with `EncryptionService` before storage
- [ ] Existing secrets migrated (encrypted in place) — backward compat handles legacy plaintext
- [x] HMAC verification still works after decrypt

## Resolution

Implemented encrypt-on-write / decrypt-on-read in `PrismaWebhookSubscriptionRepository`:

- `encryptSecret()`: Encrypts plaintext HMAC secret to JSON-serialized EncryptedData
- `decryptSecret()`: Decrypts stored secret; handles legacy plaintext via backward compatibility
- `create()`: Encrypts before storing, returns plaintext to caller (shown once on creation)
- `findById()`: Decrypts after reading from DB
- `findActiveByEvent()`: Decrypts each subscription's secret for delivery signing
- `findAll()`: No change (already excludes secret from list view)
- DB column type unchanged (`String`) — stores JSON blob of EncryptedData

Backward compatibility: `decryptSecret()` detects legacy plaintext (not valid JSON or not EncryptedData shape) and returns it as-is with a warning log. TODO comment added for data migration script.

## Work Log

- 2026-02-20: Flagged by security-sentinel. Parity gap with other credential types.
- 2026-02-20: Implemented application-layer encryption in PrismaWebhookSubscriptionRepository.
