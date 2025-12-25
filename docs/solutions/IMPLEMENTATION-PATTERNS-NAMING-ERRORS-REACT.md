---
title: Implementation Patterns - Naming, Errors, React Performance
category: implementation
tags: [patterns, naming-conventions, error-handling, react-performance, examples]
priority: P2
date: 2025-12-24
---

# Implementation Patterns - Naming, Errors, React Performance

Complete working examples for implementing the prevention strategies correctly.

---

## Pattern 1: Correct Naming in Routes & API Calls

### Schema Definition

```typescript
// packages/contracts/src/api.v1.ts

export const getPackageBySlug = {
  method: 'GET',
  path: '/packages/:slug',  // ← Parameter is 'slug'
  responses: {
    200: PackageSchema,
    404: ErrorSchema,
  },
} as const;

export const getPackageById = {
  method: 'GET',
  path: '/packages/:id',  // ← Different endpoint, different parameter
  responses: {
    200: PackageSchema,
    404: ErrorSchema,
  },
} as const;
```

### Frontend Implementation

```typescript
// client/src/pages/DateBookingPage.tsx

interface DateBookingPageParams {
  packageSlug: string;  // ← Explicit that this is a slug, not ID
}

export function DateBookingPage() {
  const { packageSlug } = useParams<DateBookingPageParams>();

  const {
    data: packageData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['package', packageSlug],
    queryFn: async () => {
      if (!packageSlug) {
        throw new Error('No package slug provided');
      }
      // ✅ CORRECT: Parameter name matches API contract
      const response = await api.getPackageBySlug({
        params: { slug: packageSlug },  // ← 'slug' matches contract
      });
      if (response.status !== 200 || !response.body) {
        throw new Error('Package not found');
      }
      return response.body as PackageDto;
    },
    enabled: !!packageSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Rest of component...
}
```

### Helper Functions

```typescript
// client/src/features/storefront/utils.ts

/**
 * Build the booking link for a package
 *
 * @param packageSlug - User-friendly URL slug (not database ID)
 * @param bookingType - Type of booking (DATE or TIMESLOT)
 */
export function buildBookingLink(
  packageSlug: string,
  bookingType: 'DATE' | 'TIMESLOT'
): string {
  // ✅ CLEAR: Parameter name makes it obvious this is a slug
  if (bookingType === 'DATE') {
    return `../book/date/${packageSlug}`;
  }
  return '../book';
}

/**
 * Get package by slug (wrapper for API)
 */
export async function getPackageBySlug(slug: string): Promise<PackageDto> {
  const response = await api.getPackageBySlug({
    params: { slug },  // ✅ Parameter name matches API
  });
  if (response.status !== 200) {
    throw new Error('Package not found');
  }
  return response.body as PackageDto;
}

// ❌ WRONG - Don't do this
export async function getPackageById(id: string): Promise<PackageDto> {
  // This confuses whether 'id' is database ID or slug
  // Should use getPackageBySlug instead
}
```

### Bad Examples to Avoid

```typescript
// ❌ WRONG - Parameter name doesn't match API
interface DateBookingPageParams {
  packageId: string;  // API expects 'slug'
}

const { packageId } = useParams<DateBookingPageParams>();
const pkg = await api.getPackageBySlug({
  params: { packageId },  // ← Type error! API expects 'slug'
});

// ❌ WRONG - Ambiguous naming
const identifier = pkg.id;  // Is this a slug or database ID?
const pkgId = pkg.slug;     // This is confusing - slug is NOT an ID
const param = useParams();  // What is 'param'? No context
```

---

## Pattern 2: Secure Error Handling

### Error Class Definition

