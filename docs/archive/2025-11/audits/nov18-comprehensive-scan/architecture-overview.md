# Macon AI Solutions - Comprehensive Architecture Overview

**Project**: Macon AI Solutions - AI-Powered Tenant Management Platform  
**Repository Type**: Monorepo (pnpm workspaces)  
**Primary Language**: TypeScript  
**Documentation Date**: November 18, 2025  
**Branch**: uifiddlin  
**Status**: Production-Ready with Active Development

---

## Executive Summary

Macon AI Solutions is a **production-grade, multi-tenant SaaS platform** for property management automation. It employs a **modern full-stack architecture** with complete separation of concerns, comprehensive testing, and enterprise-grade security. The codebase is organized as a TypeScript monorepo using pnpm workspaces, supporting both development and production deployments with optional mock adapters for testing.

### Key Architectural Characteristics

- **Multi-tenant by Design** - Complete data isolation with tenant scoping at every layer
- **Hexagonal Architecture** - Ports & adapters pattern for loose coupling and testability
- **Modular Monorepo** - Shared contracts, independent client/server deployment
- **Type-Safe API Layer** - ts-rest for compile-time type safety across client/server
- **Pluggable Adapters** - Mock and real implementations for seamless testing and development
- **Event-Driven Processing** - Internal event emitter for async operations (emails, webhooks)
- **Comprehensive Testing** - Unit, integration, and E2E test coverage with 76% baseline

---

## 1. Project Structure & Directory Organization

### 1.1 Monorepo Layout

