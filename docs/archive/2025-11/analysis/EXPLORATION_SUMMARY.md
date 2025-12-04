# MAIS Codebase Exploration - Executive Summary

## What is MAIS?

MAIS is a **production-ready multi-tenant wedding/elopement booking platform** that enables independent wedding service providers to offer customizable online booking experiences. Think of it as the SaaS infrastructure that allows venues, photographers, and planners to embed booking widgets on their websites.

## Key Strengths

### 1. **Sophisticated Multi-Tenant Architecture**

- Database-level tenant isolation with API key-based tenant resolution
- Clean separation between platform admins, tenant admins, and public customers
- Tenant data protected at multiple layers: database, API, middleware, service, and application

### 2. **Type-Safe End-to-End APIs**

- Uses ts-rest for contract-driven API design
- Single source of truth for API contracts (no OpenAPI drift)
- Full TypeScript type inference on client - compile-time API validation
- Eliminates entire class of client/server mismatch bugs

### 3. **Stripe Connect Payment Integration**

- Sophisticated multi-tenant payment splitting
- Platform takes commission via `application_fee_amount`
- Tenants receive payments directly to their bank accounts
- Server-side commission calculation with Stripe Connect constraints (0.5% - 50%)

### 4. **Clean Architecture Patterns**

- Modular monolith with explicit service boundaries
- Dependency injection for testability and loose coupling
- Repository/adapter pattern for data access and external services
- Event-driven architecture with in-process event emitter
- Clear error handling with domain-specific exceptions

### 5. **Comprehensive Security**

- JWT authentication with algorithm validation (HS256 only)
- bcryptjs password hashing (10 rounds)
- Webhook signature verification (HMAC)
- Tenant isolation validated at every layer
- API key rotation support
- Rate limiting on login and admin routes

### 6. **Developer Experience**

- Mock mode for development (no external dependencies)
- Real mode with PostgreSQL, Stripe, Google Calendar, Postmark
- Comprehensive documentation using Diátaxis framework
- Structured JSON logging with Pino
- Hot reload during development

## Core Features

### For Customers

- Browse wedding packages with add-ons
- Check availability calendar with blackout dates and Google Calendar integration
- Secure checkout via Stripe
- Email confirmation on booking completion
- Widget embedded on partner websites via postMessage

### For Tenant Admins

- Dashboard to configure packages and add-ons with photos
- Customize branding (colors, fonts, logo)
- Manage bookings and view revenue
- Set blackout dates
- Setup Stripe Connect for payment processing
- Upload logo and package photos

### For Platform Admins

- View all tenants and their metrics
- Manage tenant status (activate/deactivate)
- Monitor bookings and revenue
- Access system health checks

## Technology Stack

### Backend

- **Framework:** Express 4.21 + TypeScript
- **Database:** PostgreSQL with Prisma ORM 6.17
- **API:** @ts-rest/express 3.52 (type-safe contracts)
- **Authentication:** JWT + bcryptjs
- **Payment:** Stripe 19 (payment + Stripe Connect)
- **Email:** Postmark integration
- **Validation:** Zod schemas
- **Logging:** Pino
- **Testing:** Vitest

### Frontend

- **Framework:** React 18.3 + TypeScript
- **Build:** Vite 6
- **Routing:** React Router 7
- **State:** TanStack Query 5 (server state) + React Context (auth)
- **UI:** Radix UI components + Tailwind CSS 3
- **Icons:** Lucide React

### Shared Packages

- **Contracts:** ts-rest API contracts (shared between client/server)
- **Shared:** Common utilities and types

## Architecture Highlights

### Multi-Tenant Data Flow

```
Request → X-Tenant-Key header
    ↓
resolveTenant() middleware
    ↓
Lookup tenant by apiKeyPublic
    ↓
Validate tenant.isActive
    ↓
Attach tenant to request
    ↓
Service methods require tenantId parameter
    ↓
All queries filtered by tenantId
    ↓
Cache keys include tenant ID
    ↓
Response only contains tenant's data
```

### Payment Processing Flow

```
Customer clicks "Book"
    ↓
Checkout service fetches package + add-ons
    ↓
Commission service calculates: $100 booking × 12% = $12 commission
    ↓
Creates Stripe Connect session with:
  - destination: tenant.stripeAccountId
  - application_fee_amount: 1200 (cents)
    ↓
Stripe charges customer $100
    ↓
Sends $88 to tenant, $12 to platform
    ↓
Webhook triggers BookingPaid event
    ↓
Email service sends confirmation
```

### Event Architecture

```
Stripe webhook
    ↓
WebhooksController verifies signature
    ↓
Checks for duplicates (idempotency)
    ↓
Records webhook event
    ↓
Confirms booking
    ↓
Emits BookingPaid event
    ↓
Email service subscribes and sends confirmation
    ↓
Other services can subscribe for custom side effects
```

## Database Schema (Simplified)

```
Tenant (the wedding business)
  ├── User (tenant admins)
  ├── Package (wedding packages: "Intimate", "Full Day", etc.)
  │   ├── AddOn (photography, flowers, etc.)
  │   └── BookingAddOn (selected add-ons per booking)
  ├── Booking (customer bookings)
  │   └── Payment (payment records)
  ├── BlackoutDate (unavailable dates)
  └── WebhookEvent (Stripe event tracking)

Customer (who books)
  └── Booking (linked to Booking above)

Venue (optional location info)
  └── Booking (optional venue info)

ConfigChangeLog (audit trail for compliance)
```

