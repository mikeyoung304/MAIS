# Phase 2B Remediation Plan

## Step-by-Step Fix Instructions for All Audit Findings

**Date:** 2025-10-29
**Based On:** Master Audit Report (6-Agent Review)
**Status:** Ready for Execution
**Estimated Total Time:** 16-18 hours

---

## Overview

This document provides detailed, actionable steps to remediate all issues found in the Phase 2B comprehensive audit. Issues are organized by priority with specific file locations, code examples, and verification steps.

---

## Phase 1: CRITICAL (MUST FIX BEFORE PRODUCTION) - 3 hours

These issues **block production deployment** and must be resolved immediately.

### Task 1.1: Rotate All Exposed Secrets (1 hour)

**Priority:** P0 - BLOCKER
**Impact:** Complete system compromise possible
**Status:** ❌ NOT STARTED

#### Step-by-Step Instructions

**1. Generate New JWT Secret (5 min)**

```bash
# Generate new 256-bit secret
openssl rand -hex 32

# Example output (YOUR VALUE WILL DIFFER):
# a8f3e9d2c1b4a7f6e5d8c3b2a1f9e6d5c4b3a2f1e9d8c7b6a5f4e3d2c1b0a9f8

# Update server/.env
JWT_SECRET=<YOUR_NEW_SECRET_HERE>
```

**2. Rotate Stripe Keys (15 min)**

```bash
# Steps:
1. Login to https://dashboard.stripe.com/test/apikeys
2. Click "Roll key" next to Secret key
3. Copy new key: sk_test_51...
4. Go to https://dashboard.stripe.com/test/webhooks
5. Click on your webhook endpoint
6. Click "Roll secret"
7. Copy new webhook secret: whsec_...
8. Update server/.env:
   STRIPE_SECRET_KEY=<NEW_SECRET_KEY>
   STRIPE_WEBHOOK_SECRET=<NEW_WEBHOOK_SECRET>
9. Test with: stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```

**3. Rotate Database Password (10 min)**

```bash
# Steps:
1. Login to https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir
2. Settings → Database → Database Settings
3. Click "Reset Database Password"
4. Copy new password
5. URL-encode special characters:
   @ → %40, ! → %21, # → %23, $ → %24, % → %25
6. Update server/.env:
   DATABASE_URL=postgresql://postgres:<URL_ENCODED_PASSWORD>@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres
   DIRECT_URL=<SAME_AS_DATABASE_URL>
```

**4. Rotate Supabase API Keys (10 min)**

```bash
# Steps:
1. Supabase Dashboard → Settings → API
2. Click "Generate new service role key"
3. Copy new key
4. Update server/.env:
   SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY>
5. (anon key can stay the same - it's public)
```

**5. Update Production Environment (10 min)**

```bash
# For Vercel/Railway/Render:
# Go to your hosting dashboard → Environment Variables
# Update ALL rotated secrets:
# - JWT_SECRET
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - DATABASE_URL
# - DIRECT_URL
# - SUPABASE_SERVICE_ROLE_KEY

# Trigger redeploy to pick up new environment variables
```

**6. Notify Users of JWT Rotation (5 min)**

```markdown
# Email/Slack message:

Subject: JWT Token Rotation - Re-login Required

All JWT tokens have been invalidated due to security key rotation.
Users must log out and log back in to receive new tokens.

Timeline: Effective immediately
Impact: All current sessions invalidated
Action Required: Users must re-authenticate
```

**7. Verification (5 min)**

```bash
# Test new JWT secret
curl -X POST http://localhost:3001/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}'
# Should return new token

# Test new Stripe keys
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
# Should connect successfully

# Test new database password
npx prisma studio
# Should connect successfully
```

---

### Task 1.2: Git History Sanitization (2 hours)

**Priority:** P0 - BLOCKER
**Impact:** Exposed secrets remain in git forever
**Status:** ❌ NOT STARTED

#### Preparation (10 min)

**1. Create Backup Branch**

```bash
cd /Users/mikeyoung/CODING/Elope
git branch backup-before-sanitization
git push origin backup-before-sanitization
```

