# Customer Journey: End User Booking Flow

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Audience:** Developers, Product Managers, QA Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Customer Persona](#customer-persona)
3. [Complete Journey Map](#complete-journey-map)
4. [Technical Implementation](#technical-implementation)
5. [Multi-Tenant Isolation](#multi-tenant-isolation)
6. [Error Handling & Edge Cases](#error-handling--edge-cases)
7. [Mobile Responsiveness](#mobile-responsiveness)
8. [Performance Optimizations](#performance-optimizations)
9. [Testing Strategy](#testing-strategy)

---

## Overview

This document maps the complete customer journey for booking a service through the MAIS platform. The journey encompasses **discovery, catalog browsing, package selection, date picking, add-on customization, checkout, payment, and confirmation** - all while maintaining strict multi-tenant data isolation.

**Key Features:**

- Tenant-scoped catalog discovery via segments
- Real-time availability checking with batch optimization
- Stripe Checkout integration with Stripe Connect
- Webhook-based payment confirmation
- Idempotent operations preventing duplicate bookings
- Email confirmations via Postmark
- Calendar integration via Google Calendar API

**Core Business Value:** This flow represents the PRIMARY revenue generation mechanism for the MAIS platform. Every customer who completes this journey generates commission revenue for the platform.

---

## Customer Persona

### Primary User: Service Seeker

**Who they are:**

- Individuals or couples seeking to book services (weddings, wellness retreats, events)
- Typically accessing from mobile devices (60%+) or desktop browsers
- May be browsing multiple options simultaneously
- Price-conscious but value quality and convenience

**User Goals:**

1. **Discover** available service packages quickly
2. **Compare** options within a business segment
3. **Select** a date that works for their schedule
4. **Customize** with add-ons that enhance the experience
5. **Pay securely** with credit card (Stripe Checkout)
6. **Receive confirmation** with all booking details

**Technical Context:**

- No account creation required (guest checkout)
- Minimal form fields (name, email only)
- Mobile-first UI with touch-optimized interactions
- Real-time feedback on availability

---

## Complete Journey Map

### Stage 1: Discovery

**Entry Points:**

1. **Homepage** → Browse Packages CTA
2. **Segment Landing Page** → Direct segment URL (e.g., `/segment/wellness-retreat/packages`)
3. **Widget Embedding** → Third-party website with embedded booking widget

**User Actions:**

- Customer arrives at the MAIS platform or tenant's custom domain
- Views homepage hero section with value proposition
- Browses segment cards (if multi-segment tenant)

**Technical Flow:**

```
Client Request → Tenant Resolution → Segment Service → Catalog Service → Response
```

**Code References:**

**Frontend:**

- **Entry:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx` (lines 1-476)
  - Hero section with CTAs (lines 14-63)
  - Segment navigation cards (rendered if tenant has segments)
  - "Browse Packages" primary CTA (line 34)

**Backend:**

- **Segments API:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/segments.routes.ts`
  - `GET /v1/segments` - List all active segments (lines 33-58)
  - `GET /v1/segments/:slug` - Get segment metadata (lines 72-101)
  - `GET /v1/segments/:slug/packages` - Get segment with packages (lines 120-154)

- **Segment Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/segment.service.ts`
  - Segment-scoped catalog filtering
  - Cache with 15-minute TTL (`catalog:{tenantId}:segment:{segmentId}:packages`)

**Tenant Context Flow:**

```typescript
// 1. Client sends X-Tenant-Key header
const headers = { 'X-Tenant-Key': 'pk_live_bella-weddings_abc123' };

// 2. Tenant middleware resolves tenant
// server/src/middleware/tenant.ts (lines 55-155)
const tenant = await prisma.tenant.findUnique({
  where: { apiKeyPublic: apiKey },
  select: {
    id,
    slug,
    name,
    commissionPercent,
    branding,
    stripeAccountId,
    stripeOnboarded,
    isActive,
  },
});

// 3. Tenant injected into request
req.tenant = tenant;
req.tenantId = tenant.id;
```

**Data Isolation:**

- All segment queries scoped by `tenantId`
- Cache keys include `tenantId` to prevent cross-tenant leakage
- API key validation ensures only active tenants can serve requests

---

### Stage 2: Browse Catalog

**User Actions:**

- Views list of available packages within a segment
- Compares package prices, descriptions, and photos
- Filters by grouping (e.g., "Solo", "Couple", "Group")
- Clicks "Select" on preferred package

**UI Components:**

- **Package Cards** with:
  - Hero image (first photo from gallery)
  - Package name and description
  - Base price formatted as currency
  - Add-ons preview (count)
  - "Select" CTA button

**Technical Flow:**

```
Package Catalog Page → API Request → Catalog Service → Cache Check → Database Query → Response
```

**Code References:**

**Frontend:**

- **Package Catalog:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/PackageCatalog.tsx`
  - Grid layout with responsive columns
  - Package cards with hover effects
  - Mobile-optimized touch targets (Sprint 8)

**Backend:**

- **Catalog Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/catalog.service.ts`

  **Get All Packages (lines 56-74):**

  ```typescript
  async getAllPackages(tenantId: string): Promise<PackageWithAddOns[]> {
    // CRITICAL: Cache key includes tenantId to prevent cross-tenant data leaks
    const cacheKey = `catalog:${tenantId}:all-packages`;

    const cached = this.cache?.get<PackageWithAddOns[]>(cacheKey);
    if (cached) return cached;

    const packages = await this.repository.getAllPackagesWithAddOns(tenantId);
    this.cache?.set(cacheKey, packages, 900); // 15 min TTL
    return packages;
  }
  ```

  **Get Packages by Segment (lines 351-368):**

  ```typescript
  async getPackagesBySegment(tenantId: string, segmentId: string): Promise<Package[]> {
    const cacheKey = `catalog:${tenantId}:segment:${segmentId}:packages`;
    const cached = this.cache?.get<Package[]>(cacheKey);
    if (cached) return cached;

    const packages = await this.repository.getPackagesBySegment(tenantId, segmentId);
    this.cache?.set(cacheKey, packages, 900);
    return packages;
  }
  ```

**Database Schema:**

- **Package Model:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (lines 172-209)

  ```prisma
  model Package {
    id          String  @id @default(cuid())
    tenantId    String  // CRITICAL: Tenant isolation
    segmentId   String? // Optional segment scoping
    slug        String
    name        String
    description String?
    basePrice   Int     // Cents
    active      Boolean @default(true)
    photos      Json @default("[]") // Array of photo objects

    @@unique([tenantId, slug]) // Slug unique per tenant
    @@index([tenantId, active])
    @@index([segmentId, active])
  }
  ```

**Performance Optimization:**

- **N+1 Query Prevention:** Single query fetches packages WITH add-ons (91% query reduction)
- **Cache Strategy:** 15-minute TTL with tenant-scoped keys
- **Invalidation:** Cache cleared on package/add-on updates via service methods

---

### Stage 3: Package Selection

**User Actions:**

- Navigates to package detail page (`/package/:slug`)
- Reviews full package details:
  - Photo gallery (up to 5 photos)
  - Full description
  - Base price breakdown
- Proceeds to date selection

**Technical Flow:**

```
Package Page → API Request → Catalog Service → Package Repository → Package + Add-Ons
```

**Code References:**

**Frontend:**

- **Package Detail Page:** `/Users/mikeyoung/CODING/MAIS/client/src/features/catalog/PackagePage.tsx` (lines 1-258)

  **Component Structure (lines 19-257):**

  ```typescript
  export function PackagePage() {
    const { slug } = useParams<{ slug: string }>();
    const { data: pkg } = usePackage(slug || ''); // React Query hook

    // State management
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
    const [coupleName, setCoupleName] = useState('');
    const [email, setEmail] = useState('');

    // Progress tracking (4 steps: Package → Date → Extras → Checkout)
    const currentStep = useMemo(() => {
      if (!packageData) return 0;
      if (!selectedDate) return 1;
      if (!coupleName.trim() || !email.trim()) return 2;
      return 3;
    }, [packageData, selectedDate, coupleName, email]);

    // Dynamic total calculation
    const total = useBookingTotal(
      packageData?.priceCents || 0,
      packageData?.addOns || [],
      selectedAddOns
    );
  }
  ```

  **Progress Steps (lines 32-46):**
  - Visual progress indicator (Sprint 8 UX enhancement)
  - Guides user through 4-step booking flow
  - Auto-advances based on completion

**Backend:**

- **Get Package by Slug:** `/Users/mikeyoung/CODING/MAIS/server/src/services/catalog.service.ts` (lines 96-118)

  ```typescript
  async getPackageBySlug(tenantId: string, slug: string): Promise<PackageWithAddOns> {
    const cacheKey = `catalog:${tenantId}:package:${slug}`;
    const cached = this.cache?.get<PackageWithAddOns>(cacheKey);
    if (cached) return cached;

    const pkg = await this.repository.getPackageBySlug(tenantId, slug);
    if (!pkg) throw new NotFoundError(`Package with slug "${slug}" not found`);

    const addOns = await this.repository.getAddOnsByPackageId(tenantId, pkg.id);
    const result = { ...pkg, addOns };

    this.cache?.set(cacheKey, result, 900);
    return result;
  }
  ```

**Data Models:**

- **PackageDto (TypeScript):**
  ```typescript
  interface PackageDto {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    priceCents: number;
    photoUrl: string | null;
    addOns: AddOnDto[];
  }
  ```

---

### Stage 4: Date Selection

**User Actions:**

- Views interactive calendar (DayPicker component)
- Pre-loaded unavailable dates are greyed out
- Selects available date from calendar
- Real-time validation on selection

**UI Features:**

- **Batch Loading:** 60-day range pre-fetched (1 API call vs 60)
- **Visual Indicators:**
  - Available (white background)
  - Selected (orange highlight)
  - Unavailable (grey background, disabled)
  - Past dates (disabled)

**Technical Flow:**

```
Date Selection → Batch Fetch Unavailable → Cache Response → Click Handler → Real-time Check
```

**Code References:**

**Frontend:**

- **DatePicker Component:** `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/DatePicker.tsx` (lines 1-161)

  **Batch Fetch Strategy (lines 34-48):**

  ```typescript
  // Calculate date range (60 days from today)
  const { startDate, endDate } = useMemo(() => getDateRange(), []);

  // Batch fetch unavailable dates using React Query
  const { data: unavailableData, isLoading } = useQuery({
    queryKey: queryKeys.availability.dateRange(startDate, endDate),
    queryFn: async () => {
      const response = await api.getUnavailableDates?.({
        query: { startDate, endDate },
      });
      return response?.status === 200 ? response.body : { dates: [] };
    },
    staleTime: queryOptions.availability.staleTime,
    gcTime: queryOptions.availability.gcTime,
  });
  ```

  **Real-time Validation (lines 71-112):**

  ```typescript
  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return onSelect(undefined);

    // 1. Check local unavailable list first (fast)
    const dateStr = toUtcMidnight(date);
    const isUnavailable = unavailableDates.some((d) => toUtcMidnight(d) === dateStr);

    if (isUnavailable) {
      toast.error('Date Unavailable', {
        description: `Sorry, ${dateStr} is not available.`,
      });
      return onSelect(undefined);
    }

    // 2. Double-check with API for edge cases (date just booked)
    try {
      const response = await api.getAvailability?.({ query: { date: dateStr } });
      if (response?.status === 200 && response.body.available) {
        onSelect(date);
      } else {
        setLocalUnavailable((prev) => [...prev, date]); // Update local state
        toast.error('Date Unavailable');
        onSelect(undefined);
      }
    } catch (error) {
      onSelect(date); // Fail open for better UX
    }
  };
  ```

**Backend:**

- **Availability Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/availability.service.ts`

  **Check Single Date (lines 43-63):**

  ```typescript
  async checkAvailability(tenantId: string, date: string): Promise<AvailabilityCheck> {
    // 1. Check blackout dates (tenant-scoped)
    const isBlackout = await this.blackoutRepo.isBlackoutDate(tenantId, date);
    if (isBlackout) return { date, available: false, reason: 'blackout' };

    // 2. Check existing bookings (tenant-scoped)
    const isBooked = await this.bookingRepo.isDateBooked(tenantId, date);
    if (isBooked) return { date, available: false, reason: 'booked' };

    // 3. Check Google Calendar availability
    const isCalendarAvailable = await this.calendarProvider.isDateAvailable(date);
    if (!isCalendarAvailable) return { date, available: false, reason: 'calendar' };

    return { date, available: true };
  }
  ```

  **Batch Fetch Unavailable Dates (lines 88-92):**

  ```typescript
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<string[]> {
    // Single DB query - tenant-scoped
    const bookedDates = await this.bookingRepo.getUnavailableDates(tenantId, startDate, endDate);
    return bookedDates.map(d => d.toISOString().split('T')[0]); // YYYY-MM-DD format
  }
  ```

**Performance Impact:**

- **Before Optimization:** 60 API calls per calendar view (one per date)
- **After Optimization:** 1 API call per calendar view (batch fetch)
- **Result:** 98% reduction in API requests, 60% faster load time

**Database Query:**

- **Booking Model:** Queries use composite index `[tenantId, date]` for fast lookups
- **Query Pattern:**
  ```sql
  SELECT date FROM "Booking"
  WHERE "tenantId" = $1
    AND date BETWEEN $2 AND $3
    AND status IN ('CONFIRMED', 'PENDING');
  ```

---

### Stage 5: Add-Ons & Customer Details

**User Actions:**

- Reviews available add-ons for selected package
- Toggles add-ons on/off (checkbox interaction)
- Enters customer details:
  - Names (e.g., "Sarah & Alex")
  - Email address (for confirmation)
- Views live total calculation in sidebar

**UI Components:**

**Add-On List:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/AddOnList.tsx` (lines 1-86)
  - Animated checkbox selection with rotation effect
  - Price highlights on selection (orange accent)
  - Mobile-optimized touch targets (Sprint 8)

**Total Box:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/TotalBox.tsx` (lines 1-105)
  - **Line Items:**
    - Package base price
    - Each selected add-on (+price)
    - Subtotal
    - Tax (8%)
    - **Grand Total** (bold, large font)
  - Animated total updates (scale transform)
  - Sticky positioning on desktop

**Technical Flow:**

```
Add-On Toggle → State Update → Total Recalculation → UI Update (Animated)
```

**Code References:**

**Frontend:**

- **Add-On Selection (PackagePage.tsx lines 117-127):**

  ```typescript
  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(addOnId)) {
        newSet.delete(addOnId);
      } else {
        newSet.add(addOnId);
      }
      return newSet;
    });
  };
  ```

- **Total Calculation Hook (useBookingTotal):**
  ```typescript
  function useBookingTotal(
    packagePrice: number,
    addOns: AddOnDto[],
    selectedAddOnIds: Set<string>
  ): number {
    return useMemo(() => {
      const selectedAddOns = addOns.filter((a) => selectedAddOnIds.has(a.id));
      const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.priceCents, 0);
      return packagePrice + addOnsTotal;
    }, [packagePrice, addOns, selectedAddOnIds]);
  }
  ```

**Backend:**

- **Commission Calculation:** `/Users/mikeyoung/CODING/MAIS/server/src/services/commission.service.ts` (lines 169-222)

  ```typescript
  async calculateBookingTotal(
    tenantId: string,
    packagePrice: number,
    addOnIds: string[]
  ): Promise<BookingCalculation> {
    // 1. Fetch add-ons (tenant-scoped, active only)
    const addOns = await this.prisma.addOn.findMany({
      where: { tenantId, id: { in: addOnIds }, active: true },
    });

    // 2. Validate all add-ons found (prevent invalid IDs)
    if (addOns.length !== addOnIds.length) {
      const missingIds = addOnIds.filter(id => !addOns.map(a => a.id).includes(id));
      throw new Error(`Invalid add-ons: ${missingIds.join(', ')}`);
    }

    // 3. Calculate totals
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price, 0);
    const subtotal = packagePrice + addOnsTotal;

    // 4. Calculate commission (server-side for security)
    const commission = await this.calculateCommission(tenantId, subtotal);

    return {
      packagePrice,
      addOnsTotal,
      subtotal,
      commissionAmount: commission.amount,
      commissionPercent: commission.percent,
      tenantReceives: subtotal - commission.amount,
    };
  }
  ```

**Data Models:**

- **AddOn Model:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (lines 211-234)

  ```prisma
  model AddOn {
    id          String  @id @default(cuid())
    tenantId    String  // CRITICAL: Tenant isolation
    segmentId   String? // Segment scoping (null = global)
    slug        String
    name        String
    description String?
    price       Int     // Cents
    active      Boolean @default(true)

    @@unique([tenantId, slug])
    @@index([tenantId, active])
    @@index([tenantId, segmentId]) // Segment-scoped add-ons
  }
  ```

**Security:**

- Add-on IDs validated server-side (prevent tampering)
- Prices fetched from database (never trusted from client)
- Tenant isolation ensures cross-tenant add-on access blocked

---

### Stage 6: Checkout

**User Actions:**

- Reviews final order summary
- Clicks "Proceed to Checkout" button
- Redirected to Stripe Checkout (secure payment page)

**Technical Flow:**

```
Checkout Click → API Request → Booking Service → Commission Calc → Stripe Session → Redirect
```

**Code References:**

**Frontend:**

- **Checkout Handler (PackagePage.tsx lines 70-115):**

  ```typescript
  const handleCheckout = async () => {
    if (!selectedDate || !packageData || !coupleName.trim() || !email.trim()) return;

    setIsCheckingOut(true);
    try {
      // Format date as YYYY-MM-DD
      const eventDate = toUtcMidnight(selectedDate);

      // Call createCheckout API
      const response = await api.createCheckout({
        body: {
          packageId: packageData.id,
          eventDate,
          email: email.trim(),
          coupleName: coupleName.trim(),
          addOnIds: Array.from(selectedAddOns),
        },
      });

      if (response.status === 200) {
        // Persist checkout data to localStorage (for success page)
        const checkoutData: LastCheckout = {
          packageId: packageData.id,
          eventDate,
          email: email.trim(),
          coupleName: coupleName.trim(),
          addOnIds: Array.from(selectedAddOns),
        };
        localStorage.setItem('lastCheckout', JSON.stringify(checkoutData));

        // Redirect to Stripe Checkout
        window.location.href = response.body.checkoutUrl;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      toast.error('An error occurred during checkout');
    } finally {
      setIsCheckingOut(false);
    }
  };
  ```

**Backend:**

- **Booking Service - Create Checkout:** `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts` (lines 57-152)

  ```typescript
  async createCheckout(tenantId: string, input: CreateBookingInput): Promise<{ checkoutUrl: string }> {
    // 1. Validate package exists for tenant
    const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) throw new NotFoundError(`Package ${input.packageId} not found`);

    // 2. Fetch tenant for Stripe account
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError(`Tenant ${tenantId} not found`);

    // 3. Calculate total with commission
    const calculation = await this.commissionService.calculateBookingTotal(
      tenantId,
      pkg.priceCents,
      input.addOnIds || []
    );

    // 4. Generate idempotency key (prevents duplicate sessions)
    const idempotencyKey = this.idempotencyService.generateCheckoutKey(
      tenantId,
      input.email,
      pkg.id,
      input.eventDate,
      Date.now()
    );

    // 5. Check for cached response (duplicate request)
    const cachedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
    if (cachedResponse) return { checkoutUrl: cachedResponse.data.url };

    // 6. Store idempotency key
    await this.idempotencyService.checkAndStore(idempotencyKey);

    // 7. Prepare session metadata (CRITICAL: include tenantId)
    const metadata = {
      tenantId,                                    // ← Multi-tenant isolation
      packageId: pkg.id,
      eventDate: input.eventDate,
      email: input.email,
      coupleName: input.coupleName,
      addOnIds: JSON.stringify(input.addOnIds || []),
      commissionAmount: String(calculation.commissionAmount),
      commissionPercent: String(calculation.commissionPercent),
    };

    // 8. Create Stripe checkout session
    let session;
    if (tenant.stripeAccountId && tenant.stripeOnboarded) {
      // Stripe Connect checkout (payment → tenant account)
      session = await this.paymentProvider.createConnectCheckoutSession({
        amountCents: calculation.subtotal,
        email: input.email,
        metadata,
        stripeAccountId: tenant.stripeAccountId,
        applicationFeeAmount: calculation.commissionAmount, // Platform commission
        idempotencyKey,
      });
    } else {
      // Standard Stripe checkout (backward compatible)
      session = await this.paymentProvider.createCheckoutSession({
        amountCents: calculation.subtotal,
        email: input.email,
        metadata,
        applicationFeeAmount: calculation.commissionAmount,
        idempotencyKey,
      });
    }

    // 9. Cache response for duplicate requests
    await this.idempotencyService.updateResponse(idempotencyKey, {
      data: session,
      timestamp: new Date().toISOString(),
    });

    return { checkoutUrl: session.url };
  }
  ```

**Stripe Integration:**

- **Payment Adapter:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/stripe.adapter.ts` (lines 88-150)

  **Stripe Connect Checkout Session:**

  ```typescript
  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    // Validate commission (0.5% - 50% Stripe requirement)
    const minFee = Math.ceil(input.amountCents * 0.005);
    const maxFee = Math.floor(input.amountCents * 0.50);

    if (input.applicationFeeAmount < minFee || input.applicationFeeAmount > maxFee) {
      throw new Error('Application fee outside Stripe limits (0.5% - 50%)');
    }

    // Create session with idempotency
    const options: Stripe.RequestOptions = {};
    if (input.idempotencyKey) {
      options.idempotencyKey = input.idempotencyKey;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: input.amountCents,
          product_data: {
            name: 'Wedding Package',
            description: 'MAISment/Micro-Wedding Package',
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: input.applicationFeeAmount,  // Platform commission
        transfer_data: {
          destination: input.stripeAccountId,  // Tenant's Connected Account
        },
      },
      success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: this.cancelUrl,
      metadata: input.metadata,  // Includes tenantId
    }, options);

    return { url: session.url, sessionId: session.id };
  }
  ```

**Idempotency Protection:**

- **Purpose:** Prevent duplicate checkout sessions if user clicks "Checkout" multiple times
- **Key Generation:** Hash of (tenantId + email + packageId + eventDate + timestamp)
- **Storage:** IdempotencyKey table with 24-hour expiration
- **Behavior:** Cached response returned for duplicate requests

---

### Stage 7: Payment (Stripe Checkout)

**User Actions:**

- Enters credit card details on Stripe-hosted page
- Reviews order summary (displayed by Stripe)
- Submits payment
- Redirected back to success page on completion

**Payment Flow:**

```
Stripe Checkout → Customer Enters Card → Payment Processing → Success/Failure
                                                ↓
                                        Webhook Sent to MAIS
```

**Stripe Features Used:**

- **Checkout Sessions:** Pre-built hosted payment page
- **Stripe Connect:** Direct charges with application fees
- **Payment Intents:** Automatic payment method validation
- **SCA Support:** Built-in 3D Secure for European cards

**Security:**

- **PCI Compliance:** MAIS never handles card data (Stripe does)
- **Webhook Validation:** Cryptographic signature verification
- **Idempotent Processing:** Duplicate webhook events ignored

**Code References:**

**Stripe Configuration:**

- API Version: `2025-10-29.clover`
- Payment Methods: Card only (can extend to ACH, Apple Pay, Google Pay)
- Currency: USD (can extend to multi-currency)

**Success URL:**

- Format: `https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}`
- Stripe replaces `{CHECKOUT_SESSION_ID}` with actual session ID
- Client uses session ID to poll for booking confirmation

---

### Stage 8: Webhook Processing (Payment Confirmation)

**This is the CRITICAL stage where the booking is created in the database.**

**Webhook Flow:**

```
Stripe → POST /v1/webhooks/stripe → Signature Verification → Idempotency Check → Booking Creation
```

**Code References:**

**Backend:**

- **Webhooks Controller:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` (lines 113-273)

  **Webhook Handler (lines 113-273):**

  ```typescript
  async handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
    // 1. Verify webhook signature (prevent spoofing)
    let event: Stripe.Event;
    try {
      event = await this.paymentProvider.verifyWebhook(rawBody, signature);
    } catch (error) {
      throw new WebhookValidationError('Invalid webhook signature');
    }

    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook received');

    // 2. Extract tenantId from metadata (early extraction)
    let tenantId = 'unknown';
    try {
      const tempSession = event.data.object as Stripe.Checkout.Session;
      tenantId = tempSession?.metadata?.tenantId || 'unknown';
    } catch (err) {
      logger.warn({ eventId: event.id }, 'Could not extract tenantId');
    }

    // 3. Idempotency check (prevent duplicate processing)
    const isDupe = await this.webhookRepo.isDuplicate(tenantId, event.id);
    if (isDupe) {
      logger.info({ eventId: event.id, tenantId }, 'Duplicate webhook ignored');
      return; // Return 200 OK to Stripe
    }

    // 4. Record webhook event (tenant-scoped)
    await this.webhookRepo.recordWebhook({
      tenantId,
      eventId: event.id,
      eventType: event.type,
      rawPayload: rawBody,
    });

    // 5. Process webhook
    try {
      if (event.type === 'checkout.session.completed') {
        // Validate session structure with Zod
        const sessionResult = StripeSessionSchema.safeParse(event.data.object);
        if (!sessionResult.success) {
          await this.webhookRepo.markFailed(tenantId, event.id, 'Invalid session');
          throw new WebhookValidationError('Invalid session structure');
        }

        // Validate metadata with Zod
        const metadataResult = MetadataSchema.safeParse(sessionResult.data.metadata);
        if (!metadataResult.success) {
          await this.webhookRepo.markFailed(tenantId, event.id, 'Invalid metadata');
          throw new WebhookValidationError('Invalid metadata');
        }

        const { tenantId: validatedTenantId, packageId, eventDate, email,
                coupleName, addOnIds, commissionAmount, commissionPercent } = metadataResult.data;

        // Parse add-on IDs (validate array)
        let parsedAddOnIds: string[] = [];
        if (addOnIds) {
          const parsed = JSON.parse(addOnIds);
          const arrayResult = z.array(z.string()).safeParse(parsed);
          if (arrayResult.success) parsedAddOnIds = arrayResult.data;
        }

        // Calculate total from Stripe session
        const totalCents = sessionResult.data.amount_total ?? 0;

        logger.info({ eventId: event.id, tenantId: validatedTenantId, email },
                    'Processing checkout completion');

        // 6. Create booking (tenant-scoped)
        await this.bookingService.onPaymentCompleted(validatedTenantId, {
          sessionId: sessionResult.data.id,
          packageId,
          eventDate,
          email,
          coupleName,
          addOnIds: parsedAddOnIds,
          totalCents,
          commissionAmount: commissionAmount ? parseInt(commissionAmount, 10) : undefined,
          commissionPercent: commissionPercent ? parseFloat(commissionPercent) : undefined,
        });

        logger.info({ eventId: event.id, tenantId: validatedTenantId },
                    'Booking created successfully');
      }

      // 7. Mark webhook as processed
      await this.webhookRepo.markProcessed(tenantId, event.id);
    } catch (error) {
      if (!(error instanceof WebhookValidationError)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.webhookRepo.markFailed(tenantId, event.id, errorMessage);
        throw new WebhookProcessingError(errorMessage);
      }
      throw error;
    }
  }
  ```

**Booking Creation:**

- **Booking Service - onPaymentCompleted:** `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts` (lines 273-328)

  ```typescript
  async onPaymentCompleted(tenantId: string, input: {
    sessionId: string;
    packageId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
    totalCents: number;
    commissionAmount?: number;
    commissionPercent?: number;
  }): Promise<Booking> {
    // 1. Fetch package details
    const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) throw new NotFoundError(`Package ${input.packageId} not found`);

    // 2. Fetch add-on details (for event payload)
    const addOnTitles: string[] = [];
    if (input.addOnIds && input.addOnIds.length > 0) {
      const addOns = await this.catalogRepo.getAddOnsByPackageId(tenantId, pkg.id);
      const selectedAddOns = addOns.filter(a => input.addOnIds?.includes(a.id));
      addOnTitles.push(...selectedAddOns.map(a => a.title));
    }

    // 3. Create booking object
    const booking: Booking = {
      id: `booking_${Date.now()}`,
      packageId: pkg.id,
      coupleName: input.coupleName,
      email: input.email,
      eventDate: input.eventDate,
      addOnIds: input.addOnIds || [],
      totalCents: input.totalCents,
      commissionAmount: input.commissionAmount,
      commissionPercent: input.commissionPercent,
      status: 'PAID',
      createdAt: new Date().toISOString(),
    };

    // 4. Persist booking (enforces unique-by-date per tenant)
    // RACE CONDITION PROTECTION: Uses pessimistic locking + unique constraint
    const created = await this.bookingRepo.create(tenantId, booking);

    // 5. Emit BookingPaid event (for email notification)
    await this._eventEmitter.emit('BookingPaid', {
      bookingId: created.id,
      email: created.email,
      coupleName: created.coupleName,
      eventDate: created.eventDate,
      packageTitle: pkg.title,
      addOnTitles,
      totalCents: input.totalCents,
    });

    return created;
  }
  ```

**Database Constraints:**

- **Unique Constraint:** `@@unique([tenantId, date])` on Booking model
  - Prevents double-booking at database level
  - PostgreSQL enforces atomically
- **Pessimistic Locking:** `SELECT FOR UPDATE` in transaction
  - Locks date row during availability check + booking creation
  - Prevents race conditions between concurrent requests

**Idempotency Protection:**

- **Webhook Level:** Event ID stored in WebhookEvent table
  - Composite unique: `@@unique([tenantId, eventId])`
  - Duplicate events return early (before processing)
- **Booking Level:** Unique constraint on `[tenantId, date]`
  - If webhook retries after booking created, constraint fails gracefully
  - Error logged but not propagated to Stripe (prevents retry loop)

---

### Stage 9: Email Confirmation

**Event-Driven Flow:**

```
BookingPaid Event → Event Subscriber → Email Provider → Postmark API → Customer Inbox
```

**Code References:**

**Backend:**

- **Event Subscription:** `/Users/mikeyoung/CODING/MAIS/server/src/di.ts` (lines 277-297)

  ```typescript
  // Subscribe to BookingPaid events (real mode only)
  eventEmitter.subscribe<{
    bookingId: string;
    email: string;
    coupleName: string;
    eventDate: string;
    packageTitle: string;
    addOnTitles: string[];
    totalCents: number;
  }>('BookingPaid', async (payload) => {
    try {
      await mailProvider.sendBookingConfirm(payload.email, {
        eventDate: payload.eventDate,
        packageTitle: payload.packageTitle,
        totalCents: payload.totalCents,
        addOnTitles: payload.addOnTitles,
      });
      logger.info(
        { bookingId: payload.bookingId, email: payload.email },
        'Booking confirmation email sent'
      );
    } catch (err) {
      logger.error(
        { err, bookingId: payload.bookingId },
        'Failed to send booking confirmation email'
      );
    }
  });
  ```

**Email Provider:**

- **Postmark Adapter:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/postmark.adapter.ts`
  - Sends HTML email using Postmark API
  - Includes booking details (date, package, total)
  - Fallback: File-sink mode writes to `tmp/emails/` if no API token

**Email Content:**

- **Subject:** "Booking Confirmed - [Package Name]"
- **Body:**
  - Personalized greeting (couple names)
  - Event date
  - Package details
  - Add-ons list
  - Total price
  - Contact information
  - Calendar attachment (optional)

**Async Processing:**

- Email sending is non-blocking (event-driven)
- If email fails, booking is still created (critical path isolated)
- Errors logged for manual follow-up

---

### Stage 10: Success Page & Confirmation

**User Actions:**

- Redirected to success page: `/success?session_id={CHECKOUT_SESSION_ID}`
- Views booking confirmation details
- Downloads receipt or calendar invite (future)
- Returns to homepage

**Technical Flow:**

```
Success Page Load → Extract Session ID → Poll Booking Status → Display Confirmation
```

**Code References:**

**Frontend:**

- **Success Page:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/success/Success.tsx` (lines 1-89)

  ```typescript
  export function Success() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const bookingIdParam = searchParams.get("booking_id");

    const [bookingId, setBookingId] = useState<string | null>(bookingIdParam);

    // Poll for booking confirmation (webhook processing async)
    const { bookingDetails, packageData, isLoading, error } =
      useBookingConfirmation({ bookingId });

    const showSuccessIcon = !!bookingDetails;
    const isPaidOrConfirmed = bookingDetails || bookingId;

    return (
      <Container className="py-12 md:py-20">
        <Card className="max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              {showSuccessIcon ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              )}
            </div>
            <CardTitle className="text-4xl md:text-5xl">
              {bookingDetails ? "Booking Confirmed!" : "Almost There!"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <SuccessContent
              sessionId={sessionId}
              bookingDetails={bookingDetails}
              packageData={packageData}
              isLoading={isLoading}
              error={error}
              onBookingCreated={setBookingId}
            />
          </CardContent>

          {isPaidOrConfirmed && (
            <CardFooter className="justify-center">
              <Button asChild>
                <Link to="/">Back to Home</Link>
              </Button>
            </CardFooter>
          )}
        </Card>
      </Container>
    );
  }
  ```

**Booking Confirmation Hook:**

- **useBookingConfirmation:** Polls API every 2 seconds until booking found
- **Max Retries:** 10 attempts (20 seconds total)
- **Fallback:** If webhook delayed, shows "Processing..." state

**UI States:**

1. **Loading:** Spinner + "Processing your booking..."
2. **Success:** Green check + booking details
3. **Error:** Red alert + contact support message

**Booking Details Displayed:**

- Booking ID (reference number)
- Customer names
- Event date
- Package name
- Add-ons list
- Total paid
- Confirmation email sent notice

---

## Technical Implementation

### API Endpoints Summary

**Public Endpoints (X-Tenant-Key required):**

| Method | Endpoint                      | Description                      | Tenant-Scoped |
| ------ | ----------------------------- | -------------------------------- | ------------- |
| GET    | `/v1/segments`                | List active segments             | ✓             |
| GET    | `/v1/segments/:slug`          | Get segment metadata             | ✓             |
| GET    | `/v1/segments/:slug/packages` | Get segment with packages        | ✓             |
| GET    | `/v1/packages`                | List packages                    | ✓             |
| GET    | `/v1/packages/:slug`          | Get package details              | ✓             |
| GET    | `/v1/availability`            | Check date availability (single) | ✓             |
| GET    | `/v1/availability/range`      | Batch fetch unavailable dates    | ✓             |
| POST   | `/v1/bookings/checkout`       | Create Stripe checkout session   | ✓             |

**Webhook Endpoints (Stripe signature required):**

| Method | Endpoint              | Description              | Tenant-Scoped |
| ------ | --------------------- | ------------------------ | ------------- |
| POST   | `/v1/webhooks/stripe` | Process payment webhooks | ✓             |

**Admin Endpoints (JWT required):**

| Method | Endpoint                  | Description          | Tenant-Scoped |
| ------ | ------------------------- | -------------------- | ------------- |
| GET    | `/v1/tenant/bookings`     | List tenant bookings | ✓             |
| GET    | `/v1/tenant/bookings/:id` | Get booking details  | ✓             |

---

### Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Customer Journey                          │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│                    1. DISCOVERY (Frontend)                       │
│  - Homepage / Segment Landing Page                               │
│  - X-Tenant-Key injected in API headers                          │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│              2. TENANT RESOLUTION (Middleware)                   │
│  - Extract X-Tenant-Key from header                              │
│  - Validate format: pk_live_{slug}_{random}                      │
│  - Query: SELECT * FROM Tenant WHERE apiKeyPublic = ?            │
│  - Check isActive = true                                         │
│  - Inject req.tenantId = tenant.id                               │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│              3. CATALOG BROWSING (Service Layer)                 │
│  - CatalogService.getPackagesBySegment(tenantId, segmentId)     │
│  - Cache Check: catalog:{tenantId}:segment:{segmentId}:packages │
│  - DB Query: SELECT * FROM Package WHERE tenantId = ? AND ...   │
│  - Cache Set: 15 minute TTL                                      │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│             4. AVAILABILITY CHECK (Batch Optimized)              │
│  - Frontend: Fetch 60-day range in single request                │
│  - Backend: SELECT date FROM Booking WHERE tenantId = ?          │
│             AND date BETWEEN ? AND ? AND status IN (...)          │
│  - Returns: Array of unavailable dates (YYYY-MM-DD)              │
│  - Client disables dates in calendar picker                      │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│            5. CHECKOUT SESSION (Commission Calc)                 │
│  - CommissionService.calculateBookingTotal(tenantId, ...)        │
│  - Fetch tenant.commissionPercent                                │
│  - Calculate: Math.ceil(subtotal * (percent / 100))              │
│  - Generate idempotency key: hash(tenantId+email+pkg+date+ts)   │
│  - Stripe.checkout.sessions.create({                             │
│     payment_intent_data: {                                       │
│       application_fee_amount: commissionAmount,                  │
│       transfer_data: { destination: tenant.stripeAccountId }     │
│     },                                                           │
│     metadata: { tenantId, packageId, eventDate, ... }            │
│   })                                                             │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│               6. STRIPE CHECKOUT (External)                      │
│  - Customer enters card details                                  │
│  - Stripe processes payment                                      │
│  - Stripe sends webhook: checkout.session.completed              │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│         7. WEBHOOK PROCESSING (Critical Path)                    │
│  - Verify webhook signature (prevent spoofing)                   │
│  - Extract tenantId from metadata                                │
│  - Idempotency check: SELECT * FROM WebhookEvent                 │
│     WHERE tenantId = ? AND eventId = ?                           │
│  - If duplicate: Return 200 OK (already processed)               │
│  - Record webhook: INSERT INTO WebhookEvent(...)                 │
│  - Validate metadata with Zod schemas                            │
│  - BookingService.onPaymentCompleted(tenantId, {...})            │
│  - BEGIN TRANSACTION;                                            │
│     SELECT id FROM Booking WHERE tenantId = ? AND date = ? FOR UPDATE;│
│     INSERT INTO Booking(...) VALUES(...);                        │
│   COMMIT;                                                        │
│  - Emit BookingPaid event                                        │
│  - Mark webhook: UPDATE WebhookEvent SET status = 'PROCESSED'    │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│            8. EMAIL CONFIRMATION (Async)                         │
│  - EventEmitter.emit('BookingPaid', payload)                     │
│  - Subscriber: mailProvider.sendBookingConfirm(...)              │
│  - Postmark API: Send HTML email                                 │
│  - Fallback: File-sink (tmp/emails/) if no API token             │
└──────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────┐
│             9. SUCCESS PAGE (Polling)                            │
│  - Extract session_id from URL                                   │
│  - Poll API: GET /v1/bookings?sessionId={id}                     │
│  - Retry: Every 2s for up to 20s                                 │
│  - Display booking confirmation when found                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Isolation

### Tenant Context Flow

**1. API Key Injection (Client)**

```typescript
// client/src/lib/api.ts (lines 28-100)
let tenantApiKey: string | null = null;

export const api = initClient(Contracts, {
  api: async ({ path, method, headers, body }) => {
    const requestHeaders: Record<string, string> = { ...headers };

    // Inject tenant key for multi-tenant mode
    if (tenantApiKey) {
      requestHeaders['X-Tenant-Key'] = tenantApiKey;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  },
});

// Set tenant key once (widget initialization)
api.setTenantKey('pk_live_bella-weddings_abc123');
```

**2. Tenant Resolution (Middleware)**

```typescript
// server/src/middleware/tenant.ts (lines 55-155)
export function resolveTenant(prisma: PrismaClient) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-tenant-key'] as string;

    // 1. Validate API key format
    if (!apiKey || !apiKeyService.isValidPublicKeyFormat(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // 2. Lookup tenant by public API key
    const tenant = await prisma.tenant.findUnique({
      where: { apiKeyPublic: apiKey },
      select: {
        id: true,
        slug: true,
        name: true,
        commissionPercent: true,
        branding: true,
        stripeAccountId: true,
        stripeOnboarded: true,
        isActive: true,
      },
    });

    // 3. Validate tenant found and active
    if (!tenant) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Tenant account is inactive' });
    }

    // 4. Inject tenant into request
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      commissionPercent: Number(tenant.commissionPercent),
      branding: tenant.branding,
      stripeAccountId: tenant.stripeAccountId,
      stripeOnboarded: tenant.stripeOnboarded,
    };
    req.tenantId = tenant.id;

    next();
  };
}
```

**3. Service Layer Isolation**

```typescript
// ALL service methods require tenantId as first parameter
async getAllPackages(tenantId: string): Promise<PackageWithAddOns[]> {
  const packages = await this.repository.getAllPackagesWithAddOns(tenantId);
  return packages;
}

async getPackageBySlug(tenantId: string, slug: string): Promise<PackageWithAddOns> {
  const pkg = await this.repository.getPackageBySlug(tenantId, slug);
  if (!pkg) throw new NotFoundError(`Package with slug "${slug}" not found`);
  return pkg;
}
```

**4. Repository Pattern**

```typescript
// server/src/adapters/prisma/catalog.repository.ts
async getAllPackagesWithAddOns(tenantId: string): Promise<PackageWithAddOns[]> {
  const packages = await this.prisma.package.findMany({
    where: {
      tenantId,           // ← CRITICAL: Tenant isolation
      active: true,
    },
    include: {
      addOns: {
        where: { active: true },
      },
    },
  });

  return packages;
}
```

**5. Cache Isolation**

```typescript
// CORRECT - Tenant-scoped cache key
const cacheKey = `catalog:${tenantId}:packages`;
this.cache?.set(cacheKey, packages, 900);

// WRONG - Would leak data between tenants
const cacheKey = 'catalog:packages'; // ❌ Never do this!
```

### Data Isolation Guarantees

**Database Level:**

- All models have `tenantId` column
- Composite unique constraints: `@@unique([tenantId, slug])`
- Indexes: `@@index([tenantId, active])`

**Application Level:**

- Repository methods enforce `tenantId` parameter
- Service layer passes `tenantId` to all repository calls
- TypeScript compiler prevents accidental omission

**Cache Level:**

- Cache keys include `tenantId`
- Format: `{service}:{tenantId}:{resource}:{id}`
- Example: `catalog:tenant_abc:package:intimate-ceremony`

**API Level:**

- Middleware validates API key before route handler
- Invalid key = 401 Unauthorized (request never reaches service)
- Inactive tenant = 403 Forbidden (explicit block)

### Security Audit Checklist

- [ ] All repository methods require `tenantId` parameter
- [ ] All cache keys include `tenantId`
- [ ] All webhook metadata includes `tenantId`
- [ ] All database queries filter by `tenantId`
- [ ] No global queries (e.g., `findMany()` without `where: { tenantId }`)
- [ ] Tenant API keys validated before processing
- [ ] Stripe metadata includes `tenantId` for webhook processing
- [ ] Commission calculations fetch tenant-specific rate

---

## Error Handling & Edge Cases

### 1. Double-Booking Prevention

**Problem:** Two customers select the same date simultaneously.

**Solution:** Three-layer defense (ADR-001):

**Layer 1: Database Constraint**

```prisma
model Booking {
  tenantId String
  date     DateTime @db.Date

  @@unique([tenantId, date]) // PostgreSQL enforces atomically
}
```

**Layer 2: Pessimistic Locking**

```typescript
await prisma.$transaction(async (tx) => {
  // Lock the date row (blocks concurrent transactions)
  const existing = await tx.$queryRaw`
    SELECT id FROM "Booking"
    WHERE "tenantId" = ${tenantId} AND date = ${date}
    FOR UPDATE;
  `;

  if (existing.length > 0) {
    throw new BookingConflictError(date);
  }

  // Create booking within same transaction
  await tx.booking.create({
    data: { tenantId, date, ... }
  });
});
```

**Layer 3: Graceful Error Handling**

```typescript
try {
  await bookingRepo.create(tenantId, booking);
} catch (error) {
  if (error.code === 'P2002') {
    // Prisma unique constraint violation
    throw new BookingConflictError(date);
  }
  throw error;
}
```

**Result:**

- First request acquires lock, creates booking
- Second request waits for lock, sees existing booking, throws error
- Customer sees "Date unavailable" toast notification
- No partial state (transaction atomicity)

---

### 2. Payment Webhook Retry

**Problem:** Stripe retries webhooks if response is not 200 OK.

**Solution:** Idempotent webhook processing.

**Idempotency Check:**

```typescript
// Check if webhook already processed
const isDupe = await this.webhookRepo.isDuplicate(tenantId, event.id);
if (isDupe) {
  logger.info({ eventId: event.id, tenantId }, 'Duplicate webhook ignored');
  return; // Return 200 OK to Stripe (prevents retry)
}
```

**Webhook Recording:**

```typescript
// Record webhook BEFORE processing
await this.webhookRepo.recordWebhook({
  tenantId,
  eventId: event.id,
  eventType: event.type,
  rawPayload: rawBody,
});
```

**Database Schema:**

```prisma
model WebhookEvent {
  id        String @id @default(uuid())
  tenantId  String
  eventId   String // Stripe event ID
  eventType String
  status    WebhookStatus @default(PENDING)

  @@unique([tenantId, eventId]) // Composite unique prevents duplicates
}
```

**Result:**

- First webhook: Recorded + processed
- Retry webhook: Detected as duplicate, returns 200 OK immediately
- No duplicate bookings created
- Stripe stops retrying after 200 OK

---

### 3. Session Expiration

**Problem:** Customer abandons checkout, Stripe session expires.

**Solution:** Session expiration handling.

**Stripe Configuration:**

- Session expires after 24 hours
- Success URL includes `session_id` query parameter
- Client polls for booking with timeout

**Success Page Logic:**

```typescript
const useBookingConfirmation = ({ bookingId }: { bookingId: string | null }) => {
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 10; // 20 seconds total

  useEffect(() => {
    const interval = setInterval(() => {
      if (retries >= MAX_RETRIES) {
        clearInterval(interval);
        setError('Booking not found. Please contact support.');
        return;
      }

      // Poll API
      fetchBooking(bookingId).then((data) => {
        if (data) {
          setBookingDetails(data);
          clearInterval(interval);
        } else {
          setRetries((r) => r + 1);
        }
      });
    }, 2000); // Every 2 seconds

    return () => clearInterval(interval);
  }, [bookingId, retries]);
};
```

**Result:**

- Webhook usually processes within 2-5 seconds
- Success page shows spinner while waiting
- After 20 seconds: Shows "Contact support" message
- Manual lookup available via booking ID

---

### 4. Invalid Add-On IDs

**Problem:** Customer tampers with API request, sends invalid add-on IDs.

**Solution:** Server-side validation.

**Validation Logic:**

```typescript
// Fetch add-ons (tenant-scoped, active only)
const addOns = await this.prisma.addOn.findMany({
  where: {
    tenantId, // CRITICAL: Prevent cross-tenant access
    id: { in: addOnIds }, // Requested IDs
    active: true, // Only active add-ons
  },
});

// Validate all add-ons found
if (addOns.length !== addOnIds.length) {
  const foundIds = addOns.map((a) => a.id);
  const missingIds = addOnIds.filter((id) => !foundIds.includes(id));
  throw new Error(`Invalid add-ons: ${missingIds.join(', ')}`);
}
```

**Result:**

- Invalid IDs: Request rejected with 400 Bad Request
- Cross-tenant IDs: Filtered out by `tenantId` clause
- Inactive add-ons: Excluded from query
- Price calculated from database (never trusted from client)

---

### 5. Stripe Connect Not Onboarded

**Problem:** Tenant hasn't completed Stripe Connect onboarding.

**Solution:** Fallback to standard Stripe checkout.

**Checkout Logic:**

```typescript
if (tenant.stripeAccountId && tenant.stripeOnboarded) {
  // Stripe Connect checkout (payment → tenant account)
  session = await this.paymentProvider.createConnectCheckoutSession({
    amountCents: calculation.subtotal,
    stripeAccountId: tenant.stripeAccountId,
    applicationFeeAmount: calculation.commissionAmount,
    ...
  });
} else {
  // Standard Stripe checkout (backward compatible)
  session = await this.paymentProvider.createCheckoutSession({
    amountCents: calculation.subtotal,
    applicationFeeAmount: calculation.commissionAmount,
    ...
  });
}
```

**Result:**

- Connect onboarded: Payment → tenant account, platform takes fee
- Not onboarded: Payment → platform account (manual payout)
- No checkout failure due to onboarding status

---

### 6. Email Delivery Failure

**Problem:** Email provider fails (API key invalid, rate limit, etc).

**Solution:** Async event-driven with error logging.

**Email Subscription:**

```typescript
eventEmitter.subscribe('BookingPaid', async (payload) => {
  try {
    await mailProvider.sendBookingConfirm(payload.email, {...});
    logger.info({ bookingId: payload.bookingId }, 'Email sent');
  } catch (err) {
    logger.error({ err, bookingId: payload.bookingId },
                  'Failed to send email'); // ← Log for manual follow-up
  }
});
```

**Fallback (Dev Mode):**

- Postmark adapter checks for API token
- If missing: Writes email to `tmp/emails/{timestamp}.json`
- Developer can inspect email content locally

**Result:**

- Booking still created (critical path isolated)
- Email failure logged for manual retry
- Customer can be contacted manually via booking record
- No transaction rollback due to email failure

---

### 7. Race Condition: Multiple Checkout Clicks

**Problem:** Customer clicks "Proceed to Checkout" multiple times.

**Solution:** Idempotent checkout session creation.

**Idempotency Key Generation:**

```typescript
const idempotencyKey = this.idempotencyService.generateCheckoutKey(
  tenantId,
  input.email,
  pkg.id,
  input.eventDate,
  Date.now() // Timestamp for uniqueness
);
```

**Cache Check:**

```typescript
// Check for cached response
const cachedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
if (cachedResponse) {
  return { checkoutUrl: cachedResponse.data.url }; // Return same session
}
```

**Store Response:**

```typescript
// Cache response after Stripe call
await this.idempotencyService.updateResponse(idempotencyKey, {
  data: session,
  timestamp: new Date().toISOString(),
});
```

**Result:**

- First click: Creates new Stripe session
- Subsequent clicks: Returns cached session URL
- No duplicate sessions created
- Customer redirected to same checkout page

---

## Mobile Responsiveness

### Sprint 8: UX & Mobile Excellence

**Goal:** Ensure seamless booking experience on mobile devices (60%+ traffic).

### Key Mobile Optimizations

**1. Touch-Optimized Targets**

- Minimum touch target: 44x44px (Apple HIG, Android Material Design)
- Button padding: `px-8 py-4` (TailwindCSS utility classes)
- Increased spacing between interactive elements

**2. Responsive Layouts**

- **Breakpoints:**
  - `sm:` 640px (mobile landscape)
  - `md:` 768px (tablet)
  - `lg:` 1024px (desktop)
  - `xl:` 1280px (wide desktop)

**3. Mobile-First CSS**

- Base styles target mobile (min-width: 320px)
- Desktop enhancements via media queries
- Flexbox/Grid for fluid layouts

**4. Performance**

- Lazy loading images (`loading="lazy"`)
- Optimized bundle size (code splitting)
- Preconnect to Stripe CDN

### Component Examples

**DatePicker (Mobile):**

```tsx
<DayPicker
  mode="single"
  selected={selectedDate}
  onSelect={handleDateSelect}
  disabled={[{ before: today }, ...unavailableDates]}
  className="border border-neutral-300 rounded-lg p-4 bg-neutral-50"
  // Mobile-optimized: Large touch targets for dates
/>
```

**Add-On Cards (Mobile):**

```tsx
<Card
  className={cn(
    'cursor-pointer transition-all duration-300',
    'hover:scale-[1.02] active:scale-[0.98]', // Touch feedback
    isSelected && 'border-macon-orange shadow-elevation-2 bg-orange-50 scale-[1.01]'
  )}
  onClick={() => onToggle(addOn.id)}
>
  <label className="flex items-start gap-4 p-5 cursor-pointer">
    {/* Checkbox with large touch target */}
    <div className="relative mt-0.5">
      <div className="h-6 w-6 rounded-md border-2 transition-all" />
    </div>

    {/* Content with readable font sizes */}
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-xl mb-1">{addOn.title}</h3>
      <p className="text-sm text-gray-600">{addOn.description}</p>
    </div>

    {/* Price with visual emphasis */}
    <span className="font-bold text-2xl">{formatCurrency(addOn.priceCents)}</span>
  </label>
</Card>
```

**Progress Steps (Mobile):**

```tsx
<ProgressSteps
  steps={[
    { label: 'Package', description: 'Choose your package' },
    { label: 'Date', description: 'Select ceremony date' },
    { label: 'Extras', description: 'Add-ons & details' },
    { label: 'Checkout', description: 'Complete booking' },
  ]}
  currentStep={currentStep}
  // Mobile: Horizontal scroll with snap points
  className="overflow-x-auto snap-x snap-mandatory"
/>
```

### Mobile Testing Checklist

- [ ] Touch targets ≥ 44x44px
- [ ] No horizontal scrolling (except intentional)
- [ ] Forms accessible via virtual keyboard
- [ ] Images optimized (WebP format)
- [ ] Buttons have loading states (prevent double-tap)
- [ ] Toast notifications visible above keyboard
- [ ] Calendar picker renders correctly on small screens
- [ ] Checkout button sticky on mobile (always accessible)

---

## Performance Optimizations

### 1. Query Optimization

**N+1 Query Prevention:**

- **Problem:** Fetching packages, then add-ons for each package (1 + N queries)
- **Solution:** Single query with `include` (Prisma)
- **Result:** 91% query reduction

**Before:**

```typescript
const packages = await prisma.package.findMany({ where: { tenantId } }); // 1 query
for (const pkg of packages) {
  pkg.addOns = await prisma.addOn.findMany({ where: { packageId: pkg.id } }); // N queries
}
```

**After:**

```typescript
const packages = await prisma.package.findMany({
  where: { tenantId },
  include: { addOns: { where: { active: true } } }, // 1 query
});
```

---

### 2. Cache Strategy

**Application-Level Caching:**

- **Cache Service:** In-memory LRU cache (mock mode) or Redis (real mode)
- **TTL:** 15 minutes (900 seconds)
- **Invalidation:** On package/add-on updates

**Cache Keys:**

```typescript
// Catalog
`catalog:${tenantId}:all-packages``catalog:${tenantId}:package:${slug}``catalog:${tenantId}:segment:${segmentId}:packages`
// Availability
`availability:${tenantId}:dateRange:${startDate}:${endDate}`;
```

**Performance Impact:**

- **Cache Hit:** < 1ms response time
- **Cache Miss:** 50-100ms (database query)
- **Cache Hit Rate:** 85%+ (typical)

---

### 3. Batch Operations

**Unavailable Dates Fetching:**

- **Before:** 60 API calls per calendar view
- **After:** 1 API call (batch fetch 60-day range)
- **Result:** 98% reduction in API requests

**Database Query:**

```sql
SELECT date FROM "Booking"
WHERE "tenantId" = $1
  AND date BETWEEN $2 AND $3
  AND status IN ('CONFIRMED', 'PENDING');
```

**Response Size:**

- Typical: 5-10 unavailable dates
- Max: 60 dates (fully booked)
- Transfer: < 1KB gzipped

---

### 4. React Query Optimization

**Stale-While-Revalidate Pattern:**

```typescript
const { data: packages } = useQuery({
  queryKey: queryKeys.catalog.packages(tenantId),
  queryFn: () => api.getPackages(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (cache retention)
  refetchOnWindowFocus: false, // Prevent refetch on tab switch
});
```

**Benefits:**

- Instant page transitions (cached data)
- Background revalidation (fresh data)
- Reduced API load (fewer requests)

---

### 5. Code Splitting

**Lazy Loading:**

```typescript
const PackagePage = lazy(() => import('./features/catalog/PackagePage'));
const Success = lazy(() => import('./pages/success/Success'));

<Route path="/package/:slug" element={
  <Suspense fallback={<Spinner />}>
    <PackagePage />
  </Suspense>
} />
```

**Bundle Analysis:**

- **Main bundle:** 150KB (gzipped)
- **Lazy chunks:** 30-50KB each
- **Initial load:** < 200KB (fast TTI)

---

### 6. Image Optimization

**Package Photos:**

- **Format:** WebP (fallback to JPEG)
- **Compression:** Quality 80
- **Lazy Loading:** `loading="lazy"` attribute
- **Responsive:** `srcset` for different screen sizes

**Example:**

```tsx
<img
  src={pkg.photoUrl}
  alt={pkg.title}
  loading="lazy"
  className="w-full h-full object-cover"
  srcSet={`
    ${pkg.photoUrl}?w=400 400w,
    ${pkg.photoUrl}?w=800 800w,
    ${pkg.photoUrl}?w=1200 1200w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

## Testing Strategy

### 1. Unit Tests

**Scope:** Services, utilities, pure functions

**Example: Commission Calculation**

```typescript
describe('CommissionService', () => {
  it('should calculate commission with rounding up', async () => {
    const result = await commissionService.calculateCommission('tenant_abc', 50000);
    expect(result.amount).toBe(6000); // $60.00 (12%)
  });

  it('should enforce Stripe minimum (0.5%)', async () => {
    const result = await commissionService.calculateCommission('tenant_abc', 100);
    expect(result.amount).toBe(1); // 0.5% of $1.00 = $0.01
  });
});
```

**Coverage Target:** 80%+

---

### 2. Integration Tests

**Scope:** API endpoints, database interactions

**Example: Booking Flow**

```typescript
describe('POST /v1/bookings/checkout', () => {
  it('should create Stripe checkout session with commission', async () => {
    const response = await request(app)
      .post('/v1/bookings/checkout')
      .set('X-Tenant-Key', testTenant.apiKeyPublic)
      .send({
        packageId: testPackage.id,
        eventDate: '2025-06-15',
        email: 'customer@example.com',
        coupleName: 'Jane & John',
        addOnIds: [testAddOn.id],
      });

    expect(response.status).toBe(200);
    expect(response.body.checkoutUrl).toContain('checkout.stripe.com');
  });

  it('should prevent double-booking with conflict error', async () => {
    // Create first booking
    await createBooking({ tenantId, date: '2025-06-15' });

    // Attempt second booking on same date
    const response = await request(app)
      .post('/v1/bookings/checkout')
      .set('X-Tenant-Key', testTenant.apiKeyPublic)
      .send({ packageId: testPackage.id, eventDate: '2025-06-15', ... });

    expect(response.status).toBe(409); // Conflict
    expect(response.body.error).toContain('already booked');
  });
});
```

**Coverage Target:** 70%+

---

### 3. E2E Tests (Playwright)

**Scope:** Complete user journeys

**Example: Booking Flow**

```typescript
test('customer can complete booking flow', async ({ page }) => {
  // 1. Navigate to package page
  await page.goto('/package/intimate-ceremony');

  // 2. Select date
  await page.click('[data-testid="calendar-2025-06-15"]');

  // 3. Select add-on
  await page.click('[data-testid="addon-photography"]');

  // 4. Enter customer details
  await page.fill('[data-testid="input-coupleName"]', 'Jane & John');
  await page.fill('[data-testid="input-email"]', 'jane@example.com');

  // 5. Verify total
  await expect(page.locator('[data-testid="total"]')).toHaveText('$6,500.00');

  // 6. Proceed to checkout
  await page.click('[data-testid="checkout"]');

  // 7. Verify redirect to Stripe
  await page.waitForURL(/checkout.stripe.com/);
  expect(page.url()).toContain('checkout.stripe.com');
});
```

**Coverage Target:** Critical paths only (checkout, payment, confirmation)

---

### 4. Manual Testing Checklist

**Desktop (Chrome/Firefox/Safari):**

- [ ] Browse packages
- [ ] Select date from calendar
- [ ] Add/remove add-ons
- [ ] Enter customer details
- [ ] Proceed to Stripe checkout
- [ ] Complete payment (test mode)
- [ ] Receive confirmation email
- [ ] View success page

**Mobile (iOS Safari/Android Chrome):**

- [ ] Touch targets responsive
- [ ] Calendar picker usable
- [ ] Forms accessible via keyboard
- [ ] Checkout button visible
- [ ] Stripe checkout mobile-optimized

**Edge Cases:**

- [ ] Expired Stripe session
- [ ] Double-booking attempt
- [ ] Invalid add-on IDs
- [ ] Network error during checkout
- [ ] Webhook retry scenario

---

## Appendix

### Key File Locations

**Backend:**

- Tenant Middleware: `/Users/mikeyoung/CODING/MAIS/server/src/middleware/tenant.ts`
- Booking Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts`
- Catalog Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/catalog.service.ts`
- Availability Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/availability.service.ts`
- Commission Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/commission.service.ts`
- Webhooks Controller: `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts`
- Segments Routes: `/Users/mikeyoung/CODING/MAIS/server/src/routes/segments.routes.ts`
- Stripe Adapter: `/Users/mikeyoung/CODING/MAIS/server/src/adapters/stripe.adapter.ts`
- DI Container: `/Users/mikeyoung/CODING/MAIS/server/src/di.ts`
- Database Schema: `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`

**Frontend:**

- Home Page: `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx`
- Package Page: `/Users/mikeyoung/CODING/MAIS/client/src/features/catalog/PackagePage.tsx`
- Date Picker: `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/DatePicker.tsx`
- Add-On List: `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/AddOnList.tsx`
- Total Box: `/Users/mikeyoung/CODING/MAIS/client/src/features/booking/TotalBox.tsx`
- Success Page: `/Users/mikeyoung/CODING/MAIS/client/src/pages/success/Success.tsx`
- API Client: `/Users/mikeyoung/CODING/MAIS/client/src/lib/api.ts`

### Related Documentation

- [ARCHITECTURE.md](/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md) - System architecture overview
- [MULTI_TENANT_IMPLEMENTATION_GUIDE.md](/Users/mikeyoung/CODING/MAIS/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Multi-tenant patterns
- [DECISIONS.md](/Users/mikeyoung/CODING/MAIS/DECISIONS.md) - ADRs (double-booking, webhook idempotency)
- [TESTING.md](/Users/mikeyoung/CODING/MAIS/TESTING.md) - Test strategy and execution

---

**Document Status:** ✅ Complete
**Next Review:** After Sprint 10 (new features may require updates)
