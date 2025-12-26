---
title: 'Multi-Agent Code Review: Quick Reference'
date: 2025-12-25
category: methodology
priority: P1
status: active
tags:
  - multi-agent-review
  - quick-reference
  - cheat-sheet
---

# Multi-Agent Code Review: Quick Reference

**Print this and keep at your desk!**

---

## Agent Coordination Rules

### DO

```typescript
// Always use run_in_background for parallel agents
Task('Fix TODO-123', { run_in_background: true });
Task('Fix TODO-124', { run_in_background: true });

// Always collect results with TaskOutput
const result = await TaskOutput(agentId, {
  block: true,
  timeout: 300000
});
```

### DON'T

```typescript
// Never launch dependent tasks in parallel
Task('Create interface');  // Must finish first
Task('Implement interface'); // Depends on above - CONFLICT!

// Never forget to collect results
Task('Fix TODO-123', { run_in_background: true });
// Forgot TaskOutput - result lost!
```

---

## Priority Classification

| Priority | Definition | SLA | Examples |
|----------|------------|-----|----------|
| **P1** | Blocks launch, security vuln | < 4 hrs | Auth bypass, data leak |
| **P2** | User impact, performance | < 1 week | N+1 queries, UX gaps |
| **P3** | Code quality, optimization | Next quarter | Unused imports, memo |

**Decision Tree:**

```
Security vuln? → P1
Data corruption? → P1
Blocks core feature? → P2
Affects UX? → P2
Everything else → P3
```

---

## Triage Checklist

Before creating TODO:

- [ ] `glob '**/*ComponentName*'` - File exists?
- [ ] `grep -r 'functionName'` - Code exists?
- [ ] `git log -S 'term' --since="1 week"` - Recent commit?
- [ ] If exists and < 24h old: **SKIP**
- [ ] If exists and tested: **SKIP**
- [ ] If unclear: **AskUserQuestion**

---

## Fix Verification

After parallel fixes complete:

```bash
npm run typecheck    # Must pass
npm run lint         # Must pass
npm test             # Must pass
npm run build        # Must succeed
```

Then update TODO files:
- Change `status: pending` to `status: complete`
- Add `resolved_at:` timestamp
- Rename file from `pending` to `complete`

---

## Performance Tips

| Tip | Why |
|-----|-----|
| Launch 8-10 agents in parallel | Maximum throughput |
| Group related fixes per agent | Reduce context switching |
| Use `haiku` for simple tasks | Faster, cheaper |
| Use `opus` for complex tasks | Better reasoning |
| Set 10min timeout for refactors | Avoid premature termination |

**Model Selection:**

- **Haiku**: Remove imports, fix typos, add types
- **Sonnet**: Security fixes, API changes
- **Opus**: Architecture refactors, multi-file changes

---

## Common Commands

```bash
# Find pending TODOs
grep -l "^status: pending" todos/*.md

# Count by priority
grep -l "priority: p1" todos/*-pending-*.md | wc -l

# Check for file conflicts before parallel run
grep -h "Files to Modify" todos/123-*.md todos/124-*.md

# Post-fix verification
npm run typecheck && npm test
```

---

## Red Flags

| Symptom | Problem | Fix |
|---------|---------|-----|
| Agents modifying same file | File conflict | Run sequentially |
| TODO for existing code | Stale TODO | Verify before create |
| Agent timeout | Task too complex | Split into subtasks |
| Typecheck fails after | Breaking changes | Review agent output |
| Results never collected | Missing TaskOutput | Always await TaskOutput |

---

## Quick Templates

### TODO File

```markdown
---
status: pending
priority: p1
issue_id: "XXX"
tags: [security]
dependencies: []
---

# Title

## Problem
What and why

## Solution
How to fix

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Tests pass
```

### Agent Launch

```typescript
// Independent tasks - parallel
const agents = todos.map(t =>
  Task(`Fix ${t.id}`, { run_in_background: true })
);

// Collect all results
const results = await Promise.all(
  agents.map(a => TaskOutput(a.id, { block: true }))
);

// Verify
await Bash({ command: 'npm run typecheck' });
```

---

**Full Guide:** `/docs/solutions/methodology/MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES.md`
