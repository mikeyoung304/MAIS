---
title: Multi-Agent Code Review - Quick Reference
category: patterns
tags: [multi-agent-review, quick-reference, prevention-strategies, checklists]
date_created: 2026-01-10
status: active
---

# Multi-Agent Code Review - Quick Reference

**Print this. Laminate it. Keep it at your desk.**

---

## The One-Liner

```bash
/workflows:review <commit|PR|branch>
```

Triggers 6 specialized review agents running in parallel. Gets findings in 3-8 minutes.

---

## The 6 Agents & What They Catch

| Agent                  | Focus                  | Key Heuristic                        |
| ---------------------- | ---------------------- | ------------------------------------ |
| **TypeScript/React**   | Type safety, hooks     | "All `as Type` needs runtime guard"  |
| **Security Sentinel**  | Auth, XSS, injection   | "All inputs are hostile"             |
| **Architecture**       | DI, layering, deps     | "Routes never touch Prisma directly" |
| **Performance Oracle** | N+1, indexes, cache    | "Every loop queries DB (fix it)"     |
| **Code Simplicity**    | Duplication, dead code | ">70% similar = extract to shared"   |
| **Data Integrity**     | TOCTOU, constraints    | "Check-then-act needs transaction"   |

---

## Agent Selection Matrix

**Which agents to include:**

```
Auth routes          → Security ✓✓, TypeScript ✓, Architecture ✓
DB schema changes    → Data Integrity ✓✓, Performance ✓✓, TypeScript ✓
Booking logic        → Data Integrity ✓✓, Performance ✓✓, Security ✓
Payment code         → Security ✓✓, Data Integrity ✓✓, TypeScript ✓
UI components        → TypeScript ✓, Simplicity ✓✓, Performance ✓
Agent tools          → Data Integrity ✓, TypeScript ✓, Security ✓
Cache/queries        → Performance ✓✓, Data Integrity ✓, TypeScript ✓
Webhook handlers     → Security ✓✓, Data Integrity ✓✓, TypeScript ✓

Legend: ✓ = include  |  ✓✓ = prioritize
```

---

## Running the Review

### Step 1: Invoke

```bash
/workflows:review latest              # Current branch
/workflows:review 5cd5bfb1            # Commit hash
/workflows:review 123                 # PR number
/workflows:review https://github.com/... # PR URL
```

### Step 2: Wait (3-8 minutes)

6 agents analyze in parallel. Grab coffee.

### Step 3: Review Findings

```bash
ls todos/*-pending-*.md               # See all issues
/triage                               # Prioritize them
```

### Step 4: Fix & Verify

```bash
/resolve_todo_parallel                # Parallel fix agents
npm run typecheck && npm test         # Verify fixes
```

---

## Priority Quick Guide

| Priority | Definition         | Action                             |
| -------- | ------------------ | ---------------------------------- |
| **P1**   | Security/data loss | **BLOCKS MERGE** – Fix immediately |
| **P2**   | Performance/UX     | Should fix this sprint             |
| **P3**   | Code quality       | Backlog – batch into cleanup       |

### How to Assign Priority

```
Is it a security vulnerability?
  YES → P1

Does it cause data loss?
  YES → P1

Does it block core functionality?
  YES → P2

Does it affect user experience?
  YES → P2

Otherwise → P3
```

---

## Key Patterns to Remember

### TOCTOU Prevention (Most Common P1)

```typescript
// ❌ BAD: Race condition possible
const count = await repo.count();
if (count < limit) {
  await repo.create(); // Gap: another request could sneak in
}

// ✅ GOOD: Atomic with lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  const count = await tx.count();
  if (count >= limit) throw new Error('Limit exceeded');
  await tx.create(); // Now atomic
});
```

### Type Safety (Common P2)

```typescript
// ❌ BAD: Unsafe cast
const config = JSON.parse(data) as Config;
config.url.startsWith('http'); // Could crash

// ✅ GOOD: Validate first
const config = ConfigSchema.parse(JSON.parse(data));
config.url.startsWith('http'); // Type-safe
```

