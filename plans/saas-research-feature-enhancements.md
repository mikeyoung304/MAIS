# MAIS Feature Enhancements: Insights from SaaS Research

## Overview

This document extracts actionable feature ideas from SaaS market research to enhance MAIS's existing multi-tenant platform. These are **additive features** that strengthen the current business model of revenue-sharing partnerships with customizable storefronts.

**What MAIS Already Has:**

- Multi-tenant platform with complete data isolation
- Customizable 3-tier storefronts per tenant
- Revenue-sharing model (10-15% commission)
- Config-driven architecture with planned agent proposals
- Segment model for customer journey routing
- Booking/scheduling with double-booking prevention
- Stripe Connect, Postmark, Google Calendar integrations

**What the Research Suggests Adding:**

- AI-powered features that help tenants run their businesses better
- "Back office" automation beyond just booking
- Narrative insights that explain data, not just display it
- Proactive alerts and recommendations

---

## Feature Category 1: AI-Powered Tenant Tools

### 1.1 Smart Package Recommendations

**Problem:** Tenants struggle to price their packages competitively and don't know what's working.

**Feature:** AI analyzes booking patterns and suggests package adjustments.

**How it works:**

- Tenant dashboard shows: "Your 'Premium' tier converts 3x better than 'Basic' - consider raising the price by 15%"
- Based on actual booking data, not guesswork
- Suggestions are notifications, not automatic changes (human stays in control)

**Implementation:**

```typescript
// New endpoint
GET / v1 / insights / package - recommendations;

// Response
{
  recommendations: [
    {
      type: 'price_increase',
      packageId: 'pkg_123',
      currentPrice: 500,
      suggestedPrice: 575,
      reasoning: 'This package has 85% conversion rate, well above your 60% average',
      confidence: 'high',
    },
  ];
}
```

**Fits existing architecture:** Uses existing booking data, returns suggestions via API, tenant decides whether to act.

---

### 1.2 Seasonal Pricing Suggestions

**Problem:** Tenants don't adjust pricing for peak/off-peak seasons.

**Feature:** AI notices patterns and suggests seasonal adjustments.

**How it works:**

- "December bookings are 40% higher than average - consider a holiday premium"
- "January is slow historically - consider a 10% early-bird discount"
- Integrates with existing config-driven system (agent proposes, admin approves)

**Implementation:** Extends the planned `AgentProposal` system from ARCHITECTURE.md.

---

### 1.3 Follow-Up Reminder System

**Problem:** Tenants forget to follow up with leads who didn't book.

**Feature:** Automated reminders when prospects go cold.

**How it works:**

- Customer views package but doesn't book → 48 hours later, tenant gets reminder
- "3 prospects viewed your 'Wedding Package' this week but didn't book. Send follow-up?"
- One-click to send templated email

**Implementation:**

```typescript
// New model
model ProspectActivity {
  id          String   @id @default(cuid())
  tenantId    String
  email       String?
  packageId   String
  action      String   // 'viewed', 'started_checkout', 'abandoned'
  followedUp  Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([tenantId, followedUp, createdAt])
}
```

**Fits existing architecture:** Uses existing Postmark adapter, adds lightweight tracking.

---

## Feature Category 2: Narrative Analytics

### 2.1 Plain-English Dashboard Insights

**Problem:** Tenants see charts but don't know what to do with them.

**Feature:** AI explains what the numbers mean in simple language.

**How it works:**

- Instead of just showing "Bookings: 12 this month"
- Show: "Bookings are up 25% from last month. Your new 'Mini Session' package is driving most of the growth."

**Implementation:**

```typescript
// New endpoint
GET /v1/insights/dashboard-narrative

// Response
{
  summary: "Strong month! You're on track for your best quarter yet.",
  highlights: [
    "Bookings up 25% month-over-month",
    "'Mini Session' package is your top performer (5 of 12 bookings)",
    "Average booking value increased to $425"
  ],
  concerns: [
    "2 customers haven't responded to follow-ups"
  ],
  suggestedActions: [
    { action: "follow_up", description: "Send reminder to pending customers" }
  ]
}
```

