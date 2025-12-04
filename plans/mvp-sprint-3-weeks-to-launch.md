# MAIS MVP Sprint: 1 Week to Launch

## Overview

Ship self-service tenant signup with Stripe Connect payments in **5 days**.

**Current State:** 90% complete, 752+ tests passing, booking flow works
**Gap:** Tenants can't self-signup
**Goal:** First paying customer by end of week

---

## What We Just Fixed

**Photo Upload Tests:** All 19 tests now pass. Issue was URL path mismatch in test file (fixed).

---

## 5-Day Sprint Plan

### Day 1: Signup Backend (4 hours coding)

**Build `POST /v1/auth/signup` endpoint**

Files to modify:

- `packages/contracts/src/api.v1.ts` - Add contract
- `server/src/routes/auth.routes.ts` - Add endpoint

**Minimal Implementation:**

```typescript
// In auth.routes.ts - add alongside existing login
router.post('/signup', async (req, res) => {
  const { email, password, businessName } = req.body;

  // Validate
  if (!email || !password || !businessName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be 8+ characters' });
  }

  // Check email uniqueness
  const existing = await tenantRepo.findByEmail(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Generate slug: simple timestamp approach (guaranteed unique)
  const baseSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50);
  const slug = `${baseSlug}-${Date.now()}`;

  // Hash password (existing service method)
  const passwordHash = await tenantAuthService.hashPassword(password);

  // Generate API keys
  const apiKeyPublic = `pk_live_${slug}_${crypto.randomBytes(16).toString('hex')}`;
  const apiKeySecret = `sk_live_${slug}_${crypto.randomBytes(16).toString('hex')}`;

  // Create tenant
  const tenant = await tenantRepo.create({
    email: email.toLowerCase(),
    passwordHash,
    slug,
    name: businessName,
    apiKeyPublic,
    apiKeySecret,
    commissionPercent: 10.0,
    isActive: true,
    emailVerified: false, // Add flag, don't enforce yet
  });

  // Generate JWT
  const token = tenantAuthService.generateToken(tenant);

  return res.status(201).json({
    token,
    tenantId: tenant.id,
    slug,
    email: tenant.email,
  });
});
```

**Schema change needed:** Add `emailVerified` field

```prisma
model Tenant {
  // ... existing fields
  emailVerified Boolean @default(false)
}
```

**Acceptance Criteria:**

- [ ] Endpoint accepts email, password, businessName
- [ ] Returns JWT token on success
- [ ] Returns 409 if email exists
- [ ] Password hashed with bcrypt

---

### Day 2: Signup Frontend + Password Reset (4 hours coding)

**Build `/signup` page**

Files to create:

- `client/src/pages/SignupPage.tsx`

**Minimal Implementation:**

```tsx
// Simple form, no fancy validation
export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await api.signup({ body: { email, password, businessName } });

    if (result.status === 201) {
      api.setTenantToken(result.body.token);
      navigate('/tenant-admin/dashboard');
    } else {
      setError(result.body.error || 'Signup failed');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password (8+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />
      <input
        type="text"
        placeholder="Business Name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        required
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Account'}
      </button>
      <p>
        We charge 10% commission on bookings. <Link to="/login">Already have account?</Link>
      </p>
    </form>
  );
}
```

**Password Reset (magic link):**

Files to modify:

- `server/src/routes/auth.routes.ts` - Add reset endpoints
- `packages/contracts/src/api.v1.ts` - Add contracts

```typescript
// POST /v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const tenant = await tenantRepo.findByEmail(email.toLowerCase());

  if (tenant) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await tenantRepo.update(tenant.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: expires,
    });

    // Send email with link
    await emailService.sendPasswordReset(email, resetToken);
  }

  // Always return success (don't leak email existence)
  return res.json({ message: 'If email exists, reset link sent' });
});

// POST /v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  const tenant = await tenantRepo.findByResetToken(token);
  if (!tenant || tenant.passwordResetExpires < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const passwordHash = await tenantAuthService.hashPassword(password);
  await tenantRepo.update(tenant.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return res.json({ message: 'Password updated' });
});
```

**Schema addition:**

```prisma
model Tenant {
  // ... existing
  passwordResetToken   String?
  passwordResetExpires DateTime?
}
```

**Acceptance Criteria:**

- [ ] Signup form works end-to-end
- [ ] Redirects to dashboard on success
- [ ] Password reset email sends
- [ ] Reset link works within 1 hour

---

### Day 3: Stripe Connect Button (4 hours coding)

**Add "Connect Your Bank" to dashboard**

Files to modify:

- `client/src/features/tenant-admin/TenantDashboard/index.tsx`
- `server/src/routes/tenant-admin.routes.ts`

**Backend endpoints (service already exists):**

