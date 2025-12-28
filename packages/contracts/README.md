# @macon/contracts

Type-safe API contracts for the MAIS (Macon AI Solutions) platform. This package provides shared Zod schemas and ts-rest contracts that ensure type safety across the entire stack.

## Dependencies

- `@ts-rest/core` - Type-safe REST API framework
- `zod` - Runtime schema validation

## Installation & Usage

This is an internal workspace package. Import contracts and schemas directly:

```typescript
import {
  Contracts,
  PackageDtoSchema,
  BookingDtoSchema,
  LandingPageConfigSchema,
  SafeUrlSchema,
} from '@macon/contracts';
```

## Core Exports

### API Contracts (`api.v1.ts`)

The `Contracts` object defines all ts-rest API contracts organized by domain:

| Contract Group | Description               | Example Endpoints                                    |
| -------------- | ------------------------- | ---------------------------------------------------- |
| Public         | Customer-facing endpoints | `getPackages`, `getAvailability`, `createCheckout`   |
| Tenant Auth    | Tenant login/signup       | `tenantLogin`, `tenantSignup`, `forgotPassword`      |
| Tenant Admin   | Dashboard management      | `tenantAdminGetPackages`, `tenantAdminCreateSegment` |
| Platform Admin | Platform-wide operations  | `platformGetAllTenants`, `platformCreateTenant`      |
| Scheduling     | Time-slot appointments    | `getAvailableSlots`, `createAppointmentCheckout`     |

### DTOs (`dto.ts`)

Request/response schemas for all API endpoints:

- **Booking DTOs**: `BookingDtoSchema`, `CreateCheckoutDtoSchema`, `CreateDateBookingDtoSchema`
- **Package DTOs**: `PackageDtoSchema`, `CreatePackageDtoSchema`, `UpdatePackageDtoSchema`
- **Auth DTOs**: `AdminLoginDtoSchema`, `TenantSignupDtoSchema`, `ResetPasswordDtoSchema`
- **Scheduling DTOs**: `ServiceDtoSchema`, `AppointmentDtoSchema`, `TimeSlotDtoSchema`
- **Error DTOs**: `ErrorResponseSchema`, `BadRequestErrorSchema`, `NotFoundErrorSchema`

### Landing Page Configuration (`landing-page.ts`)

Complete configuration system for tenant storefronts.

## Landing Page Configuration

### Page-Based Architecture

The landing page system supports **7 page types**:

| Page           | Description                 | Always Enabled |
| -------------- | --------------------------- | -------------- |
| `home`         | Main landing page with hero | Yes            |
| `about`        | Business information        | No             |
| `services`     | Package/service listings    | No             |
| `faq`          | Frequently asked questions  | No             |
| `contact`      | Contact information         | No             |
| `gallery`      | Image showcase              | No             |
| `testimonials` | Customer reviews            | No             |

### Section Types

Each page contains flexible sections. **7 section types** are available:

| Type           | Schema                      | Description                                 |
| -------------- | --------------------------- | ------------------------------------------- |
| `hero`         | `HeroSectionSchema`         | Banner with headline, subheadline, CTA      |
| `text`         | `TextSectionSchema`         | Content block with optional image           |
| `gallery`      | `GallerySectionSchema`      | Image showcase with optional Instagram link |
| `testimonials` | `TestimonialsSectionSchema` | Customer reviews with ratings               |
| `faq`          | `FAQSectionSchema`          | Questions and answers                       |
| `contact`      | `ContactSectionSchema`      | Contact information display                 |
| `cta`          | `CTASectionSchema`          | Call-to-action block                        |

### Default Configuration

Use `DEFAULT_PAGES_CONFIG` for new tenants:

```typescript
import { DEFAULT_PAGES_CONFIG, PagesConfig } from '@macon/contracts';

// Get default configuration
const config: PagesConfig = DEFAULT_PAGES_CONFIG;

// Home page is always enabled (enforced by type)
config.home.enabled; // always true
```

### Schema Usage

