# Prisma JSON Type Prevention Strategies - Index

**Created:** 2026-01-02
**Status:** Complete Prevention Strategy Suite
**Impact:** P2 (Medium - prevents runtime JSON errors, data corruption, failed upgrades)

---

## Overview

Comprehensive prevention strategies for Prisma JSON field handling issues. Three documents cover different aspects:

1. **Full prevention guide** — Detailed patterns with examples
2. **Upgrade checklist** — Step-by-step checklist for Prisma version updates
3. **Quick reference** — 2-minute cheat sheet for daily use

---

## Documents Provided

### 1. Full Prevention Strategy Guide

**File:** `/docs/solutions/database-issues/prisma-json-type-prevention-MAIS-20260102.md`
**Read Time:** 20 minutes
**Audience:** Engineers implementing JSON field operations
**Size:** ~6,000 words

**Contains:**

- Problem overview (why JSON type issues occur)
- Pattern 1: JSON field reads (always two-step cast through unknown)
- Pattern 2: JSON field writes (InputJsonValue casting)
- Pattern 3: Null vs undefined (DbNull for explicit NULL)
- Pattern 4: Event sourcing with JSON payloads (validation)
- Pattern 5: Prisma extensions (avoid type extraction)
- Real-world MAIS examples (catalog, sessions, audit)
- Runtime testing patterns
- Common errors and fixes
- Golden rules summary

**Key Takeaway:**

```typescript
// Read: (value as unknown as Type)
// Write: (value as unknown as Prisma.InputJsonValue)
// NULL: Prisma.DbNull
// Validate: Schema.safeParse(value)
```

---

### 2. Pre-Upgrade Checklist

**File:** `/docs/solutions/database-issues/prisma-upgrade-checklist-MAIS-20260102.md`
**Read Time:** 5 minutes (before upgrade), execute in ~45 mins
**Audience:** Engineers performing Prisma version upgrades
**Executable:** Yes (bash commands included)

**Contains:**

- Pre-upgrade prep (document state, run baseline tests)
- Code audit (8 grep patterns to find issues)
- Upgrade execution (3 commands to run)
- Post-upgrade testing (6 test suites to verify)
- Verification report generation
- Emergency rollback procedure
- Success criteria checklist

**How to Use:**

1. Print and pin near desk
2. Follow each checklist item sequentially
3. Run all bash commands in order
4. Generate automated upgrade report
5. Commit with detailed message

**Bash Commands:** 15+ ready-to-run scripts included

---

### 3. Quick Reference Card

**File:** `/docs/solutions/database-issues/prisma-json-quick-reference-MAIS-20260102.md`
**Read Time:** 2 minutes
**Audience:** All engineers
**Printable:** Yes - laminate and keep at desk

**Contains:**

- The 4 critical patterns (with right/wrong examples)
- Decision tree (what to do in each situation)
- Common errors table (error → cause → fix)
- One-liners for copy/paste
- Files to check before commit
- When to ask for help

**Quick Access:**

```
1. Reading JSON? Cast through unknown
2. Writing JSON? Use InputJsonValue
3. Setting NULL? Use Prisma.DbNull
4. From database? Validate with Zod
```

---

## Prevention Patterns at a Glance

### Pattern 1: JSON Field Reads

```typescript
// ✅ CORRECT - Two-step cast
const photos = pkg.photos as unknown as PhotoType[];

// ❌ WRONG - Direct cast
const photos = pkg.photos as PhotoType[];
```

**Why:** TypeScript requires intermediate `unknown` type for incompatible conversions. This catches errors at compile-time.

### Pattern 2: JSON Field Writes

```typescript
// ✅ CORRECT - InputJsonValue with unknown bridge
await prisma.package.update({
  where: { id },
  data: {
    photos: validated as unknown as Prisma.InputJsonValue,
  },
});

// ❌ WRONG - Direct type
data: {
  photos: validated as PhotoType[];
}
```