**2. Document Current State**

```bash
# Count secrets in history
git log --all -p | grep -c "sk_test_51SLPlv"
git log --all -p | grep -c "whsec_0ad225e1"
git log --all -p | grep -c "3d3fa3a52c3ffd50"

# Save commit list
git log --oneline > commits-before-sanitization.txt
```

**3. Notify Team (15 min)**

```markdown
Subject: URGENT: Git History Rewrite Scheduled

⚠️ BREAKING CHANGE: We need to rewrite git history to remove exposed secrets.

WHAT: Git history rewrite (BFG Repo-Cleaner)
WHEN: [Schedule 2-hour window]
IMPACT: All developers must re-clone repository

BEFORE THE REWRITE:

1. Commit all local changes
2. Push all branches to remote
3. Note your current branch name

AFTER THE REWRITE:

1. Delete local repository
2. Re-clone from origin: git clone <url>
3. Recreate any local-only branches

Questions? Reply to this thread.
```

#### Execute Sanitization (1 hour)

**4. Install BFG Repo-Cleaner**

```bash
# macOS
brew install bfg

# Or download manually
curl -L https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -o bfg.jar
```

**5. Create Secrets File**

```bash
cat > secrets-to-remove.txt <<EOF
sk_test_51SLPlvBPdt7IPpHp4VgimjlRIpzYvwa7Mvu2Gmbow0lrsxQsNpQzm1Vfv52vdF9qqEpFtw7ntaVmQyGU199zbRlf00RrztV7fZ
whsec_0ad225e1a56469eb6959f399ac7c9536e17cd1fb07ba5513001f46853b8078b2
3d3fa3a52c3ffd50eab162e1222e4f953aede6a9e8732bf4a03a0b836f0bff24
68fa0f2690e33a51659ce4a431826afaf3aa9848765bb4092d518dca0f4a7005
@Orangegoat11
postgresql://postgres:@Orangegoat11@db.gpyvdknhmevcfdbgtqir
EOF
```

**6. Run BFG (Delete Sensitive Files)**

```bash
# Remove files that contain secrets
bfg --delete-files "SECRETS_ROTATION.md" --no-blob-protection
bfg --delete-files "AGENT_2_REPORT.md" --no-blob-protection

# Replace secret strings in all files
bfg --replace-text secrets-to-remove.txt --no-blob-protection

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**7. Verify Sanitization (10 min)**

```bash
# Search for secrets (should find NONE)
git log --all -p | grep -c "sk_test_51SLPlv"
# Expected: 0

git log --all -p | grep -c "whsec_0ad225e1"
# Expected: 0

git log --all -p | grep -c "3d3fa3a52c3ffd50"
# Expected: 0

git log --all -p | grep -c "@Orangegoat11"
# Expected: 0

# If any return > 0, repeat BFG step with those specific strings
```

#### Force Push (Dangerous - Coordinate!) (10 min)

**8. Force Push to Remote**

```bash
# ⚠️ WARNING: This is destructive and requires team coordination

# Push sanitized history
git push origin --force --all
git push origin --force --tags

# Verify remote is clean
git clone https://github.com/<YOUR_REPO> /tmp/test-clone
cd /tmp/test-clone
git log --all -p | grep -c "sk_test_51SLPlv"
# Expected: 0
```

#### Post-Sanitization (20 min)

**9. Team Re-Clone Instructions**

```markdown
# Send to all developers:

✅ Git history sanitization complete!

ACTION REQUIRED for all developers:

1. Delete your local Elope directory:
   rm -rf /Users/yourusername/CODING/Elope

2. Re-clone the repository:
   git clone https://github.com/<YOUR_REPO> Elope
   cd Elope

3. Checkout your working branch:
   git checkout your-branch-name

4. Pull latest .env from 1Password/secrets manager

5. Verify you're on the right commit:
   git log --oneline | head -1
   # Should show: <commit> feat(phase-2b): ...

Note: All old branches and commits are preserved in backup-before-sanitization branch if needed.
```

**10. Add Pre-Commit Hook**

```bash
# Install git-secrets
brew install git-secrets

