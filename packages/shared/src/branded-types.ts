/**
 * Branded Types for Type-Safe Identifiers
 *
 * Branded types (also called "nominal types" or "opaque types") add compile-time
 * type safety to string identifiers. They prevent accidentally mixing up values
 * that have the same underlying type but different semantic meanings.
 *
 * @example
 * // Without branded types - BUG compiles but fails at runtime:
 * const slug = 'wedding-gold';
 * findPackageById(slug); // ❌ Runtime error: "Package not found"
 *
 * // With branded types - BUG caught at compile time:
 * const slug: PackageSlug = 'wedding-gold' as PackageSlug;
 * findPackageById(slug); // ❌ TS2345: Argument of type 'PackageSlug' is not assignable
 *
 * @see https://github.com/anthropics/claude-code/issues/247 - Original bug
 * @see docs/solutions/patterns/BRANDED_TYPES_PATTERN.md - Documentation
 */

// ============================================================================
// Brand Symbol (shared across all branded types)
// ============================================================================

/**
 * Brand symbol used to create nominal types.
 * The symbol ensures the brand cannot be accidentally created.
 */
declare const __brand: unique symbol;

/**
 * Base branded type structure.
 * Extends the underlying type with a phantom brand property.
 */
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ============================================================================
// Package Identifiers
// ============================================================================

/**
 * Package ID (CUID format)
 * Uniquely identifies a package in the database.
 *
 * @example "clz9x7k8m0001a2b3c4d5e6f7g"
 */
export type PackageId = Brand<string, 'PackageId'>;

/**
 * Package Slug (URL-safe identifier)
 * Human-readable identifier used in URLs and external APIs.
 *
 * @example "wedding-photography-gold"
 */
export type PackageSlug = Brand<string, 'PackageSlug'>;

// ============================================================================
// Tenant Identifiers
// ============================================================================

/**
 * Tenant ID (CUID format)
 * Uniquely identifies a tenant in the multi-tenant system.
 * CRITICAL: All database queries must be scoped by TenantId.
 *
 * @example "clz9a1b2c0001d2e3f4g5h6i7j"
 */
export type TenantId = Brand<string, 'TenantId'>;

/**
 * Tenant Slug (URL-safe identifier)
 * Human-readable identifier used in storefront URLs.
 *
 * @example "handled-photography", "sarah-jane-weddings"
 */
export type TenantSlug = Brand<string, 'TenantSlug'>;

// ============================================================================
// Booking Identifiers
// ============================================================================

/**
 * Booking ID (CUID format)
 * Uniquely identifies a booking in the database.
 *
 * @example "clz9b1c2d0001e2f3g4h5i6j7k"
 */
export type BookingId = Brand<string, 'BookingId'>;

// ============================================================================
// Customer Identifiers
// ============================================================================

/**
 * Customer ID (CUID format)
 * Uniquely identifies a customer in the database.
 *
 * @example "clz9c1d2e0001f2g3h4i5j6k7l"
 */
export type CustomerId = Brand<string, 'CustomerId'>;

/**
 * Customer Email (normalized)
 * Email address used for customer identification.
 * Note: Not the same as CustomerId - email can change, ID cannot.
 *
 * @example "jane@example.com"
 */
export type CustomerEmail = Brand<string, 'CustomerEmail'>;

// ============================================================================
// Service Identifiers (Appointment Scheduling)
// ============================================================================

/**
 * Service ID (CUID format)
 * Uniquely identifies an appointment service.
 *
 * @example "clz9d1e2f0001g2h3i4j5k6l7m"
 */
export type ServiceId = Brand<string, 'ServiceId'>;

/**
 * Service Slug (URL-safe identifier)
 * Human-readable identifier for appointment services.
 *
 * @example "headshot-session-30min"
 */
export type ServiceSlug = Brand<string, 'ServiceSlug'>;

// ============================================================================
// Type Guards and Assertion Functions
// ============================================================================

/**
 * Type guard to check if a string looks like a CUID.
 * CUIDs start with 'c' and are 25 characters long.
 *
 * Note: This is a heuristic, not a cryptographic validation.
 */
export function isCuidFormat(value: string): boolean {
  // CUID v1 format: starts with 'c', 25 chars total
  // CUID v2 format: starts with letter, 24 chars total
  return /^c[a-z0-9]{24}$/.test(value) || /^[a-z][a-z0-9]{23}$/.test(value);
}

/**
 * Type guard to check if a string looks like a slug.
 * Slugs are lowercase alphanumeric with hyphens.
 */
