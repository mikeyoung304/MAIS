---
title: API Contract & Frontend-Backend Integration - Quick Reference
category: quick-reference
component: integration
severity: P1
tags: [cheat-sheet, api-contracts, transformation, validation]
created: 2026-02-05
related:
  - API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md
  - ZOD_PARAMETER_VALIDATION_PREVENTION.md
  - PREVENTION-QUICK-REFERENCE.md
---

# API Contract & Frontend-Backend Integration - Quick Reference

**Print this and pin it to your wall!**

---

## The 3 Bug Patterns (Memorize These)

### 1. Auth Mechanism Mismatch

```typescript
// ❌ WRONG - Frontend and backend disagree
// Frontend sends: headers: { Authorization: `Bearer ${token}` }
// Backend expects: req.query.token

// ✅ CORRECT - Contract specifies, both sides follow
// Contract: query: z.object({ token: z.string() })
// Frontend: fetch(`/api/preview?token=${token}`)
// Backend: const token = req.query.token
```

### 2. Null Defeats Array Defaults

```typescript
// ❌ WRONG - Transformation returns null
function transform(content) {
  if (!content) return null; // React defaults don't apply!
  return { packages: content.packages?.map(...) };
}

// ✅ CORRECT - Always return safe arrays
function transform(content) {
  if (!content) return { packages: [] }; // Safe default
  return { packages: content.packages?.map(...) ?? [] };
}
```

### 3. Type Assertion Without Validation

```typescript
// ❌ WRONG - Assumes API response shape
const data = (await response.json()) as { pages: Page[] };
return { pages: data.pages }; // Crashes if API changed!

// ✅ CORRECT - Validate with Zod
const json = await response.json();
const result = ResponseSchema.safeParse(json);
if (!result.success) {
  logger.error({ expected: ResponseSchema, received: json });
  return { success: false, error: 'Invalid response' };
}
return { success: true, data: result.data };
```

---

## Quick Decision Trees

### Should I validate this with Zod?

```
Is data crossing a trust boundary?
├── API request/response → YES, always validate
├── User input → YES, always validate
├── JSON from database → YES, always validate
├── LLM tool params → YES, always validate (Pitfall #56)
├── External API response → YES, always validate (Pitfall #43)
└── Internal function call → Maybe (TypeScript may be enough)
```

### Should my transformation return null?

```
Is it an array field?
├── YES → NEVER return null, return [] instead
└── NO (object/string/number)
    ├── Required field? → Return safe default, not null
    └── Optional field? → OK to return undefined (NOT null)
```

### Where does the auth token go?

```
Check the contract definition
├── Contract says "query param" → fetch(`/api?token=${t}`)
├── Contract says "header" → headers: { Authorization: `Bearer ${t}` }
└── Contract unclear? → ADD TO CONTRACT, then test both sides
```

---

## Before Committing ANY Integration Code

### Contract Checklist (30 seconds)

- [ ] Method, path, query, body, responses all defined
- [ ] Auth mechanism documented in contract summary
- [ ] Field names use camelCase (no snake_case)
- [ ] Array fields are `z.array()`, not `.nullable()`
- [ ] Contract test verifies both sides

### Transformation Checklist (30 seconds)

- [ ] Null input returns safe defaults
- [ ] Array fields return `[]`, never `null` or `undefined`
- [ ] Test covers `transformFn(null)` → safe output
- [ ] No `return null` for required fields

### Agent Tool API Call Checklist (60 seconds)