```
/Users/mikeyoung/CODING/MAIS/
├── package.json              # Root monorepo config (pnpm workspaces)
├── pnpm-workspace.yaml       # Workspace configuration
├── tsconfig.base.json        # Base TypeScript config (strict mode)
├── .eslintrc.cjs             # ESLint rules (strict TypeScript + Prettier)
├── .prettierrc.json          # Code formatting rules
│
├── client/                   # Frontend application (React + Vite)
│   ├── package.json          # @macon/web
│   ├── tsconfig.json         # Client TypeScript config
│   ├── vite.config.ts        # Vite bundler config
│   ├── tailwind.config.js    # Tailwind CSS design system
│   ├── postcss.config.js     # PostCSS configuration
│   └── src/
│       ├── main.tsx          # React root entry (StrictMode, providers)
│       ├── widget-main.tsx   # Embeddable widget entry point
│       ├── router.tsx        # React Router v7 route definitions
│       ├── index.css         # Global Tailwind import
│       │
│       ├── app/
│       │   ├── AppShell.tsx  # Layout wrapper (header, footer, skip links)
│       │   └── ...
│       │
│       ├── components/       # Reusable component library
│       │   ├── ui/           # Design system components (Button, Card, Dialog, etc.)
│       │   ├── auth/         # Authentication components (Login, Register)
│       │   ├── navigation/   # Navigation components (Nav, Breadcrumbs)
│       │   └── errors/       # Error boundaries and error pages
│       │
│       ├── features/         # Feature-specific modules
│       │   ├── admin/        # Platform admin dashboard (packages, segments, users)
│       │   ├── tenant-admin/ # Tenant self-service dashboard (branding, packages)
│       │   ├── booking/      # Booking flow and checkout UI
│       │   ├── catalog/      # Package catalog and browsing
│       │   └── photos/       # Photo upload and management
│       │
│       ├── pages/            # Route page components
│       │   ├── admin/        # Admin routes (login, dashboard)
│       │   ├── tenant/       # Tenant admin routes (dashboard, settings)
│       │   └── success/      # Post-booking success page
│       │
│       ├── contexts/         # React context providers
│       │   └── AuthContext   # Authentication state management
│       │
│       ├── providers/        # Provider components
│       │   └── ThemeProvider # Theme switching and dynamic styling
│       │
│       ├── hooks/            # Custom React hooks
│       │   ├── useApi        # API request abstraction
│       │   ├── useForm       # Form handling
│       │   └── useBranding   # Tenant branding configuration
│       │
│       ├── lib/              # Utility functions
│       │   ├── api.ts        # API client setup (ts-rest)
│       │   ├── api-helpers.ts# API request utilities
│       │   ├── queryClient.ts# TanStack React Query configuration
│       │   ├── auth.ts       # JWT token management
│       │   ├── utils.ts      # Helper functions (cn, classname merging)
│       │   ├── types.ts      # Client-specific type definitions
│       │   └── sentry.ts     # Error tracking initialization
│       │
│       ├── types/            # Client type definitions
│       │   └── auth.ts       # Authentication types
│       │
│       ├── ui/               # Legacy UI components (being migrated)
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   └── ...
│       │
│       ├── widget/           # Embeddable widget module
│       │   └── WidgetMessenger.ts # PostMessage API for cross-origin communication
│       │
│       └── styles/           # Global styles
│           ├── a11y.css      # Accessibility utilities (skip links)
│           └── globals.css   # Global resets
│
├── server/                   # Backend API server (Express + TypeScript)
│   ├── package.json          # @macon/api
│   ├── tsconfig.json         # Server TypeScript config
│   ├── vitest.config.ts      # Unit/integration test configuration
│   │
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema (PostgreSQL)
│   │   ├── migrations/       # Prisma migration files
│   │   └── seed.ts           # Database seed script
│   │
│   ├── src/
│   │   ├── index.ts          # Server entry point (config loading, app creation)
│   │   ├── app.ts            # Express app factory (middleware, routing)
│   │   ├── api-docs.ts       # OpenAPI/Swagger documentation generator
│   │   │
│   │   ├── lib/              # Core domain and utility libraries
│   │   │   ├── core/
│   │   │   │   ├── config.ts # Environment configuration (zod validation)
│   │   │   │   ├── logger.ts # Pino structured logging
│   │   │   │   ├── events.ts # Event emitter interface
│   │   │   │   └── errors.ts # Custom error types
│   │   │   │
│   │   │   ├── entities.ts   # Domain entity types (Package, Booking, Customer, etc.)
│   │   │   ├── ports.ts      # Interface contracts for repositories and adapters
│   │   │   ├── validation.ts # Zod validation schemas
│   │   │   ├── api-key.service.ts      # API key generation and validation
│   │   │   ├── encryption.service.ts   # Secret encryption/decryption
│   │   │   ├── cache.ts      # In-memory cache service
│   │   │   ├── date-utils.ts # Date utility functions
│   │   │   └── errors.ts     # Error utilities and Sentry integration
│   │   │
│   │   ├── services/         # Business logic layer (domain services)
│   │   │   ├── catalog.service.ts        # Package/AddOn CRUD (with caching & audit)
│   │   │   ├── booking.service.ts        # Booking creation and payment handling
│   │   │   ├── availability.service.ts   # Calendar availability checks
│   │   │   ├── identity.service.ts       # User authentication & JWT
│   │   │   ├── tenant-auth.service.ts    # Tenant admin authentication
│   │   │   ├── stripe-connect.service.ts # Stripe Connect account management
│   │   │   ├── commission.service.ts     # Commission calculation
│   │   │   ├── audit.service.ts          # Audit trail logging
│   │   │   ├── idempotency.service.ts    # Idempotent operation deduplication
│   │   │   ├── segment.service.ts        # Business segment management
│   │   │   ├── upload.service.ts         # File upload management
│   │   │   └── webhook-handler.service.ts# Stripe webhook processing
│   │   │
│   │   ├── routes/           # Express route handlers (16 route files)
│   │   │   ├── index.ts      # Route aggregator and v1 router setup
│   │   │   ├── packages.routes.ts        # GET/POST packages and add-ons
│   │   │   ├── bookings.routes.ts        # POST bookings, GET checkout session
│   │   │   ├── availability.routes.ts    # GET available dates
│   │   │   ├── auth.routes.ts            # Admin login/register
│   │   │   ├── tenant-auth.routes.ts     # Tenant admin login/register
│   │   │   ├── webhooks.routes.ts        # Stripe webhook handler
│   │   │   ├── admin.routes.ts           # Platform admin endpoints
│   │   │   ├── admin-packages.routes.ts  # Platform admin package management
│   │   │   ├── tenant.routes.ts          # Tenant CRUD endpoints
│   │   │   ├── tenant-admin.routes.ts    # Tenant self-service endpoints (branding, packages)
│   │   │   ├── tenant-admin-segments.routes.ts # Tenant segment management
│   │   │   ├── segments.routes.ts        # Segment management endpoints
│   │   │   ├── blackouts.routes.ts       # Blackout date management
│   │   │   └── dev.routes.ts             # Development/mock simulator endpoints
│   │   │
│   │   ├── controllers/      # Route controller classes
│   │   │   └── platform-admin.controller.ts
│   │   │
│   │   ├── adapters/         # External service integrations (Ports & Adapters)
│   │   │   ├── prisma/       # Prisma ORM adapters (repositories)
│   │   │   │   ├── catalog.repository.ts      # Package/AddOn persistence
│   │   │   │   ├── booking.repository.ts      # Booking persistence
│   │   │   │   ├── blackout.repository.ts     # Blackout date persistence
│   │   │   │   ├── user.repository.ts         # User persistence
│   │   │   │   ├── webhook.repository.ts      # Webhook event logging
│   │   │   │   ├── tenant.repository.ts       # Tenant persistence
│   │   │   │   ├── segment.repository.ts      # Segment persistence
│   │   │   │   └── index.ts  # Repository barrel export
│   │   │   │
│   │   │   ├── mock/         # Mock adapters (for testing)
│   │   │   │   ├── index.ts  # Mock adapter factory
│   │   │   │   ├── in-memory databases
│   │   │   │   └── mock implementations
│   │   │   │
│   │   │   ├── stripe.adapter.ts          # Stripe payment processing
│   │   │   ├── postmark.adapter.ts        # Postmark email service
│   │   │   ├── gcal.adapter.ts            # Google Calendar integration
│   │   │   └── gcal.jwt.ts                # JWT authentication for Google Calendar
│   │   │
│   │   ├── middleware/       # Express middleware
│   │   │   ├── auth.ts               # JWT verification and tenant key validation
│   │   │   ├── error-handler.ts      # Error response formatting
│   │   │   ├── request-logger.ts     # HTTP request logging
│   │   │   └── rateLimiter.ts        # Login and admin rate limiting
│   │   │
│   │   ├── validation/       # Request validation schemas
│   │   │   └── (Zod schemas for endpoint payloads)
│   │   │
│   │   ├── types/            # Server type definitions
│   │   │   └── (Custom types for services)
│   │   │
│   │   ├── generated/        # Generated code
│   │   │   └── prisma/       # Prisma Client generated types
│   │   │
│   │   └── errors/           # Error handling and Sentry integration
│   │       └── sentry.ts     # Sentry initialization and middleware
│   │
│   ├── test/                 # Test suite
│   │   ├── integration/      # Integration tests (database, services)
│   │   ├── fixtures/         # Test data factories and helpers
│   │   └── *.test.ts         # Unit tests (co-located with source)
│   │
│   └── scripts/              # Utility scripts
│       ├── doctor.ts         # Environment health check
│       ├── create-tenant.ts  # Tenant creation utility
│       └── ...
│
├── packages/                 # Shared workspace packages
│   ├── contracts/            # API contracts and type definitions
│   │   ├── package.json      # @macon/contracts
│   │   ├── src/
│   │   │   ├── index.ts      # Public API barrel export
│   │   │   ├── api.v1.ts     # ts-rest API contract definitions
│   │   │   └── dto.ts        # Data transfer object type definitions
│   │   └── tsconfig.json
│   │
│   └── shared/               # Shared utility functions
│       ├── package.json      # @macon/shared
│       ├── src/
│       │   ├── index.ts      # Public API barrel export
│       │   ├── date.ts       # Date formatting and parsing
│       │   ├── money.ts      # Currency/money formatting
│       │   ├── result.ts     # Result type for error handling
│       │   └── error-guards.ts # Type guards for errors
│       └── tsconfig.json
│
├── e2e/                      # End-to-end test suite (Playwright)
│   ├── playwright.config.ts  # Playwright test configuration
│   ├── tests/                # E2E test files
│   ├── wait-for-servers.js   # Server readiness check
│   └── .gitignore
│
├── .github/                  # GitHub configuration
│   └── workflows/
│       ├── ci.yml            # CI/CD pipeline (lint, test, build)
│       └── e2e.yml           # E2E test runner workflow
│
├── .husky/                   # Git hooks
│   └── pre-commit            # Pre-commit linting
│
├── docs/                     # Documentation
│   ├── sprints/              # Sprint reports and progress
│   ├── ARCHITECTURE.md       # Architecture documentation
│   ├── API.md                # API reference
│   └── ...
│
└── [Config Files]
    ├── .eslintrc.cjs         # ESLint configuration
    ├── .prettierrc.json      # Prettier formatting
    ├── .editorconfig         # Editor configuration
    ├── .mcp.json             # Claude MCP configuration
    └── tsconfig.json         # Root TypeScript reference
```

---

## 2. Technology Stack

### 2.1 Frontend Stack

