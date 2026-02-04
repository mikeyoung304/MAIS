# Code Review Todo Resolution - Solution Extraction

## February 4, 2026

**Session Summary:** 3 code review todos resolved with 2 reusable patterns extracted

---

## Resolutions Overview

| Todo  | Issue                               | Resolution                                                 | Pattern Value                                  |
| ----- | ----------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| #821  | Dead PostMessage Types (Build Mode) | Removed 5 unused message types, reduced protocol.ts by 32% | **HIGH** - Bidirectional protocol verification |
| #823  | OnboardingEvent Table Never Used    | Safe drop with production data verification                | **HIGH** - Schema deprecation pattern          |
| Other | General code cleanup                | Complete                                                   | N/A                                            |

---

## Solution #1: Dead PostMessage Type Detection

**File:** `/docs/solutions/code-review-patterns/DEAD_POSTMESSAGE_DETECTION_PATTERN.md`

### The Pattern

When message-passing systems have handlers but no senders, handlers mask the deadness. Detection requires **bidirectional verification**:

```
For each message type:
  ✓ Type defined in protocol.ts?
  ✓ Type SENT anywhere (postMessage calls)?     ← Key: many miss this direction
  ✓ Handler exists in receiver?

  If any direction is missing → DEAD CODE
```

### Dead Types Found

```
BUILD_MODE_HIGHLIGHT_SECTION        ✓ defined  ✗ sent  ✓ handler → DEAD
BUILD_MODE_SECTION_UPDATE           ✓ defined  ✗ sent  ✓ handler → DEAD
BUILD_MODE_PUBLISH_NOTIFICATION     ✓ defined  ✗ sent  ✓ handler → DEAD
BUILD_MODE_SECTION_EDIT             ✓ defined  ✗ sent  ✓ handler → DEAD
BUILD_MODE_SECTION_RENDERED         ✓ defined  ✗ sent  ✓ handler → DEAD
```

### Investigation Commands

```bash
# 1. List all type definitions
grep -n "readonly type:" server/src/lib/build-mode/protocol.ts

# 2. For each type, verify it's SENT
grep -r "postMessage.*BUILD_MODE_HIGHLIGHT_SECTION" server/ apps/web/ --include="*.ts"
# Result: empty (not sent anywhere)

# 3. Confirm handler exists
grep -n "case \"BUILD_MODE_HIGHLIGHT_SECTION\"" apps/web/src/hooks/useBuildModeSync.ts
# Result: handler found (but never receives this type)

# 4. CONCLUSION: DEAD (defined + handler but never sent)
```

### Remediation

1. **Remove from union** - `BuildModeMessage` type (5 entries deleted)
2. **Delete schema definitions** - Each dead type's Zod schema
3. **Remove case statements** - Handler switch blocks for dead types
4. **Verify exhaustion** - TypeScript's discriminated union will error if you missed one

### Metrics

```
protocol.ts:       260 → 177 lines (-32%)
useBuildModeSync:  489 → 270 lines (-45%)
Total:             +302 lines of dead code removed
```

### When to Apply

- After refactoring message protocols
- Cleaning up deprecated agents/features
- Code review of any `postMessage` or event system
- Before shipping new PostMessage-based features

---

## Solution #2: Schema Deprecation & Safe Table Drop

**File:** `/docs/solutions/database-issues/SCHEMA_DEPRECATION_SAFE_DROP_PATTERN.md`

### The Pattern

Safe table drops require **three-layer verification**:

```
Layer 1: Code Search      → Verify zero code references
Layer 2: Data Verification → Confirm zero rows in production
Layer 3: Dependency Check  → Keep enums if used elsewhere
```

### Investigation Steps

**Step 1: Code Search**

```bash
grep -r "onboardingEvent\|OnboardingEvent" server/src/ apps/web/src/ \
  --include="*.ts" | grep -v "OnboardingPhase"
# Result: Only in schema.prisma and migrations (zero application code)
```

**Step 2: Identify Dependencies**

```bash
grep -r "OnboardingPhase" server/src/ apps/web/src/ --include="*.ts"
# Result: Used by agent system (keep enum, drop table)
```

**Step 3: Production Data Verification**

```sql
-- Run in Supabase SQL Editor (MAIS uses Supabase, not Render)
SELECT COUNT(*) as row_count FROM "OnboardingEvent";
-- Result: 0 rows → safe to drop
```

**Why this matters:** You cannot run destructive migrations on production without verifying the data will not be lost.

### Migration Creation

```bash
npx prisma migrate dev --create-only --name drop_onboarding_event_table
```

Generated migration:

