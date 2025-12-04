# Developing

## Platform Status (November 2025)

**Current Version:** Sprint 10 Complete + Platform Admin Enhancements
**Maturity:** 9.8/10 (Production-Ready)
**Deployment:** Preparing for demo user production deployment

**Recent Sprints:**

- ✅ Sprint 7: Test stabilization (95% pass rate achieved)
- ✅ Sprint 8: UX & mobile excellence
- ✅ Sprint 8.5: Complete UX enhancements (progress indicators, back buttons, unsaved changes)
- ✅ Sprint 9: Package catalog & discovery system
- ✅ Sprint 10: Technical excellence (test stability, security, performance)

**Sprint 10 Achievements:**

- Test infrastructure: Retry helpers with exponential backoff (225 lines)
- Security: OWASP 70% compliance, input sanitization, custom CSP
- Performance: Redis caching (97.5% faster), 16 database indexes
- Test coverage: 752/752 passing (100%), 3 skipped, 12 todo, +42 new tests

**November 2025 Updates:**

- Platform admin "Sign In As" impersonation for tenant management
- Fixed tenant API to include email field in responses
- Cleaned up broken navigation routes
- Streamlined admin dashboard with dual-action buttons (Sign In As + Settings)

**Next:** Production deployment for demo users

## Vibe‑coding workflow (Claude + MCP)

- **Keep changes small.** Run prompts in phases; verify green typecheck after each.
- **Use contracts as the single source of truth.** FE/BE must import from `packages/contracts`.
- **Services own business logic**; adapters isolate external dependencies (Stripe/Postmark/GCal).
- **Prefer mocks while shaping flows**; flip to real when stable.
- **Keep TypeScript errors at zero**; don't suppress diagnostics.
- **Test first:** Write tests before implementing features (Sprint 10 standard)
- **Security first:** All input sanitized, all queries tenant-scoped
- **Performance matters:** Use caching for read-heavy operations

## Multi-Tenant Development Roadmap

This project is implementing multi-tenant self-service capabilities in phases:

- **Phase 1-3**: Core multi-tenant architecture (COMPLETE)
- **Phase 4**: Tenant admin dashboard with branding (COMPLETE)
- **Phase 5**: Add-on management, photo uploads, email templates (COMPLETE)
- **Sprint 6-7**: Test stabilization and infrastructure (COMPLETE)
- **Sprint 8-8.5**: UX & mobile excellence (COMPLETE)
- **Sprint 9**: Package catalog & discovery (COMPLETE)
- **Sprint 10**: Technical excellence (COMPLETE)
- **Phase 6**: Production deployment for demo users (IN PROGRESS)
- **Phase 7+**: Advanced features and marketplace (PLANNED)

**Current Status:** Platform production-ready. Deploying for demo users.

**Key Documents:**

- [SPRINT_10_FINAL_SUMMARY.md](./docs/sprints/SPRINT_10_FINAL_SUMMARY.md) - Sprint 10 completion report
- [CACHING_ARCHITECTURE.md](./docs/performance/CACHING_ARCHITECTURE.md) - Performance optimization guide
- [SECURITY.md](./SECURITY.md) - Security policy and vulnerability reporting
- [OWASP_COMPLIANCE.md](./docs/security/OWASP_COMPLIANCE.md) - OWASP Top 10 compliance mapping
- [MULTI_TENANT_ROADMAP.md](./docs/multi-tenant/MULTI_TENANT_ROADMAP.md) - Comprehensive phased roadmap

**Development Workflow:**
When implementing new tenant-facing features, follow these principles:

1. **Tenant Scoping**: All queries must filter by `tenantId`
2. **Ownership Verification**: Always verify tenant owns the resource before mutations
3. **Multi-Tenant Isolation**: Never leak data between tenants (see Sprint 10 webhook fix)
4. **JWT Authentication**: Use `res.locals.tenantAuth.tenantId` from JWT middleware
5. **Consistent Patterns**: Follow existing tenant-admin route patterns
6. **Security**: All input sanitized via `sanitizeObject()` middleware
7. **Performance**: Cache read-heavy data with tenant-scoped keys (`catalog:${tenantId}:...`)
8. **Testing**: Use retry helpers for integration tests (`withDatabaseRetry`, `withConcurrencyRetry`)

## Platform Admin Features

### Tenant Impersonation

Platform admins can "sign in as" any tenant to manage their account with full editing capabilities.

**How it works:**

1. Go to Platform Admin Dashboard (`/admin/dashboard`)
2. Click "Sign In As" button on any tenant row
3. System generates a special JWT with impersonation metadata
4. Page reloads - you're now operating as that tenant
5. An impersonation banner appears at the top
6. Click "Exit Impersonation" to return to admin view

**API Endpoints:**

- `POST /v1/auth/impersonate` - Start impersonation (requires platform admin token)
- `POST /v1/auth/stop-impersonation` - Return to admin mode

**Security:**

- Only PLATFORM_ADMIN users can impersonate
- All impersonation actions are audit-logged
- Token includes `impersonating.startedAt` timestamp
- Original admin identity preserved for accountability

**Files:**

- Backend: `server/src/routes/auth.routes.ts` (lines 140-181)
- Frontend: `client/src/pages/admin/PlatformAdminDashboard/TenantsTableSection.tsx`
- Banner: `client/src/features/admin/dashboard/components/ImpersonationBanner.tsx`

## Commands