| Layer                | Technology                         | Purpose               | Key Features                             |
| -------------------- | ---------------------------------- | --------------------- | ---------------------------------------- |
| **Framework**        | React 18.3                         | UI library            | Hooks, context, strict mode              |
| **Routing**          | React Router v7                    | Client-side routing   | Dynamic nested routes, loaders           |
| **Bundler**          | Vite 6.0                           | Build tool            | Fast HMR, production optimization        |
| **Styling**          | Tailwind CSS 3.4                   | Utility-first CSS     | Design tokens (Macon brand colors)       |
| **UI Components**    | Radix UI + shadcn                  | Accessible primitives | Dialog, select, dropdown, alert          |
| **State Management** | React Context                      | Local state           | Auth, theme context                      |
| **Data Fetching**    | TanStack React Query 5             | Server state          | Caching, background sync, retries        |
| **HTTP Client**      | ts-rest core                       | Type-safe API client  | Runtime request validation               |
| **Form Handling**    | Custom hooks + validation          | Form state            | useForm hook with Zod schemas            |
| **Icons**            | Lucide React                       | Icon library          | ~500+ icons                              |
| **Notifications**    | Sonner                             | Toast notifications   | Non-blocking notifications               |
| **Date Picker**      | React Day Picker                   | Calendar UI           | Calendar selection with React Day Picker |
| **Utilities**        | clsx, classname-variance-authority | Class merging         | CVA for component variants               |
| **Error Tracking**   | Sentry React                       | Error reporting       | Browser error logging                    |
| **Types**            | TypeScript 5.3                     | Type safety           | Strict mode, ESNext target               |

### 2.2 Backend Stack

| Layer              | Technology          | Purpose                 | Key Features                                |
| ------------------ | ------------------- | ----------------------- | ------------------------------------------- |
| **Runtime**        | Node.js 20+         | JavaScript runtime      | ES modules, built-in crypto                 |
| **Framework**      | Express 4.21        | HTTP server             | Middleware, routing                         |
| **API Protocol**   | ts-rest             | Type-safe REST          | Compile-time validation, OpenAPI generation |
| **Database**       | PostgreSQL 15       | Relational DB           | Multi-tenant isolation via schemas          |
| **ORM**            | Prisma 6.17         | Database abstraction    | Type-safe queries, migrations               |
| **Authentication** | JWT + bcrypt        | Auth security           | Token-based, password hashing               |
| **Payments**       | Stripe              | Payment processing      | Checkout sessions, Connect accounts         |
| **Email**          | Postmark            | Transactional email     | Booking confirmations                       |
| **Calendar**       | Google Calendar API | Availability mgmt       | Availability checks, event creation         |
| **Logging**        | Pino + pino-pretty  | Structured logging      | JSON logs with context                      |
| **Error Tracking** | Sentry Node         | Server error monitoring | Error tracking, performance monitoring      |
| **Rate Limiting**  | express-rate-limit  | DDoS protection         | Login and admin rate limiting               |
| **Security**       | Helmet              | Security headers        | CORS, CSP, XSS protection                   |
| **CORS**           | cors                | Cross-origin requests   | Multi-origin support for widget embedding   |
| **File Upload**    | Multer              | File handling           | Logo and photo uploads                      |
| **Caching**        | node-cache          | In-memory caching       | 15-minute TTL for catalog                   |
| **Testing**        | Vitest              | Unit/integration tests  | Fast test runner, coverage                  |
| **Validation**     | Zod                 | Schema validation       | Runtime request validation                  |
| **Types**          | TypeScript 5.3      | Type safety             | Strict mode, ES2022 target                  |

### 2.3 Shared Packages

| Package              | Purpose                  | Exports                                    |
| -------------------- | ------------------------ | ------------------------------------------ |
| **@macon/contracts** | API contract definitions | API v1 routes, DTO types, ts-rest contract |
| **@macon/shared**    | Shared utilities         | date, money, result, error-guards          |

### 2.4 Development Tools

| Tool           | Purpose           | Config                                 |
| -------------- | ----------------- | -------------------------------------- |
| **pnpm**       | Package manager   | Fast, space-efficient workspaces       |
| **TypeScript** | Type safety       | tsconfig.base.json (strict mode)       |
| **ESLint**     | Code linting      | @typescript-eslint strict config       |
| **Prettier**   | Code formatting   | .prettierrc.json (2-space indentation) |
| **Husky**      | Git hooks         | Pre-commit linting                     |
| **Playwright** | E2E testing       | 30s timeout, Chromium, trace retention |
| **Vitest**     | Unit testing      | Globals, node environment, v8 coverage |
| **tsx**        | TypeScript runner | CLI scripts, server dev mode           |

---

## 3. Application Architecture

### 3.1 Architecture Pattern: Hexagonal (Ports & Adapters)

The application follows **hexagonal architecture** for maximum testability and loose coupling:

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Routes (HTTP)                    │
│              (packages, bookings, auth, admin)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Middleware Layer                                │
│    (auth, error-handler, request-logger, rate-limit)        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Business Logic (Services)                       │
│  (CatalogService, BookingService, IdentityService, etc.)   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Domain (Ports & Adapters)                       │
│                                                              │
│  ┌──────────────────┐        ┌──────────────────┐           │
│  │ Repository Port  │        │ Payment Adapter  │           │
│  │  (interface)     │        │   (Stripe)       │           │
│  └────────┬─────────┘        └────────┬─────────┘           │
│           │                           │                     │
│  ┌────────▼──────────┐    ┌──────────▼───────┐            │
│  │ Prisma Adapter    │    │ Mock Adapter     │            │
│  │ (PostgreSQL)      │    │ (in-memory)      │            │
│  └───────────────────┘    └──────────────────┘            │
│                                                              │
│  ┌────────────────────┐    ┌──────────────────┐           │
│  │ Calendar Port      │    │ Email Adapter    │           │
│  │ (Google Calendar)  │    │ (Postmark)       │           │
│  └────────┬───────────┘    └──────────────────┘           │
│           │                                                │
│  ┌────────▼──────────┐                                    │
│  │ Mock Calendar     │                                    │
│  │ (all dates free)  │                                    │
│  └───────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

**Key Pattern Benefits:**

- **Testability**: Mock adapters for unit testing without external services
- **Loose Coupling**: Services depend on interfaces, not implementations
- **Swappability**: Easy to switch between Stripe/Postmark or add new payment providers
- **DI Container**: Centralized adapter configuration in `di.ts`

### 3.2 Dependency Injection Container

**Location**: `server/src/di.ts`

