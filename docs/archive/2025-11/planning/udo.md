# UDO - User Do Outside (Actions Required Outside This Terminal)

**Generated**: 2025-11-14
**Time Required**: ~4 hours of your time
**Automation Will Save You**: ~15 days of coding

---

## 🔴 CRITICAL: Actions You MUST Take Outside This Window

### 1. EXTERNAL SERVICE SETUP (30 minutes)

#### Email Service (CHOOSE ONE):

```bash
# Option A: SendGrid (Recommended - best deliverability)
Go to: https://sendgrid.com/
1. Sign up for free tier (100 emails/day free)
2. Get API Key: Settings → API Keys → Create API Key
3. Add to .env: SENDGRID_API_KEY=SG.xxxxx

# Option B: Resend (Simple, modern)
Go to: https://resend.com/
1. Sign up (10,000 emails/month free)
2. Get API Key from dashboard
3. Add to .env: RESEND_API_KEY=re_xxxxx

# Option C: Postmark (Great for transactional)
Go to: https://postmarkapp.com/
1. Sign up (100 emails/month free)
2. Get Server API Token
3. Add to .env: POSTMARK_TOKEN=xxxxx
```

#### Error Monitoring:

```bash
# Sentry (Required for production)
Go to: https://sentry.io/
1. Sign up for free tier
2. Create new project → Node.js
3. Copy DSN from project settings
4. Add to .env: SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

#### Stripe Webhook:

```bash
# Configure in Stripe Dashboard
Go to: https://dashboard.stripe.com/
1. Webhooks → Add endpoint
2. Endpoint URL: https://yourdomain.com/webhooks/stripe
3. Events to send:
   - checkout.session.completed
   - payment_intent.succeeded
   - payment_intent.payment_failed
4. Copy signing secret
5. Add to .env: STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

### 2. LEGAL CONTENT CREATION (2 hours)

#### Terms of Service:

```markdown
Create a file: /legal/terms-of-service.md
Include:

- Service description
- User responsibilities
- Payment terms
- Cancellation policy
- Liability limitations
- Dispute resolution

Use template: https://www.termsfeed.com/blog/sample-terms-of-service-template/
OR
Use generator: https://www.termly.io/products/terms-and-conditions-generator/
```

#### Privacy Policy:

```markdown
Create a file: /legal/privacy-policy.md
Include:

- What data you collect
- How you use it
- Third parties (Stripe, SendGrid)
- User rights (GDPR)
- Contact information

Use generator: https://www.privacypolicygenerator.info/
OR
Use template: https://www.termly.io/resources/templates/privacy-policy-template/
```

#### Refund Policy:

```markdown
Create a file: /legal/refund-policy.md
Decide:

- Full refund period (e.g., 14 days before event)
- Partial refund period (e.g., 7 days before)
- No refund period (e.g., 48 hours before)
- Processing fee retention
```

---

### 3. BUSINESS DECISIONS (1 hour)

#### Pricing Model:

```yaml
# Edit: /config/business-rules.yaml (create this)
commission:
  percentage: 10 # What % do you take from each booking?
  minimum: 500 # Minimum commission in cents ($5.00)

subscription:
  enabled: false # Enable monthly tenant fees?
  monthly: 9900 # $99/month per tenant?

limits:
  free_tier_bookings: 10 # Bookings before payment required
  max_photos_per_package: 10
  max_packages_per_tenant: 100
```

#### Email Templates Content:

```markdown
# Provide content for these scenarios:

1. Booking confirmation subject line
2. Booking reminder (3 days before)
3. Cancellation confirmation
4. Refund processed
5. Welcome message for new customers
```

---

### 4. DNS & DOMAIN SETUP (30 minutes)

#### For Multi-Tenant Subdomains:

```bash
# In your DNS provider (Cloudflare/Route53/etc):
1. Add wildcard CNAME: *.yourdomain.com → your-server.com
2. OR add specific subdomains:
   - tenant1.yourdomain.com → CNAME → your-server.com
   - tenant2.yourdomain.com → CNAME → your-server.com
   - tenant3.yourdomain.com → CNAME → your-server.com
```

#### SSL Certificates:

```bash
# If using Vercel/Netlify: Automatic
# If self-hosting: Use Caddy or Certbot
sudo certbot certonly --webroot -w /var/www -d *.yourdomain.com
```

---

### 5. ENVIRONMENT VARIABLES (10 minutes)

Create `.env.production`:

```bash
# Copy from .env and update these:
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-server:5432/elope_prod
STRIPE_SECRET_KEY=sk_live_xxxxx  # LIVE key, not test!
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
SENDGRID_API_KEY=SG.xxxxx
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
APP_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
```

---

### 6. TEST ACCOUNTS & DATA (20 minutes)

#### Create Test Tenants:

```sql
-- Run after automation completes:
INSERT INTO "Tenant" (name, slug, apiKey, stripeAccountId) VALUES
('Demo Wedding Venue', 'demo-venue', 'pk_test_demo_xxxxx', 'acct_xxxxx'),
('Test Photo Studio', 'test-studio', 'pk_test_studio_xxxxx', 'acct_xxxxx'),
('Sample Event Space', 'sample-space', 'pk_test_sample_xxxxx', 'acct_xxxxx');
```

#### Stripe Test Cards:

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

---

## 🟡 AFTER AUTOMATION: Testing Checklist (1 hour)

### Critical Path Testing:

- [ ] Book as customer with test card
- [ ] Receive confirmation email
- [ ] View booking in customer portal
- [ ] Cancel booking
- [ ] Process refund
- [ ] Admin can see all bookings
- [ ] Tenant admin can see only their bookings
- [ ] Branding applies correctly

### Security Testing:

- [ ] Try accessing Tenant B data as Tenant A
- [ ] Try SQL injection in forms
- [ ] Try booking same date twice quickly
- [ ] Verify Stripe webhooks work

---

## 🟢 NICE TO HAVE (Post-Launch)

1. **Analytics Dashboard** (Google Analytics or Plausible)
2. **Customer Support** (Intercom or Crisp chat)
3. **Email Marketing** (Mailchimp integration)
4. **Backup System** (Daily automated backups)
5. **CDN for Images** (Cloudflare Images or AWS CloudFront)
6. **Search Engine** (Algolia or ElasticSearch)

---

## ⏱️ TIME BREAKDOWN

**Your Required Time**: 4 hours

- External services: 30 min
- Legal content: 2 hours
- Business decisions: 1 hour
- Testing: 30 min

**Automation Saves You**: ~120 hours (15 working days)

- Database fixes: 16 hours → automated
- Race condition fixes: 24 hours → automated
- Feature development: 40 hours → automated
- Testing/coverage: 16 hours → automated
- Refactoring: 24 hours → automated

**ROI**: 4 hours of your time saves 120 hours of coding = 30x return

---

## 📞 SUPPORT RESOURCES

**Stripe Support**: https://support.stripe.com/
**SendGrid Docs**: https://docs.sendgrid.com/
**Prisma Discord**: https://discord.gg/prisma
**PostgreSQL Help**: https://www.postgresql.org/support/

---

## ✅ READY CONFIRMATION

Before I start automation, ensure you have:

- [ ] Chosen email provider (SendGrid/Resend/Postmark)
- [ ] Decided on commission percentage
- [ ] Have access to production database
- [ ] Can create API keys

**When ready, I will begin Phase 1 automation...**
