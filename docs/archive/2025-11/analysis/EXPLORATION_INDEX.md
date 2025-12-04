# Elope Codebase Exploration - Complete Index

This directory contains comprehensive documentation of the Elope codebase architecture and design.

## Generated Documentation Files

### 1. **EXPLORATION_SUMMARY.md** (Start here!)

**Purpose:** Quick executive overview of the entire system  
**Length:** ~310 lines  
**Best for:** Getting oriented, understanding what Elope does, key strengths, tech stack overview

**Covers:**

- What is Elope?
- Key architectural strengths
- Core features (customers, tenant admins, platform admins)
- Technology stack
- Architecture highlights with flow diagrams
- Database schema
- Key files to understand
- Development workflow
- Security notes
- Extension points

**Time to read:** 10-15 minutes

### 2. **CODEBASE_EXPLORATION_COMPLETE.md** (Deep dive)

**Purpose:** Comprehensive architecture documentation with implementation details  
**Length:** ~1,480 lines  
**Best for:** Understanding design patterns, implementation details, all architectural decisions

**16 Detailed Sections:**

1. Overall Architecture & Structure
2. Feature Services (7 services explained)
3. Multi-Tenant Architecture (3 subsections)
4. Admin Dashboard Structure (2 subsections)
5. API Patterns, Contracts & Schemas (3 subsections)
6. Authentication & Authorization (4 subsections)
7. Database Models & Entities (2 subsections)
8. Event-Driven Architecture (3 subsections)
9. UI/UX Components & Patterns (4 subsections)
10. Testing Structure & Patterns (3 subsections)
11. Configuration & Environment Setup (4 subsections)
12. Security & Tenant Isolation Patterns (4 subsections)
13. Integration Points & Adapters (2 subsections)
14. Key Architectural Decisions (5 decisions explained)
15. Development Workflow
16. Monitoring & Logging

**Time to read:** 45-60 minutes for full understanding

---

## Quick Navigation

### I want to understand...

**The overall system**
→ Read: EXPLORATION_SUMMARY.md (sections: "What is Elope?", "Key Strengths", "Architecture Highlights")

**How multi-tenancy works**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (section: "3. MULTI-TENANT ARCHITECTURE")

**The payment system**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (sections: "2.2 Booking Service", "2.3 Payment Processing", "2.4 Commission Service")

**Authentication and authorization**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (section: "6. AUTHENTICATION & AUTHORIZATION")

**The API design**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (section: "5. API PATTERNS, CONTRACTS & SCHEMAS")

**How to run the code**
→ Read: EXPLORATION_SUMMARY.md (section: "Development Workflow")

**Testing strategy**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (section: "10. TESTING STRUCTURE & PATTERNS")

**What files to read first**
→ Read: EXPLORATION_SUMMARY.md (section: "Key Files to Understand")

**Security considerations**
→ Read: CODEBASE_EXPLORATION_COMPLETE.md (section: "12. SECURITY & TENANT ISOLATION PATTERNS")
AND EXPLORATION_SUMMARY.md (section: "Security Notes")

**How to extend the system**
→ Read: EXPLORATION_SUMMARY.md (section: "Extension Points")

---

## File Locations Mentioned

### Backend (Node.js/Express)

```
server/
├── src/
│   ├── app.ts                  # Express setup
│   ├── di.ts                   # Dependency injection
│   ├── index.ts                # Entry point
│   ├── services/               # Domain services (7 files)
│   ├── routes/                 # API endpoints
│   ├── adapters/               # External service adapters
│   ├── middleware/             # Cross-cutting concerns
│   ├── lib/                    # Shared utilities
│   └── validation/             # Input schemas
└── prisma/                     # Database schema
```

### Frontend (React)

```
client/
├── src/
│   ├── pages/                  # Page components
│   ├── components/             # Reusable UI
│   ├── contexts/               # Auth context
│   ├── lib/                    # API client + auth
│   ├── widget/                 # Embeddable widget
│   ├── hooks/                  # Custom hooks
│   └── types/                  # Type definitions
```

### Shared

```
packages/
├── contracts/                  # ts-rest API contracts
└── shared/                     # Common utilities
```

### Documentation

```
docs/
├── architecture/               # ADRs and architecture docs
├── multi-tenant/              # Multi-tenancy guides
├── api/                       # API documentation
├── security/                  # Security procedures
├── setup/                     # Setup guides
└── operations/                # Deployment, incident response
```

---

## Key Concepts Quick Reference

### Multi-Tenancy

- **Approach:** Database-level isolation (single PostgreSQL, shared schema)
- **Tenant Resolution:** API key in `X-Tenant-Key` header
- **API Keys:** Public (`pk_live_tenant_*`) for widgets, secret for admin operations
- **Isolation:** Database, middleware, service, application levels

### Authentication

- **Admins:** JWT with `role: 'admin'`
- **Tenants:** JWT with `type: 'tenant'` and `tenantId`
- **Widget:** No auth, uses `X-Tenant-Key` header
- **Password:** bcryptjs 10 rounds

### Payment Processing

- **Provider:** Stripe + Stripe Connect
- **Model:** Destination charges (payment to tenant, platform takes commission)
- **Commission:** Server-side calculation, always round UP, clamp to 0.5%-50%
- **Webhook:** HMAC signature verification, idempotency checking

### API Design

- **Framework:** ts-rest (contract-driven)
- **Contracts:** `/packages/contracts/src/api.v1.ts`
- **DTOs:** Zod schemas in `/packages/contracts/src/dto.ts`
- **Validation:** Automatic request validation, OpenAPI generation

### Architecture Pattern

- **Style:** Modular monolith
- **DI:** Manual in `di.ts`, wired in `app.ts`
- **Adapters:** Stripe, Google Calendar, Postmark, Prisma repositories
- **Events:** In-process event emitter, handlers in `di.ts`

---

## Development Quick Start

```bash
# Install dependencies
npm install

# Development mode (mock adapters, no DB required)
npm run dev:all

# Access points:
# - API: http://localhost:3001
# - Web: http://localhost:5173
# - Docs: http://localhost:3001/api/docs

# Run tests
npm test

# Real mode with PostgreSQL
npm run dev:real
```

---

## Architecture Decisions

| Decision                             | Rationale                               | Trade-offs                                 |
| ------------------------------------ | --------------------------------------- | ------------------------------------------ |
| Modular monolith                     | Simpler operations, shared models       | Lower initial scalability                  |
| Database-level multi-tenancy         | Easier ops, natural analytics           | Cannot have separate infra per tenant      |
| Stripe Connect (destination charges) | Simple, direct payouts, good compliance | Higher Stripe fee                          |
| ts-rest contracts                    | Type safety, single source of truth     | Learning curve                             |
| In-process event emitter             | Adequate for monolith                   | Replace with queue for distributed systems |

---

## Code Quality

- **Language:** TypeScript (strict mode)
- **Testing:** Vitest, 70% branch coverage target
- **Linting:** ESLint
- **Formatting:** Prettier
- **Type Checking:** `tsc --noEmit`

---

## What's Next?

1. **Start with:** EXPLORATION_SUMMARY.md (10 minutes)
2. **Then explore:** Key files mentioned in "Key Files to Understand" section
3. **Deep dive:** CODEBASE_EXPLORATION_COMPLETE.md for specific areas
4. **Try the code:** Run locally with `npm run dev:all`
5. **Read tests:** Understand expected behavior
6. **Check `/docs/`:** Comprehensive documentation using Diátaxis framework

---

**Generated:** November 13, 2024  
**Repository:** /Users/mikeyoung/CODING/Elope  
**Author:** Claude Code (Anthropic)
