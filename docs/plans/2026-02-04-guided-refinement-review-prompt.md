# Guided Refinement Integration - Review Prompt

**Date:** 2026-02-04
**Purpose:** Full code review before commit, with focus on legacy naming debt

---

## Prompt for Fresh Context Window

Copy everything below this line into your new Claude Code session:

---

## Review Request

I need a thorough code review before committing Guided Refinement integration work. Run `/workflows:review` with special attention to legacy naming debt.

### Context

The codebase has legacy "concierge" naming from an agent architecture retired on 2026-01-30. The current architecture uses:

| Agent    | Service          | Purpose                                       |
| -------- | ---------------- | --------------------------------------------- |
| tenant   | `tenant-agent`   | Storefront, marketing, projects (tenant view) |
| customer | `customer-agent` | Booking, project hub (customer view)          |
| research | `research-agent` | Web research                                  |

**Archived:** concierge-agent, storefront-agent, marketing-agent, booking-agent, project-hub-agent

See `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` for details.

### Files Changed Today

**New:**

- `apps/web/src/lib/tenant-agent-dispatch.ts` - Message dispatcher (widget→chat)

**Modified:**

- `apps/web/src/hooks/useConciergeChat.ts` - Added `sendProgrammaticMessage`
- `apps/web/src/components/agent/ConciergeChat.tsx` - Registered sender
- `apps/web/src/app/(protected)/tenant/layout.tsx` - Added SectionWidget + callbacks

### Review Focus Areas

1. **Standard code review** - Bugs, edge cases, security, types
2. **Legacy naming audit** - Find all "concierge" references that should be "tenant-agent"
3. **Archived agent references** - Any stale code referencing retired agents?
4. **Integration correctness** - Widget↔Agent communication working?

### Search Commands

```bash
# Count concierge naming debt
grep -rn "concierge\|Concierge" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# Find archived agent references (should be zero outside docs/archive)
grep -rn "storefront-agent\|marketing-agent\|booking-agent\|project-hub-agent\|concierge-agent" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v archive | grep -v ".md"

# Verify TypeScript
npm run --workspace=apps/web typecheck && npm run --workspace=server typecheck
```

### Decision Needed

After review, recommend one of:

1. **Commit as-is** + create todo for naming cleanup (larger scope)
2. **Fix naming first** before commit
3. **Block commit** - critical issues found

### Reference Docs

- `docs/plans/2026-02-04-guided-refinement-handoff.md` - Full implementation details
- `apps/web/src/stores/refinement-store.ts` - Zustand store (466 lines)
- `apps/web/src/components/build-mode/SectionWidget.tsx` - Widget UI (409 lines)