```typescript
// server/src/lib/errors/business.ts

/**
 * Package not available error
 *
 * SECURITY: Generic message to prevent package ID enumeration attacks.
 * - Never includes packageId in error message
 * - Sensitive details are logged separately with context
 * - Safe to return to client
 */
export class PackageNotAvailableError extends PackageError {
  constructor() {
    super(
      'The requested package is not available for booking',  // Generic
      'PACKAGE_NOT_AVAILABLE'
    );
    this.name = 'PackageNotAvailableError';
  }
}

/**
 * Booking conflict error
 *
 * SECURITY: Message doesn't expose date value.
 * Use message parameter for contextual info if needed.
 */
export class BookingConflictError extends AppError {
  constructor(date: string, message?: string) {
    super(
      message ?? 'Date is already booked',  // Generic default
      'BOOKING_CONFLICT',
      409,
      true
    );
    this.name = 'BookingConflictError';
  }
}

/**
 * Invalid booking type error
 *
 * SECURITY: Includes package title (safe) but not ID.
 */
export class InvalidBookingTypeError extends PackageError {
  constructor(packageTitle: string, expectedType: string) {
    super(
      `Package "${packageTitle}" does not support ${expectedType} booking type`,
      'INVALID_BOOKING_TYPE'
    );
    this.name = 'InvalidBookingTypeError';
  }
}
```

### Service Implementation

```typescript
// server/src/services/catalog.service.ts

export class CatalogService {
  async getPackageBySlug(
    tenantId: string,
    slug: string
  ): Promise<PackageDto> {
    const pkg = await this.catalogRepo.getBySlug(tenantId, slug);

    if (!pkg) {
      // ✅ CORRECT: Log details internally
      this.logger.warn('Package not found', {
        tenantId,
        slug,
        timestamp: new Date(),
      });

      // ✅ CORRECT: Throw generic error to client
      throw new PackageNotAvailableError();
    }

    if (!pkg.active) {
      // ✅ CORRECT: Same generic error for both missing and inactive
      this.logger.warn('Package not available', {
        tenantId,
        packageId: pkg.id,  // ← Safe to log
        slug,
        reason: 'not_active',
      });

      throw new PackageNotAvailableError();
    }

    return this.mapToDto(pkg);
  }

  async createBooking(
    tenantId: string,
    packageSlug: string,
    date: string
  ): Promise<BookingDto> {
    const pkg = await this.catalogRepo.getBySlug(tenantId, packageSlug);
    if (!pkg) {
      throw new PackageNotAvailableError();
    }

    try {
      return await this.bookingService.create(tenantId, pkg.id, date);
    } catch (error) {
      if (error instanceof BookingConflictError) {
        // ✅ CORRECT: Re-throw as-is, message is already generic
        throw error;
      }

      // ❌ WRONG - Don't add details
      // throw new Error(`Booking failed: ${error.message}`);

      // ✅ CORRECT: Log error, throw generic to client
      this.logger.error('Booking creation failed', {
        tenantId,
        packageId: pkg.id,
        date,
        originalError: error,
      });
      throw new BookingError('Could not create booking');
    }
  }
}
```

### Route Implementation

```typescript
// server/src/routes/public-date-booking.routes.ts

tsRestExpress(
  contract.bookPackageBySlug,
  async ({ req, body }) => {
    try {
      const tenantId = req.tenantId;
      const { packageSlug, date } = body;

      // ✅ CORRECT: Use service which handles errors properly
      const booking = await bookingService.createBooking(
        tenantId,
        packageSlug,
        date
      );

      return {
        status: 201,
        body: { success: true, booking },
      };
    } catch (error) {
      // ✅ CORRECT: Map domain errors to HTTP responses
      if (error instanceof PackageNotAvailableError) {
        return {
          status: 404,
          body: { error: error.message },  // Generic message
        };
      }

      if (error instanceof BookingConflictError) {
        return {
          status: 409,
          body: { error: error.message },  // Generic message
        };
      }

      // ✅ CORRECT: Unexpected errors get generic response
      this.logger.error('Unexpected error in booking route', {
        originalError: error,
        tenantId: req.tenantId,
      });

      return {
        status: 500,
        body: { error: 'Something went wrong' },
      };
    }
  }
);
```

### Bad Examples to Avoid

