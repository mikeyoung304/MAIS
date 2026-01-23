---
status: complete
priority: p2
issue_id: '522'
tags:
  - code-review
  - security
  - pwa
  - mobile
dependencies: []
---

# PII in Plaintext IndexedDB

## Problem Statement

Customer email and phone are stored unencrypted in IndexedDB when offline bookings are queued. This exposes personally identifiable information (PII) if the device is compromised.

**Why it matters:** IndexedDB data is accessible to any JavaScript running on the domain. If an XSS vulnerability exists, attacker code could exfiltrate customer contact information from pending bookings.

## Findings

**Source:** Mobile Experience Code Review

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/offline-storage.ts`

**Lines:** 29-41

**Evidence:** The `PendingBooking` interface stores sensitive fields in plaintext:

```typescript
interface PendingBooking {
  id: string;
  tenantId: string;
  customerEmail: string; // PII - stored unencrypted
  customerPhone?: string; // PII - stored unencrypted
  // ... other fields
}
```

## Proposed Solutions

### Solution 1: Web Crypto API Encryption (Recommended)

**Description:** Encrypt sensitive fields using the Web Crypto API before storing in IndexedDB

```typescript
const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
  'encrypt',
  'decrypt',
]);

// Store key in session storage (cleared on tab close)
const encryptedEmail = await encryptField(customerEmail, key);

const pendingBooking: PendingBooking = {
  ...booking,
  customerEmail: encryptedEmail, // Now encrypted
};
```

**Pros:**

- Strong encryption using browser-native APIs
- Key not persisted long-term
- No external dependencies

**Cons:**

- Added complexity for encrypt/decrypt cycle
- Key management needs careful handling
- Sync operation needs decrypt before sending

**Effort:** Medium (3-4 hours)
**Risk:** Low

### Solution 2: Field-Level Hashing with Server Decrypt

**Description:** Hash fields locally, store encrypted blob that only server can decrypt

**Pros:**

- Client never has plaintext after initial entry
- Server maintains decryption capability

**Cons:**

- Requires server-side changes
- Cannot display pending booking details offline

**Effort:** Medium (4-5 hours)
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `apps/web/src/lib/offline-storage.ts`

**Components:** PWA offline sync, booking queue

## Acceptance Criteria

- [x] Customer email encrypted before IndexedDB storage
- [x] Customer phone encrypted before IndexedDB storage
- [x] Decryption works correctly for sync operation
- [x] UI can still display masked versions (e.g., `j***@email.com`)
- [x] Key lifecycle properly managed

## Work Log

| Date       | Action                                | Learnings                                                                                                |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-01-01 | Created from mobile UX code review    | PII exposure in client                                                                                   |
| 2026-01-01 | Implemented Web Crypto API encryption | Session-derived keys via PBKDF2 provide tenant isolation; legacy plaintext backward compatibility needed |

## Resources

- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
