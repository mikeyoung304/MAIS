# ADR-011: PaymentProvider Interface for Stripe Abstraction

**Date:** 2025-10-29
**Status:** Accepted (Implemented in Phase 2A)
**Decision Makers:** Engineering Team
**Category:** Architecture
**Related Issues:** Phase 2A - Restore Core Functionality

## Context

During MVP development, we initially hardcoded Stripe API calls directly in the booking service. This created tight coupling between business logic and payment vendor, making it difficult to:
- Test booking logic without real Stripe credentials
- Switch payment providers (e.g., migrate to PayPal, Square)
- Mock payment flows in development mode

We needed a way to:
1. Keep booking service vendor-agnostic
2. Enable mock payment flows for development
3. Make payment integration testable
4. Support future payment provider migrations

## Decision

We have implemented a **PaymentProvider interface** following the ports-and-adapters (hexagonal) architecture pattern.

**Interface Definition:**
```typescript
// server/src/lib/ports.ts
export interface PaymentProvider {
  createCheckoutSession(params: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
  }): Promise<{ url: string; sessionId: string }>;

  verifyWebhook(rawBody: string, signature: string): Promise<StripeWebhookEvent>;

  refundPayment?(sessionId: string, amountCents: number): Promise<void>;
}
```

**Real Implementation:**
```typescript
// server/src/adapters/stripe.adapter.ts
export class StripePaymentAdapter implements PaymentProvider {
  constructor(
    private readonly stripe: Stripe,
    private readonly config: {
      successUrl: string;
      cancelUrl: string;
      webhookSecret: string;
    }
  ) {}

  async createCheckoutSession(params) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: this.config.successUrl,
      cancel_url: this.config.cancelUrl,
      line_items: [{ ... }],
      metadata: params.metadata,
    });

    return { url: session.url!, sessionId: session.id };
  }

  async verifyWebhook(rawBody: string, signature: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.webhookSecret
    );
  }
}
```

**Mock Implementation:**
```typescript
// server/src/adapters/mock/payment.mock.ts
export class MockPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params) {
    return {
      url: `http://localhost:5173/dev/checkout?amount=${params.amountCents}`,
      sessionId: `mock_session_${Date.now()}`,
    };
  }

  async verifyWebhook(rawBody: string, signature: string) {
    // Mock always verifies successfully
    return JSON.parse(rawBody);
  }
}
```

**Dependency Injection:**
```typescript
// server/src/di.ts
const paymentProvider = config.mode === 'real'
  ? new StripePaymentAdapter(stripeClient, config)
  : new MockPaymentProvider();

const bookingService = new BookingService(
  bookingRepo,
  catalogRepo,
  eventEmitter,
  paymentProvider  // ← Injected here
);
```

## Consequences

**Positive:**
- **Testability:** Booking service can be tested without real Stripe credentials
- **Development speed:** Mock mode allows full booking flow without external API calls
- **Flexibility:** Can swap Stripe for another provider by implementing interface
- **Clean architecture:** Business logic isolated from infrastructure concerns
- **Type safety:** TypeScript ensures all implementations match interface

**Negative:**
- **Abstraction overhead:** One extra layer of indirection
- **Interface changes:** If Stripe adds features, must update interface + all implementations
- **Mock divergence:** Mock implementation may drift from real Stripe behavior

**Maintenance:**
- Must keep mock implementation in sync with real Stripe behavior
- Must update interface if payment requirements change

## Alternatives Considered

### Alternative 1: Direct Stripe SDK Usage

**Approach:** Import and use Stripe SDK directly in booking service.

**Why Rejected:**
- Tight coupling to Stripe (vendor lock-in)
- Difficult to test (requires mocking Stripe SDK)
- No mock mode (requires real API keys for development)
- Hard to migrate to another payment provider

### Alternative 2: Strategy Pattern (Multiple Concrete Classes)

**Approach:** Use strategy pattern with `StripePaymentStrategy`, `PayPalPaymentStrategy`, etc.

**Why Rejected:**
- Overengineered for current needs (only using Stripe)
- Strategy pattern better for runtime switching, not DI-time switching
- Interface + DI achieves same goal with less complexity

### Alternative 3: Feature Flags for Payment Provider

**Approach:** Use feature flags to switch between payment providers at runtime.

**Why Rejected:**
- Unnecessary complexity (no plans for multiple providers)
- Runtime switching adds risk (could switch mid-transaction)
- DI-time switching (via `config.mode`) is simpler and safer

## Implementation Details

**Files Created:**
- `server/src/lib/ports.ts` - PaymentProvider interface
- `server/src/adapters/stripe.adapter.ts` - Real implementation
- `server/src/adapters/mock/payment.mock.ts` - Mock implementation

**Files Modified:**
- `server/src/services/booking.service.ts` - Added paymentProvider parameter
- `server/src/di.ts` - Wired paymentProvider into BookingService

**Testing:**
- Added tests for StripePaymentAdapter (signature verification)
- Added tests for MockPaymentProvider (always succeeds)
- Added tests for BookingService (mock payment flow)

**Documentation:**
- ARCHITECTURE.md updated with PaymentProvider explanation
- DEVELOPING.md updated with mock mode setup

## Future Enhancements

**Potential Improvements:**
- Add `refundPayment()` method to interface (currently optional)
- Add `getPaymentStatus()` method for payment reconciliation
- Add `listPayments()` method for admin dashboard
- Support partial refunds (currently all-or-nothing)

**Migration Path (If Switching Providers):**
1. Implement new provider class (e.g., `PayPalPaymentAdapter`)
2. Ensure it implements `PaymentProvider` interface
3. Update DI config to use new provider
4. Test thoroughly in staging environment
5. Deploy to production

## References

- Ports and Adapters: [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- Clean Architecture: [The Dependency Rule](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- Stripe: [Payment Intents API](https://stripe.com/docs/payments/payment-intents)

## Related ADRs

- ADR-006: Modular Monolith Architecture
- ADR-007: Mock-First Development
- ADR-009: Database-Based Webhook Dead Letter Queue