```typescript
// ❌ WRONG - Error reveals information
throw new Error(`Package ${packageId} not found`);
throw new Error(`Tenant ${tenantId} is not active`);
throw new Error(`Database: unique constraint failed on column 'slug'`);

// ❌ WRONG - Database error message to client
catch (error) {
  if (error.code === 'UNIQUE_VIOLATION') {
    return { status: 409, body: { error: error.message } };  // Leaks schema!
  }
}

// ❌ WRONG - Including internal IDs in user-facing message
async getPackageBySlug(slug: string) {
  const pkg = await db.package.findFirst({ where: { slug } });
  if (!pkg) {
    throw new Error(`Package with slug '${slug}' not found`);  // Could leak info
  }
}
```

---

## Pattern 3: React Performance - Constants & Memoization

### Module-Level Constants

```typescript
// client/src/features/storefront/utils.ts

// ✅ CORRECT: Defined once at module level
export const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'] as const;

export const TIER_DISPLAY_NAMES: Record<TierLevel, string> = {
  tier_1: 'Essential',
  tier_2: 'Popular',
  tier_3: 'Premium',
};

export const CARD_DESCRIPTION_MAX_LENGTH = 150;

export function getTierDisplayName(level: TierLevel): string {
  return TIER_DISPLAY_NAMES[level] || level;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function extractTiers(packages: PackageDto[]): Record<TierLevel, PackageDto> {
  const result: Record<TierLevel, PackageDto> = {
    tier_1: undefined!,
    tier_2: undefined!,
    tier_3: undefined!,
  };

  for (const pkg of packages) {
    const level = pkg.tierLevel as TierLevel;
    if (TIER_LEVELS.includes(level)) {
      result[level] = pkg;
    }
  }

  return result;
}
```

### Component with Proper Memoization

```typescript
// client/src/features/storefront/TierDetail.tsx

import { useMemo } from 'react';
import { TIER_LEVELS, getTierDisplayName, extractTiers } from './utils';

interface TierDetailProps {
  package: PackageDto;
  tierLevel: TierLevel;
  allPackages: PackageDto[];
}

export function TierDetail({
  package: pkg,
  tierLevel,
  allPackages,
}: TierDetailProps) {
  // ✅ CORRECT: Constants at module level, never recreated
  const getDisplayName = (level: TierLevel) =>
    getTierDisplayName(level);  // Function reference, fine to call in render

  // ✅ CORRECT: Expensive computation memoized
  const tiers = useMemo(() => extractTiers(allPackages), [allPackages]);

  // ✅ CORRECT: Computed value memoized and dependencies are correct
  const navigation = useMemo(() => {
    const currentIndex = TIER_LEVELS.indexOf(tierLevel);
    const prevLevel = currentIndex > 0 ? TIER_LEVELS[currentIndex - 1] : null;
    const nextLevel = currentIndex < TIER_LEVELS.length - 1 ? TIER_LEVELS[currentIndex + 1] : null;

    return {
      prev: prevLevel && tiers[prevLevel] ? { level: prevLevel, pkg: tiers[prevLevel] } : null,
      next: nextLevel && tiers[nextLevel] ? { level: nextLevel, pkg: tiers[nextLevel] } : null,
    };
  }, [tierLevel, tiers]);  // ✅ Dependencies correct

  // Rest of component...
  return (
    <div>
      {/* Child components receive stable objects */}
      <NavigationComponent nav={navigation} />
    </div>
  );
}
```

### Wrapper Component with Memo

```typescript
// client/src/features/storefront/TierCard.tsx

import { memo } from 'react';
import { ChoiceCardBase, type ChoiceCardBaseProps } from './ChoiceCardBase';

interface TierCardProps {
  tier: PackageDto;
}

// ✅ CORRECT: Wrapped with memo because receives object prop
export const TierCard = memo(function TierCard({ tier }: TierCardProps) {
  return (
    <ChoiceCardBase
      title={tier.title}
      description={tier.description}
      imageUrl={tier.photoUrl}
      cta="View Details"
      href={`/tiers/${tier.slug}`}
    />
  );
});

TierCard.displayName = 'TierCard';  // ✅ Helps with debugging
```