# Initialize in repo
cd /Users/mikeyoung/CODING/Elope
git secrets --install
git secrets --register-aws  # Catches AWS keys

# Add custom patterns
git secrets --add 'sk_test_[a-zA-Z0-9]{24,}'  # Stripe test key
git secrets --add 'sk_live_[a-zA-Z0-9]{24,}'  # Stripe live key
git secrets --add 'whsec_[a-zA-Z0-9]{32,}'    # Stripe webhook secret
git secrets --add '[a-f0-9]{64}'              # 256-bit hex strings (JWT)
git secrets --add 'postgresql://[^@]*:([^@]+)@'  # Database passwords in URLs

# Test (should fail)
echo "sk_test_51ABCDEFGtest123456" > test.txt
git add test.txt
git commit -m "test"
# Should error: "test.txt:1:sk_test_51ABCDEFGtest123456"

# Remove test file
git reset HEAD test.txt
rm test.txt
```

---

## Phase 2: HIGH PRIORITY (BEFORE PRODUCTION) - 13-14 hours

These issues should be fixed before production deployment to ensure reliability and security.

### Task 2.1: Fix Raw SQL Error Handling (2 hours)

**Priority:** P1 - HIGH
**File:** `server/src/adapters/prisma/booking.repository.ts`
**Lines:** 18-29

#### Current Code (UNSAFE)

```typescript
try {
  await tx.$queryRawUnsafe(lockQuery, new Date(booking.eventDate));
} catch (lockError) {
  throw new BookingLockTimeoutError(booking.eventDate);
}
```

#### Fixed Code

```typescript
try {
  await tx.$queryRawUnsafe(lockQuery, new Date(booking.eventDate));
} catch (lockError) {
  // Only treat specific PostgreSQL errors as lock timeouts
  if (lockError instanceof PrismaClientKnownRequestError) {
    // P2034 = Transaction failed due to lock timeout
    if (lockError.code === 'P2034') {
      logger.warn(
        { date: booking.eventDate, error: lockError.code },
        'Lock timeout on booking date'
      );
      throw new BookingLockTimeoutError(booking.eventDate);
    }
  }

  // Log unexpected errors for debugging
  logger.error(
    {
      error: lockError,
      date: booking.eventDate,
      query: lockQuery,
    },
    'Unexpected error during lock acquisition'
  );

  // Re-throw to prevent masking real database issues
  throw lockError;
}
```

#### Import Required

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { logger } from '../lib/core/logger';
```

#### Testing

```typescript
// Add to test/repositories/booking-concurrency.spec.ts

describe('Lock error handling', () => {
  it('should throw BookingLockTimeoutError on P2034', async () => {
    // Mock Prisma to throw P2034 error
    const mockError = new PrismaClientKnownRequestError('Lock timeout', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });

    // ... test implementation
  });

  it('should re-throw non-lock errors', async () => {
    // Mock Prisma to throw connection error
    const mockError = new PrismaClientKnownRequestError('Connection failed', {
      code: 'P1001',
      clientVersion: '5.0.0',
    });

    // ... verify error is not converted to BookingLockTimeoutError
  });
});
```

---

### Task 2.2: Add Integration Tests (8-10 hours)

**Priority:** P1 - HIGH
**Impact:** Critical paths currently untested with real database

#### Test File 1: Booking Repository Integration (4 hours)

**Create:** `server/test/integration/booking-repository.integration.spec.ts`