The DI container (`buildContainer()`) handles adapter initialization based on `ADAPTERS_PRESET` environment variable:

```typescript
// Mock mode (development/testing)
if (config.ADAPTERS_PRESET === 'mock') {
  const adapters = buildMockAdapters(); // In-memory repositories
  return { controllers, services }; // Pre-initialized with mocks
}

// Real mode (production)
const prisma = new PrismaClient({ datasources: { db: { url } } });
const catalogRepo = new PrismaCatalogRepository(prisma);
const paymentProvider = new StripePaymentAdapter({ secretKey, ... });
// Wire real adapters
return { controllers, services };
```

**Container Exports**:

- `controllers`: All route handlers (packages, bookings, webhooks, admin, etc.)
- `services`: Domain services (catalog, booking, identity, stripe-connect, segment, audit)

### 3.3 Multi-Tenant Architecture

**Tenant Isolation Strategy**:

- **API Key Authentication**: Every request includes `X-Tenant-Key: pk_live_slug_xxx` header
- **Middleware Extraction**: `auth.ts` middleware extracts and validates tenant key
- **Service Scoping**: All repository methods accept `tenantId` as first parameter
- **Database Level**: Prisma indexes on `tenantId` field
- **Response Headers**: X-Tenant-Key exposed in CORS for client verification

**Example Request Flow**:

```
Client Request → X-Tenant-Key header → auth middleware
→ Extract tenantId → Service.catalog.getPackages(tenantId)
→ SQL: WHERE tenant_id = ? → Tenant-isolated results
```

**Multi-Tenant Entities**:

- `Tenant`: Represents a property management business (branding, stripe account, commission %)
- `User`: Linked to tenant (TENANT_ADMIN role)
- `Customer`: Tenant-scoped customers (bookings, contact info)
- `Package`: Tenant-scoped service packages (pricing, description)
- `Booking`: Tenant-scoped event bookings (payment, attendees)
- `Segment`: Tenant-scoped business segments (e.g., "Wellness Retreat")

### 3.4 Data Flow Patterns

#### Booking Flow

```
1. Client: GET /v1/packages?tenantKey=pk_live_...
   → CatalogService.getPackages(tenantId)
   → PrismaCatalogRepository.getAllPackages(tenantId)
   → Return packages with cached pricing

2. Client: POST /v1/bookings
   → BookingService.createBooking(tenantId, bookingData)
   → Check availability via AvailabilityService
   → Call StripePaymentAdapter.createCheckoutSession()
   → Save booking in PrismaBookingRepository
   → Emit 'BookingCreated' event
   → Return checkout URL

3. Client: Navigate to Stripe checkout → Complete payment

4. Stripe: Webhook POST /v1/webhooks/stripe
   → WebhooksController.handleCheckoutCompleted()
   → Call BookingService.markAsPaid(bookingId)
   → Emit 'BookingPaid' event
   → Event listener sends confirmation email via PostmarkMailAdapter

5. Client: GET /v1/success (with session_id)
   → Retrieve booking confirmation
   → Display success page
```

#### Tenant Admin Flow

```
1. Tenant Admin: POST /v1/tenant-admin/login
   → TenantAuthController
   → TenantAuthService.authenticate(email, password)
   → PrismaTenantRepository.findByEmail()
   → Return JWT token

2. Tenant Admin: GET /v1/tenant-admin/dashboard (with JWT)
   → auth middleware validates JWT
   → Extract tenantId from token
   → CatalogService.getPackages(tenantId)
   → Return tenant-scoped packages

3. Tenant Admin: PUT /v1/tenant-admin/branding
   → CatalogService.updateTenantBranding(tenantId, brandingData)
   → Update Tenant.branding (JSON field)
   → Cache invalidation (15-minute TTL)
   → Return updated branding config
```

#### Admin Operations Flow

```
1. Platform Admin: POST /v1/admin/packages
   → AdminPackagesController
   → CatalogService.createPackage(tenantId, packageData)
   → PrismaCatalogRepository.createPackage()
   → Emit 'PackageCreated' audit event
   → Cache invalidation
   → Return created package

2. Audit Service listener receives event
   → Log to ConfigChangeLog table
   → Record before/after snapshots
   → Track user/timestamp
```

---

## 4. Module Organization & Dependencies

### 4.1 Frontend Layers

```
Presentation Layer (Pages, Features)
        ↓
Component Layer (UI, Auth, Navigation)
        ↓
State Management (Context, hooks)
        ↓
HTTP Client Layer (api.ts, queryClient)
        ↓
API Contract Layer (@macon/contracts, type-safe endpoints)
        ↓
External Services (Stripe, Sentry)
```

### 4.2 Backend Layers

```
HTTP Layer (Express Routes + Middleware)
        ↓
Business Logic Layer (Services: CatalogService, BookingService, etc.)
        ↓
Domain Layer (Entities, Validation, Events)
        ↓
Adapter Layer (Repositories, Payment, Email, Calendar)
        ↓
External Systems (PostgreSQL, Stripe, Postmark, Google Calendar)
```

### 4.3 Key Module Dependencies

**Client Dependencies** (package.json):

```
@macon/contracts → Type-safe API definitions
@macon/shared    → Date/money utilities
@tanstack/react-query → Data fetching
@radix-ui/* → Accessible components
@ts-rest/core → HTTP client
tailwindcss → Styling
react-router-dom → Routing
```

**Server Dependencies** (package.json):

```
@macon/contracts    → API contract definitions
@macon/shared       → Shared utilities
@prisma/client      → Database ORM
@ts-rest/express    → API server
express             → HTTP framework
stripe              → Payment processing
zod                 → Validation schemas
```

**Contracts Package Exports** (index.ts):

```typescript
export * from './dto'; // All data transfer objects
export { Contracts } from './api.v1'; // ts-rest API definition
```

### 4.4 Circular Dependency Prevention

**Dependency Graph**:

```
Packages (Contracts, Shared)
    ↑
Client (depends on packages)
    ↑
Server (depends on packages)
    ↑
No cross-dependencies between client/server
```

---

## 5. Key Architectural Decisions

### 5.1 Type-Safe API with ts-rest

**Decision**: Use ts-rest for compile-time API contract validation

**Rationale**:

- Single source of truth for API definitions
- Client and server generate types from same contract
- Prevents request/response mismatches at compile time
- Automatic OpenAPI documentation generation

**Implementation**:

```typescript
// packages/contracts/src/api.v1.ts
export const Contracts = {
  packages: {
    getAll: {
      method: 'GET',
      path: '/packages',
      responses: { 200: { body: Package[] } },
    },
    create: {
      method: 'POST',
      path: '/packages',
      body: CreatePackageInput,
      responses: { 201: { body: Package } },
    },
  },
};

// server uses: initTsRestHandler(Contracts.packages.getAll, handler)
// client uses: api.packages.getAll.query() with type safety
```

