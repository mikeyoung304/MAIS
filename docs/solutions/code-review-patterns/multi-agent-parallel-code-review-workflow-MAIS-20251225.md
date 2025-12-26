---
# Multi-Agent Parallel Code Review with Automated Triage and Fixes
# Created: 2025-12-25
# Project: MAIS (Macon AI Solutions)

problem_type: workflow-automation
component: code-review-system
severity: P2

title: "Multi-Agent Parallel Code Review with Automated Triage and Fixes"

tags:
  - multi-agent
  - parallel-processing
  - code-review
  - triage
  - automation
  - workflows
  - claude-code
  - locked-template-system

related_files:
  - ".claude/skills/user/workflows/review.md"
  - ".claude/skills/user/triage.md"
  - ".claude/skills/user/resolve_parallel.md"
  - "docs/guides/PARALLEL-TODO-RESOLUTION-WITH-PLAYWRIGHT-VERIFICATION.md"
  - "docs/solutions/methodology/multi-agent-code-review-process.md"
---

# Multi-Agent Parallel Code Review Workflow

## Summary

A comprehensive code review workflow using 6 specialized AI agents running in parallel, followed by interactive triage and parallel fix execution. Achieves 4-6x speedup over sequential review with more thorough coverage.

## Problem Statement

Manual code reviews suffer from:
- **Time constraints**: Large changesets take hours to review properly
- **Inconsistent coverage**: Single reviewers miss issues outside their expertise
- **Unstructured findings**: Comments lack severity classification
- **Sequential bottlenecks**: Fixes implemented one at a time
- **No audit trail**: Difficult to track what was reviewed and fixed

## Solution Architecture

### Phase 1: Parallel Review (6 Specialized Agents)

Launch all review agents simultaneously using the Task tool with `run_in_background: true`:

| Agent | Focus Area |
|-------|------------|
| Security Sentinel | Authentication, authorization, input validation, secrets |
| Architecture Strategist | Multi-tenant isolation, layered patterns, DI |
| Performance Oracle | N+1 queries, caching, async patterns, resource leaks |
| Code Simplicity Reviewer | Complexity, dead code, over-engineering |
| Data Integrity Guardian | Transactions, race conditions, validation |
| Pattern Recognition Specialist | Consistency, anti-patterns |

### Phase 2: Findings Aggregation

Collect results using TaskOutput and categorize by priority:

```markdown
## P1 - Critical (Must Fix Before Merge)
- Missing security validation
- Data integrity issues
- Breaking changes

## P2 - Important (Should Fix)
- Performance issues
- Architecture concerns
- Type safety gaps

## P3 - Nice to Have
- Code style improvements
- Minor optimizations
- Documentation updates
```

### Phase 3: Interactive Triage

Use `AskUserQuestion` for ambiguous findings:

```typescript
// Clarify prioritization with user
AskUserQuestion({
  questions: [{
    question: "How should we handle finding #406?",
    header: "Priority",
    options: [
      { label: "Keep P1 - Block merge", description: "Fix now" },
      { label: "Downgrade to P2", description: "Fix in next sprint" }
    ],
    multiSelect: false
  }]
});
```

### Phase 4: Parallel Fixes (8+ Worker Agents)

Launch fix agents simultaneously, grouping related issues:

```typescript
// Launch 8 parallel fix agents in a single message
Task({ description: "Fix 404: Create _domain routes", run_in_background: true })
Task({ description: "Fix 405: Add error logging", run_in_background: true })
Task({ description: "Fix 406: HeroSection images", run_in_background: true })
Task({ description: "Fix 407: Migration data integrity", run_in_background: true })
Task({ description: "Fix 408-409: Admin + schema", run_in_background: true })
Task({ description: "Fix 410-411: Centralize conversion", run_in_background: true })
Task({ description: "Fix 412-414: Props + components", run_in_background: true })
Task({ description: "Fix 416-417: Loading + types", run_in_background: true })
```

### Phase 5: Verification

After all agents complete:

```bash
npm run typecheck  # Verify all changes compile
```

## Key Implementation Patterns

### 1. Parallel Agent Launch

Always send multiple Task tool calls in a **single message** for true parallelism:

```xml
<!-- CORRECT: Single message with multiple tasks -->
<invoke name="Task">...</invoke>
<invoke name="Task">...</invoke>
<invoke name="Task">...</invoke>
```

### 2. Background Execution

Use `run_in_background: true` to avoid blocking:

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Fix security issue",
  prompt: "...",
  run_in_background: true  // Critical for parallelism
})
```

### 3. Result Collection

Use TaskOutput to collect results after agents complete:

```typescript
// Collect all results
TaskOutput({ task_id: "agent_id_1" })
TaskOutput({ task_id: "agent_id_2" })
// ... for all agents
```

### 4. File-Based Todo Tracking

Create structured todo files for audit trail:

```markdown
# todos/404-ready-p1-missing-domain-routes.md
---
status: ready  # ready | in_progress | complete
priority: p1
issue_id: "404"
tags:
  - code-review
  - next-js
---

## Problem Statement
...

## Acceptance Criteria
- [ ] Routes created
- [ ] TypeScript passes
```

## Metrics from Real Usage

| Metric | Sequential | Parallel | Improvement |
|--------|------------|----------|-------------|
| Review time (14 findings) | ~45 min | ~8 min | 5.6x faster |
| Fix implementation | ~60 min | ~12 min | 5x faster |
| Coverage consistency | Variable | Comprehensive | More thorough |
| Audit trail | None | Full | Complete history |

## Prevention Strategies

### 1. Agent Coordination

- Always use `run_in_background` for parallel agents
- Use TaskOutput to collect results after completion
- Don't launch dependent tasks in parallel

### 2. Triage Best Practices

- Use AskUserQuestion for unclear items (don't assume)
- Classify by priority (P1=critical, P2=important, P3=nice-to-have)
- Create file-based todos for tracking and audit

### 3. Fix Verification

- Run typecheck after parallel fixes complete
- Update todo files to mark complete
- Summarize all changes for user review

### 4. Cost Optimization

- Use `model: "haiku"` for simple, well-defined tasks
- Group related fixes into single agents
- Launch maximum parallelism (8+ agents when possible)

## Example: Locked Template System Review

The workflow was used to review the Locked Template System implementation:

**Input:** 14 uncommitted files on main branch

**Review Phase (6 agents, ~3 min):**
- 4 P1 Critical findings
- 5 P2 Important findings
- 5 P3 Nice-to-have findings

**Triage Phase (~2 min):**
- 4 questions clarified with user
- 1 finding marked "won't fix" (industry standard practice)

**Fix Phase (8 agents, ~5 min):**
- All 13 approved fixes implemented in parallel
- TypeScript verification passed

**Total time:** ~10 minutes vs ~60+ minutes manually

## Related Documentation

- [Multi-Agent Code Review Process](../methodology/multi-agent-code-review-process.md)
- [Parallel TODO Resolution Pattern](../workflow/TODO-PARALLEL-RESOLUTION-PATTERN.md)
- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md)

## Version History

| Date | Change | Commits |
|------|--------|---------|
| 2025-12-25 | Initial documentation | 7894417, 5ba3e0a |