```typescript
/**
 * Integration tests for PrismaBookingRepository
 * Tests real database behavior: transactions, locks, conflicts
 *
 * Requires: Test database configured
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaBookingRepository } from '../src/adapters/prisma/booking.repository';
import { BookingConflictError, BookingLockTimeoutError } from '../src/lib/errors';
import type { Booking } from '../src/lib/entities';

describe('PrismaBookingRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaBookingRepository;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST, // Separate test database
        },
      },
    });
    repository = new PrismaBookingRepository(prisma);

    // Clean database
    await prisma.bookingAddOn.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Pessimistic Locking', () => {
    it('should acquire lock and create booking successfully', async () => {
      const booking: Booking = {
        id: 'test-booking-1',
        packageId: 'pkg-1',
        coupleName: 'John & Jane',
        email: 'test@example.com',
        eventDate: '2025-12-25',
        addOnIds: [],
        totalCents: 250000,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };

      const created = await repository.create(booking);

      expect(created.id).toBe(booking.id);
      expect(created.eventDate).toBe(booking.eventDate);
    });

    it('should throw BookingConflictError on duplicate date', async () => {
      // Create first booking
      const booking1: Booking = {
        id: 'test-booking-1',
        packageId: 'pkg-1',
        coupleName: 'John & Jane',
        email: 'test@example.com',
        eventDate: '2025-12-25',
        addOnIds: [],
        totalCents: 250000,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };
      await repository.create(booking1);

      // Try to create second booking for same date
      const booking2 = { ...booking1, id: 'test-booking-2' };

      await expect(repository.create(booking2)).rejects.toThrow(BookingConflictError);
    });

    it('should handle concurrent booking attempts (lock timeout)', async () => {
      // This test requires two concurrent transactions
      const booking: Booking = {
        id: 'test-booking-concurrent',
        packageId: 'pkg-1',
        coupleName: 'Test Couple',
        email: 'concurrent@test.com',
        eventDate: '2025-12-30',
        addOnIds: [],
        totalCents: 300000,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };

      // Start first transaction (holds lock)
      const promise1 = repository.create(booking);

      // Start second transaction immediately (should timeout)
      const promise2 = repository.create({ ...booking, id: 'booking-2' });

      const results = await Promise.allSettled([promise1, promise2]);

      // One should succeed, one should fail with timeout or conflict
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);

      // Failed one should be BookingLockTimeoutError or BookingConflictError
      const failedResult = failed[0] as PromiseRejectedResult;
      expect(
        failedResult.reason instanceof BookingLockTimeoutError ||
          failedResult.reason instanceof BookingConflictError
      ).toBe(true);
    });

    it('should rollback transaction on lock timeout', async () => {
      // Create booking that will cause lock timeout
      const booking: Booking = {
        id: 'test-rollback',
        packageId: 'pkg-1',
        coupleName: 'Rollback Test',
        email: 'rollback@test.com',
        eventDate: '2026-01-01',
        addOnIds: [],
        totalCents: 350000,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };

      try {
        // Hold lock in long-running transaction
        await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT * FROM "Booking" FOR UPDATE`;

            // Try to create booking (should timeout)
            await repository.create(booking);
          },
          { timeout: 10000 }
        );
      } catch (error) {
        // Expected to fail
      }

      // Verify NO partial data was committed (customer, booking)
      const customerCount = await prisma.customer.count({
        where: { email: booking.email },
      });
      expect(customerCount).toBe(0);

      const bookingCount = await prisma.booking.count({
        where: { id: booking.id },
      });
      expect(bookingCount).toBe(0);
    });
  });

  describe('Transaction Isolation', () => {
    it('should use Serializable isolation level', async () => {
      // This test verifies the isolation level prevents phantom reads
      const booking1: Booking = {
        id: 'test-serializable-1',
        packageId: 'pkg-1',
        coupleName: 'Isolation Test 1',
        email: 'isolation1@test.com',
        eventDate: '2026-02-14',
        addOnIds: [],
        totalCents: 400000,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      };

      const booking2 = { ...booking1, id: 'test-serializable-2', email: 'isolation2@test.com' };

      // Run two transactions that check availability and create booking
      const results = await Promise.allSettled([
        repository.create(booking1),
        repository.create(booking2),
      ]);

      // With Serializable isolation, only ONE should succeed
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      expect(succeeded.length).toBe(1);
    });
  });
});
```

#### Test File 2: Webhook Repository Integration (2 hours)

**Create:** `server/test/integration/webhook-repository.integration.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaWebhookRepository } from '../src/adapters/prisma/webhook.repository';

