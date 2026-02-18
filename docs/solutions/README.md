# Solutions Index

Institutional knowledge captured via `/workflows:compound`.
Searched automatically by `learnings-researcher` agent via YAML frontmatter Grep.

## Key Reference Docs

- **[PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md)** — Daily patterns cheat sheet (referenced in CLAUDE.md)
- **[PREVENTION-STRATEGIES-INDEX.md](./PREVENTION-STRATEGIES-INDEX.md)** — Master prevention strategies index

## Categories (31 subdirectories, 380 files)

| Category | Files | Description |
|---|---:|---|
| [patterns/](./patterns/) | 85 | Cross-cutting patterns and conventions |
| [code-review-patterns/](./code-review-patterns/) | 57 | Code review findings and recurring patterns |
| [database-issues/](./database-issues/) | 39 | Database, Prisma, and data integrity issues |
| [agent-issues/](./agent-issues/) | 21 | ADK agent runtime and tool errors |
| [agent-design/](./agent-design/) | 21 | Agent architecture and design decisions |
| [build-errors/](./build-errors/) | 19 | TypeScript/Next.js build failures |
| [react-performance/](./react-performance/) | 15 | React rendering and performance issues |
| [security-issues/](./security-issues/) | 13 | Security vulnerabilities and fixes |
| [dev-workflow/](./dev-workflow/) | 13 | Development workflow and tooling |
| [ui-bugs/](./ui-bugs/) | 12 | Frontend and UI rendering bugs |
| [deployment-issues/](./deployment-issues/) | 10 | Deployment, CI/CD, and production issues |
| [methodology/](./methodology/) | 9 | Development methodology and process |
| [best-practices/](./best-practices/) | 9 | Established best practices |
| [typescript-build-errors/](./typescript-build-errors/) | 7 | TypeScript-specific compilation errors |
| [logic-errors/](./logic-errors/) | 7 | Business logic bugs and fixes |
| [integration-issues/](./integration-issues/) | 7 | Third-party integration problems |
| [architecture/](./architecture/) | 6 | Architectural decisions and patterns |
| [test-failures/](./test-failures/) | 5 | Test failure investigations |
| [authentication-issues/](./authentication-issues/) | 4 | Auth and authorization problems |
| [workflow/](./workflow/) | 3 | Workflow automation patterns |
| [ci-cd/](./ci-cd/) | 3 | CI/CD pipeline issues |
| [testing-patterns/](./testing-patterns/) | 2 | Domain-specific testing patterns |
| [testing-gaps/](./testing-gaps/) | 2 | Missing test coverage analysis |
| [runtime-errors/](./runtime-errors/) | 2 | Runtime error investigations |
| [performance-issues/](./performance-issues/) | 2 | Performance bottleneck analysis |
| [incidents/](./incidents/) | 2 | Production incident post-mortems |
| [debugging-reports/](./debugging-reports/) | 2 | Debugging session reports |
| [test-infrastructure/](./test-infrastructure/) | 1 | Test infra setup and maintenance |
| [performance/](./performance/) | 1 | Performance optimization guides |
| [data-issues/](./data-issues/) | 1 | Data quality and migration issues |
| [build-issues/](./build-issues/) | 1 | Build system configuration |

## Top-Level Docs (174 files)

Top-level `.md` files are organized by prefix convention:

| Prefix | Purpose |
|---|---|
| `PREVENTION-*` | Prevention strategy indices and cheat sheets |
| `ADK_*` | ADK/agent development patterns and fixes |
| `E2E-TESTING-*` | End-to-end testing guides |
| `DATABASE-*` | Database client and schema patterns |
| `FILE_UPLOAD_*` | Secure file upload patterns |
| `WEBHOOK-*` | Webhook idempotency patterns |
| `EMAIL-*` | Email handling patterns |
| `ESM_CJS_*` | Module system compatibility |
| `COMPONENT-*` / `STOREFRONT-*` | UI component patterns |
| `TEST-*` / `TESTING-*` | Testing strategies and references |
| `ADVANCED-FEATURES-*` | Advanced platform patterns |
| `DEPLOYMENT-*` | Deployment verification fixes |

## How Solutions Are Discovered

The `learnings-researcher` agent discovers solutions via **Grep on YAML frontmatter** in `docs/solutions/**/*.md`. It does NOT navigate this README or follow links.

**Important for contributors:**
1. Always include YAML frontmatter with descriptive `title`, `category`, and `tags` fields
2. Place files in the appropriate subdirectory by problem type
3. Use `/workflows:compound` to create properly formatted solution docs
4. Do NOT restructure `docs/solutions/` paths — they are hardcoded in the agent

## Related

- [../../TESTING.md](../../TESTING.md) — Testing strategy overview
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) — System architecture
- [../security/](../security/) — Security documentation
- [../operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md) — Incident handling

---

**Last Updated:** 2026-02-18
**Total:** 174 top-level + 380 in subdirectories = 554 solution documents