- [ ] Input params validated with `ParamsSchema.safeParse()` (Pitfall #56)
- [ ] Response validated with `ResponseSchema.safeParse()`
- [ ] Validation failures logged with expected vs received
- [ ] No type assertions (`as`) on params or responses
- [ ] Test covers API shape change → validation fails gracefully

---

## Self-Review Grep Commands (60 seconds)

```bash
# 1. Contract violations (frontend using raw fetch)
rg "fetch\(" apps/web/src/ --type ts | grep -v "apiClient"

# 2. Unsafe transformations (returning null for arrays)
rg "return null" server/src/services/ --type ts | grep -E "transform|toViewModel"

# 3. Missing response validation (type assertions in agent tools)
rg "await.*\.json\(\) as" server/src/agent-v2/ --type ts

# 4. Null-defeating defaults (optional chaining without fallback)
rg "\?\\.map\(" server/src/ --type ts | grep -v "?? \[\]"
```

If ANY of these return results → **FIX BEFORE COMMITTING**

---

## Code Review Red Flags

| Red Flag                          | Problem                | Fix                        |
| --------------------------------- | ---------------------- | -------------------------- |
| `fetch(` without `apiClient`      | Contract violation     | Use contract client        |
| `return null` in transform        | Defeats React defaults | Return safe default        |
| `as { pages: ... }` in tool       | No validation          | Use Zod safeParse          |
| `?.map(...)` without `?? []`      | May return undefined   | Add fallback               |
| Auth in header but query expected | Contract mismatch      | Check contract             |
| `packages?: null` in type         | Null defeats defaults  | Use `packages?: Package[]` |

---

## Common Fixes (Copy-Paste Ready)

### Fix: Auth Header → Query Param

```typescript
// Before
fetch(`/api/preview?slug=${slug}`, {
  headers: { Authorization: `Bearer ${token}` },
});

// After
fetch(`/api/preview?slug=${slug}&token=${token}`);
```

### Fix: Transformation Returns Null

```typescript
// Before
function transform(content: SectionContent | null) {
  if (!content) return null;
  return { packages: content.packages?.map(...) };
}

// After
function transform(content: SectionContent | null) {
  if (!content) return { packages: [] }; // Safe default
  return { packages: content.packages?.map(...) ?? [] };
}
```

### Fix: Type Assertion → Zod Validation

```typescript
// Before
const data = (await response.json()) as MyType;
return { items: data.items };

// After
const json = await response.json();
const result = MyTypeSchema.safeParse(json);
if (!result.success) {
  logger.error({ expected: MyTypeSchema, received: json });
  return { success: false, error: 'Invalid response' };
}
return { success: true, items: result.data.items };
```

### Fix: Optional Chaining Without Fallback

```typescript
// Before
packages: content.packages?.map(transform); // May return undefined!

// After
packages: content.packages?.map(transform) ?? []; // Always array
```

---

## Integration Points

### Pitfall #56: Zod Parameter Validation

- **#56 covers:** Inbound validation (tool params, API requests)
- **This guide covers:** Outbound validation (API responses, transformations)
- **Use together:** Validate params on input, responses on output

### Pitfall #43: Tools Return Instructions

- **#43:** Tools must return data, not instructions
- **This guide:** Validate that data with Zod, don't assume shape

### Pitfall #47: ADK FunctionTool API

- **#47:** Use `parameters`/`execute` not `inputSchema`/`func`
- **This guide:** Validate response inside `execute()` function

---

## Test Patterns (Minimal Examples)

### Contract Test (30 lines)

```typescript
it('accepts token via query param as per contract', async () => {
  const response = await apiClient.preview.getPreview({
    query: { slug: 'test', token: generateTestToken() },
  });
  expect(response.status).toBe(200);
});
```

### Transformation Test (20 lines)

```typescript
it('returns safe defaults when input is null', () => {
  const result = transformContentForSection(null);
  expect(result.packages).toEqual([]); // Not undefined or null
  expect(result.features).toEqual([]);
});
```

### Response Validation Test (25 lines)

```typescript
it('validates API response shape', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ wrongShape: true }));

  const result = await tool.execute(context, validParams);

  expect(result.success).toBe(false);
  expect(result.error).toContain('validation failed');
});
```

---

## Related Docs

- **Full Guide:** [API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md](./API_CONTRACT_FRONTEND_BACKEND_PREVENTION.md)
- **Input Validation:** [ZOD_PARAMETER_VALIDATION_PREVENTION.md](./ZOD_PARAMETER_VALIDATION_PREVENTION.md)
- **Main Cheat Sheet:** [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md)

---

**Print this and tape it to your monitor!**

**Last Updated:** 2026-02-05
