# Immediate Action Items - What You Need to Do Outside This Chat

## 🚨 CRITICAL: Complete These Before Any Coding Begins

### 1. Business Decisions (Due: This Week)

#### A. Define Your Three Segments
Fill out this template and save as `segment-definitions.yaml`:

```yaml
segments:
  budget:
    name: "Essential"  # Your name choice
    tagline: "Beautiful Simplicity"
    price_range: "$_____ - $_____"
    target_customer: "Description of ideal customer"
    value_proposition: "Why choose this segment"

  premium:
    name: "Signature"  # Your name choice
    tagline: "Timeless Elegance"
    price_range: "$_____ - $_____"
    target_customer: "Description of ideal customer"
    value_proposition: "Why choose this segment"

  luxury:
    name: "Luxury"  # Your name choice
    tagline: "Extraordinary Experiences"
    price_range: "$_____ - $_____"
    target_customer: "Description of ideal customer"
    value_proposition: "Why choose this segment"
```

#### B. Create Your 3×3 Tier Matrix
Complete this pricing/feature matrix:

| Segment | Tier 1 (Base) | Tier 2 (Popular) | Tier 3 (Premium) |
|---------|---------------|------------------|------------------|
| **Essential** | | | |
| Name | "Essentials" | "Essentials Plus" | "Essentials Complete" |
| Price | $_____ | $_____ | $_____ |
| Guests | ___ | ___ | ___ |
| Hours | ___ | ___ | ___ |
| Photos | ___ | ___ | ___ |
| Features | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ |
| **Signature** | | | |
| Name | _____ | _____ | _____ |
| Price | $_____ | $_____ | $_____ |
| Guests | ___ | ___ | ___ |
| Hours | ___ | ___ | ___ |
| Photos | ___ | ___ | ___ |
| Features | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ |
| **Luxury** | | | |
| Name | _____ | _____ | _____ |
| Price | $_____ | $_____ | $_____ |
| Guests | ___ | ___ | ___ |
| Hours | ___ | ___ | ___ |
| Photos | ___ | ___ | ___ |
| Features | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ | • ___<br>• ___<br>• ___ |

#### C. Set Commission Rates
```yaml
commission_structure:
  platform_default: ___%  # Current: 10%

  by_segment:
    Essential: ___%  # Suggested: 8%
    Signature: ___%  # Suggested: 10%
    Luxury: ___%     # Suggested: 12%

  by_volume:  # Optional
    bookings_0_10: ___%
    bookings_11_50: ___%
    bookings_51_plus: ___%
```

#### D. Define Upsell Rules
```yaml
upsell_triggers:
  - when: "User views Tier 1"
    show: "Tier 2 value proposition"
    incentive: "5% off if upgraded now"

  - when: "User adds 2+ add-ons"
    show: "Next tier includes these add-ons"
    incentive: "Save $X with tier upgrade"

  - when: "Peak date selected"
    show: "Only X spots left at this tier"
    incentive: "Lock in this rate now"
```

---

### 2. Stripe Setup (Due: Before Phase 1)