### DRY Violation (Common P3)

```typescript
// ❌ BAD: >70% similar components
function DatePickerStep() {
  const [date, setDate] = useState(null);
  return <div><input value={date} onChange={e => setDate(e.target.value)} /></div>;
}

function TimePickerStep() {
  const [time, setTime] = useState(null);
  return <div><input value={time} onChange={e => setTime(e.target.value)} /></div>;
}

// ✅ GOOD: Extract to shared component
function PickerStep({ label, value, onChange }) {
  return <div><label>{label}</label><input value={value} onChange={onChange} /></div>;
}
```

---

## Verification Checklist

After fixes complete, run:

```bash
✓ npm run typecheck      # TypeScript validation
✓ npm run lint          # Code style
✓ npm test              # Unit & integration tests
✓ npm run build         # Production build
✓ Manual smoke test     # Use the feature
```

**If any fails:** Don't merge. Debug and fix.

---

## When to Use Multi-Agent Review

**Always use for:**

- 500+ lines changed
- Security-sensitive code (auth, payments)
- Multi-tenant code paths
- Database schema changes
- Before production deployments

**Skip for:**

- Documentation updates
- Single-file typos
- Config-only changes
- Simple dependency bumps

---

## Common Mistakes to Avoid

| Mistake                       | Why It Matters          | Solution                          |
| ----------------------------- | ----------------------- | --------------------------------- |
| Reviewing incomplete code     | Wastes agent time       | Finish feature first, then review |
| Skipping P1 fixes             | Security/data risks     | Must fix before merge             |
| Merging with typecheck errors | Breaks build for others | Verify all checks pass            |
| Not grouping related fixes    | Inefficient parallelism | Batch similar issues together     |
| Ignoring stale TODOs          | Creates fake work       | Verify issue still exists         |

---

## Key Files to Know

| File                                                                                    | Purpose                                  |
| --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `docs/solutions/patterns/MULTI_AGENT_REVIEW_PREVENTION_STRATEGIES.md`                   | Full strategy guide (read this in depth) |
| `docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md` | Detailed workflow documentation          |
| `docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md`                  | Patterns from real code review           |
| `docs/adrs/ADR-013-advisory-locks.md`                                                   | TOCTOU locking pattern                   |

---

## Post-Review Workflow

```
Review Complete
    ↓
Findings: P1 + P2 + P3
    ↓
Triage: Prioritize & approve
    ↓
Fix All P1: BLOCKS MERGE
    ↓
Fix P2: SHOULD FIX
    ↓
Defer P3: ADD TO BACKLOG
    ↓
Verify: TypeScript + Tests + Build
    ↓
Merge ✓
```

---

## Success Metrics

Track these to improve your review process:

- **P1 resolution time:** < 4 hours (critical issues)
- **Total review cycle:** < 15 minutes (invoke to completion)
- **Parallelism:** 8+ agents per wave
- **Merge safety:** 0 regressions post-merge
- **Security findings:** 2+ per review (by Security Sentinel)

---

## Escalation Triggers

Ask for help if:

- Unclear how to fix a finding → Ask in Slack
- Finding seems wrong → Verify it still exists
- Too many P1s for one sprint → Prioritize ruthlessly
- Agent timed out → Break into smaller tasks

---

## Before You Merge

Checklist to copy-paste:

```markdown
## Code Review Verification

- [ ] Multi-agent review run (`/workflows:review`)
- [ ] All P1 findings fixed
- [ ] TypeScript passes (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] Build passes (`npm run build`)
- [ ] Manual testing done
- [ ] PR reviewed by human
- [ ] TODOs updated (status: complete)

Ready to merge! ✓
```

---

**Print this page. Post it at your desk. Reference before every merge.**

For full context, see: `docs/solutions/patterns/MULTI_AGENT_REVIEW_PREVENTION_STRATEGIES.md`