## Key Files to Understand

### Backend Core

- `server/src/app.ts` - Express setup and middleware pipeline
- `server/src/di.ts` - Dependency injection container (where services are wired together)
- `server/src/index.ts` - Entry point

### Services (Domain Logic)

- `server/src/services/catalog.service.ts` - Package/add-on management
- `server/src/services/booking.service.ts` - Checkout and booking creation
- `server/src/services/commission.service.ts` - Platform commission calculation
- `server/src/services/stripe-connect.service.ts` - Tenant Stripe account setup
- `server/src/services/audit.service.ts` - Configuration change logging

### Routes (Endpoints)

- `server/src/routes/index.ts` - Route registration
- `server/src/routes/tenant-admin.routes.ts` - Tenant admin endpoints
- `server/src/routes/webhooks.routes.ts` - Stripe webhook handler

### Middleware (Cross-Cutting Concerns)

- `server/src/middleware/tenant.ts` - Tenant resolution via API key
- `server/src/middleware/auth.ts` - Admin authentication via JWT
- `server/src/middleware/tenant-auth.ts` - Tenant authentication via JWT
- `server/src/middleware/error-handler.ts` - Error to HTTP status mapping

### Adapters (External Services)

- `server/src/adapters/stripe.adapter.ts` - Stripe payment processing
- `server/src/adapters/gcal.adapter.ts` - Google Calendar integration
- `server/src/adapters/postmark.adapter.ts` - Email sending
- `server/src/adapters/prisma/*.ts` - Data repositories

### Frontend Pages

- `client/src/pages/Home.tsx` - Public home page
- `client/src/pages/Package.tsx` - Package detail page
- `client/src/pages/Success.tsx` - Payment success page
- `client/src/pages/admin/PlatformAdminDashboard.tsx` - Platform admin view
- `client/src/pages/tenant/TenantAdminDashboard.tsx` - Tenant admin view

### Widget (Embeddable)

- `client/src/widget/WidgetApp.tsx` - Main widget component
- `client/src/widget/WidgetMessenger.ts` - postMessage communication
- `client/src/widget-main.tsx` - Widget entry point

### API Contract

- `packages/contracts/src/api.v1.ts` - All API endpoints (ts-rest)
- `packages/contracts/src/dto.ts` - Data Transfer Objects with Zod schemas

### Authentication

- `client/src/contexts/AuthContext.tsx` - React auth context (login/logout)
- `client/src/lib/auth.ts` - JWT decoding and token management
- `client/src/lib/api.ts` - ts-rest API client with auto-auth injection

## Testing

- **Framework:** Vitest
- **Test Files:** Located alongside source (`*.test.ts`)
- **Coverage Target:** 70% branch coverage
- **Run Tests:** `npm test` (server), `npm run test:watch`
- **Integration Tests:** Use real database with test connection

## Development Workflow

```bash
# Terminal 1: API (mock mode - no DB required)
npm run dev:api

# Terminal 2: Frontend
npm run dev:client

# Terminal 3: Stripe webhooks (optional)
stripe listen --forward-to localhost:3001/v1/webhooks/stripe

# All in one
npm run dev:all
```

**Access Points:**

- API: http://localhost:3001
- Web: http://localhost:5173
- API Docs: http://localhost:3001/api/docs

## Documentation Structure

MAIS uses the **Diátaxis framework** for documentation organization:

- **Tutorials:** Learning-focused, step-by-step guides
- **How-To Guides:** Task-focused, problem-solving instructions
- **Reference:** Technical specifications and APIs
- **Explanation:** Understanding concepts and design decisions

See `/docs/README.md` for the full documentation index.

## Security Notes

1. **Tenant Isolation:** Multiple layers ensure tenants can't see each other's data
2. **Token Types:** Admin tokens (`role: 'admin'`) vs Tenant tokens (`type: 'tenant'`) prevent cross-role attacks
3. **API Keys:** Public keys safe for widgets, secret keys for admin operations
4. **Stripe Connect:** Platform never handles customer funds (good for compliance)
5. **Rate Limiting:** Login and admin routes protected from brute force
6. **Error Messages:** Don't leak whether tenants exist (return 404 on access denied)

## Deployment Considerations

- **Database:** PostgreSQL (Supabase recommended for serverless)
- **Static Files:** Logo and package photos served from `/uploads/`
- **Environment:** Mock vs Real adapter modes
- **Env Vars:** All critical config in environment variables
- **Health Checks:** `/health` (always ready), `/ready` (checks dependencies)

## Extension Points

The architecture makes it easy to extend:

- **New Services:** Add to `/services/` and wire in `di.ts`
- **New Repositories:** Implement `*Repository` interface and add adapter
- **New External Services:** Create adapter implementing port interface
- **New API Endpoints:** Add to contracts, implement handler, wire in routes
- **New Events:** Emit from service, subscribe in `di.ts`

## Next Steps for Development

1. **Understand the Request Flow:** Follow a booking creation from API call to database
2. **Try the Widget:** See how it communicates with the parent window
3. **Review Stripe Integration:** Understand commission calculation and payment flow
4. **Explore Tests:** Read test files to see expected behavior
5. **Check Documentation:** Browse `/docs/` for deep dives on specific topics

---

**Full detailed documentation:** See `/CODEBASE_EXPLORATION_COMPLETE.md` (1482 lines)
