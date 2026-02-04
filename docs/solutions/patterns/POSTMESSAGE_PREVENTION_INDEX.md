# Dead PostMessage Handler Prevention - Complete Index

**Master reference for all PostMessage prevention documentation.**

Issue: #821 (Dead PostMessage Types in Build Mode Protocol)
Status: Prevention strategy complete
Last Updated: 2026-02-04

---

## Quick Navigation

### I Have 3 Minutes

Read this first:

- **[POSTMESSAGE_QUICK_REFERENCE.md](POSTMESSAGE_QUICK_REFERENCE.md)** - 3 commands to memorize, common pitfalls, testing pattern

### I Have 10 Minutes

Start here before implementing:

- **[POSTMESSAGE_AUDIT_CHECKLIST.md](POSTMESSAGE_AUDIT_CHECKLIST.md)** - Step-by-step checklist for adding new code
- **[POSTMESSAGE_MESSAGE_REGISTRY.md](POSTMESSAGE_MESSAGE_REGISTRY.md)** - Central registry of all current message types

### I Have 20 Minutes

Understanding the full strategy:

- **[DEAD_POSTMESSAGE_HANDLER_PREVENTION.md](DEAD_POSTMESSAGE_HANDLER_PREVENTION.md)** - Complete prevention strategy with examples
- **[POSTMESSAGE_PREVENTION_SUMMARY.md](POSTMESSAGE_PREVENTION_SUMMARY.md)** - Implementation plan and getting started guide

### I'm a Tool Developer

Automating the prevention:

- **[POSTMESSAGE_ESLINT_RULES.md](POSTMESSAGE_ESLINT_RULES.md)** - ESLint rules to catch violations automatically

---

## Document Overview

### 1. POSTMESSAGE_QUICK_REFERENCE.md

**For:** Anyone adding PostMessage code
**Length:** 5 minutes
**Contains:**

- The problem in 10 seconds
- 3-minute verification checklist (3 commands)
- Sender/handler pair pattern
- Security checklist
- Common pitfalls quick table
- Registry pattern
- Testing pattern
- Yearly audit script

**Key Takeaway:** Remember these 3 commands and you're 90% of the way there.

### 2. POSTMESSAGE_AUDIT_CHECKLIST.md

**For:** Code reviewers and engineers implementing new message types
**Length:** 15-20 minutes (reference during implementation)
**Contains:**

- Adding a new protocol (5 phases with checkboxes)
- Auditing existing code (quick scan + deep audit)
- Fixing dead code (3 options with steps)
- Quarterly audit runbook
- Printable one-pager
- Troubleshooting guide

**Key Takeaway:** Tape the printable one-pager to your monitor.

### 3. DEAD_POSTMESSAGE_HANDLER_PREVENTION.md

**For:** Tech leads, architects, anyone designing PostMessage protocols
**Length:** 20-30 minutes
**Contains:**

- Root causes analysis (why it happens)
- Prevention checklist (before/during/after)
- Grep patterns for auditing (5 patterns)
- ESLint rules template (conceptual)
- Best practices (4 core patterns)
- Deprecation process
- Message registry template
- Quarterly audit checklist
- Proposed CLAUDE.md pitfall

**Key Takeaway:** Understand the "why" behind each prevention rule.

### 4. POSTMESSAGE_MESSAGE_REGISTRY.md

**For:** Central source of truth
**Length:** 10 minutes
**Contains:**

- Registry of all Build Mode messages (definition, handler, sender, status)
- Registry of all Service Worker messages
- Audit results (7 active, 1 deprecated, 0 dead)
- Addition workflow (how to add new messages)
- Query examples
- Security checklist status
- Historical changes

**Key Takeaway:** This is the single source of truth. Check here when unsure about a message type.

### 5. POSTMESSAGE_PREVENTION_SUMMARY.md

**For:** Team leads, project managers, onboarding
**Length:** 10-15 minutes
**Contains:**

- Problem statement (30 seconds)
- Solution overview (3 parts)
- Implementation plan (immediate, short-term, long-term)
- Documentation file reference table
- The 3 critical commands (with explanation)
- What happens if you skip prevention
- How to add to CLAUDE.md
- Testing strategy
- FAQ
- Metrics & success criteria
- Getting started checklist

**Key Takeaway:** This tells managers what needs to be done and why.

### 6. POSTMESSAGE_ESLINT_RULES.md

**For:** Tool developers, engineers interested in automation
**Length:** 15 minutes (reference during implementation)
**Contains:**

- Why ESLint rules (cost/benefit)
- Rule 1: Require handler for every message type
- Rule 2: Require origin validation
- Rule 3: Detect deprecated types
- Rule 4: Enforce Zod validation
- Rule 5: Warn on unvalidated data access
- Configuration template
- Installation instructions (4 steps)
- Expected results before/after
- Testing the rules
- Performance notes
- Maintenance guide
- Roadmap (3 phases)