### 5.2 Pluggable Adapters for Testing

**Decision**: Implement Ports & Adapters pattern with mock implementations

**Rationale**:

- Run full test suites without Stripe/PostgreSQL/Google Calendar
- Fast feedback loop during development
- Deterministic test behavior (mock data, predictable responses)
- Isolated unit tests vs. integrated tests

**Implementation**:

```typescript
// Port definition (interface)
interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
  createPackage(tenantId: string, data: CreatePackageInput): Promise<Package>;
}

// Real adapter (Prisma)
class PrismaCatalogRepository implements CatalogRepository {
  async getAllPackages(tenantId: string) {
    return this.prisma.package.findMany({ where: { tenantId } });
  }
}

// Mock adapter (in-memory)
class MockCatalogRepository implements CatalogRepository {
  private packages: Package[] = []; // In-memory store
  async getAllPackages(tenantId: string) {
    return this.packages.filter((p) => p.tenantId === tenantId);
  }
}

// DI Container switches adapters
const adapters =
  ADAPTERS_PRESET === 'mock' ? buildMockAdapters() : buildRealAdapters(prisma, stripe, postmark);
```

### 5.3 Event-Driven Architecture for Side Effects

**Decision**: Use in-process event emitter for async operations

**Rationale**:

- Decouple core domain logic (booking) from side effects (email, webhooks)
- Enable future scaling to message queues (Kafka, RabbitMQ) without code changes
- Support multiple listeners for same event (audit, email, Slack, etc.)

**Implementation**:

```typescript
// Event emission
eventEmitter.publish('BookingPaid', {
  bookingId, email, packageTitle, totalCents, ...
});

// Event listener
eventEmitter.subscribe('BookingPaid', async (payload) => {
  await mailProvider.sendBookingConfirm(payload.email, {...});
});
```

### 5.4 Tenant-First Authorization

**Decision**: Tenant ID in every API request and service call

**Rationale**:

- Prevents accidental cross-tenant data leakage
- Enables multi-tenant isolation at service layer (not just database)
- Supports audit trails (know which tenant triggered each operation)
- Allows per-tenant rate limiting and quotas

**Implementation**:

```typescript
// Every service method requires tenantId
async getPackages(tenantId: string): Promise<Package[]> {
  // All queries scoped to tenant
  return repo.getAllPackages(tenantId);
}

// Routes enforce tenant from auth middleware
app.get('/v1/packages', authMiddleware, (req, res) => {
  const tenantId = req.user.tenantId; // From validated JWT
  const packages = await catalogService.getPackages(tenantId);
  res.json(packages);
});
```

### 5.5 Caching Strategy

**Decision**: In-memory LRU cache with 15-minute TTL for catalog

**Rationale**:

- Catalog (packages, add-ons) changes infrequently
- Reduces database load and response time
- Cache key: `tenant:${tenantId}:packages`
- Invalidation on create/update/delete operations

**Implementation**:

```typescript
class CatalogService {
  constructor(
    private repo: CatalogRepository,
    private cache: CacheService
  ) {}

  async getPackages(tenantId: string): Promise<Package[]> {
    const cacheKey = `tenant:${tenantId}:packages`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const packages = await this.repo.getAllPackages(tenantId);
    this.cache.set(cacheKey, packages, 900); // 15-minute TTL
    return packages;
  }

  async createPackage(tenantId: string, data): Promise<Package> {
    const pkg = await this.repo.createPackage(tenantId, data);
    this.cache.del(`tenant:${tenantId}:packages`); // Invalidate
    return pkg;
  }
}
```

### 5.6 Monorepo Structure with pnpm Workspaces

**Decision**: Single repository with separate client, server, and shared packages

**Rationale**:

- Share contracts and utilities across packages (DRY)
- Single version control history for related code
- Atomic commits across client/server changes
- Simplified deployment (both can be versioned together)

**Implementation**:

```yaml
# pnpm-workspace.yaml
packages:
  - 'server'
  - 'client'
  - 'packages/*'

# package.json (root)
{
  "workspaces": ["client", "server", "packages/*"],
  "scripts": {
    "dev:api": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "dev:all": "concurrently 'npm run dev:api' 'npm run dev:client'"
  }
}
```

### 5.7 Strict TypeScript Configuration

**Decision**: Enable all strict type-checking options

**Rationale**:

- Catch type errors at compile time (e.g., missing null checks)
- Self-documenting code (types serve as contracts)
- Reduced debugging time and runtime errors

**Configuration** (tsconfig.base.json):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "target": "ES2022",
    "moduleResolution": "Bundler"
  }
}
```

---

## 6. Data Model & Database Schema

### 6.1 Core Entities

```
┌─────────────────────────────────────────────────────────────┐
│ TENANT (Multi-tenant SaaS root)                            │
├─────────────────────────────────────────────────────────────┤
│ id, slug (unique), name                                     │
│ email, passwordHash (admin login)                           │
│ apiKeyPublic, apiKeySecret (API auth)                      │
│ primaryColor, secondaryColor, accentColor (branding)       │
│ stripeAccountId, stripeOnboarded (Stripe Connect)          │
│ commissionPercent (commission rate)                         │
│ branding (JSON: fontFamily, logo, etc.)                     │
│ secrets (JSON: encrypted stripe creds)                      │
│ createdAt, updatedAt                                        │
└─────────────────────────────────────────────────────────────┘
        │
        ├── USERS (Tenant admins)
        │   └── email, passwordHash, role, tenantId
        │
        ├── CUSTOMERS (Tenant-scoped customers)
        │   └── name, email, phone, tenantId
        │
        ├── SEGMENT (Business segments)
        │   └── name, description, tenantId
        │
        ├── PACKAGE (Service packages)
        │   ├── title, slug, description, pricing
        │   ├── basePrice, baseDuration
        │   ├── segmentId (optional - scoped to segment)
        │   └── tenantId
        │       │
        │       └── ADDON (Add-on services)
        │           └── title, price, tenantId, packageId
        │
        ├── BOOKING (Reservations/orders)
        │   ├── customerId, customerName, customerEmail
        │   ├── packageId, eventDate
        │   ├── totalCents, status (PENDING, PAID, COMPLETED, FAILED)
        │   ├── stripeCheckoutSessionId, stripePaymentIntentId
        │   └── tenantId
        │
        ├── BLACKOUTDATE (Unavailable dates)
        │   ├── date, reason
        │   └── tenantId
        │
        ├── WEBHOOKEVENT (Stripe webhook audit trail)
        │   ├── stripeEventId, type, payload
        │   └── tenantId
        │
        └── CONFIGCHANGELOG (Audit trail)
            ├── action, before, after
            ├── userId, timestamp
            └── tenantId