**Why:** Prisma's JSON input type is `InputJsonValue`. Direct types fail serialization.

### Pattern 3: NULL Handling

```typescript
// ✅ CORRECT - Explicit DbNull for nullable fields
data: {
  draftPhotos: Prisma.DbNull;
}

// ❌ WRONG - Direct null (becomes JSON string "null")
data: {
  draftPhotos: null;
}

// ❌ WRONG - undefined (Prisma ignores it)
data: {
  draftPhotos: undefined;
}
```

**Why:** `DbNull` tells Prisma to set database NULL. Direct `null` may serialize incorrectly.

### Pattern 4: Validation After Reads

```typescript
// ✅ CORRECT - Always validate from database
const parsed = EventSchema.safeParse(event.payload);
if (parsed.success) {
  use(parsed.data);
} else {
  logger.warn({ error: parsed.error }, 'Invalid');
}

// ❌ WRONG - Assume it's valid
const data = event.payload as unknown as EventType;
```

**Why:** Database values could be corrupted, old version, or malformed. Schema validation prevents runtime errors.

### Pattern 5: Prisma Extensions

```typescript
// ✅ CORRECT - Simple type alias
type PrismaExt = PrismaClient;

// ❌ WRONG - Try to extract type (unreliable)
type PrismaExt = ReturnType<typeof createExtended>;
```

**Why:** Extensions maintain interface compatibility. `ReturnType<>` extraction is unreliable.

---

## Real-World MAIS Examples

### Example 1: Package Photos (Catalog)

**File:** `server/src/adapters/prisma/catalog.repository.ts:257`

```typescript
await prisma.package.update({
  where: { id: packageId, tenantId },
  data: {
    photos: data.photos as unknown as Prisma.InputJsonValue,
  },
});
```

### Example 2: Event Payloads (Onboarding)

**File:** `server/src/agent/onboarding/event-sourcing.ts:213`

```typescript
const event = await tx.onboardingEvent.create({
  data: {
    tenantId,
    eventType,
    payload: validationResult.data as Prisma.InputJsonValue,
    version: nextVersion,
  },
});
```

### Example 3: Session Messages (Agent Orchestrator)

**File:** `server/src/agent/orchestrator/base-orchestrator.ts:1284`

```typescript
await prisma.agentSession.update({
  where: { id: sessionId, tenantId },
  data: {
    messages: updatedMessages as unknown as Prisma.InputJsonValue,
  },
});
```

---

## Before Upgrading Prisma

**Must run:** `/docs/solutions/database-issues/prisma-upgrade-checklist-MAIS-20260102.md`

**Quick steps:**

1. Baseline tests (before changes)
2. Audit code (8 grep checks)
3. Upgrade Prisma
4. Regenerate client
5. Run tests (after changes)
6. Generate report

**Time:** 45-60 minutes
**Scripts:** 15+ included and ready to run

---

## Integration with CLAUDE.md

This prevention strategy connects to MAIS project instructions:

**From CLAUDE.md:**

> "Database/client mismatch prevention" → See `database-client-mismatch` solution

**From CLAUDE.md:**

> "When modifying database schema" → Use hybrid migration patterns documented in separate guide

**From CLAUDE.md:**

> "Never modify applied migrations" → Covered in upgrade checklist

---

## When to Use Each Document

| Situation                  | Document                   | Time    |
| -------------------------- | -------------------------- | ------- |
| Learning JSON patterns     | Full Guide                 | 20 min  |
| Before Prisma upgrade      | Checklist                  | 45 min  |
| Quick lookup during coding | Quick Ref                  | 2 min   |
| Print for desk             | Quick Ref                  | Anytime |
| Troubleshooting JSON error | Full Guide → Common Errors | 5 min   |
| Post-upgrade regression    | Checklist → Rollback       | 15 min  |

---

## Testing Against These Patterns

### Automated Checks

