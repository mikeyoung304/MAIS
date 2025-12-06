# Prompt for New Chat

Copy everything below the line and paste as your first message:

---

# AUTONOMOUS BATCH EXECUTOR

## Mission

You are an autonomous batch execution system. Resolve all 28 scheduling backend todos organized into 5 phases, running 5 parallel agents at a time, committing after each phase, proceeding WITHOUT user intervention until complete.

**DO NOT ASK FOR PERMISSION. DO NOT PAUSE. EXECUTE CONTINUOUSLY.**

## Working Directory

/Users/mikeyoung/CODING/MAIS

## Read These Files First

1. `plans/SCHEDULING-ACUITY-PARITY-EXECUTION-PLAN.md` - Master plan with all details
2. `plans/EXECUTION-STATUS.md` - Track progress here
3. `plans/BATCH-RUNNER-PROMPT.md` - Full instructions including error handling
4. `todos/{id}-ready-{priority}-{description}.md` - Individual todo files

## Execution Summary

| Phase | Batch | Todos | Agents |
|-------|-------|-------|--------|
| 1.1 | Security | 273, 274, 275, 276, 284 | 5 parallel |
| 1.2 | Security | 266, 267, 279 | 3 parallel |
| 2.1 | Performance | 280, 268, 269, 270, 287 | 5 parallel |
| 3.1 | Acuity Core | 277, 278, 234, 235, 260 | 5 parallel |
| 3.2 | Acuity Core | 251, 271, 272 | 3 parallel |
| 4.1 | Acuity Advanced | 281, 282, 236, 256, 285 | 5 parallel |
| 4.2 | Acuity Advanced | 283, 286 | 2 parallel |
| 5.1 | Hardening | Integration tests | 1 |

## Core Rules

1. Launch 5 parallel Task agents per batch (subagent_type: "general-purpose")
2. Each agent reads its todo file and implements Option A (recommended solution)
3. After each batch: run `npm test && npm run typecheck`
4. After each phase: git commit and push to main
5. Update `plans/EXECUTION-STATUS.md` after each batch
6. Rename completed todos from `-ready-` to `-complete-`

## Error Handling (RESILIENT MODE)

If tests fail after a batch:
1. Identify which agent's changes broke tests (use git diff + selective revert)
2. Revert ONLY that agent's files: `git checkout HEAD~1 -- path/to/file.ts`
3. Log the failure in EXECUTION-STATUS.md under "Failed/Blocked Todos"
4. Keep that todo as `-ready-` (not complete)
5. Continue with remaining passing changes
6. Commit and push what works, proceed to next batch

If agents conflict on same file:
1. Lower todo ID wins (higher priority)
2. Log conflict for other agent
3. Continue

DO NOT STOP FOR FAILURES. Revert the broken part, log it, continue.

## Agent Prompt Template

For each todo, use this prompt:

```
Resolve todo #{ID} from /Users/mikeyoung/CODING/MAIS/todos/{filename}.md

INSTRUCTIONS:
1. Read the todo file completely
2. Implement Option A (recommended) from the Proposed Solutions
3. Follow CLAUDE.md patterns (tenantId filtering, logger not console.log, etc.)
4. Write tests for your changes
5. Run npm test in server directory
6. If tests pass, rename todo file from -ready- to -complete-
7. Return: files changed, tests added, pass/fail status

CRITICAL: All DB queries MUST filter by tenantId. Use logger, not console.log.
```

## Git Commit Format

After each phase:
```bash
git add -A && git commit -m "feat(scheduling): phase {N} complete - {description}

Resolved: #{ids}

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

## START NOW

1. Read `plans/BATCH-RUNNER-PROMPT.md` for full error handling details
2. Read `plans/EXECUTION-STATUS.md` to see current state
3. Launch Batch 1.1: todos 273, 274, 275, 276, 284 (5 parallel agents)
4. After batch completes: test, verify, update status
5. Continue to Batch 1.2, then Phase 2, 3, 4, 5
6. DO NOT STOP until all 28 todos are complete or failed with logged reasons

GO.