```typescript
import {
  PagesConfigSchema,
  PageConfigSchema,
  UpdateLandingPageConfigSchema,
  LandingPageConfigSchema,
} from '@macon/contracts';

// Validate full pages configuration
const validated = PagesConfigSchema.parse(config);

// Validate update request (partial)
const update = UpdateLandingPageConfigSchema.parse({
  pages: {
    about: { enabled: true, sections: [...] }
  }
});
```

### Page Names Constant

```typescript
import { PAGE_NAMES, PageName } from '@macon/contracts';

// PAGE_NAMES = ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials']
// PageName type = 'home' | 'about' | 'services' | ...
```

## Security Schemas

### SafeUrlSchema

XSS-safe URL validation that blocks dangerous protocols:

```typescript
import { SafeUrlSchema } from '@macon/contracts';

// Allowed: https://, http://
SafeUrlSchema.parse('https://example.com'); // OK
SafeUrlSchema.parse('http://example.com'); // OK

// Blocked: javascript:, data:, vbscript:, etc.
SafeUrlSchema.parse('javascript:alert(1)'); // Throws
SafeUrlSchema.parse('data:text/html,...'); // Throws
```

Features:

- Max 2048 characters (RFC 7230 recommended limit)
- Protocol allowlist (https, http only)
- Handles mixed-case attacks (`JaVaScRiPt:`)

### SafeImageUrlSchema

Image URL validation (extends SafeUrlSchema):

```typescript
import { SafeImageUrlSchema, SafeImageUrlOptionalSchema } from '@macon/contracts';

// For required image fields
const imageUrl = SafeImageUrlSchema.parse(url);

// For optional image fields
const optionalImage = SafeImageUrlOptionalSchema.parse(url);
```

### InstagramHandleSchema

Validates Instagram handles and normalizes by removing `@` prefix:

```typescript
import { InstagramHandleSchema } from '@macon/contracts';

InstagramHandleSchema.parse('@studio_name'); // Returns: 'studio_name'
InstagramHandleSchema.parse('studio_name'); // Returns: 'studio_name'
InstagramHandleSchema.parse('invalid@chars'); // Throws
```

Rules:

- Max 30 characters (Instagram limit)
- Allowed: letters, numbers, periods, underscores
- Optional `@` prefix (normalized/removed)

## Type Reference Table

| Export                    | Type           | Description                          |
| ------------------------- | -------------- | ------------------------------------ |
| `Contracts`               | ts-rest router | All API contracts                    |
| `PackageDtoSchema`        | Zod schema     | Package response shape               |
| `BookingDtoSchema`        | Zod schema     | Booking response shape               |
| `CreateCheckoutDtoSchema` | Zod schema     | Checkout request body                |
| `TenantPublicDtoSchema`   | Zod schema     | Public tenant info                   |
| `LandingPageConfigSchema` | Zod schema     | Full landing page config             |
| `PagesConfigSchema`       | Zod schema     | Pages configuration                  |
| `PageConfigSchema`        | Zod schema     | Single page config                   |
| `SectionSchema`           | Zod union      | Discriminated union of section types |
| `SafeUrlSchema`           | Zod schema     | XSS-safe URL validation              |
| `SafeImageUrlSchema`      | Zod schema     | Safe image URL validation            |
| `InstagramHandleSchema`   | Zod schema     | Instagram handle validation          |
| `DEFAULT_PAGES_CONFIG`    | `PagesConfig`  | Default pages for new tenants        |
| `PAGE_NAMES`              | `const array`  | All page name strings                |
| `PageName`                | Type           | Union of page name literals          |
| `Section`                 | Type           | Union of all section types           |
| `HeroSection`             | Type           | Hero section shape                   |
| `TextSection`             | Type           | Text section shape                   |
| `GallerySection`          | Type           | Gallery section shape                |
| `TestimonialsSection`     | Type           | Testimonials section shape           |
| `FAQSection`              | Type           | FAQ section shape                    |
| `ContactSection`          | Type           | Contact section shape                |
| `CTASection`              | Type           | CTA section shape                    |

## Build

```bash
# Build the package
npm run build

# Type check only
npm run typecheck
```