```bash
# Find reads without unknown (should be zero)
grep -r "as.*\[\]" server/src --include="*.ts" | grep -v "unknown as"

# Find InputJsonValue usage (verify correct)
grep -r "InputJsonValue" server/src --include="*.ts"

# Find DbNull usage (should be present for nulls)
grep -r "DbNull" server/src --include="*.ts"
```

### Test Examples

**Test JSON round-trip (read/write):**

```typescript
it('should preserve JSON on write/read', async () => {
  const data = [{ url: 'x', size: 100 }];
  await prisma.package.update({
    where: { id },
    data: { photos: data as unknown as Prisma.InputJsonValue },
  });
  const read = await prisma.package.findUnique({ where: { id } });
  const parsed = read.photos as unknown as typeof data;
  expect(parsed).toEqual(data);
});
```

**Test schema validation:**

```typescript
it('should validate event payload', async () => {
  const parsed = EventSchema.safeParse(event.payload);
  expect(parsed.success).toBe(true);
  expect(parsed.data.field).toBeDefined();
});
```

---

## Common Issues Prevented

1. **"Cannot convert undefined to JSON value"**
   - Cause: Assigning `undefined` to JSON field
   - Fix: Don't include field in update, or use empty default

2. **Type mismatch on generic JSON**
   - Cause: Direct cast `as SomeType`
   - Fix: Use `as unknown as SomeType`

3. **Data corruption: JSON field contains "null" string**
   - Cause: Used `null` instead of `Prisma.DbNull`
   - Fix: Use `Prisma.DbNull` for explicit NULL

4. **Failed upgrade: Unknown JSON field type**
   - Cause: Schema changed between versions
   - Fix: Run upgrade checklist for baseline comparison

---

## Success Criteria

Your JSON field handling is solid when:

- [ ] All JSON reads use `(value as unknown as Type)` pattern
- [ ] All JSON writes use `as unknown as Prisma.InputJsonValue`
- [ ] All optional JSON nulls use `Prisma.DbNull`
- [ ] All JSON values from DB validated before use
- [ ] No Prisma extensions try to extract types
- [ ] Pre-upgrade checklist runs successfully
- [ ] Post-upgrade tests pass with zero JSON errors

---

## Quick Links

### Prevention Documents

- **Full Guide:** `prisma-json-type-prevention-MAIS-20260102.md`
- **Upgrade Checklist:** `prisma-upgrade-checklist-MAIS-20260102.md`
- **Quick Reference:** `prisma-json-quick-reference-MAIS-20260102.md`

### Related Strategies

- Schema Drift Prevention: `prisma-hybrid-migration-schema-drift.md`
- Supabase IPv6 Issues: `prisma-db-execute-supabase-migrations-MAIS-20251231.md`
- Migration Execution: `schema-drift-prevention-MAIS-20251204.md`

### MAIS Code Examples

- **Event Sourcing:** `server/src/agent/onboarding/event-sourcing.ts`
- **Catalog Repository:** `server/src/adapters/prisma/catalog.repository.ts`
- **Advisor Memory:** `server/src/adapters/prisma/advisor-memory.repository.ts`
- **Base Orchestrator:** `server/src/agent/orchestrator/base-orchestrator.ts`

### Official References

- [Prisma JSON Documentation](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#json)
- [Prisma Extensions Guide](https://www.prisma.io/docs/orm/prisma-client/client-extensions/overview)
- [Prisma Migration Guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/prototyping-your-schema)

---

## Summary

**Three complementary documents prevent Prisma JSON type issues:**

1. **Learn the patterns** → Full Prevention Guide (20 min read)
2. **Execute upgrades safely** → Upgrade Checklist (45 min execution)
3. **Quick daily reference** → Quick Reference Card (laminate & keep at desk)

**Core rule:** JSON reads through `unknown`, writes as `InputJsonValue`, nulls as `DbNull`, always validate after reads.

**Result:** Zero JSON field runtime errors, successful Prisma upgrades, type-safe database operations.