```typescript
// POST /v1/tenant-admin/stripe/onboarding-link
router.post('/stripe/onboarding-link', tenantAuthMiddleware, async (req, res) => {
  const tenantId = res.locals.tenantAuth.tenantId;

  // Create account if not exists
  let tenant = await tenantRepo.findById(tenantId);
  if (!tenant.stripeAccountId) {
    const accountId = await stripeConnectService.createConnectedAccount(tenantId);
    tenant = await tenantRepo.update(tenantId, { stripeAccountId: accountId });
  }

  // Generate onboarding link
  const url = await stripeConnectService.createOnboardingLink(tenantId);
  return res.json({ url });
});

// GET /v1/tenant-admin/stripe/status
router.get('/stripe/status', tenantAuthMiddleware, async (req, res) => {
  const tenantId = res.locals.tenantAuth.tenantId;
  const tenant = await tenantRepo.findById(tenantId);

  return res.json({
    hasAccount: !!tenant.stripeAccountId,
    onboarded: tenant.stripeOnboarded,
  });
});
```

**Frontend component:**

```tsx
function StripeConnectButton() {
  const [status, setStatus] = useState({ hasAccount: false, onboarded: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getStripeStatus().then((r) => r.status === 200 && setStatus(r.body));
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    const result = await api.getStripeOnboardingLink();
    if (result.status === 200) {
      window.open(result.body.url, '_blank');
    }
    setLoading(false);
  };

  if (status.onboarded) {
    return <span className="text-green-600">Bank Connected</span>;
  }

  return (
    <button onClick={handleConnect} disabled={loading}>
      {loading ? 'Loading...' : 'Connect Your Bank'}
    </button>
  );
}
```

**Acceptance Criteria:**

- [ ] Button visible on tenant dashboard
- [ ] Clicking opens Stripe onboarding
- [ ] After return, status shows "Connected" (via webhook)

---

### Day 4: Deploy + Test (8 hours)

**Morning: Deploy**

1. Run migrations:

```bash
cd server && npm exec prisma migrate dev --name add_email_verified_and_reset
```

2. Deploy API to Render:

```bash
git push origin main  # Render auto-deploys from main
```

3. Deploy client to Vercel:

```bash
cd client && vercel --prod
```

4. Configure production environment:

- `JWT_SECRET` (generate new for prod)
- `DATABASE_URL` (Supabase production)
- `STRIPE_SECRET_KEY` (live key)
- `STRIPE_WEBHOOK_SECRET` (register webhook)
- `POSTMARK_SERVER_TOKEN`

5. Register Stripe webhook:

```bash
stripe listen --forward-to https://api.maconaisolutions.com/v1/webhooks/stripe
```

**Afternoon: End-to-end test**

- [ ] Create account via signup
- [ ] Login works
- [ ] Create package
- [ ] Upload photo
- [ ] Connect Stripe (test mode first)
- [ ] Process test booking
- [ ] Verify commission collected

---

### Day 5: Little Bit Farm + Launch (4 hours)

**Morning: Beta test with real user**

1. Send signup link to Little Bit Farm
2. Get on Zoom call, watch them use it
3. Fix any blockers immediately

**Afternoon: Launch**

- [ ] Switch Stripe to live mode
- [ ] Monitor for issues
- [ ] Email 5 other potential customers

---

## What's NOT in This Sprint

Explicitly excluded (add later based on user feedback):

- Revenue metrics dashboard (no revenue yet)
- Analytics/charts
- Settings page
- Email verification enforcement
- Multi-factor auth
- Custom domains
- Onboarding wizard

---

## Files to Create/Modify Summary

**Create:**

- `client/src/pages/SignupPage.tsx`
- `client/src/pages/ResetPasswordPage.tsx`
- `client/src/pages/ForgotPasswordPage.tsx`

**Modify:**

- `packages/contracts/src/api.v1.ts` - Add signup, reset, Stripe contracts
- `server/src/routes/auth.routes.ts` - Add signup, reset endpoints
- `server/src/routes/tenant-admin.routes.ts` - Add Stripe endpoints
- `server/prisma/schema.prisma` - Add emailVerified, reset fields
- `client/src/App.tsx` - Add routes
- `client/src/features/tenant-admin/TenantDashboard/index.tsx` - Add Stripe button

**Already Fixed:**

- `server/test/http/tenant-admin-photos.test.ts` - Path fix, all 19 tests pass

---

## Success Criteria

- [ ] Someone can sign up without admin help
- [ ] Someone can connect their bank account
- [ ] Someone can receive a payment
- [ ] Platform collects 10% commission
- [ ] Little Bit Farm is live by end of week

---

## Risk Mitigation

| Risk                      | Mitigation                                    |
| ------------------------- | --------------------------------------------- |
| Stripe onboarding dropout | Clear instructions, "Resume" button on return |
| Password forgotten        | Magic link reset (Day 2)                      |
| Email typos               | Show confirmation before submit               |
| Deployment issues         | Deploy Day 4 morning, full afternoon to fix   |

---

## Quick Commands Reference

```bash
# Run photo tests (now passing)
npm test -- test/http/tenant-admin-photos.test.ts

# Run all tests
npm test

# Start dev servers
npm run dev:all

# Create migration
cd server && npm exec prisma migrate dev --name your_migration_name

# Deploy
git push origin main  # Triggers Render deploy
cd client && vercel --prod
```