describe('PrismaWebhookRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaWebhookRepository;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST } },
    });
    repository = new PrismaWebhookRepository(prisma);
    await prisma.webhookEvent.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Idempotency', () => {
    it('should detect duplicate webhooks', async () => {
      const webhook = {
        eventId: 'evt_test_123',
        eventType: 'checkout.session.completed',
        rawPayload: '{"data": "test"}',
      };

      // First webhook
      await repository.recordWebhook(webhook);
      expect(await repository.isDuplicate('evt_test_123')).toBe(false);

      // Duplicate webhook
      expect(await repository.isDuplicate('evt_test_123')).toBe(true);

      // Verify status was updated to DUPLICATE
      const event = await prisma.webhookEvent.findUnique({
        where: { eventId: 'evt_test_123' },
      });
      expect(event?.status).toBe('DUPLICATE');
      expect(event?.attempts).toBe(2); // Incremented
    });

    it('should handle concurrent duplicate checks', async () => {
      const webhook = {
        eventId: 'evt_concurrent_456',
        eventType: 'checkout.session.completed',
        rawPayload: '{"data": "concurrent"}',
      };

      // Record webhook
      await repository.recordWebhook(webhook);

      // Multiple duplicate checks at once
      const checks = await Promise.all([
        repository.isDuplicate('evt_concurrent_456'),
        repository.isDuplicate('evt_concurrent_456'),
        repository.isDuplicate('evt_concurrent_456'),
      ]);

      // All should return true (duplicate)
      expect(checks.every((c) => c === true)).toBe(true);
    });
  });

  describe('Status Transitions', () => {
    it('should mark webhook as PROCESSED', async () => {
      await repository.recordWebhook({
        eventId: 'evt_process_789',
        eventType: 'checkout.session.completed',
        rawPayload: '{"data": "process"}',
      });

      await repository.markProcessed('evt_process_789');

      const event = await prisma.webhookEvent.findUnique({
        where: { eventId: 'evt_process_789' },
      });
      expect(event?.status).toBe('PROCESSED');
      expect(event?.processedAt).not.toBeNull();
    });

    it('should mark webhook as FAILED with error', async () => {
      await repository.recordWebhook({
        eventId: 'evt_fail_999',
        eventType: 'checkout.session.completed',
        rawPayload: '{"data": "fail"}',
      });

      await repository.markFailed('evt_fail_999', 'Database connection failed');

      const event = await prisma.webhookEvent.findUnique({
        where: { eventId: 'evt_fail_999' },
      });
      expect(event?.status).toBe('FAILED');
      expect(event?.lastError).toBe('Database connection failed');
      expect(event?.attempts).toBe(2); // Incremented
    });
  });
});
```

#### Test File 3: HTTP Webhook Endpoint (2 hours)

**Create:** `server/test/http/webhooks.http.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type Stripe from 'stripe';

describe('POST /v1/webhooks/stripe', () => {
  let app: Express.Application;

  beforeEach(() => {
    app = createApp();
  });

  it('should reject webhook without signature header', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .send({ type: 'checkout.session.completed' });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('signature');
  });

  it('should reject webhook with invalid signature', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'invalid_signature')
      .send({ type: 'checkout.session.completed' });

    expect(response.status).toBe(422);
  });

  it('should accept valid webhook and return 200', async () => {
    // Generate valid Stripe signature
    const payload = JSON.stringify({
      id: 'evt_test_valid',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 250000,
          metadata: {
            packageId: 'pkg-classic',
            eventDate: '2026-06-15',
            email: 'test@example.com',
            coupleName: 'Test Couple',
            addOnIds: '[]',
          },
        },
      },
    });

    // Use Stripe library to generate valid signature
    const signature = generateTestSignature(payload);

    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', signature)
      .set('content-type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
  });

  it('should return 200 for duplicate webhook', async () => {
    // First webhook
    const payload = createValidWebhookPayload('evt_duplicate_test');
    const signature = generateTestSignature(payload);

    await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', signature)
      .send(payload);

    // Duplicate webhook (same event ID)
    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', signature)
      .send(payload);

    expect(response.status).toBe(200);
    // Verify booking was NOT created twice
  });
});

