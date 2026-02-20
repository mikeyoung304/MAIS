---
status: pending
priority: p3
issue_id: '11058'
tags: [integrations, contracts, esignature]
dependencies: []
---

# 11058: No Contract/eSignature Integration

## Problem Statement

Photographers and therapists require signed contracts before sessions. There is no
contract or eSignature integration in the platform. The `Project` model exists but
has no contract attachment capability. Competitors HoneyBook and Dubsado lead with
this feature — it is a table-stakes requirement for professional service businesses.

## Findings

- `Project` model has no `contractId`, `contractUrl`, or `signedAt` fields
- No contract template storage exists
- No integration with DocuSign, HelloSign (now Dropbox Sign), or PandaDoc
- Booking flow has no "sign contract" step before confirmation

## Proposed Solution

Phase 1 — Simple contract attachment (no eSignature):

- Add `contractUrl` to `Project` model (tenant uploads PDF)
- Display contract link in booking confirmation email

Phase 2 — eSignature integration (recommended: HelloSign / Dropbox Sign):

1. Define `ISignatureProvider` port
2. Implement `HelloSignAdapter` or `PandaDocAdapter`
3. Add `MockSignatureAdapter` for dev/test
4. Integrate into booking flow: after payment, send contract for signature
5. Block project start until contract is signed (optional per-tenant config)

**Schema change needed:**

```prisma
model Project {
  // ... existing fields
  contractTemplateId  String?
  contractSentAt      DateTime?
  contractSignedAt    DateTime?
  contractUrl         String?
}
```

## Acceptance Criteria

- [ ] `ISignatureProvider` port defined
- [ ] At least one concrete adapter implemented (HelloSign or PandaDoc)
- [ ] `MockSignatureAdapter` for test mode
- [ ] Contract send triggered after booking/payment
- [ ] Tenant can upload/select contract template
- [ ] Contract status visible in project hub
- [ ] Migration for new Project fields

## Effort

Large

## Work Log

- 2026-02-20: Strategic finding from integration review. Table-stakes for photographers and therapists.