export function isSlugFormat(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
}

// ============================================================================
// Assertion Functions (Runtime Boundaries)
// ============================================================================

/**
 * Assert and brand a string as a PackageId.
 * Use at system boundaries (API inputs, database results).
 *
 * @throws Error if the value doesn't look like a CUID
 */
export function asPackageId(value: string): PackageId {
  if (!isCuidFormat(value)) {
    throw new Error(`Invalid PackageId format: "${value}" is not a CUID`);
  }
  return value as PackageId;
}

/**
 * Assert and brand a string as a PackageSlug.
 * Use at system boundaries (URL params, API inputs).
 *
 * @throws Error if the value doesn't look like a slug
 */
export function asPackageSlug(value: string): PackageSlug {
  if (!isSlugFormat(value)) {
    throw new Error(`Invalid PackageSlug format: "${value}" is not a valid slug`);
  }
  return value as PackageSlug;
}

/**
 * Assert and brand a string as a TenantId.
 * Use at system boundaries (JWT claims, API inputs).
 *
 * @throws Error if the value doesn't look like a CUID
 */
export function asTenantId(value: string): TenantId {
  if (!isCuidFormat(value)) {
    throw new Error(`Invalid TenantId format: "${value}" is not a CUID`);
  }
  return value as TenantId;
}

/**
 * Assert and brand a string as a TenantSlug.
 * Use at system boundaries (URL params, API inputs).
 *
 * @throws Error if the value doesn't look like a slug
 */
export function asTenantSlug(value: string): TenantSlug {
  if (!isSlugFormat(value)) {
    throw new Error(`Invalid TenantSlug format: "${value}" is not a valid slug`);
  }
  return value as TenantSlug;
}

/**
 * Assert and brand a string as a BookingId.
 * Use at system boundaries (API inputs, database results).
 *
 * @throws Error if the value doesn't look like a CUID
 */
export function asBookingId(value: string): BookingId {
  if (!isCuidFormat(value)) {
    throw new Error(`Invalid BookingId format: "${value}" is not a CUID`);
  }
  return value as BookingId;
}

/**
 * Assert and brand a string as a CustomerId.
 * Use at system boundaries (JWT claims, API inputs).
 *
 * @throws Error if the value doesn't look like a CUID
 */
export function asCustomerId(value: string): CustomerId {
  if (!isCuidFormat(value)) {
    throw new Error(`Invalid CustomerId format: "${value}" is not a CUID`);
  }
  return value as CustomerId;
}

/**
 * Assert and brand a string as a ServiceId.
 * Use at system boundaries (API inputs, database results).
 *
 * @throws Error if the value doesn't look like a CUID
 */
export function asServiceId(value: string): ServiceId {
  if (!isCuidFormat(value)) {
    throw new Error(`Invalid ServiceId format: "${value}" is not a CUID`);
  }
  return value as ServiceId;
}

/**
 * Assert and brand a string as a ServiceSlug.
 * Use at system boundaries (URL params, API inputs).
 *
 * @throws Error if the value doesn't look like a slug
 */
export function asServiceSlug(value: string): ServiceSlug {
  if (!isSlugFormat(value)) {
    throw new Error(`Invalid ServiceSlug format: "${value}" is not a valid slug`);
  }
  return value as ServiceSlug;
}

// ============================================================================
// Unsafe Branding (For Known-Good Values)
// ============================================================================

/**
 * Brand a string as PackageId without validation.
 * ONLY use when the value is known to be valid (e.g., from Prisma).
 *
 * @deprecated Prefer asPackageId() for safety
 */
export function unsafeAsPackageId(value: string): PackageId {
  return value as PackageId;
}

/**
 * Brand a string as PackageSlug without validation.
 * ONLY use when the value is known to be valid (e.g., from Prisma).
 *
 * @deprecated Prefer asPackageSlug() for safety
 */
export function unsafeAsPackageSlug(value: string): PackageSlug {
  return value as PackageSlug;
}

/**
 * Brand a string as TenantId without validation.
 * ONLY use when the value is known to be valid (e.g., from JWT middleware).
 *
 * @deprecated Prefer asTenantId() for safety
 */
export function unsafeAsTenantId(value: string): TenantId {
  return value as TenantId;
}

/**
 * Brand a string as TenantSlug without validation.
 * ONLY use when the value is known to be valid (e.g., from Prisma).
 *
 * @deprecated Prefer asTenantSlug() for safety
 */
export function unsafeAsTenantSlug(value: string): TenantSlug {
  return value as TenantSlug;
}