```

### 6.2 Key Schema Constraints

**Tenant Isolation**:

- ✅ `tenantId` foreign key on all tenant-scoped tables
- ✅ Index on `(tenantId, ...)` for fast filtering
- ✅ Service layer enforces tenantId in queries
- ✅ Auth middleware extracts and validates tenantId

**Data Integrity**:

- ✅ Unique constraints: `apiKeyPublic`, `slug`, `stripeAccountId`
- ✅ Foreign keys with `onDelete: Cascade` for cleanup
- ✅ Default values for timestamps and status fields
- ✅ Type safety via Prisma schema (no raw SQL in services)

**Performance Indexes**:

- `tenantId` on all scoped tables
- `(tenantId, slug)` on Package for unique slug per tenant
- `(tenantId, date)` on BlackoutDate for range queries
- `(tenantId, status)` on Booking for filtering

---

## 7. API Layer Design

### 7.1 REST Endpoint Organization

**16 Route Files** organized by domain:

```
/v1/packages              → GET all, POST create
/v1/packages/:id          → GET one, PUT update, DELETE
/v1/packages/:id/add-ons  → GET add-ons for package

/v1/bookings              → POST create, GET all
/v1/bookings/:id/session  → GET checkout session

/v1/availability          → GET available dates

/v1/auth/login            → POST admin login
/v1/auth/register         → POST admin register

