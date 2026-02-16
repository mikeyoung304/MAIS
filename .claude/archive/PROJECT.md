# MAIS - Multi-Tenant Business Growth Club Platform

## Quick Context

- **Type:** Business growth club with revenue-sharing partnerships
- **Phase:** Sprint 6 Complete (60% test pass rate, 0% variance)
- **Stack:** Express + React + TypeScript + Prisma + PostgreSQL
- **Critical:** Multi-tenant isolation, AI consulting, commission calculation

## Business Model

- AI consulting and growth strategies for entrepreneurs
- Seamless booking/scheduling for coaching sessions
- Professional website creation and marketing automation
- Revenue-sharing partnerships (not subscription-based)

## Documentation Map

- Architecture: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Decisions: [DECISIONS.md](../DECISIONS.md)
- Development: [DEVELOPING.md](../DEVELOPING.md)
- Multi-tenant: [docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md](../docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- Security: [docs/security/SECURITY.md](../docs/security/SECURITY.md)
- Operations: [docs/operations/RUNBOOK.md](../docs/operations/RUNBOOK.md)
- Testing: [TESTING.md](../TESTING.md)
- Environment: [docs/setup/ENVIRONMENT.md](../docs/setup/ENVIRONMENT.md)
- Incidents: [docs/operations/INCIDENT_RESPONSE.md](../docs/operations/INCIDENT_RESPONSE.md)
- API Docs: [docs/api/API_DOCS_QUICKSTART.md](../docs/api/API_DOCS_QUICKSTART.md)

## Critical Patterns (NON-NEGOTIABLE)

1. **Multi-tenant isolation:** ALL queries MUST include tenantId
2. **Commission calculation:** ALWAYS use Math.ceil (round UP)
3. **Webhook idempotency:** Check eventId for duplicates
4. **Cache keys:** MUST include tenantId prefix
5. **Pessimistic locking:** For booking creation (prevent double-booking)

## Common Commands

- Start dev: `npm run dev:all`
- Run tests: `npm test`
- Reset DB: `npx prisma migrate reset`
- Check types: `npm run typecheck`
- Validate env: `npm run doctor`
- Validate patterns: `./.claude/hooks/validate-patterns.sh`
- Format code: `npm run format`
- Lint: `npm run lint`

## Key Files

- DI Container: `server/src/di.ts`
- Schema: `server/prisma/schema.prisma`
- Contracts: `packages/contracts/src/api.v1.ts`
- Tenant Middleware: `server/src/middleware/tenant.ts`
- Mock Adapters: `server/src/adapters/mock/index.ts`
- Stripe Adapter: `server/src/adapters/stripe.adapter.ts`
- Booking Service: `server/src/services/booking.service.ts`

## Development Modes

- **Mock mode:** `ADAPTERS_PRESET=mock` (no external dependencies)
- **Real mode:** `ADAPTERS_PRESET=real` (Stripe, PostgreSQL, etc.)

## Current Sprint Status

- Sprint 6: Complete (60% test pass rate, 0% variance achieved)
- Sprint 7 Goal: 70% pass rate (73/104 tests passing)
- Phase 5.1: Backend complete (package photo uploads)

## Security Notes

- JWT_SECRET required (32 bytes minimum)
- TENANT_SECRETS_ENCRYPTION_KEY required (64 hex chars)
- Rate limiting: 5 login attempts / 15 minutes
- All tenant API keys encrypted with AES-256-GCM

## Testing

- Unit tests: Isolated service logic (no DB/network)
- Integration tests: Database-backed with tenant isolation
- E2E tests: Playwright with mock mode for speed
- Coverage goal: 70% overall, 100% for critical paths (webhooks, payments)

## Automated Validation

- Pre-commit hooks validate critical patterns
- Run manually: `./.claude/hooks/validate-patterns.sh`
- Checks: multi-tenant isolation, commission calculation, cache keys
- CI/CD: Pattern validation runs on every commit

## Before You Start Coding

1. **Check current branch**: `git branch` (should be on feature branch, not main)
2. **Validate environment**: `npm run doctor`
3. **Review critical patterns**: Read `.claude/PATTERNS.md`
4. **Run pattern validator**: `./.claude/hooks/validate-patterns.sh`
5. **Start in mock mode**: `ADAPTERS_PRESET=mock npm run dev:all`
