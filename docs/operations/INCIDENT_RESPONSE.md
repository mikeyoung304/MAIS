# Incident Response Runbook

**MAIS - Macon AI Solutions Platform**
**Last Updated:** November 26, 2025
**Owner:** Operations Team
**Escalation:** support@maconaisolutions.com

---

## Overview

This runbook provides step-by-step incident response procedures for the MAIS business growth platform. Each section contains symptom identification, diagnostic steps, and resolution procedures.

**Emergency Contacts:**

- On-call Engineer: [Your on-call rotation]
- Database Admin: [Supabase support or internal DBA]
- Payment Provider: Stripe Support (https://support.stripe.com)

**Key Resources:**

- Production Dashboard: Supabase Dashboard (credentials in password manager)
- Stripe Dashboard: https://dashboard.stripe.com
- Application Logs: [Your logging service URL]

---

## Table of Contents

1. [API Down / 500 Errors](#1-api-down--500-errors)
2. [Failed Webhooks from Stripe](#2-failed-webhooks-from-stripe)
3. [Database Connection Loss](#3-database-connection-loss)
4. [Double-Booking Incident](#4-double-booking-incident)
5. [Memory Leaks / Performance Degradation](#5-memory-leaks--performance-degradation)
6. [Rollback Procedures](#6-rollback-procedures)
7. [Communication Templates](#7-communication-templates)

---

## 1. API Down / 500 Errors

### Symptoms

- Health check endpoint (`/health`) returns non-200 status
- Client applications receiving 500 Internal Server Error
- Increased error rate in monitoring dashboards
- Customer reports of booking failures

### Severity Levels

- **P0 (Critical):** Complete API outage, no requests succeeding
- **P1 (High):** >50% error rate, partial functionality impaired
- **P2 (Medium):** <50% error rate, isolated endpoint failures

### Diagnostic Steps

#### Step 1: Verify Service Status

```bash
# Check if API is responding
curl https://api.elope.example.com/health
# Expected: {"ok":true}

# Check readiness (config validation)
curl https://api.elope.example.com/ready
# Expected: {"ok":true,"mode":"real"}
```

#### Step 2: Check Application Logs

```bash
# View recent errors (adjust path to your deployment)
tail -n 100 /var/log/elope/api.log | grep ERROR

# Check for specific error patterns
grep "ECONNREFUSED" /var/log/elope/api.log  # Database connection
grep "ETIMEDOUT" /var/log/elope/api.log     # Timeout issues
grep "UnhandledPromiseRejection" /var/log/elope/api.log
```

**Common Error Patterns:**

- `ECONNREFUSED` → Database connection failure (see Section 3)
- `Stripe API error` → Payment provider issue
- `P2002` (Prisma) → Database constraint violation
- `ENOMEM` → Out of memory (see Section 5)

#### Step 3: Check Database Health

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

Or via Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir
2. Navigate to **Database** → **Monitoring**
3. Check active connections and query performance

#### Step 4: Check External Services

```bash
# Test Stripe API connectivity
curl https://api.stripe.com/v1/charges -u $STRIPE_SECRET_KEY:
# Should return 401 (confirms Stripe is reachable)

# Check DNS resolution
nslookup api.stripe.com
nslookup db.gpyvdknhmevcfdbgtqir.supabase.co
```

### Resolution Steps

#### Resolution 1: Service Restart (Quick Fix)

```bash
# For systemd-based deployments
sudo systemctl restart elope-api

# For PM2
pm2 restart elope-api

# For Docker
docker restart elope-api-container

# Verify health after restart
curl https://api.elope.example.com/health
```

#### Resolution 2: Check Environment Variables

```bash
# Verify all required variables are set
cd /path/to/elope/server
npm run doctor

# Common missing variables
echo $DATABASE_URL
echo $STRIPE_SECRET_KEY
echo $STRIPE_WEBHOOK_SECRET
echo $JWT_SECRET
```

If variables are missing:

```bash
# Restore from backup or secrets manager
cp /backup/.env.production /path/to/elope/server/.env

# Restart service
sudo systemctl restart elope-api
```

#### Resolution 3: Check Disk Space

```bash
# Check available disk space
df -h

# If disk is full, clear logs
sudo journalctl --vacuum-time=7d
rm /var/log/elope/*.log.old
```

#### Resolution 4: Scale Resources

If under heavy load:

```bash
# Increase process count (PM2)
pm2 scale elope-api +2

# Or adjust systemd limits
sudo systemctl edit elope-api
# Add: LimitNOFILE=65536

# Restart
sudo systemctl restart elope-api
```

### Rollback Procedure

If recent deployment caused the issue:

```bash
# Revert to previous Docker image
docker pull elope/api:v1.2.3  # Previous stable version
docker stop elope-api-container
docker rm elope-api-container
docker run -d --name elope-api-container elope/api:v1.2.3

# Or revert Git commit
git revert HEAD
npm run build
npm run start
```

See [Section 6: Rollback Procedures](#6-rollback-procedures) for detailed steps.

### Prevention

- Set up automated health checks (every 60 seconds)
- Configure alerting for >5% error rate
- Implement circuit breakers for external API calls
- Monitor disk space and set alerts at 80% usage

---

## 2. Failed Webhooks from Stripe

### Symptoms

- Customers report payment succeeded but no booking confirmation
- Stripe dashboard shows failed webhook deliveries
- `WebhookEvent` table has rows with `status='FAILED'`
- Application logs show webhook processing errors

### Severity Levels

- **P1 (High):** Payment collected but booking not created (revenue at risk)
- **P2 (Medium):** Webhook failures with successful retries

### Diagnostic Steps

#### Step 1: Check Stripe Dashboard

1. Go to https://dashboard.stripe.com
2. Navigate to **Developers** → **Webhooks**
3. Click on your webhook endpoint
4. Check **Recent deliveries** for failed events
5. Note the Event IDs that failed

#### Step 2: Query WebhookEvent Table

```sql
-- Connect to database
psql $DATABASE_URL

-- Find failed webhooks
SELECT
  "eventId",
  "eventType",
  "status",
  "attempts",
  "lastError",
  "createdAt"
FROM "WebhookEvent"
WHERE status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 20;

-- Check specific event
SELECT * FROM "WebhookEvent"
WHERE "eventId" = 'evt_1234567890';
```

#### Step 3: Check Application Logs

```bash
# Search for webhook errors
grep "Webhook processing failed" /var/log/elope/api.log

# Check for specific error types
grep "BookingConflictError" /var/log/elope/api.log  # Double-booking
grep "WebhookValidationError" /var/log/elope/api.log  # Invalid payload
grep "DatabaseError" /var/log/elope/api.log  # Database issues
```

#### Step 4: Verify Webhook Signature Secret

```bash
# Check if webhook secret is set correctly
echo $STRIPE_WEBHOOK_SECRET
# Should start with: whsec_...

# Test webhook signature verification (from Stripe CLI)
stripe listen --forward-to localhost:3001/v1/webhooks/stripe
```

### Resolution Steps

#### Resolution 1: Manual Webhook Replay (Stripe Dashboard)

For recent failed webhooks (within 7 days):

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Find the failed webhook event
3. Click **Send test webhook**
4. Select the same event type (`checkout.session.completed`)
5. Verify booking was created in database

#### Resolution 2: Manual Webhook Replay (Stripe CLI)

```bash
# Install Stripe CLI if not present
brew install stripe/stripe-cli/stripe
stripe login

# Replay specific event
stripe events resend evt_1234567890

# Monitor webhook endpoint
stripe listen --forward-to https://api.elope.example.com/v1/webhooks/stripe
```

#### Resolution 3: Process Stuck Booking Manually

If webhook cannot be replayed, create booking manually:

```sql
-- 1. Find the Stripe session ID from failed webhook
SELECT "rawPayload"::json->'data'->'object'->>'id' as session_id,
       "rawPayload"::json->'data'->'object'->'metadata' as metadata
FROM "WebhookEvent"
WHERE "eventId" = 'evt_1234567890';

-- 2. Extract metadata (note the values)
-- packageId, eventDate, email, coupleName, addOnIds, amount_total

-- 3. Create Customer record
INSERT INTO "Customer" (id, email, name, "createdAt", "updatedAt")
VALUES (
  'cus_' || gen_random_uuid()::text,
  'customer@example.com',  -- From metadata
  'Customer Name',          -- From coupleName
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET "updatedAt" = NOW()
RETURNING id;

-- 4. Create Booking record (use customer id from above)
INSERT INTO "Booking" (
  id,
  "customerId",
  "packageId",
  date,
  status,
  "totalPrice",
  "createdAt",
  "updatedAt"
)
VALUES (
  'booking_' || gen_random_uuid()::text,
  'cus_abc123',              -- Customer ID from step 3
  'pkg_classic',             -- From metadata
  '2025-12-20'::date,        -- From metadata eventDate
  'CONFIRMED',
  350000,                    -- From amount_total (in cents)
  NOW(),
  NOW()
);

-- 5. Create Payment record
INSERT INTO "Payment" (
  id,
  "bookingId",
  amount,
  currency,
  status,
  processor,
  "processorId",
  "createdAt"
)
VALUES (
  'payment_' || gen_random_uuid()::text,
  'booking_abc123',          -- Booking ID from step 4
  350000,                    -- Same as totalPrice
  'USD',
  'CAPTURED',
  'stripe',
  'cs_test_1234567890',      -- Stripe session ID
  NOW()
);

-- 6. Mark webhook as processed
UPDATE "WebhookEvent"
SET status = 'PROCESSED', "processedAt" = NOW()
WHERE "eventId" = 'evt_1234567890';
```

#### Resolution 4: Send Confirmation Email Manually

If booking was created but email failed:

```bash
# Method 1: Trigger email via API (if available)
curl -X POST https://api.elope.example.com/v1/admin/bookings/booking_abc123/resend-confirmation \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Method 2: Use email template
# Edit server/tmp/emails/manual-confirmation.eml with booking details
# Send via your email client or SMTP
```

Or via Postmark dashboard:

1. Go to Postmark dashboard
2. Navigate to **Templates**
3. Find booking confirmation template
4. Send test with customer data

### Prevention

- Monitor webhook failure rate in Stripe dashboard
- Set up alerts for >5 failed webhooks per hour
- Implement automatic retry mechanism (Stripe retries up to 3 days)
- Add dead-letter queue for permanently failed webhooks
- Log all webhook payloads for debugging

### Customer Communication Template

See [Section 7: Communication Templates](#customer-booking-manual-recovery)

---

## 3. Database Connection Loss

### Symptoms

- Application logs show `ECONNREFUSED` or `ETIMEDOUT` errors
- Health check passes but readiness fails
- Intermittent 500 errors during database queries
- Prisma logs: "Can't reach database server"

### Severity Levels

- **P0 (Critical):** Complete database connectivity loss
- **P1 (High):** Intermittent connection failures >20%
- **P2 (Medium):** Connection pool exhaustion

### Diagnostic Steps

#### Step 1: Check Database Reachability

```bash
# Test basic connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check if Supabase project is paused
# Go to: https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir

# Test from application server
curl https://db.gpyvdknhmevcfdbgtqir.supabase.co:5432
# Should see: connection refused (expected for raw TCP)

# Check DNS resolution
nslookup db.gpyvdknhmevcfdbgtqir.supabase.co
```

#### Step 2: Check Connection Pool Status

```sql
-- View active connections
SELECT
  count(*) as total_connections,
  state,
  wait_event_type
FROM pg_stat_activity
GROUP BY state, wait_event_type
ORDER BY total_connections DESC;

-- Check connection limits
SELECT
  setting::int as max_connections,
  (SELECT count(*) FROM pg_stat_activity) as current_connections
FROM pg_settings
WHERE name = 'max_connections';

-- Find long-running queries
SELECT
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 minutes'
ORDER BY duration DESC;
```

#### Step 3: Check Application Connection Pool

```bash
# Check Prisma connection pool settings in logs
grep "Prisma" /var/log/elope/api.log | grep "connection"

# Verify DATABASE_URL connection limit parameter
echo $DATABASE_URL | grep "connection_limit"
# Should see: ?connection_limit=10 or similar
```

#### Step 4: Check Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir
2. Navigate to **Database** → **Monitoring**
3. Check:
   - Active connections graph
   - CPU usage
   - Memory usage
   - Disk I/O

### Resolution Steps

#### Resolution 1: Restart Application (Connection Pool Reset)

```bash
# Restart application to reset connection pool
sudo systemctl restart elope-api

# Or for Docker
docker restart elope-api-container

# Verify connections dropped
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%prisma%';"
```

#### Resolution 2: Kill Idle Connections

```sql
-- Identify idle connections older than 30 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '30 minutes'
  AND pid != pg_backend_pid();

-- Verify connections freed
SELECT count(*) FROM pg_stat_activity;
```

#### Resolution 3: Resume Supabase Project (If Paused)

1. Go to Supabase Dashboard
2. Click **Resume Project** if paused
3. Wait 2-3 minutes for database to come online
4. Test connection: `psql $DATABASE_URL -c "SELECT 1;"`
5. Restart application

#### Resolution 4: Increase Connection Pool Limit

```bash
# Edit DATABASE_URL to increase connection limit
# Before: postgresql://...?connection_limit=10
# After:  postgresql://...?connection_limit=20

# Update environment variable
export DATABASE_URL="postgresql://postgres:password@host:5432/db?connection_limit=20"

# Or edit .env file
vi /path/to/elope/server/.env

# Restart application
sudo systemctl restart elope-api
```

#### Resolution 5: Scale Database (Supabase)

If free tier limits are hit:

1. Go to Supabase Dashboard → **Settings** → **Billing**
2. Upgrade to Pro plan (100 → 500 connection limit)
3. Adjust connection pool settings in DATABASE_URL
4. Restart application

### Connection Pool Exhaustion Recovery

```bash
# 1. Force disconnect all application connections
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'postgres'
    AND pid != pg_backend_pid()
    AND usename = 'postgres';
"

# 2. Restart application with lower connection limit
export DATABASE_URL="postgresql://...?connection_limit=5"
sudo systemctl restart elope-api

# 3. Monitor connection usage
watch -n 5 'psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"'

# 4. Gradually increase connection limit as needed
```

### Prevention

- Set connection pool limit appropriate for database tier (5-10 for free tier)
- Implement connection pool monitoring
- Set alerts for >80% connection pool usage
- Use `prisma.$disconnect()` in graceful shutdown
- Configure proper connection timeout values
- Consider database upgrade for higher limits

---

## 4. Double-Booking Incident

### Symptoms

- Two bookings exist for the same date
- Customer A reports receiving confirmation for a date
- Customer B also reports booking the same date
- Database shows duplicate `Booking.date` values (violates UNIQUE constraint)

### Severity Levels

- **P0 (Critical):** Confirmed double-booking with paying customers
- **P1 (High):** Suspected race condition, needs immediate verification

**IMPORTANT:** This is a wedding business. Double-booking is catastrophic. Handle with maximum urgency and customer care.

### Diagnostic Steps

#### Step 1: Verify Double-Booking

```sql
-- Check for duplicate dates
SELECT date, count(*) as booking_count
FROM "Booking"
WHERE status != 'CANCELED'
GROUP BY date
HAVING count(*) > 1;

-- Get details of double-booked dates
SELECT
  b.id,
  b.date,
  b."createdAt",
  c.email,
  c.name as customer_name,
  p.name as package_name,
  b."totalPrice"
FROM "Booking" b
JOIN "Customer" c ON b."customerId" = c.id
JOIN "Package" p ON b."packageId" = p.id
WHERE b.date = '2025-12-20'  -- Replace with double-booked date
  AND b.status != 'CANCELED'
ORDER BY b."createdAt";
```

#### Step 2: Investigation - Check Race Condition Logs

```bash
# Search for concurrent booking attempts
grep "2025-12-20" /var/log/elope/api.log | grep "checkout"

# Look for lock timeout errors
grep "BookingLockTimeoutError" /var/log/elope/api.log

# Check webhook processing logs
grep "checkout.session.completed" /var/log/elope/api.log | grep "2025-12-20"

# Find timestamps of both bookings
grep "Booking created successfully" /var/log/elope/api.log | grep "2025-12-20"
```

#### Step 3: Check Database Constraint Status

```sql
-- Verify UNIQUE constraint exists on Booking.date
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'Booking'::regclass
  AND contype = 'u';  -- unique constraint

-- Should see: UNIQUE (date)
```

If constraint is missing:

```sql
-- This is critical - constraint should exist!
-- Check if it was accidentally dropped:
SELECT * FROM pg_constraint WHERE conname LIKE '%Booking%date%';
```

#### Step 4: Check Payment Records

```sql
-- Verify both customers paid
SELECT
  p.id,
  p."bookingId",
  p.amount,
  p.status,
  p."processorId",
  p."createdAt",
  b.date
FROM "Payment" p
JOIN "Booking" b ON p."bookingId" = b.id
WHERE b.date = '2025-12-20'  -- Replace with double-booked date
ORDER BY p."createdAt";
```

### Resolution Steps

#### Resolution 1: Immediate Customer Communication

**DO THIS FIRST before technical resolution**

1. Identify which booking came second
2. Contact customer of second booking IMMEDIATELY by phone
3. Apologize profusely and explain the system error
4. Offer alternative dates OR full refund + compensation
5. Document conversation

Use template: [Customer Double-Booking Apology](#customer-double-booking-apology)

#### Resolution 2: Determine Which Booking to Keep

Decision criteria (in order):

1. **First payment completed** (check `Payment.createdAt`)
2. **First booking created** (check `Booking.createdAt`)
3. **Customer preference** (if timestamps are within seconds)

```sql
-- Determine first booking by payment timestamp
SELECT
  b.id as booking_id,
  b."createdAt" as booking_created,
  p."createdAt" as payment_created,
  c.email,
  c.name
FROM "Booking" b
JOIN "Payment" p ON p."bookingId" = b.id
JOIN "Customer" c ON b."customerId" = c.id
WHERE b.date = '2025-12-20'
ORDER BY p."createdAt" ASC
LIMIT 1;

-- This is the booking to KEEP ^^^^
```

#### Resolution 3: Cancel Second Booking

```sql
-- Start transaction for safety
BEGIN;

-- Cancel second booking (replace with actual ID)
UPDATE "Booking"
SET status = 'CANCELED', notes = 'CANCELED due to double-booking system error (see incident log)'
WHERE id = 'booking_second_id';

-- Mark payment as refunded (if refund issued)
UPDATE "Payment"
SET status = 'CANCELED'
WHERE "bookingId" = 'booking_second_id';

-- Verify only one active booking remains
SELECT count(*) FROM "Booking"
WHERE date = '2025-12-20' AND status != 'CANCELED';
-- Should return: 1

COMMIT;
```

#### Resolution 4: Issue Refund via Stripe

```bash
# Option 1: Via Stripe Dashboard
# 1. Go to https://dashboard.stripe.com/payments
# 2. Search for payment using customer email
# 3. Click "Refund" and enter full amount
# 4. Add reason: "System error - double booking"

# Option 2: Via Stripe CLI
stripe refunds create \
  --charge=ch_1234567890 \
  --amount=350000 \
  --reason=requested_by_customer \
  --metadata[reason]="double-booking-system-error"

# Option 3: Via API (if available)
curl -X POST https://api.elope.example.com/v1/admin/payments/payment_id/refund \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "double-booking system error"}'
```

#### Resolution 5: Offer Compensation

For affected customer:

- Full refund (processed above)
- $500 discount on rescheduled date
- Complimentary add-on (e.g., photographer, bouquet)
- Gift certificate for related services

Document compensation in:

```sql
UPDATE "Booking"
SET notes = 'CANCELED - double-booking error. Customer offered: full refund + $500 credit + free photographer. Follow-up: 2025-10-31'
WHERE id = 'booking_second_id';
```

### Root Cause Analysis

#### Investigate Race Condition

1. Check application logs for concurrent webhook processing
2. Verify pessimistic locking is enabled (see `ARCHITECTURE.md` ADR-001)
3. Check database transaction isolation level

```sql
-- Check current transaction isolation level
SHOW default_transaction_isolation;
-- Should be: read committed
```

#### Code Review Checklist

Verify the following in `server/src/services/booking.service.ts`:

- [ ] Transaction wraps availability check + booking creation
- [ ] `SELECT ... FOR UPDATE` lock is used
- [ ] Constraint violation is caught (P2002 error)
- [ ] Lock timeout is configured (prevent deadlocks)

#### Review in `server/src/adapters/prisma/booking.repository.ts`:

```typescript
// Verify this pattern exists:
await prisma.$transaction(async (tx) => {
  const existing = await tx.$queryRaw`
    SELECT id FROM "Booking"
    WHERE date = ${date}
    FOR UPDATE
  `;

  if (existing.length > 0) {
    throw new BookingConflictError(date);
  }

  await tx.booking.create({ data: { ... } });
});
```

### Prevention

#### Immediate Actions

1. Verify UNIQUE constraint exists on `Booking.date`
2. Verify pessimistic locking code is deployed
3. Add integration test for race condition
4. Enable detailed webhook logging

#### Short-term Improvements

```sql
-- Add additional constraint for safety
ALTER TABLE "Booking"
ADD CONSTRAINT "check_active_booking_per_date"
EXCLUDE USING gist (
  date WITH =,
  status WITH =
)
WHERE (status != 'CANCELED');
```

#### Long-term Improvements

- Implement distributed locking (Redis) for multi-server deployments
- Add real-time availability check before payment
- Implement booking reservation system (hold date for 15 min)
- Add automated double-booking detection monitor
- Set up alerts for constraint violations

---

## 5. Memory Leaks / Performance Degradation

### Symptoms

- Gradually increasing response times over hours/days
- API becomes unresponsive
- Server memory usage climbing continuously
- Out of memory errors in logs: `ENOMEM`, `JavaScript heap out of memory`
- Process crashes with OOM (Out of Memory) killer

### Severity Levels

- **P1 (High):** Service degradation, response times >5 seconds
- **P2 (Medium):** Memory usage >80%, pre-emptive action needed

### Diagnostic Steps

#### Step 1: Check Current Memory Usage

```bash
# Check process memory
ps aux | grep node | grep elope

# Or for Docker
docker stats elope-api-container

# Check system memory
free -h

# Check Node.js heap usage (if exposed via metrics endpoint)
curl https://api.elope.example.com/metrics
```

#### Step 2: Capture Heap Snapshot (Node.js)

```bash
# Send SIGUSR2 to trigger heap dump (if configured)
kill -USR2 $(pgrep -f "node.*elope")

# Or use Node.js inspector
node --inspect=9229 dist/index.js &
chrome://inspect  # Connect and capture heap snapshot

# Or install heapdump package and trigger programmatically
npm install heapdump
```

#### Step 3: Check for Resource Leaks

```bash
# Check open file descriptors
lsof -p $(pgrep -f "node.*elope") | wc -l

# Check database connections
psql $DATABASE_URL -c "
  SELECT count(*), state, application_name
  FROM pg_stat_activity
  WHERE application_name LIKE '%prisma%'
  GROUP BY state, application_name;
"

# Check for event listener leaks in logs
grep "MaxListenersExceeded" /var/log/elope/api.log
```

#### Step 4: Review Recent Code Changes

```bash
# Check recent deployments
git log --oneline -10

# Look for suspicious patterns:
# - New global variables
# - Event listeners not cleaned up
# - Cached data structures growing unbounded
# - Missing prisma.$disconnect()
```

### Resolution Steps

#### Resolution 1: Immediate Service Restart

```bash
# Quick fix to restore service
sudo systemctl restart elope-api

# Or Docker
docker restart elope-api-container

# Monitor memory after restart
watch -n 5 'ps aux | grep node | grep elope'
```

#### Resolution 2: Increase Memory Limit (Temporary)

```bash
# For Node.js process (systemd)
sudo systemctl edit elope-api
# Add:
[Service]
Environment="NODE_OPTIONS=--max-old-space-size=4096"

# Or in package.json
"start": "node --max-old-space-size=4096 dist/index.js"

# Restart
sudo systemctl restart elope-api
```

#### Resolution 3: Enable Garbage Collection Logging

```bash
# Start with GC logging to diagnose
node --expose-gc --trace-gc dist/index.js > gc.log 2>&1

# Or add to systemd service
Environment="NODE_OPTIONS=--trace-gc --trace-gc-verbose"
```

#### Resolution 4: Implement Graceful Restarts

```bash
# Setup automated restart when memory threshold hit (PM2)
pm2 start dist/index.js --name elope-api --max-memory-restart 1G

# Or use systemd watchdog
[Service]
Restart=on-failure
RestartSec=10s
```

### Memory Leak Identification

#### Common Causes in MAIS Codebase

**1. Database Connection Leaks**

```typescript
// BAD - connection leak
async function badQuery() {
  const prisma = new PrismaClient(); // New client every time!
  return await prisma.booking.findMany();
  // Missing: prisma.$disconnect()
}

// GOOD - singleton client
const prisma = new PrismaClient();
async function goodQuery() {
  return await prisma.booking.findMany();
}
```

**2. Event Listener Leaks**

```typescript
// BAD - listener never removed
eventEmitter.on('BookingPaid', handler);

// GOOD - remove listener
const listener = () => { ... };
eventEmitter.on('BookingPaid', listener);
// Later:
eventEmitter.removeListener('BookingPaid', listener);
```

**3. Global Cache Growth**

```typescript
// BAD - cache grows unbounded
const cache: Record<string, any> = {};
function getCached(key: string) {
  if (!cache[key]) {
    cache[key] = expensiveOperation(); // Never evicted!
  }
  return cache[key];
}

// GOOD - LRU cache with max size
import LRU from 'lru-cache';
const cache = new LRU({ max: 500 });
```

#### Analysis Steps

```bash
# 1. Take heap snapshot at startup
curl http://localhost:9229/json/list
# Use Chrome DevTools to capture baseline

# 2. Run load test
artillery quick --count 100 --num 10 https://api.elope.example.com/v1/packages

# 3. Take another heap snapshot
# Compare in Chrome DevTools:
# - Look for objects with increasing retention
# - Check "Comparison" view between snapshots
# - Focus on: Arrays, Closures, EventEmitters

# 4. Check specific areas:
# - Prisma client instances
# - Event listeners
# - HTTP agent connections
# - Cache objects
```

### Performance Monitoring Setup

#### Metrics to Track

```bash
# Create monitoring script: /opt/elope/monitor-memory.sh
#!/bin/bash
while true; do
  echo "$(date): $(ps aux | grep 'node.*elope' | awk '{print $6}') KB"
  sleep 60
done >> /var/log/elope/memory.log

# Run as systemd service or cron job
```

#### Set Up Alerts

Configure alerts for:

- Memory usage >1GB (warning)
- Memory usage >1.5GB (critical)
- Response time >3 seconds (warning)
- Error rate >5% (critical)

### Prevention

- Code review checklist: Check for resource cleanup
- Add memory usage tests in CI/CD
- Implement health check with memory metrics
- Use heap snapshot diffing in staging
- Set up APM tool (e.g., New Relic, DataDog)
- Schedule periodic restarts (e.g., daily at 3 AM UTC)

---

## 6. Rollback Procedures

### When to Rollback

- New deployment causes P0/P1 incident
- Error rate >20% after deployment
- Data corruption detected
- Security vulnerability introduced

### Types of Rollbacks

#### A. Application Code Rollback

**Method 1: Docker Image Rollback**

```bash
# 1. Identify current and previous versions
docker images elope/api

# 2. Stop current container
docker stop elope-api-container
docker rm elope-api-container

# 3. Start previous version
docker run -d \
  --name elope-api-container \
  --env-file /path/to/.env \
  -p 3001:3001 \
  elope/api:v1.2.3  # Previous stable version

# 4. Verify health
curl https://api.elope.example.com/health

# 5. Monitor logs
docker logs -f elope-api-container
```

**Method 2: Git Revert**

```bash
# 1. Identify problematic commit
git log --oneline -10

# 2. Revert (preferred - keeps history)
git revert abc1234

# Or reset (dangerous - rewrites history)
git reset --hard HEAD~1

# 3. Rebuild and deploy
npm install
npm run build
sudo systemctl restart elope-api

# 4. Verify
curl https://api.elope.example.com/ready
```

**Method 3: Symbolic Link Switch (Zero-Downtime)**

```bash
# Setup:
# /opt/elope/releases/v1.2.3/
# /opt/elope/releases/v1.2.4/
# /opt/elope/current -> v1.2.4

# Rollback:
cd /opt/elope
ln -sfn releases/v1.2.3 current
sudo systemctl restart elope-api

# Verify
curl https://api.elope.example.com/health
```

#### B. Database Migration Rollback

**Method 1: Prisma Migrate Rollback**

```bash
# WARNING: This can cause data loss!
# Always backup first

# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Check migration history
cd server
npx prisma migrate status

# 3. Rollback last migration (MANUAL)
# Prisma doesn't support automatic rollback
# You must write and run a DOWN migration

# Example: Rollback added column
psql $DATABASE_URL -c '
  ALTER TABLE "Booking" DROP COLUMN IF EXISTS "newColumn";
'

# 4. Mark migration as rolled back
# Delete from _prisma_migrations table
psql $DATABASE_URL -c "
  DELETE FROM _prisma_migrations
  WHERE migration_name = '20251031120000_add_new_column';
"
```

**Method 2: Manual SQL Rollback**

```bash
# 1. Backup database (CRITICAL)
pg_dump $DATABASE_URL > backup_before_rollback.sql

# 2. Prepare rollback script
cat > rollback_migration.sql << 'EOF'
BEGIN;

-- Reverse the changes (example)
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "newField";
DROP INDEX IF EXISTS "idx_booking_newField";

-- Verify changes
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Booking';

COMMIT;
EOF

# 3. Test in transaction first
psql $DATABASE_URL -f rollback_migration.sql

# 4. Verify application works
npm run test
curl https://api.elope.example.com/health
```

**Method 3: Restore from Backup**

```bash
# NUCLEAR OPTION - Use when migrations are severely broken

# 1. Get list of backups (Supabase)
# Go to: https://supabase.com/dashboard/project/gpyvdknhmevcfdbgtqir
# Navigate: Database → Backups

# 2. Restore from backup (via Supabase dashboard)
# Click restore on the backup before migration

# 3. Or restore from manual backup
# WARNING: This will ERASE all data after backup!
psql $DATABASE_URL < backup_20251031_120000.sql

# 4. Regenerate Prisma client
cd server
npx prisma generate

# 5. Restart application
sudo systemctl restart elope-api
```

#### C. Environment Variable Rollback

```bash
# 1. Backup current .env
cp /path/to/elope/server/.env /path/to/elope/server/.env.backup_$(date +%Y%m%d)

# 2. Restore previous .env
cp /path/to/backups/.env.20251030 /path/to/elope/server/.env

# Or restore from secrets manager
# AWS Secrets Manager:
aws secretsmanager get-secret-value \
  --secret-id elope/production/env \
  --version-stage AWSPREVIOUS \
  --query SecretString \
  --output text > /path/to/elope/server/.env

# 3. Verify changes
diff /path/to/elope/server/.env /path/to/elope/server/.env.backup_*

# 4. Restart application
sudo systemctl restart elope-api

# 5. Verify
npm run doctor
curl https://api.elope.example.com/ready
```

#### D. External Service Rollback

**Stripe API Version Rollback**

```bash
# Stripe API versions are pinned in code
# Rollback by reverting code to previous version

# Check current Stripe API version
grep "stripe" server/package.json

# Downgrade Stripe SDK
cd server
npm install stripe@12.0.0  # Previous version

# Rebuild and restart
npm run build
sudo systemctl restart elope-api
```

**Webhook Endpoint Rollback**

```bash
# If webhook changes broke processing

# Option 1: Update webhook endpoint in Stripe dashboard
# 1. Go to: https://dashboard.stripe.com/webhooks
# 2. Edit webhook endpoint
# 3. Change URL to previous version endpoint
# 4. Save

# Option 2: Re-deploy previous endpoint code
# (See Application Code Rollback above)
```

### Rollback Verification Checklist

After ANY rollback:

- [ ] `/health` endpoint returns 200 OK
- [ ] `/ready` endpoint returns `{"ok":true}`
- [ ] Test booking flow end-to-end
- [ ] Check database connectivity
- [ ] Verify Stripe webhooks processing
- [ ] Review error logs (no new errors)
- [ ] Monitor for 30 minutes post-rollback
- [ ] Update incident log
- [ ] Notify team of rollback

### Post-Rollback Actions

```bash
# 1. Document what was rolled back
cat >> /var/log/elope/rollbacks.log << EOF
$(date): Rolled back deployment v1.2.4 to v1.2.3
Reason: High error rate (35%) on booking creation
Severity: P1
Performed by: [Engineer Name]
EOF

# 2. Investigate root cause
# - Review diff: git diff v1.2.3 v1.2.4
# - Check breaking changes
# - Add tests to prevent regression

# 3. Update runbook if needed
# - Document new failure scenario
# - Update rollback procedures
# - Add monitoring/alerts

# 4. Schedule post-mortem
# - Invite: Engineering, Product, Operations
# - Timeline reconstruction
# - Root cause analysis
# - Action items with owners
```

---

## 7. Communication Templates

### Customer: Booking Manual Recovery

**Subject:** Your MAIS Wedding Booking - Action Required

```
Dear [Customer Name],

We're reaching out regarding your wedding booking for [Event Date].

Due to a temporary technical issue with our payment processing system, your payment was successfully processed through Stripe, but we need to manually confirm some details to complete your booking.

Your booking details:
- Date: [Event Date]
- Package: [Package Name]
- Total: $[Amount]
- Payment Status: CONFIRMED ✓

What we need from you:
- Please reply to confirm the following details are correct:
  - Your name(s): [Couple Name]
  - Contact email: [Email]
  - Phone: [Phone]

Once we receive your confirmation, we'll send your official booking confirmation and calendar invitation within 1 business hour.

We sincerely apologize for this inconvenience. As a thank-you for your patience, we're including [compensation - e.g., "a complimentary floral bouquet" / "$100 credit toward add-ons"].

If you have any questions, please call us directly at [Phone Number] or reply to this email.

Best regards,
[Your Name]
MAIS Customer Care
[Contact Information]
```

---

### Customer: Double-Booking Apology

**PHONE CALL SCRIPT** (Use this before email)

```
"Hello [Customer Name], this is [Your Name] from MAIS. I'm calling about your wedding booking.

I need to inform you of a serious error on our part. Due to a technical issue, we accidentally double-booked the date you selected [Event Date]. I am deeply, deeply sorry for this.

Your payment was successfully processed, but we cannot fulfill your booking on this date as another couple's booking was confirmed moments before yours.

Here's what we're doing to make this right:

1. Full refund processed immediately (you'll see it in 5-7 business days)
2. $500 discount on any rescheduled date within the next 12 months
3. [Complimentary add-on - e.g., professional photography package worth $800]
4. Priority booking - you choose your new date first

I understand this is incredibly frustrating and disappointing. This is entirely our fault, and we take full responsibility.

Can we schedule a call tomorrow to discuss alternative dates that work for you?"

[Listen to customer response]

"Again, I cannot apologize enough. I'll follow up via email within the next hour with all the details in writing. Is there anything else I can answer right now?"
```

**FOLLOW-UP EMAIL**

**Subject:** Regarding Your MAIS Booking - Our Sincere Apology

```
Dear [Customer Name],

Thank you for speaking with me today. I'm writing to follow up on our conversation regarding the double-booking of [Event Date].

I want to reiterate: this was entirely our fault due to a technical error in our booking system, and we take full responsibility.

What we're doing immediately:
✓ Full refund: $[Amount] (processed today, will appear in 5-7 business days)
✓ Your payment details: Stripe Transaction ID [Transaction ID]

What we're offering as compensation:
✓ $500 discount on any rescheduled date within the next 12 months
✓ Complimentary [Add-on Name] (valued at $[Amount])
✓ Priority booking status for your preferred new date

Next steps:
1. Please review our available dates: [Link to availability calendar]
2. Reply with your top 3 preferred alternative dates
3. We'll confirm within 24 hours and send your new booking confirmation

We've taken immediate action to fix the technical issue that caused this, and we've implemented additional safeguards to ensure it never happens again.

I understand if you choose not to reschedule with us. However, I genuinely hope we can earn back your trust and be part of your special day.

Please call me directly at [Direct Phone] if you have any questions or concerns.

Our deepest apologies,
[Your Name]
[Title]
MAIS
[Direct Contact Information]
```

---

### Internal: Incident Notification

**Subject:** [P0/P1/P2] Production Incident - [Brief Description]

```
Incident Details:
- Severity: P0 (Critical)
- Status: INVESTIGATING / MITIGATED / RESOLVED
- Started: 2025-10-31 14:32 UTC
- Duration: [Ongoing / 15 minutes]
- Affected Users: ~50 customers unable to complete bookings

Summary:
[2-3 sentence description of what's happening]

Impact:
- Customer Impact: Unable to complete checkout process
- Revenue Impact: Estimated $X,XXX in lost bookings
- Data Impact: None / [describe if applicable]

Current Status:
- [Action 1]: In progress
- [Action 2]: Completed at 14:45 UTC
- Root Cause: Under investigation

Next Update: [Time]

War Room: [Slack/Teams Channel]
Incident Commander: [Name]

---
[Your Name] - [Timestamp]
```

---

### Status Page Update (If Available)

**Investigating:**

```
We are investigating reports of intermittent issues with booking checkout.
Payments are not being processed during this time.
Posted: Oct 31, 14:32 UTC
```

**Identified:**

```
We have identified a database connectivity issue affecting booking creation.
Our engineering team is working on a fix.
Posted: Oct 31, 14:45 UTC
```

**Monitoring:**

```
A fix has been deployed. We are monitoring the system for stability.
Booking functionality has been restored.
Posted: Oct 31, 15:10 UTC
```

**Resolved:**

```
The issue has been fully resolved. All systems are operating normally.
Total duration: 38 minutes.
Affected bookings have been processed manually.
Posted: Oct 31, 15:30 UTC
```

---

## Appendix

### Quick Reference: Common Commands

```bash
# Health Checks
curl https://api.elope.example.com/health
curl https://api.elope.example.com/ready

# Restart Service
sudo systemctl restart elope-api         # systemd
pm2 restart elope-api                    # PM2
docker restart elope-api-container       # Docker

# View Logs
tail -f /var/log/elope/api.log          # File logs
journalctl -u elope-api -f              # systemd logs
docker logs -f elope-api-container      # Docker logs

# Database
psql $DATABASE_URL                       # Connect
psql $DATABASE_URL -c "SELECT 1;"       # Quick test

# Prisma
npx prisma migrate status                # Check migrations
npx prisma generate                      # Regenerate client

# Environment
npm run doctor                           # Validate config
cat /path/to/.env | grep -v "^#"        # Show config (hide comments)
```

### Key File Locations

```
/path/to/elope/
├── server/
│   ├── .env                    # Environment variables
│   ├── src/                    # Source code
│   ├── prisma/                 # Database schema & migrations
│   └── tmp/emails/             # Email file sink (dev mode)
├── client/                     # Web application
└── docs/                       # Documentation
    ├── ARCHITECTURE.md         # System architecture
    ├── RUNBOOK.md             # Operational procedures
    └── INCIDENT_RESPONSE.md   # This document
```

### Escalation Contacts

| Role             | Contact       | Responsibility                      |
| ---------------- | ------------- | ----------------------------------- |
| On-Call Engineer | [Phone/Slack] | First responder                     |
| Engineering Lead | [Phone/Slack] | P0/P1 escalation                    |
| Database Admin   | [Contact]     | Database issues                     |
| Product Owner    | [Contact]     | Customer communication              |
| CEO/Founder      | [Contact]     | Business decisions (double-booking) |

---

## Post-Incident Review Template

After resolving a P0/P1 incident, complete this template:

### Incident Summary

- **Date:** 2025-10-31
- **Duration:** 38 minutes
- **Severity:** P0
- **Detection:** Customer report / Monitoring alert
- **Time to Detect:** 5 minutes
- **Time to Resolve:** 33 minutes

### Timeline

```
14:32 UTC - Customer reports checkout failing
14:35 UTC - Monitoring alert fired (error rate >10%)
14:37 UTC - On-call engineer begins investigation
14:45 UTC - Root cause identified: database connection pool exhausted
14:50 UTC - Fix deployed: increased connection limit
14:55 UTC - Service restored
15:10 UTC - Monitoring confirms stability
15:30 UTC - Incident closed
```

### Root Cause

[Technical explanation of what caused the incident]

### Resolution

[What actions were taken to resolve the incident]

### Impact

- **Customers Affected:** ~50
- **Revenue Impact:** ~$15,000 in delayed bookings
- **Data Loss:** None
- **SLA Breach:** Yes (99.9% uptime target)

### What Went Well

- Fast detection via monitoring
- Clear runbook procedures followed
- Effective communication with customers

### What Went Wrong

- Connection pool limit too low
- No alerting for connection pool usage
- Delayed customer notification (15 min)

### Action Items

| Action                               | Owner       | Due Date   | Priority |
| ------------------------------------ | ----------- | ---------- | -------- |
| Increase connection pool limit to 20 | Engineering | 2025-11-01 | P0       |
| Add connection pool usage alerts     | DevOps      | 2025-11-03 | P1       |
| Update customer communication SLA    | Support     | 2025-11-05 | P2       |
| Load test with 2x traffic            | QA          | 2025-11-07 | P2       |

---

**Document Version:** 1.0
**Last Reviewed:** October 31, 2025
**Next Review:** January 31, 2026 or after next major incident
