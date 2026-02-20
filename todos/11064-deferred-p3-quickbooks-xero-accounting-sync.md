---
status: pending
priority: p3
issue_id: '11064'
tags: [integrations, accounting, quickbooks]
dependencies: []
---

# 11064: No QuickBooks/Xero Integration for Payment Reconciliation

## Problem Statement

There is no integration with accounting software (QuickBooks Online or Xero) for
payment reconciliation. Photographers and coaches need to reconcile Stripe payments
with their accounting software. Currently, they must manually export from Stripe and
import into QuickBooks/Xero — a tedious and error-prone process that makes the
platform feel incomplete for serious business owners.

## Findings

- No accounting adapter or port exists
- Stripe webhook events (`payment_intent.succeeded`) capture all payment data
- `Booking` and `Payment` models have all required fields (amount, date, customer, service)
- QuickBooks Online and Xero both have REST APIs with OAuth2

## Proposed Solution

Define an `IAccountingProvider` port and implement adapters:

```typescript
interface IAccountingProvider {
  createInvoice(params: InvoiceParams): Promise<AccountingInvoice>;
  recordPayment(params: PaymentParams): Promise<void>;
  syncCustomer(customer: Customer): Promise<string>; // returns accounting customer ID
}
```

**Phase 1 — QuickBooks Online (larger market share):**

1. `QuickBooksAdapter` implementing `IAccountingProvider`
2. OAuth2 flow for tenant to connect QBO account
3. On `payment_intent.succeeded`: create QBO invoice + mark paid
4. Sync customer to QBO Customers on first booking
5. Store `qboCustomerId` on `Customer` model

**Phase 2 — Xero:**

- Same port, different adapter
- UK/Australia/NZ market

**Schema additions:**

```prisma
model Customer {
  qboCustomerId  String?  // QuickBooks Online customer ID
  xeroContactId  String?  // Xero contact ID
}
```

## Acceptance Criteria

- [ ] `IAccountingProvider` port defined
- [ ] `QuickBooksAdapter` implemented with OAuth2 connection flow
- [ ] Invoice created in QBO on payment success (via webhook)
- [ ] Customer synced to QBO on first booking
- [ ] `MockAccountingAdapter` for test/dev mode
- [ ] OAuth tokens stored encrypted per tenant
- [ ] Env vars documented in render.yaml

## Effort

Large

## Work Log

- 2026-02-20: Strategic finding from integration review. High value for photographers and coaches running real businesses.
