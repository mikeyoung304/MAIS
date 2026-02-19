/**
 * Central query limit configuration.
 *
 * All findMany/list queries should reference these limits
 * instead of using magic numbers. Prevents Pitfall #13 (unbounded queries).
 */
export const QueryLimits = {
  /** Default page size for paginated queries */
  DEFAULT_PAGE_SIZE: 50,

  /** Maximum items per page (enforced by PaginatedQuerySchema) */
  MAX_PAGE_SIZE: 100,

  /** Booking queries — higher limit due to date-range filtering */
  BOOKINGS_MAX: 500,

  /** Tenant list for platform admin */
  TENANTS_MAX: 500,

  /** Scheduling config (availability rules, blackout dates) per tenant */
  SCHEDULING_CONFIG_MAX: 500,

  /** Storefront sections/drafts per tenant */
  SECTIONS_MAX: 500,

  /** Catalog items (tiers, segments, add-ons, services) per tenant */
  CATALOG_MAX: 100,

  /** Project hub queries */
  PROJECTS_MAX: 50,

  /** Customer list per tenant */
  CUSTOMERS_MAX: 100,
} as const;
