---
module: MAIS
date: 2026-01-24
problem_type: multi-tenant-configuration
component: server/checkout, server/config
symptoms:
  - Static environment variables used for tenant-specific URLs
  - Global configuration used where per-tenant values required
  - Customer redirected to wrong tenant context
  - URLs missing tenant slug after payment flows
root_cause: Static configuration pattern applied to dynamic multi-tenant requirements
resolution_type: prevention_strategies
severity: P1
tags: [multi-tenant, configuration, stripe, checkout, prevention, code-review]
related_fix: plans/fix-multi-tenant-stripe-checkout-urls.md
---

# Static Configuration in Multi-Tenant Systems: Prevention Strategies

**Problem Class:** Using static/global configuration for values that must vary per-tenant.

**Specific Example:** Stripe checkout success/cancel URLs were environment variables, causing all tenants to redirect to the same global URL instead of their tenant-specific storefronts.

**Impact:** P1 - Broken checkout flow, customers lose context, bookings abandoned

---

## 1. Code Review Checklist Item

### Multi-Tenant Configuration Review

Add to existing code review checklist:

```markdown
## Multi-Tenant Configuration (CRITICAL)

- [ ] **No static URLs for tenant-facing flows** - Verify URLs include `${tenantSlug}` or `${tenantId}` when routing customers
- [ ] **Environment variables audited** - Any `config.SOMETHING_URL` must be examined for tenant-specificity
- [ ] **Constructor vs Method parameters** - URLs/endpoints passed to service constructors are static; pass at method call time for dynamic
- [ ] **Metadata includes tenant context** - External service calls (Stripe, webhooks) include tenant identifier for routing
```

### Red Flags to Watch For

| Code Pattern                            | Concern                | Question to Ask                                |
| --------------------------------------- | ---------------------- | ---------------------------------------------- |
| `config.SUCCESS_URL`                    | Static URL             | "Does every tenant use the same success page?" |
| `new ServiceAdapter({ url: config.X })` | Config at construction | "Does this URL vary per request?"              |
| `process.env.CALLBACK_URL`              | Build-time value       | "Is this the same for all tenants?"            |
| `const baseUrl = process.env.APP_URL`   | Global URL             | "What about `tenant.customDomain`?"            |

### Quick Grep Check

```bash
# Find potential static URL patterns in multi-tenant code
rg "config\.\w+_URL|process\.env\.\w+_URL" server/src/services/ --type ts
rg "successUrl|cancelUrl|callbackUrl|redirectUrl" server/src/ --type ts -A 3
```

---

## 2. Architectural Pattern: Tenant-Contextual Configuration

### Anti-Pattern: Static Configuration

```typescript
// WRONG - URLs fixed at startup, same for all tenants
class PaymentService {
  constructor(
    private config: {
      successUrl: string; // Set once at app startup
      cancelUrl: string;
    }
  ) {}

  async createCheckout(tenantId: string, amount: number) {
    return stripe.createSession({
      success_url: this.config.successUrl, // Same for ALL tenants!
      cancel_url: this.config.cancelUrl,
    });
  }
}
```

### Correct Pattern: Dynamic Tenant Resolution

```typescript
// CORRECT - URLs built per-request using tenant context
class PaymentService {
  constructor(
    private tenantRepo: TenantRepository,
    private config: { baseUrl: string } // Just the base, not full URLs
  ) {}

  async createCheckout(tenantId: string, amount: number) {
    const tenant = await this.tenantRepo.findById(tenantId);

    // Build tenant-specific URLs at runtime
    const successUrl = `${this.config.baseUrl}/t/${tenant.slug}/checkout/success`;
    const cancelUrl = `${this.config.baseUrl}/t/${tenant.slug}/checkout`;

    return stripe.createSession({
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantSlug: tenant.slug }, // Enable webhook routing
    });
  }
}
```

### Decision Tree: Static vs Dynamic Configuration

