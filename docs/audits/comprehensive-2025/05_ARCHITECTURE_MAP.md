# MAIS Architecture Map

**Date:** 2025-12-28
**Version:** 1.0

---

## 1. System Architecture Overview

```
                                    ┌─────────────────────────────────────┐
                                    │           CLOUDFLARE                │
                                    │      (DNS, WAF, DDoS Protection)    │
                                    └──────────────────┬──────────────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────────────────┐
                    │                                  │                                  │
                    ▼                                  ▼                                  ▼
        ┌───────────────────┐            ┌───────────────────┐            ┌───────────────────┐
        │   VERCEL EDGE     │            │   VERCEL EDGE     │            │    RENDER.COM     │
        │   (Next.js SSR)   │            │   (Next.js SSR)   │            │  (Express API)    │
        │                   │            │                   │            │                   │
        │ apps/web (3000)   │            │ client (5173)     │            │ server (3001)     │
        │ Tenant Storefronts│            │ Legacy Admin SPA  │            │ REST API          │
        └─────────┬─────────┘            └─────────┬─────────┘            └─────────┬─────────┘
                  │                                │                                │
                  │  ◄──────────  ts-rest API Contract  ──────────►                 │
                  │                                │                                │
                  └────────────────────────────────┴────────────────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
                    ▼                              ▼                              ▼
        ┌───────────────────┐        ┌───────────────────┐        ┌───────────────────┐
        │    SUPABASE       │        │      REDIS        │        │   EXTERNAL APIs   │
        │                   │        │    (Upstash)      │        │                   │
        │ - PostgreSQL      │        │                   │        │ - Stripe          │
        │ - Storage (S3)    │        │ - Cache           │        │ - Postmark        │
        │ - Auth (unused)   │        │ - BullMQ Queue    │        │ - Google Calendar │
        └───────────────────┘        └───────────────────┘        └───────────────────┘
```

---