function generateTestSignature(payload: string): string {
  // Use actual Stripe webhook signature generation
  // See: https://stripe.com/docs/webhooks/signatures
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp,
  });
  return signature;
}
```

#### Configuration (30 min)

**1. Add Test Database**

Update `package.json`:

```json
{
  "scripts": {
    "test:integration": "DATABASE_URL=$DATABASE_URL_TEST vitest run test/integration/",
    "test:integration:watch": "DATABASE_URL=$DATABASE_URL_TEST vitest watch test/integration/"
  }
}
```

Add to `.env.test`:

```bash
DATABASE_URL_TEST=postgresql://postgres:testpassword@localhost:5433/elope_test
```

**2. Setup Test Database**

```bash
# Create test database (Docker)
docker run --name elope-test-db -p 5433:5432 -e POSTGRES_PASSWORD=testpassword -d postgres:15

# Run migrations
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
```

**3. Run Integration Tests**

```bash
npm run test:integration
```

---

### Task 2.3: Fix AddOn Price Capture (1 hour)

**Priority:** P1 - HIGH
**File:** `server/src/adapters/prisma/booking.repository.ts`
**Line:** 67

#### Current Code (WRONG)

```typescript
addOns: {
  create: booking.addOnIds.map((addOnId) => ({
    addOnId,
    quantity: 1,
    unitPrice: 0,  // ❌ Hardcoded to 0
  })),
}
```

#### Fixed Code

```typescript
// Add before booking creation
const addOnPrices = new Map<string, number>();
if (booking.addOnIds.length > 0) {
  // Fetch actual add-on prices
  const addOns = await tx.addOn.findMany({
    where: {
      id: { in: booking.addOnIds },
    },
    select: { id: true, price: true },
  });
  addOns.forEach((a) => addOnPrices.set(a.id, a.price));
}

// Create booking with correct prices
const created = await tx.booking.create({
  data: {
    // ... existing fields
    addOns: {
      create: booking.addOnIds.map((addOnId) => ({
        addOnId,
        quantity: 1,
        unitPrice: addOnPrices.get(addOnId) || 0, // ✅ Real price
      })),
    },
  },
  // ... existing include
});
```

#### Testing

```typescript
// Add to booking.repository.spec.ts
it('should capture correct add-on prices', async () => {
  // Create add-ons with specific prices
  const addOn1 = await prisma.addOn.create({
    data: { id: 'addon-1', packageId: 'pkg-1', title: 'Photos', price: 50000 },
  });
  const addOn2 = await prisma.addOn.create({
    data: { id: 'addon-2', packageId: 'pkg-1', title: 'Music', price: 30000 },
  });

  // Create booking with add-ons
  const booking = createTestBooking({
    addOnIds: ['addon-1', 'addon-2'],
  });
  await repository.create(booking);

  // Verify prices were captured
  const bookingAddOns = await prisma.bookingAddOn.findMany({
    where: { bookingId: booking.id },
  });

  expect(bookingAddOns[0].unitPrice).toBe(50000); // ✅ Not 0
  expect(bookingAddOns[1].unitPrice).toBe(30000); // ✅ Not 0
});
```

---

### Task 2.4: Security Hardening (2 hours)

#### Fix 2.4.1: Specify JWT Algorithm (30 min)

**File:** `server/src/services/identity.service.ts`

**Current Code (VULNERABLE):**

```typescript
const token = jwt.sign(payload, this.secret); // ❌ Algorithm not specified
```

**Fixed Code:**

```typescript
const token = jwt.sign(payload, this.secret, {
  algorithm: 'HS256', // ✅ Explicit algorithm
  expiresIn: '7d', // ✅ Token expiration
});
```

**Verification:**

```typescript
const decoded = jwt.verify(token, this.secret, {
  algorithms: ['HS256'], // ✅ Only allow HS256
}) as TokenPayload;
```

#### Fix 2.4.2: Increase Bcrypt Rounds (30 min)

**File:** `server/src/services/identity.service.ts`

**Current Code:**

```typescript
const salt = await bcrypt.genSalt(10); // ❌ Too low (OWASP recommends 12+)
```

**Fixed Code:**

```typescript
const BCRYPT_ROUNDS = 12; // ✅ OWASP 2023 recommendation
const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
```

#### Fix 2.4.3: Require Strong Admin Password (30 min)

**File:** `server/prisma/seed.ts`

**Current Code (INSECURE):**

```typescript
const adminUser = {
  email: 'admin@example.com',
  password: 'admin', // ❌ Weak default password
};
```

**Fixed Code:**

```typescript
// Require from environment
const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
if (!adminPassword) {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be set in environment');
}
if (adminPassword.length < 12) {
  throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 12 characters');
}