```
Is this configuration value...

1. The same for ALL tenants, ALL requests?
   └── YES → Static config (env var) is fine
   └── NO → Continue to #2

2. Does it vary by TENANT?
   └── YES → Must be dynamic, resolved at request time
   └── NO → Continue to #3

3. Does it vary by REQUEST context (user, session, etc.)?
   └── YES → Pass as method parameter
   └── NO → Re-evaluate - probably static

Examples:
- API_VERSION → Static (same for all)
- DATABASE_URL → Static (single database, tenant isolation via WHERE)
- CHECKOUT_SUCCESS_URL → DYNAMIC (varies by tenant slug)
- WEBHOOK_CALLBACK_URL → DYNAMIC (varies by tenant custom domain)
- LOGO_URL → DYNAMIC (stored in tenant.branding)
```

### Tenant-Aware URL Patterns

| URL Type         | Pattern                                  | Example                              |
| ---------------- | ---------------------------------------- | ------------------------------------ |
| Storefront       | `/t/{slug}`                              | `/t/acme-photography`                |
| Booking flow     | `/t/{slug}/book/{package}`               | `/t/acme-photography/book/elopement` |
| Checkout success | `/t/{slug}/book/success?session_id={ID}` | Dynamic with Stripe session          |
| Checkout cancel  | `/t/{slug}/book`                         | Back to package selection            |
| Custom domain    | `{customDomain}/book/success`            | If tenant has custom domain          |

---

## 3. Test Case: Tenant-Specific URL Validation

### Unit Test Pattern

```typescript
describe('CheckoutSessionFactory', () => {
  it('should generate tenant-specific success URL', async () => {
    // Arrange
    const tenantSlug = 'acme-photography';
    const tenant = await createTestTenant({ slug: tenantSlug });

    // Act
    const session = await factory.createCheckoutSession({
      tenantId: tenant.id,
      amountCents: 10000,
      email: 'customer@example.com',
    });

    // Assert - URL contains tenant slug
    expect(session.successUrl).toContain(`/t/${tenantSlug}/`);
    expect(session.successUrl).toMatch(/\/t\/acme-photography\/book\/success/);
  });

  it('should NOT use global/static URLs for tenant flows', async () => {
    const tenantA = await createTestTenant({ slug: 'tenant-a' });
    const tenantB = await createTestTenant({ slug: 'tenant-b' });

    const sessionA = await factory.createCheckoutSession({
      tenantId: tenantA.id,
      amountCents: 10000,
      email: 'a@test.com',
    });

    const sessionB = await factory.createCheckoutSession({
      tenantId: tenantB.id,
      amountCents: 10000,
      email: 'b@test.com',
    });

    // URLs MUST be different for different tenants
    expect(sessionA.successUrl).not.toEqual(sessionB.successUrl);
    expect(sessionA.successUrl).toContain('tenant-a');
    expect(sessionB.successUrl).toContain('tenant-b');
  });
});
```

### E2E Test Pattern

```typescript
test('checkout redirects to tenant-specific success page', async ({ page }) => {
  const tenantSlug = 'test-tenant';

  // Start checkout on tenant storefront
  await page.goto(`/t/${tenantSlug}/book/elopement`);
  await fillBookingForm(page);
  await page.click('[data-testid="submit-booking"]');

  // After checkout completion, verify tenant-specific redirect
  await page.waitForURL(/\/t\/test-tenant\/book\/success\?session_id=/);

  // Should NOT redirect to global /success page
  expect(page.url()).not.toMatch(/^\/success/);
  expect(page.url()).toContain(`/t/${tenantSlug}/`);
});
```

### Integration Test: Cross-Tenant Isolation

```typescript
it('should NOT leak URLs between tenants', async () => {
  const results: string[] = [];

  // Create sessions for multiple tenants
  for (const slug of ['alpha', 'beta', 'gamma']) {
    const tenant = await createTestTenant({ slug });
    const session = await factory.createCheckoutSession({
      tenantId: tenant.id,
      amountCents: 5000,
      email: `${slug}@test.com`,
    });
    results.push(session.successUrl);
  }

  // All URLs must be unique and contain correct slug
  expect(new Set(results).size).toBe(3); // All unique
  expect(results[0]).toContain('/t/alpha/');
  expect(results[1]).toContain('/t/beta/');
  expect(results[2]).toContain('/t/gamma/');
});
```