```bash
npm run typecheck                 # typecheck all workspaces
npm run lint                      # lint all workspaces
npm run dev:api                   # API server (mock mode by default)
npm run dev:client                # Web client
npm run dev:all                   # Both API + client + Stripe webhook listener
npm test --workspace=server       # Run server tests
```

## Database Setup ✅ COMPLETE

### Prerequisites

Install PostgreSQL 14+. Options:

- **Local:** `brew install postgresql@16` (macOS) or Docker
- **Cloud:** Railway, Render, Supabase, or Neon

### Initial Setup

1. **Create a database:**

   ```bash
   createdb mais_dev
   ```

2. **Set DATABASE_URL in `server/.env`:**

   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/mais_dev?schema=public"
   ```

3. **Run migrations:**

   ```bash
   cd server
   npm exec prisma migrate dev
   ```

4. **Seed the database:**

   ```bash
   npm exec prisma db seed
   ```

   This creates:
   - Admin user: `admin@example.com` / password: `admin`
   - 3 service packages (Basic, Professional, Premium) with 4 add-ons
   - Sample blackout date (Dec 25, 2025)

5. **Start API in real mode:**
   ```bash
   npm run dev:api
   # Or set ADAPTERS_PRESET=real in server/.env
   ```

### Database Commands

```bash
# View data in Prisma Studio
cd server && npm exec prisma studio

# Generate Prisma Client after schema changes
cd server && npm run prisma:generate

# Create a new migration
cd server && npm exec prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
cd server && npm exec prisma migrate reset

# Check migration status
cd server && npm exec prisma migrate status
```

## Env presets

```bash
# server/.env
ADAPTERS_PRESET=mock # or real
API_PORT=3001
CORS_ORIGIN=http://localhost:5173

# Security (REQUIRED for real mode)
JWT_SECRET=change-me  # Generate: openssl rand -hex 32
TENANT_SECRETS_ENCRYPTION_KEY=...  # Generate: openssl rand -hex 32

# Real mode - Database (✅ IMPLEMENTED)
DATABASE_URL=postgresql://username:password@localhost:5432/mais_dev?schema=public

# Real mode - Stripe (✅ IMPLEMENTED)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=http://localhost:5173/success
STRIPE_CANCEL_URL=http://localhost:5173

# Real mode - Email (✅ IMPLEMENTED with file-sink fallback)
POSTMARK_SERVER_TOKEN=...          # Optional: falls back to file-sink
POSTMARK_FROM_EMAIL=bookings@yourdomain.com

# Real mode - Calendar (✅ IMPLEMENTED with mock fallback)
GOOGLE_CALENDAR_ID=...            # Optional: falls back to mock calendar
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...
```

## Security Setup ✅ COMPLETE

### Generating Secure Secrets

```bash
# Generate JWT secret (32 bytes)
openssl rand -hex 32

# Generate tenant encryption key (32 bytes)
openssl rand -hex 32

# Add to server/.env
JWT_SECRET=<generated-jwt-secret>
TENANT_SECRETS_ENCRYPTION_KEY=<generated-encryption-key>
```

### Login Rate Limiting

Login endpoints are automatically protected with rate limiting:

- **5 attempts** per 15-minute window per IP address
- Only **failed attempts** count toward the limit
- Returns **429 Too Many Requests** after limit exceeded

**Test the rate limiting:**

```bash
cd server
./test-login-rate-limit.sh
```

### Security Monitoring

Failed login attempts are logged with structured data:

```bash
# View failed login attempts in logs
grep "login_failed" server/logs/*.log

# Monitor for potential attacks
grep "429" server/logs/*.log  # Rate limit hits
```

### Secret Rotation

For production deployments, rotate secrets quarterly:

1. **JWT_SECRET** - Invalidates all active sessions
2. **Stripe Keys** - Rotate via Stripe dashboard
3. **Database Password** - Update via Supabase/provider dashboard
4. **TENANT_SECRETS_ENCRYPTION_KEY** - Requires migration script

**See comprehensive guides:**

- [SECRET_ROTATION_GUIDE.md](./docs/security/SECRET_ROTATION_GUIDE.md) - Complete rotation procedures
- [IMMEDIATE_SECURITY_ACTIONS.md](./docs/security/IMMEDIATE_SECURITY_ACTIONS.md) - Urgent actions checklist
- [SECURITY.md](./docs/security/SECURITY.md) - Security best practices

## Repo structure (current)

```
server/                           # Express 4 API
  src/
    routes/*.routes.ts            # HTTP routes (was http/v1/*.http.ts)
    services/*.service.ts         # Business logic (was domains/*/service.ts)
    middleware/                   # Express middleware
    adapters/                     # External integrations (prisma, stripe, postmark, gcal, mock)
    lib/
      core/                       # Config, logger, events, errors
      ports.ts                    # Repository/provider interfaces
      entities.ts                 # Domain entities
      errors.ts                   # Domain errors
    di.ts                         # Dependency injection
    app.ts                        # Express app setup
    index.ts                      # Server entry point
  prisma/                         # Database schema & migrations
  test/                           # Unit & integration tests

client/                           # React 18 + Vite
  src/
    features/{catalog,booking,admin}/  # Feature modules
    pages/                        # Route pages
    ui/                           # Reusable components
    lib/                          # Utilities & API client
    app/                          # App shell

packages/
  contracts/                      # @ts-rest API contracts
  shared/                         # Shared utilities (money, date, result)
```

## Pull requests (solo habit)

- Keep PRs under 300 lines.
- Include: what changed, why, test notes.
- CI must pass typecheck + unit tests.
