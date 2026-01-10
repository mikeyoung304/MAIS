# Dual Draft System - Quick Reference

**Print this and pin it! (2 min read)**

---

## The Bug Pattern

```
AI writes → Draft column ✓
AI publishes → Live column (wrong format) ✓
Public API reads → Expects {published: config} ✗
Result: "Published!" but storefront empty
```

---

## 3 Prevention Rules

### 1. Schema Validation: Match ID Format

```typescript
// What generates the ID?
Prisma @default(cuid()) → z.string() or z.string().cuid()
Prisma @default(uuid()) → z.string().uuid()
External system        → z.string() (safest)

// WRONG
id: z.string().uuid()  // ❌ Fails on Prisma CUIDs

// CORRECT
id: z.string()         // ✅ Accepts any format
```

### 2. Multi-Path Data: Verify Format Matches

Before writing shared data, ask:

1. "What code reads this data?"
2. "Is my format what the reader expects?"
3. "Are there other write paths? Same format?"

```typescript
// WRONG: Direct copy
landingPageConfig: tenant.landingPageConfigDraft

// CORRECT: Match expected format
landingPageConfig: {
  published: tenant.landingPageConfigDraft,  // ← Reader expects this
  publishedAt: new Date().toISOString(),
}
```

### 3. AI Communication: Include State Guidance

```typescript
return {
  data: {
    content: pages,
    hasDraft: true, // ← State indicator (REQUIRED)
    note: 'DRAFT content. Say "In your draft..." - NOT live yet.',
  },
};
```

Tool description must include:

```
COMMUNICATION RULES:
- If hasDraft=true: Say "In your draft..."
- If hasDraft=false: Say "On your storefront..."
- NEVER say "live" when hasDraft=true
```

---

## Warning Signs

- JSON field written in multiple places
- "Works in AI" but "broken in public API"
- Schema validation passes but data empty
- AI says "published" but nothing changed

---

## Code Review Questions

| Area       | Question                                          |
| ---------- | ------------------------------------------------- |
| Schema     | What generates this ID? Does validation match?    |
| Multi-path | What reads this? Is format compatible?            |
| AI tools   | Does response include state + communication note? |

---

## Decision Tree: ID Validation

```
Need ID validation?
├── Prisma generates it?
│   ├── Yes → z.string() (or z.string().cuid())
│   └── No → Check generator
├── UUID explicitly set?
│   └── Yes → z.string().uuid()
├── Custom prefix (pk_*)?
│   └── Yes → z.string().startsWith('pk_')
└── Unknown?
    └── z.string() (permissive)
```

---

**Full documentation:** `DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
**Related:** #697, #699