const adminUser = {
  email: 'admin@example.com',
  password: adminPassword, // ✅ From environment
};
```

**Update `.env.example`:**

```bash
# Admin user default password (CHANGE THIS!)
ADMIN_DEFAULT_PASSWORD=ChangeThisToAStrongPassword123!
```

#### Fix 2.4.4: Make Migration Idempotent (30 min)

**File:** `server/prisma/migrations/01_add_webhook_events.sql`

**Current Code (NOT IDEMPOTENT):**

```sql
CREATE TYPE "WebhookStatus" AS ENUM (...);
CREATE TABLE "WebhookEvent" (...);
```

**Fixed Code:**

```sql
-- Make migration idempotent (can run multiple times safely)

-- Create enum if not exists
DO $$ BEGIN
  CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "rawPayload" TEXT NOT NULL,
  "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'WebhookEvent_eventId_key'
  ) THEN
    CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'WebhookEvent_eventId_idx'
  ) THEN
    CREATE INDEX "WebhookEvent_eventId_idx" ON "WebhookEvent"("eventId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'WebhookEvent_status_idx'
  ) THEN
    CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");
  END IF;
END $$;
```

---

## Phase 3: MEDIUM PRIORITY (POST-LAUNCH) - 5-6 hours

### Task 3.1: Improve Webhook Error Handling (1 hour)

**File:** `server/src/adapters/prisma/webhook.repository.ts:52-55`

**Current Code:**

```typescript
try {
  await this.prisma.webhookEvent.create({ data: input });
} catch (error) {
  // Swallows ALL errors
}
```

**Fixed Code:**

```typescript
try {
  await this.prisma.webhookEvent.create({ data: input });
} catch (error) {
  // Only ignore unique constraint violations (duplicate eventId)
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
    logger.info({ eventId: input.eventId }, 'Webhook already recorded (duplicate)');
    return; // Graceful handling
  }
  // Re-throw other errors
  throw error;
}
```

---

### Task 3.2: Fix Magic Numbers (30 min)

**File:** `server/src/adapters/prisma/booking.repository.ts`

**Extract Constants:**

```typescript
// At top of file
const BOOKING_TRANSACTION_TIMEOUT_MS = 5000; // 5 seconds
const BOOKING_ISOLATION_LEVEL = 'Serializable';

// In transaction call
await this.prisma.$transaction(
  async (tx) => {
    // ...
  },
  {
    timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
    isolationLevel: BOOKING_ISOLATION_LEVEL as any,
  }
);
```

---

### Task 3.3: Remove Dead Code (15 min)

**File:** `server/src/lib/errors.ts`

**Remove:**

```typescript
export class WebhookDuplicateError extends ConflictError {
  constructor(eventId: string) {
    super(`Webhook event ${eventId} has already been processed`);
    this.name = 'WebhookDuplicateError';
  }
}
```

**Reason:** Error class is defined but never thrown in code. Controller returns early for duplicates instead of throwing.

---

### Task 3.4: Add Correlation IDs (2 hours)

**Create middleware for request tracking:**

**File:** `server/src/middleware/correlation-id.ts`

```typescript
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // Add to logger context
  res.locals.logger = logger.child({ correlationId });

  next();
}
```

**Update all log statements to use correlation ID from context.**

---

### Task 3.5: Configure Connection Pooling (1 hour)

**File:** `server/src/di.ts`

**Current:**

```typescript
const prisma = new PrismaClient();
```

**Explicit Configuration:**

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log: config.nodeEnv === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  // Connection pool configuration
  // Supabase recommends: (num_physical_cpus * 2) + effective_spindle_count
  // For serverless: 1-5 connections per instance
});

// Connection pool monitoring
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected');
  }
});
```

