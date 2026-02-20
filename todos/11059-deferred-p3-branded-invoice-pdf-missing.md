---
status: pending
priority: p3
issue_id: '11059'
tags: [integrations, invoicing, pdf]
dependencies: []
---

# 11059: No Branded Invoice/PDF Generation

## Problem Statement

There is no way to generate a PDF invoice after a payment is completed. Therapists
with HSA/FSA clients require formal invoices (often called "superbills") for insurance
reimbursement. Coaches with corporate clients need invoices for expense reporting.
The platform collects payment via Stripe but produces no downloadable document.

## Findings

- Stripe generates receipts but they are Stripe-branded, not tenant-branded
- No PDF generation library exists in the codebase
- `Booking` and `Payment` models have all the data needed (amount, date, service, customer)
- No `/invoices` route or service exists

## Proposed Solution

Use a lightweight PDF generation library (e.g., `@react-pdf/renderer` or `puppeteer`
with an HTML template, or a service like `pdfshift`):

1. Add `InvoiceService` in `server/src/services/invoice.service.ts`
2. Template includes: tenant logo, tenant name/address, customer name, service description,
   date, amount, payment method, invoice number
3. Expose `GET /v1/bookings/:id/invoice` → streams PDF
4. Add invoice download button in customer booking confirmation email
5. Add invoice list in tenant dashboard (optional Phase 2)

**Invoice number generation:** `INV-{year}-{sequential}` scoped per tenant.

**Schema addition (optional):**

```prisma
model Invoice {
  id          String   @id @default(cuid())
  tenantId    String
  bookingId   String   @unique
  invoiceNum  String
  issuedAt    DateTime @default(now())
  pdfUrl      String?  // if stored in object storage
}
```

## Acceptance Criteria

- [ ] `InvoiceService` generates branded PDF with tenant and booking details
- [ ] `GET /v1/bookings/:id/invoice` streams PDF (tenant-scoped)
- [ ] Invoice download link in booking confirmation email
- [ ] Tenant branding (logo, name, address) appears on invoice
- [ ] Unit test for invoice data assembly (not PDF rendering)

## Effort

Medium

## Work Log

- 2026-02-20: Strategic finding from integration review. Required for therapist (HSA/FSA superbills) and corporate coach segments.