**Fits existing architecture:** Reads existing booking/package data, generates narrative via LLM, caches results.

---

### 2.2 Monthly Business Report

**Problem:** Tenants want to know how their business is doing without digging through data.

**Feature:** Auto-generated monthly summary email.

**How it works:**

- First of month: tenant receives email with last month's highlights
- Revenue, bookings, top packages, trends
- Sent via existing Postmark integration

**Implementation:** Scheduled job that queries tenant data and sends formatted email.

---

## Feature Category 3: Customer Journey Enhancements

### 3.1 Segment-Based Landing Pages

**Problem:** All customers see the same storefront regardless of how they arrived.

**Feature:** Different landing experiences based on customer segment.

**How it works:**

- Tenant creates segments: "Wedding", "Corporate", "Portrait"
- Each segment has its own hero image, featured packages, messaging
- URL: `tenant.mais.app/weddings` vs `tenant.mais.app/corporate`

**Fits existing architecture:** Segment model already exists with `heroTitle`, `metaDescription`. Just need routing + UI.

---

### 3.2 Smart Package Filtering

**Problem:** Customers see all packages when they only care about one category.

**Feature:** Packages auto-filter based on segment or customer answers.

**How it works:**

- Customer answers: "What type of event?" → "Wedding"
- Only wedding-relevant packages shown
- Uses existing `Package.segments` relation

**Implementation:** Frontend filtering based on segment selection, no backend changes needed.

---

### 3.3 Post-Booking Automation

**Problem:** Tenants manually send confirmation emails, reminders, and follow-ups.

**Feature:** Configurable email sequences triggered by booking events.

**How it works:**

- Booking confirmed → Send confirmation (existing)
- 7 days before event → Send preparation checklist
- 1 day after event → Send thank-you + review request
- Tenant configures which emails to send and when

**Implementation:**

```typescript
// New model
model EmailSequence {
  id          String   @id @default(cuid())
  tenantId    String
  trigger     String   // 'booking_confirmed', 'days_before_event', 'days_after_event'
  offsetDays  Int      // -7 for "7 days before", +1 for "1 day after"
  templateId  String
  active      Boolean  @default(true)

  @@index([tenantId, trigger])
}
```

**Fits existing architecture:** Uses existing event system (`BookingPaid` event) + Postmark adapter.

---

## Feature Category 4: Tenant Admin Improvements

### 4.1 Quick Actions Dashboard

**Problem:** Tenant dashboard is informational but not actionable.

**Feature:** Surface the most important actions at the top.

**How it works:**

- "You have 2 pending bookings to confirm"
- "3 customers viewed packages but didn't book"
- "Your calendar has availability this weekend - promote it?"

**Implementation:** Dashboard widget that aggregates actionable items from various sources.

---

### 4.2 Template Library

**Problem:** New tenants start from scratch on package descriptions, emails, etc.

**Feature:** Pre-built templates tenants can customize.

**How it works:**

- "Start with a template" when creating new package
- Templates organized by business type (wellness, photography, consulting)
- Tenant can edit everything after importing

**Implementation:**

```typescript
// New model
model Template {
  id          String   @id @default(cuid())
  category    String   // 'package', 'email', 'landing_page'
  businessType String  // 'wellness', 'photography', 'consulting', 'events'
  name        String
  content     Json     // Template data
  isSystem    Boolean  @default(true)  // System templates vs tenant-created

  @@index([category, businessType])
}
```

---

### 4.3 AI-Assisted Content Writing

**Problem:** Tenants struggle to write compelling package descriptions.

**Feature:** AI helps write/improve package descriptions.

**How it works:**

- Tenant clicks "Help me write this"
- AI generates description based on: package name, price, what's included
- Tenant can edit, accept, or regenerate

**Implementation:**

