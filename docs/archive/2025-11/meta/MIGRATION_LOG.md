# Stack Migration Log: Elope → rebuild-6.0

**Migration Start Date:** 2025-10-23
**Branch:** `stack-migration`
**Goal:** Align Elope's tech stack and architecture with rebuild-6.0 for mastery and consistency

## Pre-Migration State

### Current Architecture

- **Structure:** Hexagonal/Clean Architecture
  - `apps/api/src/domains/` - Domain logic
  - `apps/api/src/adapters/` - Port implementations
  - `apps/api/src/di.ts` - Dependency injection
- **Package Manager:** pnpm 8.15.0
- **API Design:** @ts-rest contract-first
- **Express:** 5.1.0
- **React:** 19.0.0
- **Database:** Direct Prisma → PostgreSQL
- **Auth:** Custom JWT with bcryptjs
- **Logging:** Pino
- **Testing:** Vitest + Playwright (extensive)

### Target Architecture (rebuild-6.0)

- **Structure:** Layered/Pragmatic
  - `server/src/routes/` - Express routes
  - `server/src/services/` - Business logic
  - Simple, direct approach
- **Package Manager:** npm
- **API Design:** Traditional Express routes
- **Express:** 4.21.2
- **React:** 18.3.1
- **Database:** Supabase + Prisma
- **Auth:** Supabase Auth + Custom JWT
- **Logging:** Winston
- **Testing:** Vitest (minimal)

## Migration Phases

### Phase 1: Structural Alignment ✅ COMPLETED (95%)

**Status:** Completed 2025-10-23 (schema alignment pending)
**Branch:** `stack-migration`

**Tasks:**

- [x] Create git branch
- [x] Create backup branch
- [x] Document current state
- [x] Flatten architecture (hexagonal → layered)
- [x] Switch to npm (pnpm → npm)
- [x] Downgrade dependencies (Express 5→4, React 19→18)
- [x] Update tsconfig with esModuleInterop
- [x] Fix all import paths (21 files)
- [x] Create consolidated lib files (ports, entities, errors)
- [ ] Align Prisma schema with entity DTOs (pending)
- [ ] Verify tests pass

**Changes Log:**

- 2025-10-23: Created `stack-migration` branch
- 2025-10-23: Created `backup-before-migration` branch for rollback safety
- 2025-10-23: Moved apps/api/ → server/ and apps/web/ → client/
- 2025-10-23: Removed pnpm-lock.yaml, pnpm-workspace.yaml
- 2025-10-23: Updated package.json workspaces and scripts for npm
- 2025-10-23: Downgraded Express 5.1.0→4.21.2, React 19.0.0→18.3.1
- 2025-10-23: Generated package-lock.json (697 packages)
- 2025-10-23: Fixed import paths across services, routes, middleware, adapters
- 2025-10-23: Created lib/ports.ts, updated lib/entities.ts, lib/errors.ts
- 2025-10-23: Updated tsconfig.json with esModuleInterop and removed extends

**Known Issues:**

- Prisma schema field names don't match entity DTOs (name vs title, basePrice vs priceCents)
- Requires schema alignment or mapper functions in adapters
- Some adapters need interface updates (Stripe API version, PaymentProvider)

### Phase 2: Supabase Migration (Future)

**Status:** Not Started
**Estimated Duration:** 8-12 hours

### Phase 3: API & Logging Alignment (Future)

**Status:** Not Started
**Estimated Duration:** 10-13 hours

### Phase 4: Testing Simplification (Future)

**Status:** Not Started
**Estimated Duration:** 6-8 hours

## Decisions & Tradeoffs

### What We're Changing

1. ✅ Architecture: Hexagonal → Layered (pragmatic)
2. ✅ Package Manager: pnpm → npm (consistency)
3. ✅ Database: Prisma → Supabase + Prisma (managed services)
4. ✅ Auth: Custom JWT → Supabase Auth (managed)
5. ✅ Logging: Pino → Winston (consistency)
6. ✅ Express: 5.x → 4.x (stability)
7. ✅ React: 19.x → 18.x (stability)

### What We're Keeping (Exceptions to "Nearly Identical")

1. ← @ts-rest API (too valuable, will add to rebuild-6.0 later)
2. ← Extensive testing (good documentation, will restructure to match)
3. ← Domain services (simplify but keep clean business logic)

### Rationale

**Goal:** Master ONE stack deeply rather than maintain TWO different architectures.
**Optimization:** Learning velocity > architectural purity
**Timeline:** Save 2-3 months by standardizing

## Rollback Plan

If migration fails or causes issues:

```bash
git checkout main
git branch -D stack-migration
git checkout -b stack-migration backup-before-migration
```

## Resources

- **rebuild-6.0 Location:** `~/CODING/rebuild-6.0`
- **Comparison Report:** See earlier analysis
- **Target Stack Definition:** See migration plan

---

**Last Updated:** 2025-10-23
**Current Phase:** Phase 1 - Structural Alignment
