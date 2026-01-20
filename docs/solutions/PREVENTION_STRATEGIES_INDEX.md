# Prevention Strategies Index

Complete guide to preventing common issues in the MAIS codebase.

---

## Quick Links (By Problem)

### Authentication & Client-Server Communication

| Problem                                                                        | Prevention Strategy                                                                                 | Audience                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------- |
| Client component calling Express API directly instead of through Next.js proxy | [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](NEXTJS_CLIENT_API_PROXY_PREVENTION.md)                      | Frontend developers               |
| Uncertain where to call APIs from                                              | [NEXTJS_CLIENT_API_QUICK_REFERENCE.md](NEXTJS_CLIENT_API_QUICK_REFERENCE.md)                        | Frontend developers (30-sec read) |
| Reviewing PR with API calls                                                    | [NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md](NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md)                      | Code reviewers                    |
| Multi-tenant data isolation                                                    | [mais-critical-patterns.md](patterns/mais-critical-patterns.md)                                     | All developers                    |
| Auth form accessibility issues                                                 | [auth-form-accessibility-checklist.md](patterns/auth-form-accessibility-checklist-MAIS-20251230.md) | Frontend developers               |

### Database & Schema

| Problem                              | Prevention Strategy                                                                                      | Audience           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------ |
| Schema drift from manual SQL         | [schema-drift-prevention.md](database-issues/schema-drift-prevention-MAIS-20251204.md)                   | Backend developers |
| Database client mismatch             | [database-client-mismatch.md](database-issues/database-client-mismatch-MAIS-20251204.md)                 | Backend developers |
| IPv6 connection issues with Supabase | [supabase-ipv6-session-pooler-connection.md](database-issues/supabase-ipv6-session-pooler-connection.md) | DevOps / Backend   |

### Development Workflow

| Problem                                                    | Prevention Strategy                                                                                                                                       | Audience            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Service Worker serving stale JS bundles after code changes | [service-worker-cache-stale-js-bundles-MAIS-20260105.md](dev-workflow/service-worker-cache-stale-js-bundles-MAIS-20260105.md)                             | Frontend developers |
| App broken after running production build then dev server  | [turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md](build-errors/turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md) | Frontend developers |

### Type Safety & TypeScript

| Problem                             | Prevention Strategy                                                                                                                   | Audience                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| When to use `any` in TypeScript     | [ts-rest-any-type-library-limitations-MAIS-20251204.md](best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)         | All developers              |
| Quick decision tree for `any` types | [any-types-quick-reference-MAIS-20251204.md](best-practices/any-types-quick-reference-MAIS-20251204.md)                               | All developers (2-min read) |
| Cascading entity type errors        | [cascading-entity-type-errors-MAIS-20251204.md](logic-errors/cascading-entity-type-errors-MAIS-20251204.md)                           | Backend developers          |
| Unused variable build failures      | [typescript-unused-variables-build-failure-MAIS-20251227.md](build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md) | All developers              |

### Architecture & Patterns

| Problem                                 | Prevention Strategy                                                                                                                            | Audience                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Multi-segment storefront UX             | [SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md](patterns/SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md)                          | Frontend developers      |
| Segment storefront quick reference      | [SEGMENT_FIRST_QUICK_REFERENCE.md](patterns/SEGMENT_FIRST_QUICK_REFERENCE.md)                                                                  | Frontend developers      |
| ADK FunctionTool TypeScript type safety | [ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md](patterns/ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md)                                                | Backend/Agent developers |
| AI agent proposal execution missing     | [chatbot-proposal-execution-flow-MAIS-20251229.md](logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)                              | Backend/Agent developers |
| Circular dependencies in agent modules  | [circular-dependency-executor-registry-MAIS-20251229.md](patterns/circular-dependency-executor-registry-MAIS-20251229.md)                      | Backend developers       |
| Next.js App Router migration pitfalls   | [nextjs-migration-lessons-learned-MAIS-20251225.md](code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)                    | Frontend developers      |
| Vercel deployment with npm workspaces   | [vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md](deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md) | DevOps / Frontend        |
| Critical patterns checklist             | [mais-critical-patterns.md](patterns/mais-critical-patterns.md)                                                                                | All developers           |