```sql
-- Verified 0 rows in production
-- Enum OnboardingPhase retained for agent system prompts
DROP TABLE IF EXISTS "OnboardingEvent";
```

**Key safety features:**

- `DROP TABLE IF EXISTS` - Idempotent (safe for retries)
- `IF EXISTS` - Doesn't fail if table already gone
- Documented verification in comment
- Forward-only (no paired rollback files)

### Common Mistakes to Avoid

#### ❌ Mistake #1: Paired Rollback Files

```bash
# WRONG - Anti-pattern
16_drop_table.sql          # Drops table (first)
16_drop_table_rollback.sql # Recreates table (alphabetically after)
# Result: Schema drift - production lacks table, dev has it
```

**Why:** Migrations run alphabetically. Both files have same timestamp. The "rollback" runs AFTER the drop, undoing it.

**Solution:** Forward-only migrations. To undo, create a NEW migration.

#### ❌ Mistake #2: Not Verifying Production Data

Always check row count before writing DROP statement.

#### ❌ Mistake #3: Dropping Unused Enums

Keep `OnboardingPhase` enum even though table is dropped, because agents still reference it:

```typescript
// Keep enum - used by agents
enum OnboardingPhase {
  DISCOVERY
  PLANNING
  SETUP
  LAUNCH
}

// Delete model - not used by application
// model OnboardingEvent { ... }
```

### Metrics

```
Schema changes:  1 model deleted + 1 enum retained
Migration count: +1 forward-only migration
Lines in schema: ~20 line reduction
```

### Database Access Patterns

MAIS uses Supabase (verify first!):

| Approach            | Status     | Notes               |
| ------------------- | ---------- | ------------------- |
| Supabase SQL Editor | ✓ Works    | Manual but reliable |
| Supabase CLI        | ✗ Limited  | Interactive only    |
| Render MCP          | ✗ Wrong DB | MAIS ≠ Render       |

Always verify your database provider before attempting queries.

---

## Key Takeaways

### Pattern #1: Dead Message Detection

**Mental model:** Both sides of protocol must exist

- Missing send side → dead type (even with handler)
- Missing receive side → never called (even if sent)
- Use grep matrix to verify systematically

**Prevention:** Add this check to PR review guidelines for postMessage/event systems

### Pattern #2: Safe Schema Cleanup

**Mental model:** Three layers before drop

1. Code references (grep all)
2. Production data (verify row count)
3. Dependencies (keep partial schema if needed)

**Prevention:** Audit schema quarterly for dead tables

---

## How to Use These Solutions

### In Your Code

When encountering dead code or deprecated database tables:

1. **Dead code detection** → Follow DEAD_POSTMESSAGE_DETECTION_PATTERN.md
   - Creates grep commands for your specific types
   - Builds exhaustive matrix
   - Finds masked dead code (handlers without sends)

2. **Schema cleanup** → Follow SCHEMA_DEPRECATION_SAFE_DROP_PATTERN.md
   - Verify code doesn't use table
   - Check production data safely
   - Create forward-only migration
   - Test locally before committing

### Finding These Solutions Later

```bash
# Quick search
grep -r "dead.*message\|postMessage" docs/solutions/

# Full pattern
grep -r "bidirectional.*protocol" docs/solutions/

# Schema drop pattern
grep -r "safe.*drop\|schema.*deprecation" docs/solutions/
```

### Automation

Both patterns include example shell scripts for automated detection. See:

- DEAD_POSTMESSAGE_DETECTION_PATTERN.md - `check-dead-messages.sh`
- SCHEMA_DEPRECATION_SAFE_DROP_PATTERN.md - `verify-table-drop-safety.sh`

---

## Cross-References

### Related Pitfalls (from CLAUDE.md)

- **#92** (Code path drift) - Similar pattern: duplicate implementations
- **#59** (Migration rollback) - Opposite case: forward-only migrations required
- **#87** (Orphan imports) - Clean build required after deletions
- **#71** (Over-engineering) - Check before custom implementation

### Related Solutions

- `docs/solutions/PREVENTION_STRATEGIES_INDEX.md` - Master index
- `docs/solutions/code-review-patterns/` - Other detection patterns
- `docs/solutions/database-issues/` - Migration patterns

---

## Session Metadata

| Attribute          | Value                      |
| ------------------ | -------------------------- |
| Date               | 2026-02-04                 |
| Duration           | Code review session        |
| Todos Resolved     | 3                          |
| Patterns Extracted | 2                          |
| Lines Removed      | 302+                       |
| Type Safety        | 100% (no TypeScript drift) |
| Production Impact  | Safe (0 row drop)          |