## 2. Application Layer Detail

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS API (server/)                                  │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           MIDDLEWARE CHAIN                                   │  │
│  │                                                                              │  │
│  │  Request → Rate Limit → CORS → Helmet → Body Parser → Request Logger        │  │
│  │        → Tenant Resolution → Auth Verification → Route Handler              │  │
│  │                                                                              │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   PUBLIC ROUTES  │  │   ADMIN ROUTES   │  │  WEBHOOK ROUTES  │                 │
│  │                  │  │                  │  │                  │                 │
│  │ - /v1/t/:slug/*  │  │ - /v1/admin/*    │  │ - /v1/webhooks/* │                 │
│  │ - /v1/public/*   │  │ - /v1/tenant/*   │  │                  │                 │
│  │ - /v1/auth/*     │  │ - /v1/agent/*    │  │ Stripe signature │                 │
│  │                  │  │                  │  │ verification     │                 │
│  │ API Key auth     │  │ JWT auth         │  │                  │                 │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                     │                            │
│  ┌────────┴─────────────────────┴─────────────────────┴────────┐                  │
│  │                       SERVICE LAYER                          │                  │
│  │                                                               │                  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │                  │
│  │  │ Booking     │ │ Catalog     │ │ Commission  │ │ Identity│ │                  │
│  │  │ Service     │ │ Service     │ │ Service     │ │ Service │ │                  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │                  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │                  │
│  │  │ Availability│ │ Scheduling  │ │ Upload      │ │ Agent   │ │                  │
│  │  │ Service     │ │ Service     │ │ Service     │ │ Service │ │                  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │                  │
│  └────────┬─────────────────────────────────────────────────────┘                  │
│           │                                                                         │
│  ┌────────┴─────────────────────────────────────────────────────┐                  │
│  │                      ADAPTER LAYER (ports.ts)                 │                  │
│  │                                                               │                  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │                  │
│  │  │ Prisma      │ │ Stripe      │ │ Postmark    │ │ GCal    │ │                  │
│  │  │ Repositories│ │ Adapter     │ │ Adapter     │ │ Adapter │ │                  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │                  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │                  │
│  │  │ Redis Cache │ │ Upload      │ │ Encryption  │             │                  │
│  │  │ Adapter     │ │ Adapter     │ │ Service     │             │                  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘             │                  │
│  └───────────────────────────────────────────────────────────────┘                  │
│                                                                                     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Multi-Tenant Data Flow

```
                           TENANT A                    TENANT B
                              │                           │
                              ▼                           ▼
                    ┌─────────────────┐         ┌─────────────────┐
                    │  pk_live_a_xxx  │         │  pk_live_b_yyy  │
                    │  (Public Key)   │         │  (Public Key)   │
                    └────────┬────────┘         └────────┬────────┘
                             │                           │
                             ▼                           ▼
              ┌──────────────────────────────────────────────────────┐
              │                  TENANT MIDDLEWARE                    │
              │                                                       │
              │  1. Extract X-Tenant-Key header                       │
              │  2. Validate key format (pk_live_slug_16hex)          │
              │  3. Query tenant by slug + verify hash                │
              │  4. Inject tenantId into request                      │
              │                                                       │
              └──────────────────────────┬───────────────────────────┘
                                         │
                                         ▼
              ┌──────────────────────────────────────────────────────┐
              │                  ALL DATABASE QUERIES                 │
              │                                                       │
              │    prisma.booking.findMany({                          │
              │      where: {                                         │
              │        tenantId: req.tenantId,  ◄── MANDATORY         │
              │        ...otherFilters                                │
              │      }                                                │
              │    })                                                 │
              │                                                       │
              └──────────────────────────────────────────────────────┘
                                         │
              ┌──────────────────────────┴───────────────────────────┐
              │                                                       │
              ▼                                                       ▼
┌─────────────────────────┐                         ┌─────────────────────────┐
│      TENANT A DATA      │                         │      TENANT B DATA      │
│                         │                         │                         │
│ Bookings: 500           │                         │ Bookings: 1200          │
│ Customers: 200          │                         │ Customers: 450          │
│ Packages: 5             │                         │ Packages: 12            │
│                         │                         │                         │
│ ISOLATED - No crossover │                         │ ISOLATED - No crossover │
└─────────────────────────┘                         └─────────────────────────┘
```

---

## 4. Booking Transaction Flow

```
Customer                  Express API                  PostgreSQL
   │                           │                            │
   │── POST /v1/t/slug/book ──▶│                            │
   │                           │                            │
   │                           │── BEGIN TRANSACTION ──────▶│
   │                           │                            │
   │                           │── pg_advisory_xact_lock ──▶│
   │                           │   (hash of tenantId+date)  │
   │                           │◀── Lock acquired ──────────│
   │                           │                            │
   │                           │── Check existing booking ─▶│
   │                           │◀── None found ─────────────│
   │                           │                            │
   │                           │── INSERT booking ─────────▶│
   │                           │◀── Created ────────────────│
   │                           │                            │
   │                           │── COMMIT ─────────────────▶│
   │                           │   (lock released)          │
   │◀── 201 Created ───────────│                            │
```

---

## 5. Stripe Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CHECKOUT FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

Customer         Frontend          Express API          Stripe         Database
   │                │                   │                  │               │
   │─ Select pkg ──▶│                   │                  │               │
   │                │─ POST checkout ──▶│                  │               │
   │                │                   │                  │               │
   │                │                   │── Validate ─────▶│               │
   │                │                   │   availability   │               │
   │                │                   │                  │               │
   │                │                   │─ Generate ──────▶│               │
   │                │                   │  idempotency key │               │
   │                │                   │                  │               │
   │                │                   │─────────────────▶│               │
   │                │                   │ Create session   │               │
   │                │                   │◀─ Session URL ───│               │
   │                │◀─ Redirect URL ───│                  │               │
   │◀─ Redirect ────│                   │                  │               │
   │                                    │                  │               │
   │──────────── Complete payment ─────▶│                  │               │
   │                                    │                  │               │
   │                                    │◀─ Webhook ───────│               │
   │                                    │   (signed)       │               │
   │                                    │                  │               │
   │                                    │── Verify sig ───▶│               │
   │                                    │── Check dedup ──▶│               │
   │                                    │── Queue job ────▶│               │
   │                                    │◀─ 200 OK ────────│               │
   │                                    │                  │               │
   │                                    │       ┌──────────┴───────────┐   │
   │                                    │       │   BullMQ Worker      │   │
   │                                    │       │                      │   │
   │                                    │       │─ Create booking ────▶│   │
   │                                    │       │─ Create payment ────▶│   │
   │                                    │       │─ Send confirmation ─▶│   │
   │                                    │       │                      │   │
   │                                    │       └──────────────────────┘   │
```

---

## 6. Agent (AI) Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AI GROWTH ASSISTANT                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

User Message            Agent Service              Claude API           Database
     │                       │                         │                    │
     │── "Update pkg" ──────▶│                         │                    │
     │                       │                         │                    │
     │                       │── Build context ───────▶│                    │
     │                       │   (tenant data)         │                    │
     │                       │                         │                    │
     │                       │─────────────────────────▶│                   │
     │                       │   Send to Claude         │                   │
     │                       │                         │                    │
     │                       │◀── Tool call: ──────────│                    │
     │                       │    update_package       │                    │
     │                       │                         │                    │
     │                       │                         │                    │
     │                       │── Create proposal ─────▶│◀── Validate ──────│
     │                       │   (PENDING status)      │                    │
     │                       │                         │                    │
     │◀── Preview proposal ──│                         │                    │
     │                       │                         │                    │
     │── "Yes, confirm" ────▶│                         │                    │
     │                       │                         │                    │
     │                       │── Execute proposal ────▶│                    │
     │                       │   (via Executor)        │                    │
     │                       │                         │── Update record ──▶│
     │                       │                         │                    │
     │◀── "Package updated" ─│                         │                    │


PROPOSAL TRUST TIERS:
┌──────────────────────────────────────────────────────────────────┐
│ T1 (Low Risk)    │ Auto-execute   │ Toggle, minor edits         │
│ T2 (Medium Risk) │ Require confirm│ Price changes, package mods │
│ T3 (High Risk)   │ Require confirm│ Deletions, cancellations    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. File Structure

```
MAIS/
├── apps/
│   └── web/                          # Next.js 14 App Router
│       ├── src/
│       │   ├── app/                  # App Router pages
│       │   │   ├── t/[slug]/         # Tenant storefronts
│       │   │   ├── (protected)/      # Admin routes (NextAuth)
│       │   │   └── api/              # Next.js API routes
│       │   ├── components/           # React components
│       │   │   ├── ui/               # Shared UI (Button, Card)
│       │   │   └── tenant/           # Tenant-specific
│       │   └── lib/                  # Utilities
│       │       ├── auth.ts           # NextAuth.js v5 config
│       │       ├── tenant.ts         # Tenant data fetching
│       │       └── api.ts            # ts-rest client
│       └── middleware.ts             # Custom domain resolution
│
├── server/                           # Express API
│   ├── src/
│   │   ├── routes/                   # HTTP handlers (@ts-rest)
│   │   │   ├── auth.routes.ts        # Login, password reset
│   │   │   ├── tenant-admin.routes.ts# Tenant CRUD (1895 lines)
│   │   │   ├── webhooks.routes.ts    # Stripe webhooks
│   │   │   └── agent.routes.ts       # AI agent endpoints
│   │   ├── services/                 # Business logic
│   │   │   ├── booking.service.ts    # Booking facade
│   │   │   ├── catalog.service.ts    # Package/add-on management
│   │   │   └── idempotency.service.ts# Request deduplication
│   │   ├── adapters/                 # External integrations
│   │   │   ├── prisma/               # Database repositories
│   │   │   ├── mock/                 # In-memory for dev
│   │   │   ├── stripe.adapter.ts     # Stripe SDK
│   │   │   └── postmark.adapter.ts   # Email
│   │   ├── middleware/               # Express middleware
│   │   │   ├── tenant.ts             # Tenant resolution
│   │   │   ├── auth.ts               # Admin JWT validation
│   │   │   └── rateLimiter.ts        # Rate limiting (12 types)
│   │   ├── agent/                    # AI Growth Assistant
│   │   │   ├── tools/                # Read & write tools
│   │   │   ├── proposals/            # Proposal system
│   │   │   └── executors/            # Mutation execution
│   │   ├── lib/
│   │   │   ├── core/                 # Config, logger, events
│   │   │   ├── ports.ts              # Repository interfaces
│   │   │   └── entities.ts           # Domain models
│   │   └── di.ts                     # Dependency injection
│   └── prisma/
│       ├── schema.prisma             # Database schema (24 models)
│       └── migrations/               # SQL migrations
│
├── packages/
│   ├── contracts/                    # API contracts (Zod + ts-rest)
│   │   └── src/
│   │       ├── api.v1.ts             # Endpoint definitions
│   │       └── dto.ts                # Shared schemas
│   └── shared/                       # Shared utilities
│
├── client/                           # Vite SPA (legacy admin)
│   └── src/                          # Being migrated to Next.js
│
└── docs/                             # Documentation
    ├── solutions/                    # Prevention strategies
    ├── adrs/                         # Architectural decisions
    └── design/                       # Brand guidelines
```

---

## 8. Technology Stack

| Layer                      | Technology                           | Purpose                  |
| -------------------------- | ------------------------------------ | ------------------------ |
| **Frontend (Storefronts)** | Next.js 14, React 18, TailwindCSS    | Tenant-facing pages      |
| **Frontend (Admin)**       | Next.js 14, Radix UI, TanStack Query | Admin dashboard          |
| **API**                    | Express 4, TypeScript 5.9            | REST API                 |
| **API Contracts**          | ts-rest, Zod                         | Type-safe contracts      |
| **Database**               | PostgreSQL 15, Prisma 6              | Primary data store       |
| **Cache**                  | Redis (Upstash)                      | Caching, queues          |
| **Queue**                  | BullMQ                               | Async webhook processing |
| **Auth**                   | NextAuth.js v5, JWT                  | Session management       |
| **Payments**               | Stripe Connect                       | Payment processing       |
| **Email**                  | Postmark                             | Transactional email      |
| **Calendar**               | Google Calendar API                  | Availability sync        |
| **Storage**                | Supabase Storage                     | File uploads             |
| **Monitoring**             | Sentry                               | Error tracking           |
| **Hosting**                | Vercel (frontend), Render (API)      | Deployment               |

---

## 9. Database Schema (24 Models)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE MODELS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

CORE TENANT:
  Tenant ──────────┬── TenantDomain
                   ├── ApiKey
                   └── Admin

CATALOG:
  Package ─────────┬── Segment
                   ├── AddOn
                   └── PackagePhoto

BOOKING:
  Booking ─────────┬── Customer
                   ├── Payment
                   └── Reminder (virtual)

SCHEDULING:
  Service ─────────┬── AvailabilityRule
                   ├── AvailabilityException
                   └── BlackoutDate

AGENT:
  AgentSession ────┬── AgentProposal
                   └── AgentAuditLog

SYSTEM:
  WebhookEvent ────┬── WebhookDelivery
                   └── WebhookSubscription

  IdempotencyKey
  ConfigChangeLog
  EarlyAccessRequest
```

---

## 10. Key Design Decisions

| Decision               | Choice                               | Rationale                                     |
| ---------------------- | ------------------------------------ | --------------------------------------------- |
| **Tenant Isolation**   | Database row-level filtering         | Simpler than schema-per-tenant, scales better |
| **API Style**          | REST with ts-rest contracts          | Type safety across stack                      |
| **Auth Strategy**      | JWT (stateless)                      | Horizontal scaling, no session store needed   |
| **Cache Strategy**     | Read-through with tenant-scoped keys | Prevents cross-tenant leakage                 |
| **Webhook Processing** | Async queue with sync fallback       | Reliability with graceful degradation         |
| **Payment Flow**       | Stripe Checkout (hosted)             | PCI compliance offloaded                      |
| **Agent Architecture** | Proposal/Executor pattern            | Human-in-the-loop for safety                  |
| **File Storage**       | External (Supabase)                  | Scales independently                          |

---

_Architecture document maintained by engineering team. Update on significant changes._