---

## By Role

### Frontend Developers

**Must Read:**

1. [NEXTJS_CLIENT_API_QUICK_REFERENCE.md](NEXTJS_CLIENT_API_QUICK_REFERENCE.md) - 2-min orientation
2. [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](NEXTJS_CLIENT_API_PROXY_PREVENTION.md) - Deep understanding
3. [auth-form-accessibility-checklist.md](patterns/auth-form-accessibility-checklist-MAIS-20251230.md) - WCAG compliance
4. [SEGMENT_FIRST_QUICK_REFERENCE.md](patterns/SEGMENT_FIRST_QUICK_REFERENCE.md) - Storefront UX (1-min read)

**Should Read:**

- [SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md](patterns/SEGMENT_FIRST_STOREFRONT_UX_PATTERN-MAIS-20260108.md) - Full storefront pattern (browser history, URL sync)
- [nextjs-migration-lessons-learned-MAIS-20251225.md](code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) - 10 App Router gotchas
- [any-types-quick-reference-MAIS-20251204.md](best-practices/any-types-quick-reference-MAIS-20251204.md) - TypeScript `any` decision tree
- [service-worker-cache-stale-js-bundles-MAIS-20260105.md](dev-workflow/service-worker-cache-stale-js-bundles-MAIS-20260105.md) - Service Worker caching issues

**If Deploying:**

- [vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md](deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md) - Vercel + monorepo fix

---

### Backend Developers

**Must Read:**

