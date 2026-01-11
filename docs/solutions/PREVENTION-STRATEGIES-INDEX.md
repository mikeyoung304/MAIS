# Prevention Strategies Index

Quick navigation to prevention guides. Each guide is a consolidated, single-source reference.

---

## Quick Start

| Need                          | Guide                                                                      |
| ----------------------------- | -------------------------------------------------------------------------- |
| **Print-and-pin cheat sheet** | [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md)           |
| **10 critical patterns**      | [patterns/mais-critical-patterns.md](./patterns/mais-critical-patterns.md) |
| **Search for specific issue** | `grep -r "keyword" docs/solutions/`                                        |

---

## Consolidated Guides by Topic

### Security & Authentication

| Topic                  | Guide                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Multi-tenant isolation | [patterns/mais-critical-patterns.md](./patterns/mais-critical-patterns.md)                 |
| Client auth patterns   | [CLIENT_AUTH_GUIDE.md](./CLIENT_AUTH_GUIDE.md)                                             |
| NextAuth v5            | [authentication-issues/NEXTAUTH_V5_GUIDE.md](./authentication-issues/NEXTAUTH_V5_GUIDE.md) |
| File upload security   | [FILE_UPLOAD_SECURITY_GUIDE.md](./FILE_UPLOAD_SECURITY_GUIDE.md)                           |

### Agent System

| Topic              | Guide                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| Agent ecosystem    | [AGENT_ECOSYSTEM_GUIDE.md](./AGENT_ECOSYSTEM_GUIDE.md)                                 |
| Agent tools        | [patterns/AGENT_TOOLS_PREVENTION_INDEX.md](./patterns/AGENT_TOOLS_PREVENTION_INDEX.md) |
| Multi-agent review | [methodology/MULTI_AGENT_REVIEW_GUIDE.md](./methodology/MULTI_AGENT_REVIEW_GUIDE.md)   |

### Build & TypeScript

| Topic                   | Guide                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| TypeScript build errors | [TYPESCRIPT_BUILD_GUIDE.md](./TYPESCRIPT_BUILD_GUIDE.md)                     |
| ESM/CJS compatibility   | [ESM_CJS_CONSOLIDATED.md](./ESM_CJS_CONSOLIDATED.md)                         |
| ESLint dead code        | [patterns/ESLINT_PREVENTION_INDEX.md](./patterns/ESLINT_PREVENTION_INDEX.md) |
| Schema drift            | [SCHEMA_DRIFT_PREVENTION.md](./SCHEMA_DRIFT_PREVENTION.md)                   |

### Testing

| Topic                 | Guide                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Test isolation        | [TEST_ISOLATION_GUIDE.md](./TEST_ISOLATION_GUIDE.md)                                                               |
| E2E Next.js migration | [patterns/E2E_NEXTJS_MIGRATION_PREVENTION_STRATEGIES.md](./patterns/E2E_NEXTJS_MIGRATION_PREVENTION_STRATEGIES.md) |

### React & Frontend

| Topic                  | Guide                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| React hooks rules      | [patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md](./patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md)                           |
| Server/client boundary | [patterns/SERVER_CLIENT_MODULE_SPLIT_PREVENTION_STRATEGIES.md](./patterns/SERVER_CLIENT_MODULE_SPLIT_PREVENTION_STRATEGIES.md) |
| Dual draft system      | [patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md](./patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md)                   |

### Patterns Directory

The `patterns/` directory contains 37 focused prevention guides. Key ones:

```
patterns/
├── mais-critical-patterns.md          # START HERE - 10 critical patterns
├── AGENT_TOOLS_PREVENTION_INDEX.md    # Agent tool patterns
├── ESLINT_PREVENTION_INDEX.md         # Dead code prevention
├── REACT_HOOKS_EARLY_RETURN_*         # Rules of hooks
├── SERVER_CLIENT_MODULE_SPLIT_*       # Module boundaries
├── DUAL_MODE_ORCHESTRATOR_*           # Dual-mode agent
├── CODE_REVIEW_708_717_*              # Latest code review patterns
└── E2E_NEXTJS_MIGRATION_*             # E2E test patterns
```

---

## Quick Reference Files

Each consolidated guide has a quick reference. For daily use:

| Quick Reference                                                                                                | Purpose            |
| -------------------------------------------------------------------------------------------------------------- | ------------------ |
| [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md)                                               | Master cheat sheet |
| [methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md](./methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md)       | Multi-agent review |
| [patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md](./patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md)                 | Dead code          |
| [patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md](./patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md) | React hooks        |

---

## Workflow Integration

### Before Coding

1. Check [mais-critical-patterns.md](./patterns/mais-critical-patterns.md) for the 10 patterns you MUST follow

### Before Committing

1. Run `npm run typecheck && npm run lint`
2. Check [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md) code review checklist

### Before Merging

1. Run `/workflows:review` for multi-agent review
2. Address all P1/P2 findings

### After Fixing Non-Trivial Bug

1. Run `/workflows:compound` to document the solution
2. Solution saved to `docs/solutions/` for future reference

---

## Archived Documentation

Superseded and session-specific docs are in:

```
docs/archive/solutions-consolidated-20260110/
├── duplicates/           # Exact duplicates removed
├── superseded-patterns/  # Old pattern files
└── topic-clusters/       # Consolidated topic files
    ├── client-auth/
    ├── esm-cjs/
    ├── file-upload/
    ├── multi-agent/
    ├── nextauth-v5/
    ├── test-isolation/
    └── typescript-build/
```

If you need historical context, check the archive.