**Add to `.env`:**

```bash
# Prisma connection pool (Supabase)
DATABASE_URL=postgresql://postgres:password@host:5432/db?connection_limit=5&pool_timeout=10
```

---

### Task 3.6: Update Documentation (1 hour)

**Fix claims in documentation:**

1. **PHASE_2B_COMPLETION_REPORT.md**
   - Line 12: Change "102 tests passing" → "103 tests passing"
   - Line 652: Update test count
   - Line 45: Change "95% production readiness" → "85% (revised after audit)"

2. **AGENT_2_REPORT.md**
   - Line 15: Remove "NO SECRETS WERE EXPOSED IN GIT HISTORY"
   - Add: "SECRETS WERE EXPOSED in documentation files (SECRETS_ROTATION.md, DEPLOYMENT_INSTRUCTIONS.md, AGENT_2_REPORT.md). Git history sanitization performed on 2025-10-29."

3. **SECRETS_ROTATION.md**
   - Remove ALL actual secret values
   - Replace with: `<SECRET_VALUE_REDACTED>`
   - Add note: "Actual values available in 1Password/secure vault"

4. **DEPLOYMENT_INSTRUCTIONS.md**
   - Remove actual Stripe keys
   - Replace with placeholders

---

## Verification Checklist

After completing all tasks, verify:

### Phase 1 Verification

- [ ] All secrets rotated (JWT, Stripe, Database, Supabase)
- [ ] Git history clean (no secrets found with `git log -p | grep "sk_test"`)
- [ ] Pre-commit hooks installed (`git secrets --list`)
- [ ] Team has re-cloned repository

### Phase 2 Verification

- [ ] Raw SQL error handling checks specific error codes
- [ ] Integration tests pass (103+ tests)
- [ ] AddOn prices captured correctly (not hardcoded 0)
- [ ] JWT algorithm specified (`HS256`)
- [ ] Bcrypt rounds increased to 12
- [ ] Admin password from environment
- [ ] Migration is idempotent

### Phase 3 Verification

- [ ] Webhook error handling improved
- [ ] Magic numbers extracted to constants
- [ ] Dead code removed (WebhookDuplicateError)
- [ ] Correlation IDs propagated
- [ ] Connection pooling configured
- [ ] Documentation updated (no false claims)

### Final Smoke Tests

```bash
# 1. TypeScript compiles
npm run typecheck

# 2. All tests pass
npm run test

# 3. Integration tests pass
npm run test:integration

# 4. Application starts
npm run dev

# 5. Health check
curl http://localhost:3001/health

# 6. Authentication works
curl -X POST http://localhost:3001/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<NEW_PASSWORD>"}'

# 7. Webhook endpoint responds
curl -X POST http://localhost:3001/api/v1/webhooks/stripe \
  -H "stripe-signature: test" \
  -d '{}'
# Should return 422 (invalid signature) - not 500
```

---

## Timeline Summary

| Phase   | Priority   | Duration    | Start      | End         |
| ------- | ---------- | ----------- | ---------- | ----------- |
| Phase 1 | P0 BLOCKER | 3 hours     | Day 1, 9am | Day 1, 12pm |
| Phase 2 | P1 HIGH    | 13-14 hours | Day 1, 1pm | Day 2, 3pm  |
| Phase 3 | P2 MEDIUM  | 5-6 hours   | Day 3, 9am | Day 3, 3pm  |

**Total Time:** 21-23 hours (3 days with focused effort)

---

## Support Resources

- **Master Audit Report:** `/Users/mikeyoung/CODING/Elope/MASTER_AUDIT_REPORT.md`
- **Individual Agent Reports:** `/Users/mikeyoung/CODING/Elope/AUDIT_*.md`
- **Architecture Documentation:** `/Users/mikeyoung/CODING/Elope/ARCHITECTURE.md`
- **Deployment Guide:** `/Users/mikeyoung/CODING/Elope/DEPLOYMENT_INSTRUCTIONS.md`

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Status:** Ready for execution
