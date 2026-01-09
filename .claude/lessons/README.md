# Claude Lessons Index - MAIS

Codified lessons from multi-tenant SaaS development. These patterns prevent common issues in tenant-scoped, config-driven architectures.

## Quick Reference

| ID                                                   | Category       | Problem                     | Detection Signal                     |
| ---------------------------------------------------- | -------------- | --------------------------- | ------------------------------------ |
| [CL-TENANT-001](./CL-TENANT-001-tenant-scoping.md)   | Security       | Missing tenantId in queries | Cross-tenant data leakage            |
| [CL-ADAPTER-001](./CL-ADAPTER-001-mock-first-dev.md) | Architecture   | Real adapter before mock    | Integration tests fail in CI         |
| [CL-SAVE-001](./CL-SAVE-001-autosave-race.md)        | Data Integrity | Auto-save race conditions   | Stale data overwrites recent changes |
| [CL-SERVICE-001](./CL-SERVICE-001-service-layer.md)  | Architecture   | Business logic in routes    | Untestable code, tight coupling      |

## When to Reference

**Before writing database queries:** Read CL-TENANT-001
**Before creating new adapters:** Read CL-ADAPTER-001
**Before implementing auto-save:** Read CL-SAVE-001
**Before adding business logic:** Read CL-SERVICE-001

## Format

Each lesson follows a standard structure:

- **Problem** - What went wrong
- **Bug Pattern** - Code that causes the issue
- **Fix Pattern** - Correct implementation
- **Prevention Checklist** - Items to verify
- **Detection** - How to identify this issue

## Maintenance

When you encounter a new incident:

1. Run `/workflows:codify` to document it
2. If it's a recurring pattern, add to this index
3. Keep lessons under 60 lines for quick reference

## Related Documentation

- `docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Detailed prevention docs
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Quick reference cheat sheet
