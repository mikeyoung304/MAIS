# Autonomous Batch Runner Prompt

**Copy everything below this line into a new Claude Code chat:**

---

# AUTONOMOUS BATCH EXECUTOR

## Mission

You are an autonomous batch execution system. Your job is to resolve all 28 scheduling backend todos organized into 5 phases, running 5 parallel agents at a time, committing after each phase, and proceeding WITHOUT user intervention until complete.

**DO NOT ASK FOR PERMISSION. DO NOT PAUSE. EXECUTE CONTINUOUSLY.**

## Working Directory

```
/Users/mikeyoung/CODING/MAIS
```

## Key Files to Read First

1. `plans/SCHEDULING-ACUITY-PARITY-EXECUTION-PLAN.md` - The master plan
2. `plans/EXECUTION-STATUS.md` - Track your progress here
3. `todos/{id}-ready-{priority}-{description}.md` - Individual todo files

## Execution Phases

### Phase 1: Critical Security (Batches 1.1 + 1.2)
- **Batch 1.1:** Todos 273, 274, 275, 276, 284 (5 parallel)
- **Batch 1.2:** Todos 266, 267, 279 (3 parallel)
- **After Phase 1:** Commit and push

### Phase 2: Performance (Batch 2.1)
- **Batch 2.1:** Todos 280, 268, 269, 270, 287 (5 parallel)
- **After Phase 2:** Commit and push

### Phase 3: Acuity Core (Batches 3.1 + 3.2)
- **Batch 3.1:** Todos 277, 278, 234, 235, 260 (5 parallel)
- **Batch 3.2:** Todos 251, 271, 272 (3 parallel)
- **After Phase 3:** Commit and push

### Phase 4: Acuity Advanced (Batches 4.1 + 4.2)
- **Batch 4.1:** Todos 281, 282, 236, 256, 285 (5 parallel)
- **Batch 4.2:** Todos 283, 286 (2 parallel)
- **After Phase 4:** Commit and push

### Phase 5: Hardening
- Final integration testing
- **After Phase 5:** Commit and push

---

## Agent Prompt Template

For each todo, launch a Task agent with this prompt structure:

```
Resolve todo #{ID} from /Users/mikeyoung/CODING/MAIS/todos/{filename}.md

INSTRUCTIONS:
1. Read the todo file completely
2. Understand the problem statement and proposed solution
3. Implement Option A (recommended) unless there's a clear reason not to
4. Follow all patterns in CLAUDE.md (tenant isolation, no console.log, etc.)
5. Write tests for your changes
6. Run `npm test` in the server directory to verify
7. Rename the todo file from `-ready-` to `-complete-` when done

CRITICAL RULES:
- All database queries MUST filter by tenantId
- Use logger, never console.log
- Follow existing code patterns
- Add JSDoc comments to new functions
- Run tests before marking complete

Return a summary of:
- What files were changed
- What tests were added
- Whether tests pass
- The todo file was renamed to complete
```

---

## Batch Execution Pattern

Launch 5 agents in ONE message using multiple Task tool invocations:

```javascript
// Example for Batch 1.1 - send all 5 in a single message
Task({ prompt: "Resolve todo #273...", subagent_type: "general-purpose" })
Task({ prompt: "Resolve todo #274...", subagent_type: "general-purpose" })
Task({ prompt: "Resolve todo #275...", subagent_type: "general-purpose" })
Task({ prompt: "Resolve todo #276...", subagent_type: "general-purpose" })
Task({ prompt: "Resolve todo #284...", subagent_type: "general-purpose" })
```

Wait for all 5 to complete using AgentOutputTool, then proceed to next batch.

---

## After Each Batch

1. **Update status file:** Edit `plans/EXECUTION-STATUS.md` to mark batch complete
2. **Run verification:**
   ```bash
   cd /Users/mikeyoung/CODING/MAIS && npm run typecheck && npm test
   ```