#### A. Stripe Dashboard Configuration
1. **Log into Stripe Dashboard** → [dashboard.stripe.com](https://dashboard.stripe.com)

2. **Enable Connect** (if not already):
   - Navigate to "Connect" → "Settings"
   - Set platform name: "Your Platform Name"
   - Configure onboarding settings

3. **Set Webhook Endpoints**:
   ```
   Endpoint URL: https://your-domain.com/v1/webhooks/stripe
   Events to listen for:
   ✓ checkout.session.completed
   ✓ payment_intent.succeeded
   ✓ payment_intent.payment_failed
   ✓ account.updated
   ✓ account.application.authorized
   ```

4. **Get Your Keys**:
   ```bash
   # Save these securely
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_CONNECT_CLIENT_ID=ca_...
   ```

#### B. Test Environment Setup
1. **Create Test Mode Webhooks**:
   ```
   Test Endpoint: https://staging.your-domain.com/v1/webhooks/stripe
   Use same events as production
   ```

2. **Get Test Keys**:
   ```bash
   STRIPE_SECRET_KEY_TEST=sk_test_...
   STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
   ```

---

### 3. Design Assets (Due: Before Phase 4)

#### A. Create Mockups/Wireframes
Use Figma, Sketch, or even paper sketches for:

1. **Segment Selector Page**
   - 3 cards/boxes showing segments
   - Clear value props for each
   - Visual hierarchy

2. **Tier Comparison Table**
   - 3-column layout
   - Feature checkmarks
   - "Most Popular" badge placement
   - CTA buttons

3. **Upsell Modal**
   - Before/after comparison
   - Urgency messaging
   - Accept/Decline buttons

4. **Mobile Layouts**
   - Segment cards (stacked)
   - Tier comparison (swipeable)
   - Simplified upsell

#### B. Prepare Visual Assets
Gather or create:
```
/assets/
  /segments/
    essential-hero.jpg    (1920x1080)
    signature-hero.jpg    (1920x1080)
    luxury-hero.jpg       (1920x1080)
  /tiers/
    tier-1-gallery/       (5-10 images each)
    tier-2-gallery/
    tier-3-gallery/
  /icons/
    check-mark.svg
    popular-badge.svg
    upgrade-arrow.svg
```

---

### 4. Content Creation (Due: Before Phase 4)

#### A. Write Segment Descriptions
**Template**:
```markdown
## [Segment Name]

**Tagline**: One compelling line

**Description**: 2-3 sentences about who this is for and why they'd choose it.

**Perfect For**:
- Couples who...
- Those looking for...
- Anyone wanting...
```

#### B. Create Feature Lists
For each tier, write:
- 5-8 key features (bullet points)
- 1-2 exclusive benefits
- What's NOT included (manage expectations)

#### C. Craft Upsell Copy
Write variations for A/B testing:
```
Version A: Value Focus
"Upgrade to [Tier] and save $X on these included features..."

Version B: Scarcity Focus
"Only 2 [Tier] spots left for your date. Secure yours now..."

Version C: Social Proof
"73% of couples choose [Tier] for dates like yours..."
```

---

### 5. Analytics Setup (Due: Before Phase 6)

#### A. Google Analytics 4
1. Create GA4 property if not exists
2. Get Measurement ID: `G-XXXXXXXXXX`
3. Define custom events:
   ```javascript
   // Events to track
   gtag('event', 'segment_selected', {
     segment_name: 'Signature',
     segment_index: 2
   });

   gtag('event', 'tier_compared', {
     tiers_viewed: ['tier1', 'tier2', 'tier3'],
     time_spent: 45
   });

   gtag('event', 'upsell_shown', {
     from_tier: 'Essential',
     to_tier: 'Essential Plus',
     price_difference: 500
   });
   ```

#### B. Conversion Goals
Define in GA4:
- Segment selection → Tier view: Target 80%
- Tier view → Add-on selection: Target 60%
- Upsell shown → Accepted: Target 15%
- Checkout started → Completed: Target 70%

---

### 6. Infrastructure (Due: Before Testing)

#### A. Staging Environment
```bash
# Set up staging subdomain
staging.your-domain.com

# Environment variables
NODE_ENV=staging
DATABASE_URL=postgresql://...staging-db
STRIPE_SECRET_KEY=sk_test_...
```

#### B. CDN Configuration
For images/assets:
1. CloudFlare or AWS CloudFront
2. Configure cache rules:
   - Images: 30 days
   - CSS/JS: 7 days
   - API responses: No cache

#### C. Error Tracking
Set up Sentry or Rollbar:
```javascript
Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  tracesSampleRate: 0.1
});
```

---

### 7. Test Data Preparation (Due: Before Phase 1)

#### A. Create Test Tenants
In your staging database:
```sql
-- Tenant 1: Budget-focused
INSERT INTO "Tenant" (slug, name, commissionPercent)
VALUES ('budget-weddings', 'Budget Weddings Co', 8.0);

-- Tenant 2: Mid-market
INSERT INTO "Tenant" (slug, name, commissionPercent)
VALUES ('signature-events', 'Signature Events', 10.0);

-- Tenant 3: Luxury
INSERT INTO "Tenant" (slug, name, commissionPercent)
VALUES ('luxury-ceremonies', 'Luxury Ceremonies', 12.0);
```

#### B. Sample Packages Data
Create 9 test packages (3 segments × 3 tiers) with:
- Realistic pricing
- Varied features
- Test images
- Sample add-ons

---

### 8. Team Preparation (Due: Before Phase 1)

#### A. Schedule Stakeholder Meetings
- [ ] Review segment/tier structure (30 min)
- [ ] Approve pricing matrix (30 min)
- [ ] Confirm upsell strategy (30 min)
- [ ] Sign off on mockups (1 hour)

#### B. Create Documentation
- [ ] Admin training guide
- [ ] Segment FAQ for support team
- [ ] API documentation updates
- [ ] Rollout communication plan

---

## Quick Start Checklist

### This Week - Business Critical
- [ ] Define 3 segments with names/descriptions
- [ ] Create 3×3 tier pricing matrix
- [ ] Set commission rates per segment
- [ ] Write upsell rules

### Next Week - Technical Setup
- [ ] Configure Stripe Connect
- [ ] Set up staging environment
- [ ] Create test data
- [ ] Set up analytics

### Before Frontend Work - Creative
- [ ] Design mockups approved
- [ ] Content written
- [ ] Images gathered/created
- [ ] Brand guidelines updated

---

## Questions to Answer Now

Before you proceed, make sure you can answer:

1. **Segments**: What three market segments are you targeting?
2. **Pricing**: What's the price range for each segment?
3. **Features**: What differentiates each tier within a segment?
4. **Commission**: Will you vary commission by segment?
5. **Upsells**: What's your target upsell conversion rate?
6. **Timeline**: Do you have a hard launch deadline?
7. **Testing**: Which tenants will beta test?
8. **Success**: What metrics define success?

---

## Resources & Tools

### Recommended Tools
- **Mockups**: Figma (free), Whimsical, Balsamiq
- **Analytics**: Google Analytics 4, Mixpanel, Amplitude
- **Feature Flags**: LaunchDarkly, Unleash, GrowthBook
- **Error Tracking**: Sentry, Rollbar, LogRocket
- **Load Testing**: k6, Artillery, Gatling

### Helpful Templates
- [Figma Pricing Table Templates](https://www.figma.com/community/search?model_type=hub_files&q=pricing%20table)
- [GA4 Event Tracking Guide](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [Stripe Connect Best Practices](https://stripe.com/docs/connect/best-practices)

---

## Next Steps After Completing These Items

Once you've completed Phase 0 (these external requirements):

1. **Share the completed templates** in our next session
2. **I'll generate** the exact migration scripts
3. **We'll implement** Phase 1 together (database/models)
4. **You'll have** a working staging environment with segments

Remember: The technical implementation is straightforward because your architecture is solid. The critical path is having clear business decisions and content ready. Don't start coding until Phase 0 is complete!

---

*Save this document and use it as your working checklist. Update it as you complete each item, and bring the filled-out templates to our next session.*