1. [mais-critical-patterns.md](patterns/mais-critical-patterns.md) - 10 critical rules
2. [schema-drift-prevention-MAIS-20251204.md](database-issues/schema-drift-prevention-MAIS-20251204.md) - Database migrations
3. [chatbot-proposal-execution-flow-MAIS-20251229.md](logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - If working on agent features

**Should Read:**

- [ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md](patterns/ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md) - TypeScript safety in ADK agents
- [circular-dependency-executor-registry-MAIS-20251229.md](patterns/circular-dependency-executor-registry-MAIS-20251229.md) - Registry pattern for agent modules
- [database-client-mismatch-MAIS-20251204.md](database-issues/database-client-mismatch-MAIS-20251204.md) - DB/client version issues
- [cascading-entity-type-errors-MAIS-20251204.md](logic-errors/cascading-entity-type-errors-MAIS-20251204.md) - Type safety

---

### Code Reviewers

**Must Have:**

1. [NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md](NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md) - Frontend API review
2. [mais-critical-patterns.md](patterns/mais-critical-patterns.md) - General patterns

**Should Have:**

- [ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md](patterns/ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md) - Reviewing ADK agent code
- [chatbot-proposal-execution-flow-MAIS-20251229.md](logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - Agent feature review
- [any-types-quick-reference-MAIS-20251204.md](best-practices/any-types-quick-reference-MAIS-20251204.md) - TypeScript reviews
- [auth-form-accessibility-checklist.md](patterns/auth-form-accessibility-checklist-MAIS-20251230.md) - Auth page reviews

---

### DevOps / Platform Team

**Must Read:**

1. [vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md](deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md) - Next.js deployment
2. [supabase-ipv6-session-pooler-connection.md](database-issues/supabase-ipv6-session-pooler-connection.md) - Database connectivity

**Should Read:**

- [schema-drift-prevention-MAIS-20251204.md](database-issues/schema-drift-prevention-MAIS-20251204.md) - Migration reliability

---

## By Problem Domain

### Six Critical Prevention Strategies (NEW - MUST READ)

**Comprehensive guide to preventing 6 most common development issues:**

| Document                                                                                                            | Issues Covered                                                                                                                                            | Coverage       |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [SIX_CRITICAL_PREVENTION_STRATEGIES_MAIS-20260105.md](patterns/SIX_CRITICAL_PREVENTION_STRATEGIES_MAIS-20260105.md) | 1. Console.log stubs 2. Prop name mismatches 3. Executor registry gaps 4. Timeout memory leaks 5. Dynamic Tailwind classes 6. Incomplete feature shipping | All developers |

---

### Client-Server Communication

**The Core Issue:** How do client components safely call authenticated backend APIs?

| Document                                                                       | What                             | Why                       | When                     |
| ------------------------------------------------------------------------------ | -------------------------------- | ------------------------- | ------------------------ |
| [NEXTJS_CLIENT_API_QUICK_REFERENCE.md](NEXTJS_CLIENT_API_QUICK_REFERENCE.md)   | Quick cheat sheet (30 sec)       | Fast lookup during coding | During development       |
| [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](NEXTJS_CLIENT_API_PROXY_PREVENTION.md) | Complete explanation (15 min)    | Full understanding        | Before writing API calls |
| [NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md](NEXTJS_CLIENT_API_REVIEW_CHECKLIST.md) | Code review guide (5 min per PR) | Catch issues before merge | During code review       |

---

### Multi-Tenant Data Isolation

**The Core Issue:** Preventing data leakage between tenants (critical security)

| Document                                                                       | What                             |
| ------------------------------------------------------------------------------ | -------------------------------- |
| [mais-critical-patterns.md](patterns/mais-critical-patterns.md)                | Tenant scoping in all queries    |
| [NEXTJS_CLIENT_API_PROXY_PREVENTION.md](NEXTJS_CLIENT_API_PROXY_PREVENTION.md) | Tenant validation in API proxies |

---

### Database Schema Management

**The Core Issue:** Keeping schema.prisma and actual database in sync

| Document                                                                                               | What                           | Why                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ | ----------------------- |
| [schema-drift-prevention-MAIS-20251204.md](database-issues/schema-drift-prevention-MAIS-20251204.md)   | Migration patterns             | Manual SQL causes drift |
| [database-client-mismatch-MAIS-20251204.md](database-issues/database-client-mismatch-MAIS-20251204.md) | When DB types don't match code | Type safety breaks      |

---

### AI Agent Architecture

**The Core Issue:** Proposals must execute after confirmation (T2/T3)

| Document                                                                                                                  | What                    | Critical Detail                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------- |
| [chatbot-proposal-execution-flow-MAIS-20251229.md](logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)         | Full proposal lifecycle | Missing executor bridge                |
| [circular-dependency-executor-registry-MAIS-20251229.md](patterns/circular-dependency-executor-registry-MAIS-20251229.md) | Registry pattern        | Routes + orchestrator circular imports |

---

### Frontend Accessibility

**The Core Issue:** WCAG 2.1 AA compliance for auth forms

| Document                                                                                            | What                     |
| --------------------------------------------------------------------------------------------------- | ------------------------ |
| [auth-form-accessibility-checklist.md](patterns/auth-form-accessibility-checklist-MAIS-20251230.md) | Checklist + code samples |

---

### Development Workflow & Build System

**The Core Issue:** Stale caches blocking code changes in development

| Document                                                                                                                                                  | What                          | Why                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- |
| [service-worker-cache-stale-js-bundles-MAIS-20260105.md](dev-workflow/service-worker-cache-stale-js-bundles-MAIS-20260105.md)                             | Service Worker cache clearing | SW serves old code after restarts |
| [turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md](build-errors/turbopack-hmr-cache-conflict-after-production-build-MAIS-20260102.md) | Turbopack cache conflicts     | Mode-specific `.next` structures  |

---

## How to Use These Documents

### Scenario 1: "I'm starting to code a feature"

1. Read the appropriate **Quick Reference** (30 sec)
2. Code while keeping the quick reference visible
3. Before committing, review the **Prevention Strategy** again

### Scenario 2: "I'm reviewing a PR"

1. Use the **Review Checklist** specific to the code domain
2. Look for red flags mentioned in the checklist
3. Use provided review comments if issues found

### Scenario 3: "Something broke, where's the solution?"

1. Check the **By Problem** section above
2. Find the matching issue
3. Read that prevention strategy
4. Apply the fix
5. Consider writing a **Compound Engineering** solution doc for future agents

### Scenario 4: "I want to understand this architecture"

1. Find the domain in **By Problem Domain**
2. Read all documents in that section
3. Understand the "why" behind the pattern

---

## Key Insight: Compound Engineering

**Each prevention strategy prevents the same mistake from recurring.**

When you fix a bug:

1. Fix it in the code (obvious)
2. Create/update a prevention strategy document
3. Future agents find it via search instead of making the same mistake

**Examples:**

- Developers kept calling APIs directly → wrote NEXTJS_CLIENT_API_PROXY_PREVENTION.md
- Proposals confirmed but never executed → wrote chatbot-proposal-execution-flow-MAIS-20251229.md
- Circular imports in agent code → wrote circular-dependency-executor-registry-MAIS-20251229.md

**Result:** Each lesson learned becomes a teachable pattern for the team.

---

## Maintenance

### When to Add a New Prevention Strategy

1. **Debugging took >15 minutes** - Spend 15 more to document it
2. **Issue affects multiple developers** - Document it once, prevent 10 instances
3. **Root cause wasn't obvious** - Document the solution for future agents
4. **You had to research it** - Future you will thank you

### How to Add One

1. Create markdown file in appropriate subfolder:
   - `patterns/` - Architectural patterns
   - `best-practices/` - Developer guidelines
   - `logic-errors/` - Bugs & how to prevent
   - `database-issues/` - Schema/data problems
   - `deployment-issues/` - Production/DevOps
   - `code-review-patterns/` - Review insights
   - `build-errors/` - Build failures

2. Use this naming: `DESCRIPTION-PURPOSE-MAIS-YYYY-MM-DD.md`
   - Example: `chatbot-proposal-execution-flow-MAIS-20251229.md`

3. Structure:
   - Problem statement (1 paragraph)
   - Root cause
   - Prevention strategies (3+)
   - Code examples (good and bad)
   - Decision tree (if applicable)
   - Resources

4. Update this INDEX.md with link

5. Reference in CLAUDE.md global instructions

---

## Files Not in This Index

Some important documentation files are referenced in CLAUDE.md but aren't "prevention strategies":

- **CLAUDE.md** - Global project instructions
- **DEVELOPING.md** - Development setup
- **ARCHITECTURE.md** - System design
- **DECISIONS.md** - ADRs (Architectural Decision Records)
- **TESTING.md** - Test strategy
- **BRAND_VOICE_GUIDE.md** - Design system

These are reference docs, not prevention strategies. Prevention strategies teach you what to do after mistakes.

---

## Contributing

**Did you find a bug that took >15 minutes to fix?**

1. Write a prevention strategy in the appropriate folder
2. Add it to the index above
3. Reference it in CLAUDE.md
4. Create a commit with title: `docs: add prevention strategy for {issue}`

**Make future developers (and yourself) thank you.**

---

## Quick Stats

**Total Prevention Strategies:** 18+ (12 original + 6 new critical patterns)

**By Category:**

- Critical Patterns: 6 (NEW)
- Architecture & Patterns: 3
- Client-Server Communication: 3
- Database Issues: 3
- Type Safety: 2
- Deployment: 1
- Build Errors: 2
- Accessibility: 1
- Development Workflow: 1

**Coverage:**

- Frontend: 5+
- Backend: 4+
- DevOps: 2+
- All: 3+

**Time to Read:**

- Quick Reference: 2-5 min
- Prevention Strategy: 10-20 min
- Deep Dive (with code): 20-30 min

---

## Last Updated

2026-01-19 - Added ADK FunctionTool TypeScript Safety Prevention (context typing, state casting, property names)

Previous updates:

- 2026-01-05: Added Six Critical Prevention Strategies (console.log stubs, prop mismatches, executor gaps, timeouts, dynamic Tailwind, incomplete shipping)
- 2026-01-05: Added Service Worker caching solution for stale JS bundles
- 2025-12-30: Added Next.js Client API Proxy prevention strategies
- 2025-12-29: Added agent execution & circular dependency patterns
- 2025-12-27: Added TypeScript unused variable strategy
- 2025-12-26: Added Vercel deployment strategy
- 2025-12-25: Added Next.js migration lessons
- 2025-12-04: Added database & type safety strategies

---

See CLAUDE.md for the canonical reference to these strategies (in "Prevention Strategies" section).
