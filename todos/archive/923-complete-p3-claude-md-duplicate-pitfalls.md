# 923 - CLAUDE.md Duplicate Pitfalls (22/64, 62/70)

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-philosopher)
**File:** `CLAUDE.md`

## Problem

Two sets of duplicate/overlapping pitfalls:

1. **Pitfall 22** and **Pitfall 64** both cover "UUID validation on CUID fields"
   - 22: "UUID validation on CUID fields (use `z.string()` not `z.string().uuid()`)"
   - 64: "UUID validation on CUID fields - MAIS uses CUIDs not UUIDs; use `z.string().min(1)` instead..."

2. **Pitfall 62** and **Pitfall 70** both cover "Zod safeParse in agent tools"
   - 62: "Type assertion without validation...use Zod `safeParse()` as FIRST LINE"
   - 70: "Missing Zod safeParse in agent tools...MUST call `schema.safeParse(params)` as FIRST LINE"

## Fix

Merge each duplicate pair into the more detailed version and retire the shorter one.