3. **If tests fail:**
   - Identify which agent's changes broke tests
   - Fix the issue inline (don't spawn new agent)
   - Re-run tests

---

## After Each Phase

1. **Git commit:**
   ```bash
   git add -A && git commit -m "$(cat <<'EOF'
   feat(scheduling): complete phase {N} - {description}

   Resolved todos: #{id1}, #{id2}, #{id3}...

   🤖 Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

2. **Git push:**
   ```bash
   git push origin main
   ```

3. **Update status file** with commit SHA

4. **Proceed to next phase immediately** - DO NOT WAIT FOR USER

---

## Commit Messages by Phase

- **Phase 1:** `fix(security): complete phase 1 - critical security fixes`
- **Phase 2:** `perf(scheduling): complete phase 2 - performance optimizations`
- **Phase 3:** `feat(scheduling): complete phase 3 - acuity core features`
- **Phase 4:** `feat(scheduling): complete phase 4 - acuity advanced features`
- **Phase 5:** `chore(scheduling): complete phase 5 - production hardening`

---

## Error Handling (Resilient Mode)

### Batch Verification Process

After all agents in a batch complete, use this staged verification:

```bash
# 1. Create a clean branch for this batch
git checkout -b batch-{phase}-{batch}-verification

# 2. For each completed agent, apply and test individually:
```

**For each agent's changes:**
1. Note which files the agent modified
2. Run `npm test`
3. If tests PASS → keep changes, continue to next agent
4. If tests FAIL → revert that agent's files, log failure, continue

### Identifying Breaking Changes

When tests fail after a batch:

```bash
# 1. Get list of modified files
git diff --name-only HEAD~1

# 2. Run tests to confirm failure
npm test

# 3. Use git bisect-style approach:
#    - Stash half the changes
#    - Run tests
#    - If pass, the problem is in stashed changes
#    - If fail, problem is in remaining changes
#    - Narrow down to specific file/agent
```

### Revert Strategy

When you identify the breaking agent:

```bash
# 1. Revert only that agent's files
git checkout HEAD~1 -- path/to/broken/file.ts

# 2. Re-run tests to confirm fix
npm test

# 3. Log the failure
```

Then update EXECUTION-STATUS.md:

```markdown
## Failed/Blocked Todos

| Todo ID | Description | Reason | Files Reverted | Action Needed |
|---------|-------------|--------|----------------|---------------|
| 275 | Database indexes | Migration syntax error | prisma/migrations/xxx | Manual review needed |
```

### Agent Conflict Resolution

If two agents modified the same file:

1. Check which agent's changes are more critical (lower todo ID = higher priority)
2. Keep the higher priority agent's changes
3. Log the conflict for the other agent
4. The conflicting todo stays as `-ready-` (not completed)

### If an agent completely fails to execute:
1. Log in EXECUTION-STATUS.md with error message
2. Keep todo as `-ready-`
3. Continue with other agents
4. Do NOT block the batch

### If git push fails:
1. `git pull --rebase origin main`
2. If conflicts: resolve by keeping our changes (we just tested them)
3. `git push origin main`
4. If still fails after 3 attempts, log and continue (push manually later)

### Recovery Commands

```bash
# Undo last agent's changes
git checkout HEAD -- .

# See what changed
git diff --stat

# Reset to last known good state
git reset --hard origin/main

# Cherry-pick specific commits
git cherry-pick <commit-sha>
```

---

## Success Criteria

The execution is complete when:
- [ ] All 28 todos are renamed from `-ready-` to `-complete-`
- [ ] All phases committed and pushed
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] EXECUTION-STATUS.md shows all batches complete

---

## START EXECUTION

Begin now. Read the execution plan and status file, then launch Batch 1.1 with 5 parallel agents.

DO NOT ASK FOR PERMISSION. EXECUTE AUTONOMOUSLY UNTIL ALL PHASES COMPLETE.

**START WITH:**
1. Read `plans/SCHEDULING-ACUITY-PARITY-EXECUTION-PLAN.md`
2. Read `plans/EXECUTION-STATUS.md`
3. Launch Batch 1.1 (todos 273, 274, 275, 276, 284) with 5 parallel Task agents