**Key Takeaway:** These are optional but highly recommended for catching issues at development time.

---

## The 3 Critical Commands (Memorize These)

### Command 1: List all defined message types

```bash
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | grep -o "'[^']*'"
```

**Purpose:** See what message types exist
**Output:** List of type names like `BUILD_MODE_INIT`, `BUILD_MODE_CONFIG_UPDATE`

### Command 2: Verify sender exists for a type

```bash
MSG_TYPE="BUILD_MODE_INIT"
git grep "$MSG_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"
# Should return ≥1 result showing postMessage call
```

**Purpose:** Find where a message is sent
**Output:** Line(s) showing `iframe.postMessage({type: MESSAGE_TYPE, ...})`

### Command 3: Verify handler exists for a type

```bash
MSG_TYPE="BUILD_MODE_INIT"
grep -r "case '$MSG_TYPE'" apps/web/src --include="*.ts" --include="*.tsx"
# Should return ≥1 result showing handler case statement
```

**Purpose:** Find where a message is handled
**Output:** Line(s) showing `case 'MESSAGE_TYPE': ...`

---

## Implementation Timeline

### Week 1: Read & Plan

- [ ] Read Quick Reference (5 min)
- [ ] Read Audit Checklist (10 min)
- [ ] Read Prevention Summary (10 min)
- [ ] Share quick reference with team (Slack)
- [ ] Memorize 3 critical commands

### Week 2: Add to CLAUDE.md

- [ ] Add Pitfall #97 to `/CLAUDE.md`
- [ ] Link to prevention docs
- [ ] Create code review checklist comment

### Week 3: First Code Review

- [ ] Use checklist on first PostMessage PR
- [ ] Run the 3 commands in review
- [ ] Leave template comment: "PostMessage audit: ✓ definition, ✓ sender, ✓ handler"

### Week 4+: Ongoing

- [ ] Use checklist on all PostMessage code
- [ ] Run quarterly audits (1st of each quarter)
- [ ] Update registry when new messages added

### Sprint 3 (Optional): Add ESLint Rules

- [ ] Implement Rules 1-2 (most impactful)
- [ ] Enable in CI
- [ ] Catch dead code at development time

---

## Prevention Rules Summary

### Before Adding PostMessage Code

1. **Got product sign-off?** Document why the message is needed
2. **Chose naming?** Use `PROTOCOL_FEATURE_ACTION` format
3. **Design both directions?** Parent → Child AND Child → Parent

### During Implementation

1. **Define schema first** - Create Zod schema in protocol.ts
2. **Add sender and handler in same commit** - Never split across commits
3. **Add security checks** - Origin validation + Zod safeParse
4. **Add tests** - Round-trip tests verifying send → handle → verify
5. **Add logging** - Debug failed sends/receives

### Code Review

1. **Run the 3 commands** - Verify definition, sender, handler all exist
2. **Check security** - Origin check first, Zod validation second
3. **Check tests** - Round-trip test must exist
4. **Use the checklist** - Don't approve until all items checked

### After Merge

1. **Update registry** - Add row to POSTMESSAGE_MESSAGE_REGISTRY.md
2. **Update PR notes** - List which messages were added
3. **Monitor quarterly** - First Monday of each quarter, audit for dead code

---

## Common Scenarios

### Scenario 1: Adding a New Message Type

**Follow these docs in order:**

1. POSTMESSAGE_QUICK_REFERENCE.md - Understand the pattern
2. POSTMESSAGE_AUDIT_CHECKLIST.md - Phase 1-5 checklist
3. DEAD_POSTMESSAGE_HANDLER_PREVENTION.md - Understand best practices
4. Run the 3 critical commands during review

### Scenario 2: Code Review with PostMessage Changes

**Follow this workflow:**

1. Open POSTMESSAGE_QUICK_REFERENCE.md
2. Run the 3 commands to verify sender/handler exist
3. Check security: origin validation + Zod safeParse
4. Verify tests include round-trip scenario
5. Leave comment: "PostMessage audit passed: ✓ definition, ✓ sender, ✓ handler, ✓ security"

### Scenario 3: Found Potentially Dead Message Type

**Follow this workflow:**

1. Run command 2 to verify sender exists
2. If no sender found, you found dead code
3. Follow "Option A: Delete" or "Option B: Mark Planned" from POSTMESSAGE_AUDIT_CHECKLIST.md
4. Update POSTMESSAGE_MESSAGE_REGISTRY.md status
5. Create PR with dead code removal

### Scenario 4: Quarterly Audit

**Time:** ~30 minutes, first Monday of quarter
**Follow this workflow:**

