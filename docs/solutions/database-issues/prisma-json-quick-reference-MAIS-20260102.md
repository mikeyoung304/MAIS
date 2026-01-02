# Prisma JSON Type Safety - Quick Reference

**Print & Pin:** Yes
**Time to read:** 2 minutes
**Use when:** Working with JSON fields in Prisma

---

## The 4 Patterns

### 1️⃣ Reading JSON Fields

```typescript
// ✅ CORRECT - Always cast through unknown first
const photos = tenant.photos as unknown as PhotoType[];

// ❌ WRONG - Direct cast
const photos = tenant.photos as PhotoType[];
```

**Why:** TypeScript won't let you cast incompatible types directly. Using `unknown` as intermediate enforces two-step safety check.

---

### 2️⃣ Writing JSON Fields

```typescript
// ✅ CORRECT - Use Prisma.InputJsonValue
await prisma.tenant.update({
  where: { id },
  data: {
    photos: validated as unknown as Prisma.InputJsonValue,
  },
});

// ❌ WRONG - Direct type
await prisma.tenant.update({
  where: { id },
  data: { photos: validated as PhotoType[] },
});
```

**Why:** Prisma expects `InputJsonValue` type for JSON field writes. Direct types cause serialization errors.

---

### 3️⃣ Setting NULL on Optional JSON

```typescript
// ✅ CORRECT - Use Prisma.DbNull
await prisma.package.update({
  where: { id },
  data: { draftPhotos: Prisma.DbNull },
});

// ❌ WRONG - Direct null
await prisma.package.update({
  where: { id },
  data: { draftPhotos: null },
});

// ❌ WRONG - undefined
await prisma.package.update({
  where: { id },
  data: { draftPhotos: undefined }, // Prisma ignores this
});
```

**Why:** `Prisma.DbNull` explicitly sets database NULL. Direct `null` may be serialized as JSON string `"null"`. `undefined` tells Prisma to skip the field.

---

### 4️⃣ Validating JSON After Read

```typescript
// ✅ CORRECT - Always validate with Zod
const parsed = EventSchema.safeParse(event.payload);
if (parsed.success) {
  const data = parsed.data; // Now safe to use
} else {
  logger.warn({ error: parsed.error }, 'Invalid event');
}

// ❌ WRONG - Assume it's valid
const data = event.payload as unknown as EventType; // Unvalidated!
```

**Why:** JSON from database could be corrupted, old version, or malformed. Schema validation catches these before use.

---

## Decision Tree

```
Working with a JSON field?
│
├─ Reading it? → Cast: (value as unknown as TargetType)
│
├─ Writing to it? → Use: (value as unknown as Prisma.InputJsonValue)
│
├─ Setting to NULL (optional field only)?
│  └─ Use: Prisma.DbNull
│
└─ Received from database?
   └─ Validate: Schema.safeParse(value)
```

---

## Common Errors & Fixes

| Error                               | Cause                                         | Fix                                   |
| ----------------------------------- | --------------------------------------------- | ------------------------------------- |
| "Cannot assign type X to type Y"    | Direct incompatible cast                      | Add `as unknown` in middle            |
| "Cannot convert undefined to JSON"  | Assigning `undefined` to JSON field           | Skip field or use empty default       |
| JSON field contains `"null"` string | Used direct `null` instead of `Prisma.DbNull` | Use `Prisma.DbNull` for explicit NULL |
| Type error after Prisma upgrade     | Schema changed but casts didn't update        | Re-run type check, verify casts       |
| Data lost in JSON field             | Overwrite without validation                  | Always validate + preserve existing   |

---

## One-Liners

```typescript
// Read
const item = db.field as unknown as Type;

// Write
data: {
  field: value as unknown as Prisma.InputJsonValue;
}

// NULL
data: {
  field: Prisma.DbNull;
}

// Validate
const ok = Schema.safeParse(value);
if (!ok.success) return; // Error!
```

---

## Files to Check Before Commit

```bash
# Find all JSON casts (should all use unknown)
grep -r "as.*\[\]" src --include="*.ts" | grep -v "unknown as"

# Find JSON writes (should use InputJsonValue)
grep -r "data: {" src --include="*.ts" | grep -i json

# Find null assignments (should use DbNull)
grep -r ":\s*null[,}]" src --include="*.ts" | grep -i "data:\|update"
```

---

## When to Ask for Help

- ❓ "Should I validate this JSON?" → YES, always
- ❓ "Can I assign `null` directly?" → NO, use `Prisma.DbNull`
- ❓ "Is this cast safe?" → Only if it's `as unknown as Type`
- ❓ "Did the upgrade break JSON?" → Check the [full guide](./prisma-json-type-prevention-MAIS-20260102.md)

---

## Links

- **Full Guide:** `docs/solutions/database-issues/prisma-json-type-prevention-MAIS-20260102.md`
- **Upgrade Checklist:** `docs/solutions/database-issues/prisma-upgrade-checklist-MAIS-20260102.md`
- **MAIS Examples:** Search codebase for `as unknown as Prisma.InputJsonValue`
