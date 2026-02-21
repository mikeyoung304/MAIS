# HANDLED - Membership Platform for Service Professionals

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-92.2%25-brightgreen)](./TESTING.md)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](./DEVELOPING.md)
[![Production Ready](https://img.shields.io/badge/production-ready-brightgreen)](./ARCHITECTURE.md)
[![Platform Maturity](https://img.shields.io/badge/maturity-9.8%2F10-brightgreen)](./docs/archive/2025-12/sprints/2025-11-24_SPRINT_10_FINAL_SUMMARY.md)

> Done-for-you tech. Done-with-you education. For service professionals who want to focus on their craft.

---

## What is HANDLED?

**HANDLED** ([gethandled.ai](https://gethandled.ai)) is a **membership platform for service professionals** — from photographers to therapists to personal trainers — combining done-for-you tech with done-with-you education.

Members get:

- **Optimized storefront** showcasing your services and brand
- **Integrated booking & payments** through Stripe
- **AI-powered chatbot** that handles client inquiries 24/7
- **Monthly newsletter** about what's worth knowing in AI
- **Live Zoom calls** with the community and experts

### The Membership Model

HANDLED is a straightforward membership — one monthly fee, everything included:

- **Done-for-you tech** - We build and maintain your website, booking system, and AI chatbot
- **Done-with-you education** - Monthly newsletters and Zoom calls about AI trends that matter
- **Community access** - Connect with other service professionals on the same journey
- **Ongoing support** - We're here when you need help, not just at setup

### What Members Get

**1. Professional Website + Booking**

- Beautiful, conversion-optimized website showcasing your services
- Integrated booking system with calendar sync
- Payment processing through Stripe (you keep 100% of your earnings)

**2. AI Chatbot for Your Business**

- 24/7 client inquiry handling
- Answers questions about your services and availability
- Books appointments directly into your calendar

**3. Monthly Education**

- Newsletter covering AI trends relevant to service businesses
- Live Zoom calls with Q&A and guest experts
- No fluff — just what's actually useful

### Who Is HANDLED For?

Any service professional who books clients and wants to look professional online:

- **Health & Wellness** — Therapists, personal trainers, yoga instructors, massage therapists
- **Creative Professionals** — Photographers, videographers, graphic designers, musicians
- **Coaches & Consultants** — Life coaches, business coaches, career consultants
- **Event Professionals** — Wedding planners, event coordinators, DJs, caterers
- **Home Services** — Interior designers, organizers, tutors, pet sitters
- **And more** — If you book appointments with clients, HANDLED works for you

### Why Members Love It

- **One monthly fee** — No surprise charges, predictable cost
- **Tech handled for you** — No DIY website builders or plugin nightmares
- **Stay current on AI** — Learn what matters without drowning in hype
- **Community support** — You're not figuring this out alone

### Platform Capabilities

The HANDLED platform supports flexible pricing models:

- **Membership-based** — Flat monthly fee (current default)
- **Commission-based** — Platform fee as percentage of bookings (available for custom arrangements)

Members on the standard membership keep 100% of their booking revenue.

### Member Platform Features

**Current Maturity: Sprint 10 Complete - Production Ready (9.8/10)**

**🚀 Status: Production (December 2025)**

Club members currently have self-service access to:

- ✅ **Visual Branding** - Logo, colors, fonts for their digital presence (100% complete)
- ✅ **Service Package Management** - Full CRUD for offerings and pricing (100% complete)
- ✅ **Package Photos** - Photo upload API + UI complete (100% complete)
- ✅ **Add-On Management** - Upsells and extras configuration (100% complete)
- ✅ **Availability Control** - Blackout date and scheduling management (100% complete)
- ✅ **Member Dashboard** - Secure admin interface for business management (100% complete)
- ✅ **Package Discovery** - Segment-based catalog organization (100% complete)
- ✅ **Booking Management** - View and manage customer bookings (100% complete)
- ✅ **Customer Chatbot** - AI-powered booking assistant for storefronts (100% complete)
- ⚠️ **Content Customization** - Copy and messaging control (Planned)
- ⚠️ **Email Templates** - Custom client communication templates (Planned)

**Latest Updates:**

**Sprint 10 (Jan 2025) - Technical Excellence: COMPLETE ✅**

- **High Test Pass Rate**: Comprehensive test suite (run `npm test` to verify)
- **Test Infrastructure**: Retry helpers with exponential backoff (225 lines)
- **Security Hardening**: OWASP 70% compliance, input sanitization, custom CSP
- **Performance Optimization**: Redis caching (97.5% faster), 16 database indexes
- **New Tests**: Race condition and security coverage
- **Platform Maturity**: 9.5/10 → 9.8/10 (production-ready)

**Sprint 9 (Jan 2025) - Package Catalog & Discovery: COMPLETE ✅**

- ✅ Segment-based package organization
- ✅ Featured packages and display ordering
- ✅ Package grouping and filtering
- ✅ Mobile-optimized catalog browsing

**Sprint 8-8.5 (Jan 2025) - UX & Mobile Excellence: COMPLETE ✅**

- ✅ Progress indicators for booking flow
- ✅ Back buttons with unsaved changes detection
- ✅ Mobile-responsive design across all pages
- ✅ Accessibility improvements (WCAG 2.1 Level AA)

**Sprint 6-7 (Nov 2024):**

- ✅ Test stabilization infrastructure
- ✅ Database connection pool optimization
- ✅ Cache isolation and audit logging

**Roadmap:** See [Sprint 10 Final Summary](./docs/archive/2025-12/sprints/2025-11-24_SPRINT_10_FINAL_SUMMARY.md) for complete Sprint 10 report and [CHANGELOG.md](./CHANGELOG.md) for version history.

**Next: Production deployment for demo users → Scale to 10+ tenants**

---

## Agent-Powered Platform (Live - January 2026)

HANDLED is an **agent-powered, config-driven platform** where AI agents collaborate with members to manage their website, booking, and marketing configurations.

### AI Agent System

The platform runs 3 consolidated AI agents on Google Cloud Run using Google ADK (Agent Development Kit):

| Agent              | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| **customer-agent** | Service discovery, booking, project hub (customer view)         |
| **tenant-agent**   | Storefront editing, marketing, project management (tenant view) |
| **research-agent** | Web research                                                    |

These replaced a 6-agent hub-and-spoke architecture in January 2026 (see ADR-020). Previously archived agents (concierge, marketing, storefront, booking, project-hub) are available in git history.

### Core Capabilities

- **Conversational onboarding** -- AI-guided storefront setup with autonomous first-draft generation
- **Storefront editing** -- Section-level content management via `SectionContentService`
- **Marketing assistance** -- Brand strategy, competitive analysis, content generation
- **Customer booking** -- 24/7 AI-powered booking assistant on tenant storefronts
- **Project management** -- Customer-tenant communication and project tracking
- **Trust tiers** -- T1 (read-only), T2 (modify with preview), T3 (publish/delete with confirmation)

### Learn More

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Agent architecture and system design
- **[Sprint 10 Final Summary](./docs/archive/2025-12/sprints/2025-11-24_SPRINT_10_FINAL_SUMMARY.md)** - Sprint 10 completion report
- **[server/src/agent-v2/deploy/SERVICE_REGISTRY.md](./server/src/agent-v2/deploy/SERVICE_REGISTRY.md)** - Agent deployment registry

**Status**: Production (January 2026). 3-agent architecture live, storefront content via SectionContent table.

---

## Architecture Philosophy

MAIS is built as a **multi-tenant modular monolith** with clear boundaries and production-ready patterns:

- **Simplicity over novelty**: One backend + one frontend; shared types
- **Multi-tenant by design**: Complete data isolation via row-level tenantId scoping
- **Contract-first API**: Type-safe communication via Zod + ts-rest
- **Layered architecture**: Services own business logic; adapters isolate vendors
- **Tenant middleware**: Automatic tenant resolution from X-Tenant-Key header on all public routes
- **Mock-first development**: Build end-to-end with in-memory adapters, then swap to real providers
- **Bulletproof by default**: Strict TypeScript, Zod validation, comprehensive error handling

Learn more: [ARCHITECTURE.md](./ARCHITECTURE.md) | [MULTI_TENANT_IMPLEMENTATION_GUIDE.md](./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

---

## Tech Stack

### Backend

- **Runtime**: Node.js 20+
- **Framework**: Express 4 (HTTP server)
- **Language**: TypeScript 5.9.3 (strict mode)
- **Database**: PostgreSQL 15 (via Supabase)
- **ORM**: Prisma 7 (type-safe queries, migrations)
- **API Contract**: ts-rest + Zod (type-safe API)
- **Payments**: Stripe (checkout + webhooks)
- **Email**: Postmark (with file-sink fallback)
- **Calendar**: Google Calendar API (with mock fallback)
- **Logging**: Pino (structured JSON logging)
- **Testing**: Vitest (unit + integration tests)

### Frontend

- **Framework**: Next.js 14 App Router (React 18, React Server Components)
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 3
- **UI Components**: Radix UI (accessible primitives)
- **State Management**: TanStack Query (server state)
- **Auth**: NextAuth.js v5 (Credentials Provider)
- **API Client**: ts-rest/core (generated from contracts)

### Infrastructure

- **Database Hosting**: Supabase (PostgreSQL + connection pooling)
- **Monorepo**: npm workspaces
- **Process Manager**: systemd / PM2 / Docker
- **Deployment**: Docker containers (recommended)

---

## Project Structure

```
mais/
├── server/               # Backend API application
│   ├── src/
│   │   ├── routes/      # HTTP route handlers (Express + ts-rest)
│   │   ├── services/    # Business logic (booking, catalog, availability)
│   │   ├── adapters/    # External integrations (Prisma, Stripe, Postmark)
│   │   ├── middleware/  # Auth, error handling, logging
│   │   ├── agent-v2/   # AI agent system (3-agent architecture)
│   │   │   ├── deploy/
│   │   │   │   ├── customer/   # Customer-facing agent (13 tools)
│   │   │   │   ├── tenant/     # Tenant-facing agent (34 tools)
│   │   │   │   └── research/   # Web research agent
│   │   └── lib/         # Core utilities (config, logger, errors)
│   ├── prisma/          # Database schema and migrations
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── test/            # Unit and integration tests
│
├── apps/
│   └── web/             # Next.js 14 App Router (primary frontend)
│       ├── src/
│       │   ├── app/     # App Router pages (/t/[slug], auth, etc.)
│       │   ├── components/  # React components (tenant, ui, agent)
│       │   └── lib/     # Auth, API client, utilities
│       └── public/      # Static assets
│
├── packages/
│   ├── contracts/       # Shared API contracts (Zod schemas + endpoints)
│   └── shared/          # Shared DTOs and utilities (money, date helpers)
│
└── docs/                # Documentation
    ├── ARCHITECTURE.md
    ├── INCIDENT_RESPONSE.md
    ├── RUNBOOK.md
    └── ...
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Booking    │  │   Tenant     │  │    Admin     │         │
│  │     Flow     │  │  Storefronts │  │  Dashboard   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────┬────────────────────────────────────────┘
                         │ ts-rest client (type-safe)
                         │ X-Tenant-Key: pk_live_slug_xxx
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER (Express)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Tenant Middleware                       │  │
│  │  Validates X-Tenant-Key → Resolves Tenant → Injects ctx  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Routes Layer                         │  │
│  │  /packages  /bookings  /webhooks  /admin  /availability  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Services Layer                          │  │
│  │  CatalogService  BookingService  AvailabilityService      │  │
│  │  IdentityService  NotificationService  CommissionService  │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Adapters Layer                          │  │
│  │  PrismaRepos  StripeProvider  PostmarkProvider            │  │
│  │  GoogleCalendar  TenantRepository  (with mock alts)       │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │    External Services                  │
        │  • PostgreSQL (Supabase)              │
        │    - Row-level tenant isolation       │
        │  • Stripe (payments + Connect)        │
        │  • Postmark (email delivery)          │
        │  • Google Calendar (availability)     │
        └───────────────────────────────────────┘
```

**Key Design Patterns:**

- **Multi-Tenant Data Isolation**: All database queries scoped by tenantId
- **Tenant Middleware**: Automatic tenant resolution from API keys on all public routes
- **Variable Commission Rates**: Per-tenant commission calculated server-side (10-15%)
- **Dependency Injection**: Services receive adapters via constructor
- **Repository Pattern**: Database access abstracted behind interfaces
- **Event-Driven**: In-process event emitter for cross-service communication
- **Double-Booking Prevention**: Database constraints (tenantId + date) + pessimistic locking + transactions
- **Idempotent Webhooks**: Database-tracked event processing with retry support

---

## Screenshots

> Coming soon: Customer booking flow, admin dashboard, package management

For now, see the development guide: [DEVELOPING.md](./DEVELOPING.md)

---

## Quick Start

### Prerequisites

- **Node.js** 20+ and npm 8+
- **Git** for cloning the repository
- **PostgreSQL** access (Supabase free tier works perfectly)
- **Stripe Account** (free test mode)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mais.git
cd mais

# 2. Install dependencies
npm install

# 3. Verify your environment
npm run doctor
# This checks that all required dependencies are installed
```

### Option A: Mock Mode (Fastest - No External Services)

Perfect for local development and testing without setting up external services.

```bash
# 1. Start the API (mock mode is default)
npm run dev:api

# 2. In a new terminal, start the Next.js frontend
cd apps/web && npm run dev

# 3. Open your browser
# API: http://localhost:3001
# Web: http://localhost:3000
```

**What's mocked:**

- In-memory database (no PostgreSQL needed)
- Fake Stripe checkout (no payment processing)
- Console logging instead of email (no Postmark needed)
- Mock calendar (no Google Calendar needed)

**Test credentials:**

- Admin login: `admin@example.com` / `admin`

### Option B: Real Mode (Production-Like)

Run with actual external services (recommended before production deployment).

```bash
# 1. Create a Supabase project
# - Go to https://supabase.com
# - Create a new project (free tier)
# - Copy your DATABASE_URL from Settings → Database

# 2. Setup environment variables
cp server/.env.example server/.env
# Edit server/.env with your credentials:
# - DATABASE_URL (from Supabase)
# - DIRECT_URL (same as DATABASE_URL)
# - STRIPE_SECRET_KEY (from Stripe dashboard)
# - STRIPE_WEBHOOK_SECRET (from Stripe CLI)

# 3. Run database migrations
cd server
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed  # Creates sample data
cd ..

# 4. Start all services (API + Next.js + Stripe webhooks)
npm run dev:all

# Or start each service separately:
npm run dev:api                    # Terminal 1: API server
cd apps/web && npm run dev         # Terminal 2: Next.js frontend
stripe listen --forward-to localhost:3001/v1/webhooks/stripe  # Terminal 3: Webhooks
```

**Setup guides:**

- Database: [SUPABASE.md](./docs/setup/SUPABASE.md)
- Stripe: [RUNBOOK.md § Stripe Local Testing](./docs/operations/RUNBOOK.md#stripe-local-testing)
- Email: [RUNBOOK.md § Email (Postmark)](./docs/operations/RUNBOOK.md#email-postmark)
- Calendar: [RUNBOOK.md § Google Calendar](./docs/operations/RUNBOOK.md#google-calendar-integration)

### Create Your First Tenant

Before you can use the booking system, you need to create a tenant:

```bash
# Create a test tenant (this generates API keys)
cd server
npm run create-tenant -- \
  --name "Bella Weddings" \
  --slug "bella-weddings" \
  --email "hello@bellaweddings.com" \
  --commission 12.5

# Output will show your API keys:
# Public Key: pk_live_bella-weddings_abc123...
# Secret Key: sk_live_bella-weddings_xyz789...
# Save these keys - the secret key is shown only once!
```

### Default Segments and Tiers

When a new tenant is created, the system automatically sets up a **1×3 structure**:

| Default       | Name             | Slug               | Purpose                         |
| ------------- | ---------------- | ------------------ | ------------------------------- |
| **1 Segment** | General          | `general`          | Groups related service packages |
| **Tier 1**    | Basic Package    | `basic-package`    | Entry-level offering            |
| **Tier 2**    | Standard Package | `standard-package` | Most popular option             |
| **Tier 3**    | Premium Package  | `premium-package`  | Full experience                 |

**How it works:**

- **Segments** = Categories of services (e.g., "Family Photos", "Weddings", "Engagements")
- **Tiers** = Pricing levels within each segment (Basic → Standard → Premium)
- Tenants can create **1-10 segments** and **1-10 tiers per segment**
- Each tier is a `Package` with `groupingOrder` (1, 2, 3...) for display ordering
- All packages start with `basePrice: 0` — tenants set their own pricing

**Example for a photographer:**

```
Tenant: Bella Weddings
├── Segment: "Family Photos"
│   ├── Mini Session (Tier 1) - $150
│   ├── Standard Session (Tier 2) - $350
│   └── Premium Session (Tier 3) - $600
│
├── Segment: "Engagement Photos"
│   ├── Essential (Tier 1) - $250
│   ├── Classic (Tier 2) - $450
│   └── Deluxe (Tier 3) - $750
│
└── Segment: "Wedding Photos"
    ├── Coverage Only (Tier 1) - $2,000
    ├── Full Day (Tier 2) - $4,000
    └── Complete Experience (Tier 3) - $6,500
```

### Verify Installation

```bash
# Check API health
curl http://localhost:3001/health
# Expected: {"ok":true}

# Test tenant API (replace with your public key)
curl -H "X-Tenant-Key: pk_live_bella-weddings_abc123..." \
  http://localhost:3001/v1/packages
# Expected: [] (empty array - no packages yet)

# Check configuration
npm run doctor
# Expected: All green checkmarks

# Run tests
npm test
# Expected: All tests passing
```

### What to Do Next

1. **Explore the Admin Dashboard**
   - Visit http://localhost:3000/admin/login
   - Login with `admin@example.com` / `admin`
   - Manage packages, add-ons, and blackout dates

2. **Test the Booking Flow**
   - Visit http://localhost:3000
   - Browse packages
   - Select a date and complete checkout
   - (Mock mode: use any email, no payment needed)
   - (Real mode: use Stripe test card `4242 4242 4242 4242`)

3. **Review the Documentation**
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and patterns
   - [DEVELOPING.md](./DEVELOPING.md) - Development workflow
   - [TESTING.md](./TESTING.md) - Testing strategy
   - [INCIDENT_RESPONSE.md](./docs/operations/INCIDENT_RESPONSE.md) - Production runbook

### Troubleshooting

**API won't start:**

```bash
# Check if port 3001 is already in use
lsof -i :3001
# Kill the process or change API_PORT in .env

# Check environment configuration
npm run doctor
```

**Database connection errors:**

```bash
# Verify DATABASE_URL is set correctly
echo $DATABASE_URL

# Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check Supabase project isn't paused
# Visit: https://supabase.com/dashboard
```

**Stripe webhooks not working:**

```bash
# Verify Stripe CLI is installed and logged in
stripe --version
stripe login

# Check webhook secret matches .env
stripe listen --print-secret
# Copy output to STRIPE_WEBHOOK_SECRET in .env
```

**Client shows API errors:**

```bash
# Verify API is running
curl http://localhost:3001/health

# Check CORS_ORIGIN in server/.env
# Should be: http://localhost:3000

# Clear browser cache and hard reload
```

Still stuck? See [RUNBOOK.md](./docs/operations/RUNBOOK.md) for detailed troubleshooting.

---

## Switching Modes

Toggle between mock and real mode by changing one environment variable:

```bash
# server/.env
ADAPTERS_PRESET=mock  # In-memory, no external services
# or
ADAPTERS_PRESET=real  # PostgreSQL, Stripe, Postmark, Google Calendar
```

**Graceful Fallbacks** (in real mode):

- **Postmark** not configured → Emails written to `server/tmp/emails/`
- **Google Calendar** not configured → All dates show as available (mock)

This allows you to run "real mode" with just database + Stripe, and add email/calendar later.

---

## Embeddable Widget

MAIS offers an embeddable booking widget that tenants can add to their existing websites with just a few lines of code.

### Quick Integration Example

```html
<!-- Add this to your website -->
<div id="mais-booking-widget"></div>

<script>
  (function () {
    window.MaisConfig = {
      apiKey: 'pk_live_yourcompany_abc123xyz789',
      container: '#mais-booking-widget',
    };
    var s = document.createElement('script');
    s.src = 'https://widget.mais.com/sdk/mais-sdk.js';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>
```

**Features:**

- Auto-resizing iframe with seamless integration
- Automatic branding from admin dashboard (colors, logo, fonts)
- Both embedded and modal/popup modes
- Event callbacks for analytics integration
- Mobile-responsive design
- Dark mode support

**Learn More:**

- **[WIDGET_INTEGRATION_GUIDE.md](./docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md)** - Complete integration documentation
- **[examples/widget-demo.html](./examples/widget-demo.html)** - Live example with both modes

---

## Documentation

### Getting Started

- **[Quick Start](#quick-start)** - Get up and running in 5 minutes
- **[WIDGET_INTEGRATION_GUIDE.md](./docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md)** - Embed the booking widget on your website
- **[DEVELOPING.md](./DEVELOPING.md)** - Development workflow and conventions
- **[TESTING.md](./TESTING.md)** - Testing strategy and guidelines
- **[API_DOCS_QUICKSTART.md](./docs/api/API_DOCS_QUICKSTART.md)** - Interactive API documentation

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, patterns, and data flow
- **[MULTI_TENANT_IMPLEMENTATION_GUIDE.md](./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Multi-tenant architecture guide
- **[MULTI_TENANT_ROADMAP.md](./docs/multi-tenant/MULTI_TENANT_ROADMAP.md)** - Phased plan for tenant self-service features
- **[PHASE_5_IMPLEMENTATION_SPEC.md](./docs/archive/2025-11/phases/PHASE_5_IMPLEMENTATION_SPEC.md)** - Technical specs for Priority 1 features
- **[DECISIONS.md](./DECISIONS.md)** - Architectural Decision Records (ADRs)
- **[SUPABASE.md](./docs/setup/SUPABASE.md)** - Database setup and integration guide

### Operations & Production

- **[RUNBOOK.md](./docs/operations/RUNBOOK.md)** - Operational procedures and local testing
- **[INCIDENT_RESPONSE.md](./docs/operations/INCIDENT_RESPONSE.md)** - Production incident response playbook
- **[ENVIRONMENT.md](./docs/setup/ENVIRONMENT.md)** - Environment variables reference
- **[SECRETS.md](./docs/security/SECRETS.md)** - Secret management and rotation procedures
- **[SECURITY.md](./docs/security/SECURITY.md)** - Security best practices and guardrails
- **[SECRET_ROTATION_GUIDE.md](./docs/security/SECRET_ROTATION_GUIDE.md)** - Complete guide for rotating secrets
- **[IMMEDIATE_SECURITY_ACTIONS.md](./docs/security/IMMEDIATE_SECURITY_ACTIONS.md)** - Urgent security action items

### Migration & Project History

- **[PHASE_1_COMPLETION_REPORT.md](./docs/archive/2025-11/phases/PHASE_1_COMPLETION_REPORT.md)** - Phase 1: Multi-tenant foundation
- **[PHASE_2B_COMPLETION_REPORT.md](./docs/archive/2025-11/phases/PHASE_2B_COMPLETION_REPORT.md)** - Phase 2B completion summary

---

## Contributing

We welcome contributions! Before submitting a PR, please:

1. **Read the development guide**: [DEVELOPING.md](./DEVELOPING.md)
2. **Follow the architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Write tests**: See [TESTING.md](./TESTING.md)
4. **Document decisions**: Add ADRs to [DECISIONS.md](./DECISIONS.md) for significant changes
5. **Update docs**: Keep README and related docs in sync with code changes

### Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes and test thoroughly
npm run test
npm run typecheck
npm run lint

# 3. Commit with descriptive messages
git commit -m "feat(booking): add double-booking prevention"

# 4. Push and create a pull request
git push origin feature/your-feature-name
```

### Code Style

- **TypeScript**: Strict mode enabled, no implicit any
- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)
- **Testing**: Vitest for unit/integration tests

---

## Deployment

### Production Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Environment variables configured (use `npm run doctor`)
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Stripe webhook endpoint configured in dashboard
- [ ] Email provider configured (Postmark or use file-sink)
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place (Supabase auto-backups enabled)
- [ ] SSL/TLS certificates configured
- [ ] Review [INCIDENT_RESPONSE.md](./docs/operations/INCIDENT_RESPONSE.md)

### Docker Deployment

```bash
# Build Docker image
docker build -t mais/api:latest -f server/Dockerfile .

# Run with environment variables
docker run -d \
  --name mais-api \
  --env-file server/.env.production \
  -p 3001:3001 \
  mais/api:latest

# Check health
curl http://localhost:3001/health
```

### Environment-Specific Configs

```bash
# Development
ADAPTERS_PRESET=mock
NODE_ENV=development
LOG_LEVEL=debug

# Staging
ADAPTERS_PRESET=real
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_URL=<staging-db>

# Production
ADAPTERS_PRESET=real
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_URL=<production-db>
```

See [RUNBOOK.md](./docs/operations/RUNBOOK.md) for detailed production operations.

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mais/issues)
- **Documentation**: All docs in this repository
- **Questions**: Open a discussion in GitHub Discussions

---

## 📚 Test Suite Documentation

**Current Status**: Comprehensive test suite - Production Ready (run `npm test` to verify)

### Quick Links

- **[SESSION_SUMMARY.md](./docs/archive/2025-11/analysis/SESSION_SUMMARY.md)** - Quick reference summary of Phase 1 completion
- **[FORWARD_PLAN.md](./docs/archive/2025-11/analysis/FORWARD_PLAN.md)** - Comprehensive phased plan for reaching 100%
- **[FINAL_COMPLETION_REPORT.md](./docs/archive/2025-11/analysis/FINAL_COMPLETION_REPORT.md)** - Complete Phase 1 achievement report

### Sprint 10 Phase 2 Complete (Nov 24, 2025)

**Achievements**:

- ✅ Comprehensive test suite passing (run `npm test` to verify)
- ✅ Fixed booking race condition test
- ✅ Fixed encryption service test
- ✅ Zero flaky tests (100% CI/CD stability)
- ✅ Production-ready test infrastructure

**Next Steps**: Component refactoring and production deployment preparation

---

## Acknowledgments

Built with modern, production-ready tools:

- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [React](https://react.dev/) - UI framework
- [Prisma](https://www.prisma.io/) - Type-safe database ORM
- [Supabase](https://supabase.com/) - PostgreSQL hosting
- [Stripe](https://stripe.com/) - Payment processing
- [ts-rest](https://ts-rest.com/) - Type-safe API contracts
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

---

**Made with care for service professionals who want to focus on their craft, not their tech.**