```typescript
// New endpoint
POST /v1/ai/generate-description
{
  packageName: "Wedding Day Coverage",
  price: 2500,
  duration: "8 hours",
  includes: ["Photos", "Video", "Album"]
}

// Response
{
  description: "Capture every magical moment of your special day with our comprehensive Wedding Day Coverage. Over 8 hours, our team will document your celebration from preparation to send-off, delivering stunning photos, cinematic video, and a beautifully crafted album to treasure forever.",
  alternatives: [
    "Your love story deserves to be told beautifully...",
    "From 'I do' to the last dance..."
  ]
}
```

---

## Feature Category 5: Analytics & Reporting

### 5.1 Conversion Funnel Tracking

**Problem:** Tenants don't know where they're losing customers.

**Feature:** Simple funnel visualization.

**How it works:**

- View → Checkout Started → Booking Complete
- "You're losing 40% of customers at checkout - your packages might be too expensive"

**Implementation:** Track events at each stage, display funnel in dashboard.

---

### 5.2 Revenue Forecasting

**Problem:** Tenants don't know what revenue to expect.

**Feature:** Simple projection based on confirmed bookings + historical patterns.

**How it works:**

- "Projected revenue this month: $4,200 (based on 8 confirmed bookings)"
- "You typically get 3-5 more bookings in the last week of the month"

**Implementation:** Query confirmed bookings + apply historical conversion rates.

---

### 5.3 Comparative Insights (Anonymized)

**Problem:** Tenants don't know if their performance is good or bad.

**Feature:** Compare against anonymized platform averages.

**How it works:**

- "Your conversion rate (65%) is above the platform average (52%)"
- "Your average booking value is in the top 25% of similar businesses"
- All data anonymized and aggregated

**Implementation:** Aggregate metrics across tenants, compare individual to average.

---

## Implementation Priority

### Phase 1: Quick Wins (2-4 weeks each)

1. **Plain-English Dashboard Insights** - High value, uses existing data
2. **Post-Booking Email Sequences** - High value, extends existing email system
3. **Segment-Based Landing Pages** - Uses existing Segment model

### Phase 2: Medium Effort (4-6 weeks each)

4. **AI-Assisted Content Writing** - Requires LLM integration
5. **Follow-Up Reminder System** - New tracking + notification logic
6. **Template Library** - New model + admin UI

### Phase 3: Larger Features (6-8 weeks each)

7. **Smart Package Recommendations** - Requires analytics pipeline
8. **Conversion Funnel Tracking** - Requires event tracking infrastructure
9. **Monthly Business Reports** - Requires scheduled jobs + email templates

---

## Technical Approach

### LLM Integration (for AI features)

Simple, single-provider approach:

```typescript
// server/src/adapters/llm/claude.adapter.ts
export class ClaudeAdapter {
  async generateText(prompt: string): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  }
}
```

Add to DI container, inject where needed. No multi-LLM router - keep it simple.

### Caching Strategy

AI-generated insights should be cached:

```typescript
// Cache narrative insights for 1 hour
const cacheKey = `insights:${tenantId}:dashboard`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const insights = await generateInsights(tenantId);
await cache.set(cacheKey, insights, 3600);
return insights;
```

### Tenant Isolation

All new features follow existing pattern:

```typescript
// Every query includes tenantId
const bookings = await prisma.booking.findMany({
  where: { tenantId, ... }
});
```

---

## What This Plan Does NOT Include

- **Business model changes** - Keep revenue-sharing, keep multi-tenant
- **Vertical pivots** - MAIS stays horizontal, serving all business types
- **Complex agent frameworks** - Use simple LLM calls, not autonomous agents
- **Multi-LLM routing** - Single provider (Claude) is sufficient

---

## Summary

The SaaS research suggested many ideas, but the most valuable for MAIS are:

1. **Make data actionable** - Don't just show numbers, explain what they mean
2. **Automate follow-ups** - Help tenants stay on top of their customer relationships
3. **Reduce setup friction** - Templates and AI-assisted content help new tenants launch faster
4. **Leverage segments** - Use the existing Segment model for personalized customer journeys

These features strengthen MAIS's value proposition to club members: "We don't just give you a booking platform, we help you grow your business."

---

_Plan created: November 25, 2025_
_Focus: Feature enhancements, not business pivot_
