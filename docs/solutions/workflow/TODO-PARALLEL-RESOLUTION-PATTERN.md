# Todo Parallel Resolution Pattern

## Overview

Pattern for efficiently resolving multiple todos using parallel subagents, with verification-first approach to avoid duplicate work on already-implemented features.

**Session:** 2025-12-05
**Commits:** `62f54ab`, `fc63985`
**Result:** 12 todos resolved in ~90 minutes

---

## The Problem

During a plan review, todos were created describing work that had already been implemented:

```
22:59:24 → Commit 1647a40: Implementation complete (landing page editor)
22:59:54 → Commit c4c8baf: Todos created (30 seconds later!)
         → TODOs 246-249 described already-done work
```

**Root cause:** Plan review created todos from documentation assumptions without verifying code existence.

---

## The Solution: Parallel Verification-First Workflow

### Step 1: Verify Before Implementing

Before implementing ANY todo, run parallel verification agents:

```
Task(Explore): "Check if TODO-246 backend endpoints exist"
Task(Explore): "Check if TODO-247 hook has batching patterns"
Task(Explore): "Check if TODO-248 component exists"
Task(Explore): "Check if TODO-249 rate limiting applied"
```

**Key insight:** 9 of 15 todos (60%) were already implemented.

### Step 2: Categorize Todos

| Category             | Action                       | Time      |
| -------------------- | ---------------------------- | --------- |
| **Already Complete** | Update status, add evidence  | 5 min     |
| **Quick Win**        | Implement (< 1 hour)         | 20-45 min |
| **Deferred**         | Document scope, dependencies | 10 min    |

### Step 3: Batch Similar Work

Group todos by type and resolve in parallel:

```typescript
// Wave 1: All verifications (parallel)
Task(Explore): "Verify TODO-253 localStorage"
Task(Explore): "Verify TODO-254 tab blur"
Task(Explore): "Verify TODO-255 layout shift"

// Wave 2: Quick implementations (parallel)
Task(general-purpose): "Add transaction wrapper TODO-252"
Task(general-purpose): "Create ErrorAlert component TODO-264"
Task(general-purpose): "Add React.memo TODO-265"
```

---

## Code Patterns Extracted

### Pattern 1: Transaction Wrapper (Data Integrity)

**Problem:** Read-modify-write without atomicity
**Solution:** Wrap in Prisma transaction

```typescript
// Before (TODO-252)
async discardLandingPageDraft(tenantId: string) {
  const tenant = await this.prisma.tenant.findUnique({...});
  await this.prisma.tenant.update({...}); // Not atomic!
}

// After
async discardLandingPageDraft(tenantId: string) {
  return await this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({...});
    await tx.tenant.update({...}); // Atomic
  });
}
```

### Pattern 2: Shared Component Extraction

**Problem:** 3x duplicated error display markup
**Solution:** Extract to shared component

```typescript
// client/src/components/shared/ErrorAlert.tsx (TODO-264)
export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
  );
}
```

### Pattern 3: React.memo for Pure Components

**Problem:** Cascading re-renders in lists
**Solution:** Wrap pure components in memo

```typescript
// Before (TODO-265)
export function StatusBadge({ status, variant }: Props) {...}

// After
export const StatusBadge = memo(function StatusBadge({
  status, variant
}: Props) {...});
```

---

## Verification Evidence Template

When closing a todo as "already implemented":

```markdown
## Work Log

| Date       | Action | Notes                                                 |
| ---------- | ------ | ----------------------------------------------------- |
| 2025-12-05 | Closed | Verified: [what exists] at [file:line], commit [hash] |
```

Example:

```markdown
| 2025-12-05 | Closed | Verified: draftAutosaveLimiter at rateLimiter.ts:133, commit 1647a40 |
```

---

## Prevention Strategies

### 1. Always Verify First

Before creating ANY todo from a plan review:

```bash
# Search for the functionality
Glob("**/tenant-admin-landing-page*.ts")
Grep("draftAutosaveLimiter", "server/src/")
git log --oneline -10  # Check recent commits
```

### 2. Use Time-Aware Deferral

If code was committed < 24 hours ago, defer creating todos:

- Implementation likely still in progress
- Tests haven't been written yet
- Plan vs reality gap not yet visible

### 3. Categorize Before Acting

Decision tree:

```
Is code already there?
  → YES: Mark complete with evidence
  → NO: Is it < 1 hour work?
    → YES: Implement now
    → NO: Defer with scope estimate
```

---

## Metrics

| Metric                     | Value       |
| -------------------------- | ----------- |
| Todos reviewed             | 15          |
| Already complete           | 9 (60%)     |
| Quick wins implemented     | 3           |
| Deferred                   | 6           |
| Total time                 | ~90 minutes |
| Time saved by verification | ~6 hours    |

---

## Quick Reference

### Parallel Verification Command

```
Run these agents IN PARALLEL:
- Task(Explore): "Check TODO-XXX existence"
- Task(Explore): "Check TODO-YYY existence"
- Task(Explore): "Check TODO-ZZZ existence"
```

### Todo Status Flow

```
pending → verified-complete (code exists)
        → ready (needs work)
        → deferred (larger scope)
```

### Commit Message Template

```
chore(todos): resolve P1/P2 todos with parallel verification

Resolved:
- XXX: [action taken]
- YYY: [action taken]

Deferred:
- ZZZ: [reason]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Related Documentation

- `docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Master prevention index
- `todos/README.md` - Todo system documentation
- `.claude/commands/resolve_todo_parallel.md` - Resolution command

---

_Created: 2025-12-05 | Session: Todo Parallel Resolution_