### Base Component

```typescript
// client/src/features/storefront/ChoiceCardBase.tsx

import { memo } from 'react';

export interface ChoiceCardBaseProps {
  title: string;
  description: string;
  imageUrl: string | null;
  cta: string;
  href: string;
}

// ✅ CORRECT: Base component wrapped with memo
export const ChoiceCardBase = memo(function ChoiceCardBase({
  title,
  description,
  imageUrl,
  cta,
  href,
}: ChoiceCardBaseProps) {
  return (
    <a href={href} className="card">
      {imageUrl && (
        <img src={imageUrl} alt={title} className="card-image" />
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="cta">{cta}</div>
    </a>
  );
});

ChoiceCardBase.displayName = 'ChoiceCardBase';
```

### Bad Examples to Avoid

```typescript
// ❌ WRONG - Constants created in render
export function TierSelector() {
  const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];  // New array every render!
  const names = { tier_1: 'Essential', tier_2: 'Popular' };  // New object every render!

  return <div>{TIER_LEVELS.map(level => <span>{names[level]}</span>)}</div>;
}

// ❌ WRONG - Object created without useMemo
export function TierDetail({ allPackages }) {
  const tiers = extractTiers(allPackages);  // New object every render
  const navigation = {  // New object every render
    prev: tiers[0],
    next: tiers[1],
  };
  return <Child nav={navigation} />;  // Child re-renders every time
}

// ❌ WRONG - Memo without prop stabilization
export const TierCard = memo(function TierCard({ tier }) {
  return <Base {...tier} />;
});

// Parent creates new object every render
export function Parent({ tiers }) {
  return tiers.map(tier => <TierCard tier={tier} />);  // OK
  // OR
  return <TierCard tier={{ title: 'New' }} />;  // ❌ Wrong! New object every render
}

// ❌ WRONG - useCallback without memo'ed child
export function Parent() {
  const handleClick = useCallback(() => {  // No benefit without memo'ed child
    doSomething();
  }, []);

  return <button onClick={handleClick}>Click</button>;  // Not memoized!
}

// ✅ CORRECT - useCallback WITH memo'ed child
const Button = memo(function Button({ onClick }) {
  return <button onClick={onClick}>Click</button>;
});

export function Parent() {
  const handleClick = useCallback(() => {  // Now this is beneficial
    doSomething();
  }, []);

  return <Button onClick={handleClick} />;  // Memo'ed child, stable callback
}
```

---

## Summary: Quick Reference

### Naming Pattern

```typescript
// Always: Parameter name = API contract name
interface Params {
  packageSlug: string;  // API expects 'slug'
}
const { packageSlug } = useParams<Params>();
await api.getPackageBySlug({ params: { slug: packageSlug } });
```

### Error Pattern

```typescript
// Always: Generic message to client, detailed logging
try {
  const result = await service.getPackage(id);
} catch (error) {
  if (error instanceof PackageNotAvailableError) {
    logger.warn('Package not available', { id, tenantId });  // ← Details logged
    return { status: 404, body: { error: error.message } };  // ← Generic to client
  }
}
```

### React Pattern

```typescript
// Always: Constants module-level, objects use useMemo
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];  // ← Module level

export const TierCard = memo(function TierCard({ tier }) {  // ← Wrapped with memo
  return <Base {...tier} />;
});

export function Parent({ tiers }) {
  const navigation = useMemo(() => calculateNav(tiers), [tiers]);  // ← Memoized
  return <TierCard nav={navigation} />;  // ← Child receives stable object
}
```

---

## Files to Reference

- Error classes: `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`
- API contracts: `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/api.v1.ts`
- Good example: `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierDetail.tsx`
- Good example: `/Users/mikeyoung/CODING/MAIS/client/src/pages/DateBookingPage.tsx`