/v1/admin/*               → Platform admin endpoints
/v1/admin-packages/*      → Package management
/v1/segments/*            → Segment management

/v1/tenant-admin/*        → Tenant self-service endpoints
/v1/tenant-admin/branding → GET/PUT branding config
/v1/tenant-admin/packages → GET/POST packages (tenant scope)

/v1/webhooks/stripe       → POST Stripe webhook

/v1/dev/*                 → Development simulation endpoints (mock only)

/health                   → Liveness check
/ready                    → Readiness check
/api/docs                 → Swagger UI documentation
/api/docs/openapi.json    → OpenAPI spec
```

### 7.2 Request/Response Patterns

**Successful Response**:

```json
{
  "status": "success",
  "data": {
    "id": "pkg_abc123",
    "title": "Premium Wedding Package",
    "basePrice": 5000,
    "currency": "USD"
  }
}
```

**Error Response**:

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid tenant API key"
  }
}
```

**Paginated Response** (when applicable):

```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 7.3 Authentication & Authorization

**API Key Authentication** (Public Client):

```
Header: X-Tenant-Key: pk_live_bellaweddings_abc123xyz
→ Validated in auth middleware
→ Extracted tenantId used in all service calls
```

**JWT Authentication** (Admin):

```
Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
→ Verified with JWT_SECRET
→ Extracts userId, tenantId, role
→ Authorizes based on role (ADMIN, TENANT_ADMIN, PLATFORM_ADMIN)
```

**Rate Limiting**:

- Login endpoints: 5 attempts per 15 minutes per IP
- Admin routes: Global rate limit (100 req/min)
- Webhook endpoints: Skipped (no limit)

---

## 8. Testing Architecture

### 8.1 Test Pyramid

```
                  ▲
                 ╱│╲
                ╱ │ ╲  E2E (Playwright)
               ╱  │  ╲ End-to-end tests (4-5 core user flows)
              ╱───┼───╲
             ╱    │    ╲
            ╱     │     ╲ Integration (Vitest)
           ╱      │      ╲ Database + service layer tests
          ╱───────┼───────╲
         ╱        │        ╲
        ╱         │         ╲ Unit (Vitest)
       ╱          │          ╲ Individual functions, mock adapters
      ╱───────────┼───────────╲
     ╱            │            ╲
    ╱─────────────┴─────────────╲

Coverage Target: 80% lines, 75% branches, 80% functions
Current: 76% (Phase 6 post-stabilization)
```

### 8.2 Test Categories

**Unit Tests** (`*.test.ts`):

- Location: Co-located with source files
- Runner: Vitest
- Adapters: Mock repositories
- Coverage: Individual service methods
- Example: `catalog.service.test.ts` (no database)

**Integration Tests** (`test/integration/`):

- Location: Separate test directory
- Runner: Vitest
- Adapters: Real Prisma + test database
- Coverage: Service interactions with database
- Setup: Test database fixtures, seed data
- Example: `test/integration/booking.service.test.ts`

**E2E Tests** (`e2e/tests/`):

- Location: Playwright test files
- Runner: Playwright
- Scope: Full user flows (booking, admin, auth)
- Browser: Chromium
- Features: Screenshots, videos, traces on failure
- Setup: Dev servers (API + client) run via webServer config

### 8.3 Test Configuration

**Vitest** (`server/vitest.config.ts`):

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'test/**', 'dist/**'],
      thresholds: { lines: 40, branches: 75, functions: 35 },
    },
  },
});
```

**Playwright** (`e2e/playwright.config.ts`):

```typescript
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:5173',
    timeout: 120000,
  },
});
```

### 8.4 Continuous Integration

**GitHub Actions** (`.github/workflows/ci.yml`):

```yaml
jobs:
  lint:
    - ESLint for TypeScript/TSX files
    - Prettier format check

  typecheck:
    - TypeScript strict compile check

  test:
    - Unit tests: vitest run --coverage
    - Coverage report uploaded to Codecov

  integration-tests:
    - Integration tests: vitest run test/integration/ (with DATABASE_URL_TEST)

  build:
    - Client: vite build (production bundle)
    - Server: tsc -b (emit TypeScript declarations)
```

---

## 9. Security Architecture

### 9.1 Authentication & Authorization

**User Roles**:

- `USER`: Default platform user (future)
- `ADMIN`: Platform admin (view all tenants, manage infrastructure)
- `TENANT_ADMIN`: Tenant admin (manage own tenant's data)
- `PLATFORM_ADMIN`: Same as ADMIN (legacy naming)

**Authentication Methods**:

1. **JWT (Admin)**: `POST /v1/auth/login` → returns `{ token: "JWT..." }`
2. **API Key (Public Client)**: `X-Tenant-Key: pk_live_slug_xxx` header
3. **Tenant Auth**: `POST /v1/tenant-admin/login` → returns tenant admin JWT

**Authorization Checks**:

```typescript
// Middleware validates JWT signature
const decoded = jwt.verify(token, config.JWT_SECRET);

// Routes check role
if (decoded.role !== 'PLATFORM_ADMIN') {
  throw new ForbiddenError('Admin access required');
}

// Services enforce tenant scoping
async getPackages(tenantId: string) {
  return repo.getAllPackages(tenantId); // Always scoped
}
```

### 9.2 Data Protection

**Passwords**:

- Hashed with bcryptjs (10 rounds)
- Never logged or exposed in responses
- Validated on admin/tenant login

**API Keys**:

- Public key: `pk_live_tenant_slug_random` (safe to expose)
- Secret key: Stored hashed in database
- Generation: UUID + tenant slug + random suffix

**Secrets Storage**:

- Tenant.secrets: JSON field with encrypted Stripe credentials
- Encryption: AES-256-GCM (CipherText + IV + AuthTag)
- Decryption key: From environment (DB-level encryption possible)

**CORS Security**:

- Whitelist: localhost, https://mais.com, https://widget.mais.com
- Production: All HTTPS origins allowed (for widget embedding)
- Credentials: true (allows cookies if needed)
- Exposed Headers: X-Tenant-Key

### 9.3 Rate Limiting & DDoS Prevention

**Login Endpoints**:

- 5 attempts per 15 minutes per IP
- Blocks further attempts (429 Too Many Requests)
- Implements exponential backoff client-side

**Admin Routes**:

- Global rate limit: 100 requests per 1 minute
- Skipped for: health, ready, dev endpoints

**Helmet Middleware**:

- Content-Security-Policy headers
- X-Frame-Options: DENY (prevent clickjacking)
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HTTPS enforcement)

### 9.4 Input Validation

**Server-Side Validation** (Zod schemas):

```typescript
const CreatePackageSchema = z.object({
  title: z.string().min(1).max(200),
  basePrice: z.number().int().positive(),
  baseDuration: z.number().int().positive(),
});

// In route handler
const validated = CreatePackageSchema.parse(req.body);
```

**API Key Validation**:

```typescript
// X-Tenant-Key format: pk_live_slug_random
const isValidApiKey = (key: string) => {
  const [prefix, mode, slug, ...rest] = key.split('_');
  return prefix === 'pk' && mode === 'live' && slug && rest.length > 0;
};
```

**HTTPS Enforcement** (Production):

- Stripe Webhook: Only HTTPS endpoints allowed
- Google Calendar: Only HTTPS requests accepted
- Postmark: Only HTTPS API calls accepted

---

## 10. Deployment & DevOps

### 10.1 Environment Configuration

**Development**:

```bash
ADAPTERS_PRESET=mock              # Use in-memory adapters
API_PORT=3001
JWT_SECRET=dev-secret-key-12345
VITE_API_URL=http://localhost:3001
VITE_APP_MODE=development
```

**Testing**:

```bash
ADAPTERS_PRESET=mock
DATABASE_URL=postgresql://localhost/macon_test
VITE_E2E=1
VITE_TENANT_API_KEY=pk_live_elope-e2e_000000000000
```

**Production**:

```bash
ADAPTERS_PRESET=real
DATABASE_URL=postgresql://user:pass@supabase.co/db  # Connection pooling
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
POSTMARK_SERVER_TOKEN=...
GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...
NODE_ENV=production
```

### 10.2 Build & Deployment Process

**Client Build** (Vite):

```bash
npm run build --workspace=client
# Output: client/dist/ → Deployed to CDN or static hosting
```

**Server Build** (TypeScript):

```bash
npm run build --workspace=server
# Output: server/dist/ → Node.js runtime
```

**Database**:

```bash
npx prisma migrate deploy  # Apply pending migrations
npx prisma db seed        # Run seed script (optional)
```

**Startup**:

```bash
npm start --workspace=server
# Loads config → Initializes Prisma → Starts Express on port 3001
```

### 10.3 Scaling Considerations

**Horizontal Scaling**:

- Stateless Express servers (no session storage)
- Use external session store (Redis) if needed
- Database connection pooling via Prisma/Supabase
- In-memory cache (node-cache) could be replaced with Redis

**Database Optimization**:

- Indexes on `tenantId`, `(tenantId, slug)`, `(tenantId, date)`
- Query optimization via Prisma query optimization
- Connection pooling (Supabase manages automatically)
- Slow query logging in dev mode

**Monitoring**:

- Sentry error tracking (Node + Browser)
- Pino structured logging (JSON format for log aggregation)
- Health checks: `/health`, `/ready` endpoints
- Performance monitoring: Sentry profiling, server logs

---

## 11. Key Patterns & Best Practices

### 11.1 Error Handling

**Custom Error Types**:

```typescript
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} not found: ${id}`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
  }
}
```

**Error Middleware**:

```typescript
app.use(errorHandler);
// Catches thrown errors and formats as JSON response
// Logs to Sentry + structured logging
```

### 11.2 Idempotency & Retry Safety

**Idempotency Service**:

```typescript
// Prevents duplicate bookings if webhook retried
const idempotencyKey = req.headers['idempotency-key'];
const cached = await idempotencyService.get(idempotencyKey);
if (cached) return cached; // Return cached response

const result = await bookingService.create(...);
await idempotencyService.set(idempotencyKey, result);
return result;
```

**Webhook Handling**:

- Verify Stripe signature
- Store event ID to prevent duplicates
- Return 200 immediately (async processing)
- Emit domain event for side effects

### 11.3 Audit & Compliance

**Audit Service**:

```typescript
// Log all package changes
await auditService.log({
  action: 'PACKAGE_CREATED',
  resource: 'Package',
  resourceId: package.id,
  before: null,
  after: package,
  userId,
  tenantId,
});
```

**Retention**:

- ConfigChangeLog: 90 days (configurable)
- WebhookEvent: 1 year (compliance)
- Audit logs: Structured logging (Datadog/CloudWatch)

---

## 12. Development Workflow

### 12.1 Getting Started

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env  # Edit with dev settings

# Run development servers
npm run dev:all      # Concurrently runs API + client

# Or run separately
npm run dev:api      # API only (port 3001)
npm run dev:client   # Client only (port 5173)
```

### 12.2 Testing Workflow

```bash
# Unit tests (with mock adapters)
npm run test:unit

# Watch mode (auto-rerun on changes)
npm run test:watch

# Integration tests (with real database)
npm run test:integration

# E2E tests (full user flows)
npm run test:e2e

# Coverage report
npm run test:coverage
```

### 12.3 Code Quality

```bash
# Linting (ESLint)
npm run lint

# Format code (Prettier)
npm run format

# Type checking (TypeScript)
npm run typecheck

# All checks together
npm run lint && npm run typecheck && npm run test
```

### 12.4 Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Commit changes (pre-commit hook runs ESLint)
git commit -m "feat(feature): Description of changes"

# Create pull request
gh pr create --title "PR Title" --body "Description"
```

---

## 13. Component Inventory

### 13.1 Shared Components (shadcn/Radix)

**Form Components**:

- `Button` - Primary, secondary, destructive variants
- `Input` - Text, email, password inputs
- `Select` - Dropdown selection
- `Dialog` - Modal dialogs (Radix)
- `AlertDialog` - Confirmation dialogs
- `Label` - Form labels

**Layout Components**:

- `Card` - Content container
- `Container` - Page width limiter
- `Loading` - Spinner animation

**Indicators**:

- `Badge` - Status badges
- `Alert` - Alert boxes
- `Toast` - Notifications (via Sonner)

### 13.2 Feature Components

**Admin Dashboard**:

- AdminLayout - Admin dashboard layout
- AdminNav - Admin navigation
- TenantList - Tenant management table
- SegmentList - Segment management

**Tenant Admin**:

- TenantDashboard - Tenant main dashboard
- BrandingEditor - Logo, color picker
- PackageEditor - Package CRUD
- BlackoutDateManager - Availability management

**Booking**:

- CatalogBrowser - Package listing and filtering
- CheckoutForm - Billing information
- BookingConfirmation - Success page

---

## 14. Performance Considerations

### 14.1 Caching Strategy

**HTTP Cache Headers**:

```typescript
// Cacheable endpoints
GET /v1/packages  → Cache-Control: public, max-age=300 (5 min)
GET /api/docs     → Cache-Control: public, max-age=86400 (1 day)

// Non-cacheable endpoints
POST /v1/bookings → Cache-Control: no-cache, no-store
GET /v1/admin/*   → Cache-Control: private, no-cache
```

**Server-Side Caching**:

- Catalog (packages): 15-minute TTL
- Availability: 1-minute TTL (fresh data for date checking)
- Admin data: No cache (real-time updates)

**Client-Side Caching** (React Query):

- Stale time: 5 minutes (when to refetch)
- Cache time: 10 minutes (when to garbage collect)
- Background refetch: On window focus

### 14.2 Database Query Optimization

**N+1 Query Prevention**:

```typescript
// Bad: N+1 queries
const packages = await repo.getAllPackages(tenantId);
for (const pkg of packages) {
  pkg.addOns = await repo.getAddOns(pkg.id); // N queries!
}

// Good: Single query with joins
const packages = await repo.getAllPackagesWithAddOns(tenantId);
```

**Index Strategy**:

- `(tenantId)` on all scoped tables
- `(tenantId, slug)` on Package
- `(tenantId, status)` on Booking
- `(tenantId, date)` on BlackoutDate

### 14.3 Bundle Size Optimization

**Client Build**:

```typescript
// Tree-shaking unused code
import { Button } from '@/components/ui'; // Only Button included

// Code splitting
const AdminLayout = lazy(() => import('@/features/admin/layout'));
// Loaded on-demand when admin route accessed
```

**Chunk Analysis**:

```bash
npm run build --workspace=client
# View dist/ file sizes
# Analyze with: npx vite-plugin-visualizer
```

---

## 15. Future Architectural Enhancements

### 15.1 Phase 7-8 Roadmap

**Planned Improvements**:

- [ ] Redis caching layer (replace node-cache)
- [ ] Message queue (Kafka/RabbitMQ) for webhook processing
- [ ] Micro-services split (catalog, booking as separate services)
- [ ] GraphQL API alongside REST
- [ ] Rate limiting service (Redis-backed)
- [ ] Multi-region database replication
- [ ] API versioning (v2, v3 alongside v1)

### 15.2 Observability Enhancements

- [ ] OpenTelemetry tracing (distributed tracing across services)
- [ ] Grafana dashboards for metrics
- [ ] Custom domain events for business metrics
- [ ] Real-time alerting on SLOs

### 15.3 Testing Improvements

- [ ] Increase coverage to 85%+ (currently 76%)
- [ ] Contract testing for API changes
- [ ] Load testing (k6/Locust)
- [ ] Chaos engineering (failure injection)

---

## 16. Summary: Architecture at a Glance

| Aspect              | Technology                   | Pattern                               |
| ------------------- | ---------------------------- | ------------------------------------- |
| **API Layer**       | ts-rest + Express            | RESTful with type-safe contracts      |
| **Frontend**        | React 18 + Vite              | SPA with client-side routing          |
| **Styling**         | Tailwind CSS                 | Utility-first design system           |
| **Database**        | PostgreSQL + Prisma          | Relational with ORM abstraction       |
| **Architecture**    | Hexagonal (Ports & Adapters) | Loose coupling, high testability      |
| **Multi-Tenancy**   | Tenant-scoped queries        | Complete data isolation               |
| **Testing**         | Vitest + Playwright          | Unit + integration + E2E              |
| **Auth**            | JWT + API Keys               | Role-based access control             |
| **Payments**        | Stripe + Stripe Connect      | Commission-based multi-tenant billing |
| **Logging**         | Pino structured logging      | JSON logs for log aggregation         |
| **Error Tracking**  | Sentry                       | Client + server error monitoring      |
| **Package Manager** | pnpm workspaces              | Monorepo with shared packages         |
| **CI/CD**           | GitHub Actions               | Automated lint, test, build pipeline  |

---

## Appendix: Key Files Reference

**Root Config Files**:

- `/package.json` - Monorepo workspace definitions
- `/tsconfig.base.json` - Base TypeScript strict config
- `/.eslintrc.cjs` - ESLint rules
- `/.prettierrc.json` - Code formatting

**Server Entry Points**:

- `server/src/index.ts` - Server startup
- `server/src/app.ts` - Express app factory
- `server/src/di.ts` - Dependency injection container
- `server/prisma/schema.prisma` - Database schema

**Client Entry Points**:

- `client/src/main.tsx` - React root
- `client/src/router.tsx` - Route definitions
- `client/tailwind.config.js` - Design tokens

**API Contracts**:

- `packages/contracts/src/api.v1.ts` - ts-rest API definition
- `packages/contracts/src/dto.ts` - Data transfer objects

**Test Configuration**:

- `server/vitest.config.ts` - Unit/integration test config
- `e2e/playwright.config.ts` - E2E test config

---

**Document Generated**: November 18, 2025  
**Analysis Depth**: Very Thorough (Complete Codebase Scan)  
**Version**: 1.0  
**Branch**: uifiddlin (UI Development)