---

## 4. CLAUDE.md Pitfall Entry

### Proposed Addition (Pitfall #76)

```markdown
76. Static config for tenant-specific URLs - Never use `config.SUCCESS_URL` or `process.env.CALLBACK_URL` for URLs that route customers back to tenant storefronts; build URLs dynamically with `${baseUrl}/t/${tenant.slug}/...` and include `tenantSlug` in external service metadata. See `docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md`
```

### Full Entry for Common Pitfalls Section

````markdown
### Multi-Tenant Configuration Pitfalls (76)

76. **Static config for tenant-specific URLs** - Environment variables set at startup cannot vary per-tenant. If a URL routes customers back to their storefront, it MUST include tenant context.

```typescript
// WRONG - Static URL from env var
const session = await stripe.createSession({
  success_url: config.STRIPE_SUCCESS_URL, // Same for ALL tenants
});

// CORRECT - Build URL with tenant context at request time
const successUrl = `${config.CORS_ORIGIN}/t/${tenant.slug}/book/success`;
const session = await stripe.createSession({
  success_url: successUrl,
  metadata: { tenantSlug: tenant.slug }, // For webhook routing
});
```
````

**Detection:** `rg "config\.\w+_URL" server/src/services/ | grep -v baseUrl`

**See:** [STATIC_CONFIG_MULTI_TENANT_PREVENTION.md](docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md)

````

---

## 5. Quick Reference Checklist

### Before Implementing External Service Integration

```markdown
## External Service Multi-Tenant Checklist

- [ ] Callback/redirect URLs include tenant identifier (slug or ID)
- [ ] Metadata/tags include tenant context for webhook routing
- [ ] URL parameters NOT stored in env vars or constructor config
- [ ] Test verifies different tenants get different URLs
- [ ] Custom domain fallback considered (tenant.customDomain ?? default)
````

### Configuration Audit Questions

When reviewing any configuration-driven feature:

1. **"What happens when Tenant B's customer hits this URL?"**
   - If the answer is "same as Tenant A" - that's a bug for customer-facing flows

2. **"Can I grep for tenant.slug in this file?"**
   - If no tenant context in URLs/callbacks - likely a static config issue

3. **"Is this value set in di.ts or at service method call?"**
   - di.ts = static/global, method call = can be dynamic

---

## 6. Related Patterns

| Pattern                  | Location                                                                             | Relationship           |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------- |
| Tenant-scoped queries    | [mais-critical-patterns.md](./mais-critical-patterns.md)                             | Data isolation         |
| Tenant-scoped cache keys | [mais-critical-patterns.md](./mais-critical-patterns.md)                             | Cache isolation        |
| Custom domain routing    | [VERCEL_MULTI_TENANT_DEPLOYMENT.md](../../routing/VERCEL_MULTI_TENANT_DEPLOYMENT.md) | URL resolution         |
| Webhook tenant routing   | [server/src/jobs/webhook-processor.ts]                                               | Metadata-based routing |

---

## 7. Prevention Summary

| Layer             | Prevention Mechanism                                       |
| ----------------- | ---------------------------------------------------------- |
| **Code Review**   | Check any `_URL` env var for tenant-specificity            |
| **Architecture**  | Build URLs at request time, not construction time          |
| **Testing**       | Verify different tenants get different URLs                |
| **Documentation** | Pitfall #76 in CLAUDE.md                                   |
| **ESLint**        | Could add custom rule for `config.*URL` in service methods |

---

**Last Updated:** 2026-01-24
**Related Fix:** `plans/fix-multi-tenant-stripe-checkout-urls.md`
**Commit:** `be35d466` - fix(booking): enable tenant-specific Stripe checkout redirect URLs