1. Read "Quarterly Audit Runbook" in POSTMESSAGE_AUDIT_CHECKLIST.md
2. Run automated script (or run 3 commands manually)
3. Record results
4. If dead code found, follow Scenario 3
5. Commit results: `git commit -m "docs: Q1 2026 PostMessage audit - 0 dead types found"`

---

## File Cross-References

### If You're Implementing (Active Development)

```
POSTMESSAGE_QUICK_REFERENCE.md        ← Start here (3 min)
    ↓
POSTMESSAGE_AUDIT_CHECKLIST.md        ← Follow step-by-step (bookmark it)
    ↓
DEAD_POSTMESSAGE_HANDLER_PREVENTION.md ← Reference during implementation
    ↓
POSTMESSAGE_MESSAGE_REGISTRY.md       ← Update after merge
```

### If You're Reviewing (Code Review)

```
POSTMESSAGE_QUICK_REFERENCE.md        ← Remember the 3 commands
    ↓
Run the 3 commands (copy from there)
    ↓
POSTMESSAGE_AUDIT_CHECKLIST.md        ← Phase 3: Validation section
    ↓
Approve or request changes
```

### If You're Onboarding (New Engineer)

```
POSTMESSAGE_PREVENTION_SUMMARY.md     ← Understand "why" (10 min)
    ↓
POSTMESSAGE_QUICK_REFERENCE.md        ← Learn "what" (3 min)
    ↓
POSTMESSAGE_MESSAGE_REGISTRY.md       ← See current state (5 min)
    ↓
Ready to code - use checklist when needed
```

### If You're Designing Tools (ESLint)

```
POSTMESSAGE_ESLINT_RULES.md           ← All 5 rules explained
    ↓
DEAD_POSTMESSAGE_HANDLER_PREVENTION.md ← Why each rule matters
    ↓
POSTMESSAGE_QUICK_REFERENCE.md        ← What the rules should catch
```

---

## Metrics & Success

### Measure These

- **Code review time** - Should decrease as grep becomes automatic
- **Dead code per quarter** - Should trend toward 0
- **Test coverage** - All messages should have round-trip tests
- **Team knowledge** - % of engineers who can name the 3 parts

### Target State (3 Months)

| Metric                                    | Target |
| ----------------------------------------- | ------ |
| Dead code found per audit                 | 0-2    |
| Code review time for PostMessage PR       | <5 min |
| Test coverage for messages                | 90%+   |
| Engineers who can recite prevention rules | 80%+   |

---

## Related Resources

### MAIS Codebase

- **Issue:** `/todos/archive/821-complete-p2-dead-postmessage-types.md`
- **Protocol:** `apps/web/src/lib/build-mode/protocol.ts`
- **Handlers:** `apps/web/src/hooks/useBuildModeSync.ts`
- **Senders:** `apps/web/src/components/preview/PreviewPanel.tsx`
- **CLAUDE.md:** Add Pitfall #97 here

### External References

- ESLint Plugin Development: https://eslint.org/docs/extend/plugins
- Zod Documentation: https://zod.dev
- PostMessage Security: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

---

## FAQ

**Q: Which document should I read first?**
A: If you have 3 min → Quick Reference. If you have 20 min → Prevention Summary. If you have time → All of them in order.

**Q: Can I just memorize the 3 commands?**
A: Yes! That gets you 90% of the way. Understanding the "why" behind rules makes you more effective during design.

**Q: What's the minimum viable set of documents to print?**
A: Print the one-pager from POSTMESSAGE_QUICK_REFERENCE.md and POSTMESSAGE_AUDIT_CHECKLIST.md.

**Q: When should I implement ESLint rules?**
A: Optional. Start with manual prevention (3 commands). Add ESLint in Sprint 3 if team wants automation.

**Q: How do I know if I did it right?**
A: The 3 commands all return results, security checks exist, tests pass, and registry is updated.

---

## Document Maintenance

**Owner:** @engineering-team (anyone)
**Update Trigger:**

- When new message type added (update registry)
- When dead code found (update examples)
- Quarterly audit results (update registry)

**Review Cycle:** Quarterly (first Monday of quarter)

**Last Audit:** 2026-02-04

---

## Getting Help

- **"How do I add a message?"** → POSTMESSAGE_AUDIT_CHECKLIST.md (Phase 1-5)
- **"What message types exist?"** → POSTMESSAGE_MESSAGE_REGISTRY.md
- **"What's the pattern?"** → POSTMESSAGE_QUICK_REFERENCE.md (Sender/Handler Pair Pattern)
- **"Why is this important?"** → DEAD_POSTMESSAGE_HANDLER_PREVENTION.md (Root Causes section)
- **"How do I fix dead code?"** → POSTMESSAGE_AUDIT_CHECKLIST.md (Fixing Dead Code section)
- **"Can we automate this?"** → POSTMESSAGE_ESLINT_RULES.md

---

**Version:** 1.0 | **Status:** Complete | **Last Updated:** 2026-02-04
