---
review_agents:
  [
    kieran-typescript-reviewer,
    code-simplicity-reviewer,
    security-sentinel,
    performance-oracle,
    architecture-strategist,
    data-integrity-guardian,
    agent-native-reviewer,
    julik-frontend-races-reviewer,
    git-history-analyzer,
    pattern-recognition-specialist,
  ]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

- Multi-tenant platform — ALL queries MUST filter by tenantId (CRITICAL security)
- Express + React + Next.js 14 monorepo with Prisma 7 + PostgreSQL
- Config-driven architecture — check for hard-coded values
- Mock-first development — verify mock implementations match production behavior
- ts-rest + Zod contracts — validate contract changes propagate to all consumers
- Extra scrutiny on: auth flows, tenant isolation, Stripe payment integrations
- 3-agent AI architecture (tenant-agent, customer-agent, research-agent) on Cloud Run via ADK
- Agent tools use Zod schema validation + requireContext() guards — verify both present
- Frontend uses Next.js App Router with async server components — watch for race conditions
- Run `npm test` and `npm run typecheck` before any merge
