/**
 * Port interfaces for repositories and external adapters
 *
 * Barrel re-export — all consumers import from this index.
 * Domain files are organized by bounded context.
 */

// Catalog (Tiers, AddOns)
export type {
  CatalogRepository,
  CreateTierInput,
  UpdateTierInput,
  CreateAddOnInput,
  UpdateAddOnInput,
} from './catalog.port';

// Booking
export type {
  TimeslotBooking,
  BookingUpdateInput,
  BookingRepository,
  AppointmentDto,
} from './booking.port';

// Blackout dates
export type { BlackoutRepository } from './blackout.port';

// User & Authentication
export type {
  UserRepository,
  User,
  UserRole,
  TokenPayload,
  TenantTokenPayload,
  UnifiedTokenPayload,
} from './user-auth.port';

// Early Access
export type { EarlyAccessRequest, EarlyAccessRepository } from './early-access.port';

// Webhooks
export type {
  WebhookRepository,
  WebhookSubscriptionRepository,
  WebhookSubscription,
  WebhookSubscriptionListItem,
  WebhookSubscriptionForDelivery,
  WebhookDeliveryRecord,
  WebhookDeliveryListItem,
} from './webhook.port';

// Service & Availability
export type {
  ServiceRepository,
  AvailabilityRuleRepository,
  AvailabilityRule,
  CreateAvailabilityRuleData,
  UpdateAvailabilityRuleData,
  AvailabilityCheck,
  CreateServiceInput,
  UpdateServiceInput,
} from './service.port';

// Calendar
export type { BusyTimeBlock, CalendarProvider } from './calendar.port';

// Payment
export type { PaymentProvider, CheckoutSession } from './payment.port';

// Email
export type { EmailProvider } from './email.port';

// Cache
export { DEFAULT_CACHE_TTL_SECONDS } from './cache.port';
export type { CacheServicePort } from './cache.port';

// Storage
export type { UploadedFile, UploadResult, FileSystem, StorageProvider } from './storage.port';

// Tenant
export type { TenantEntity, ITenantRepository } from './tenant.port';

// Section Content
export type {
  PageName,
  BlockType,
  SectionContentEntity,
  UpsertSectionInput,
  VersionEntry,
  ISectionContentRepository,
} from './section-content.port';
