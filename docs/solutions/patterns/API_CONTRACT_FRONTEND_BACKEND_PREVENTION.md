---
title: API Contract & Frontend-Backend Integration Prevention Strategy
category: patterns
component: integration
severity: P1
tags: [api-contracts, ts-rest, frontend-backend, validation, transformation, type-safety]
created: 2026-02-05
updated: 2026-02-05
related:
  - ZOD_PARAMETER_VALIDATION_PREVENTION.md
  - AGENT_TOOLS_PREVENTION_INDEX.md
  - PREVENTION-QUICK-REFERENCE.md
---

# API Contract & Frontend-Backend Integration Prevention Strategy

**Problem Solved:** Frontend-backend contract mismatches, defensive transformation failures, and agent tool response validation

**Root Cause:** Three common patterns across the MAIS codebase:

1. **Auth mechanism mismatch** - Frontend sends Authorization header, backend expects query param
2. **Null defeats array defaults** - Transformation returns `null`, React `= []` defaults don't apply
3. **Type assertion without validation** - Agent tools use `as` instead of Zod safeParse

**Impact:** 401 errors, runtime crashes, silent failures, data corruption

---

## The 3 Bug Patterns

### Bug 1: Preview 401 - Auth Mechanism Mismatch

**What happened:**

```typescript
// Frontend (apps/web/src/components/agent/PreviewIframe.tsx)
const response = await fetch(`/api/preview?slug=${slug}`, {
  headers: {
    Authorization: `Bearer ${token}`, // ❌ Sent as header
  },
});

// Backend (server/src/routes/public/preview.routes.ts)
const token = req.query.token as string; // ❌ Expected query param
if (!token) return 401; // ALWAYS fails!
```

**Root cause:** API contract never specified WHERE the token goes (header vs query vs body)

**Prevention:** Explicit contract documentation + automated contract tests

---

### Bug 2: .map() Crash - Null Defeats Array Defaults

**What happened:**

```typescript
// Transformation layer (server/src/services/section-content.service.ts)
function transformContentForSection(content: SectionContent | null) {
  if (!content) return null; // ❌ Returns null instead of safe default

  return {
    ...content,
    packages: content.packages?.map(...), // Renames field
  };
}

// Frontend component (apps/web/src/components/sections/PackageGrid.tsx)
export function PackageGrid({ packages = [] }: { packages?: Package[] }) {
  return packages.map(...); // ❌ Crashes! null !== undefined, default doesn't apply
}
```

**Root cause:** Transformation layer returns `null`, bypassing React default parameter

**Prevention:** Defensive transformation pattern with guaranteed field existence

---

### Bug 3: build_first_draft - Type Assertion Without Validation

**What happened:**

```typescript
// Agent tool (server/src/agent-v2/deploy/tenant/src/tools/storefront/build_first_draft.tool.ts)
const result = await fetch(`${baseUrl}/api/agent/storefront/build-first-draft`, {
  body: JSON.stringify(input),
});

const data = (await result.json()) as { pages: Page[] }; // ❌ Type assertion without validation

// Return expects this shape
return {
  success: true,
  pages: data.pages, // ❌ Assumes shape matches
};

// But the route handler transforms it differently
// (server/src/routes/tenant-admin/storefront.routes.ts)
router.post('/build-first-draft', async (req, res) => {
  const result = await service.buildFirstDraft(tenantId, input);
  // result = { pages: [...] }

  // Transform to flat structure
  return res.json({
    sections: result.pages.flatMap((p) => p.sections), // ❌ Different shape!
  });
});
```

**Root cause:** Agent tool assumed service response shape = API response shape, used type assertion instead of Zod validation

**Prevention:** Zod safeParse on ALL external responses (Pitfall #56)

---

## Prevention Strategies

### 1. API Contract Verification

**Problem:** Frontend and backend disagree on auth mechanism, field names, response shapes

**Solution:** Explicit contract specification + automated verification

#### Pattern: ts-rest Contract with Auth Documentation

```typescript
// packages/contracts/src/contracts/preview.ts
import { z } from 'zod';
import { initContract } from '@ts-rest/core';

const c = initContract();

export const previewContract = c.router({
  getPreview: {
    method: 'GET',
    path: '/preview',

    // CRITICAL: Document auth mechanism explicitly
    summary: 'Get storefront preview (requires token in query param)',

    query: z.object({
      slug: z.string().min(1, 'Tenant slug required'),
      token: z.string().min(1, 'JWT token required'), // ← EXPLICIT: query param
    }),

    responses: {
      200: PreviewResponseSchema,
      401: z.object({ error: z.literal('Unauthorized') }),
      404: z.object({ error: z.literal('Tenant not found') }),
    },

    // OPTIONAL: Add metadata for frontend code generation
    metadata: {
      auth: {
        type: 'query_param',
        field: 'token',
      },
    },
  },
});
```

**Frontend follows contract:**

```typescript
// ✅ CORRECT - Matches contract specification
const response = await fetch(
  `/api/preview?slug=${slug}&token=${token}` // Token in query
);

// ❌ WRONG - Violates contract
const response = await fetch(`/api/preview?slug=${slug}`, {
  headers: { Authorization: `Bearer ${token}` }, // Contract says query param!
});
```

#### Checklist: API Contract Definition

When defining ANY new contract:

- [ ] **Method** specified (GET, POST, PUT, DELETE)
- [ ] **Path** specified with path params documented
- [ ] **Query params** schema defined (if any)
- [ ] **Request body** schema defined (if any)
- [ ] **Headers** schema defined (if auth/content-type required)
- [ ] **Response schemas** defined for ALL status codes (200, 400, 401, 404, 500)
- [ ] **Auth mechanism** documented in summary (header? query? body?)
- [ ] **Canonical field names** match between request/response (no renaming!)
- [ ] **Array fields** default to `[]` in schema, never nullable
- [ ] **Optional fields** use `.optional()` not `.nullable()`

#### Automated Contract Verification

**Test pattern:**

```typescript
// server/src/routes/__tests__/preview.contract.test.ts
import { previewContract } from '@macon/contracts';
import { testApiClient } from '../test-utils';

describe('Preview Contract Verification', () => {
  it('should accept token via query param (not header)', async () => {
    const token = generateTestToken();

    // ✅ Via query param (contract-compliant)
    const response = await testApiClient.preview.getPreview({
      query: { slug: 'test-tenant', token },
    });

    expect(response.status).toBe(200);
  });

  it('should reject token via Authorization header', async () => {
    const token = generateTestToken();

    // ❌ Via header (contract violation)
    const response = await fetch('/api/preview?slug=test-tenant', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401); // Backend correctly rejects
  });
});
```

**Run in CI:**

```bash
# package.json scripts
{
  "test:contracts": "vitest run --config vitest.contract.config.ts",
  "test:api": "npm run test:contracts && npm run test:integration"
}
```

#### Common Contract Mismatches

| Frontend Sends                   | Backend Expects       | Fix                                      |
| -------------------------------- | --------------------- | ---------------------------------------- |
| `Authorization: Bearer ${token}` | `req.query.token`     | Change frontend to query param           |
| `{ userId: string }`             | `{ user_id: string }` | Use camelCase consistently (contracts)   |
| `{ items: null }`                | `{ items?: Item[] }`  | Never send `null` for arrays, omit field |
| `{ date: Date }`                 | `{ date: string }`    | Always use ISO string for dates          |
| `{ amount: 1000 }`               | `{ amount: "1000" }`  | Document number vs string in schema      |

---

### 2. Defensive Transformation Layer

**Problem:** Transformation functions rename/reshape data but don't guarantee field existence, breaking React defaults

**Solution:** Transformation layer MUST guarantee non-null arrays and required fields

#### Pattern: Safe Transformation with Field Guarantees

```typescript
// ❌ WRONG - Returns null, breaks React defaults
function transformContentForSection(content: SectionContent | null) {
  if (!content) return null;

  return {
    id: content.id,
    packages: content.packages?.map(transformPackage), // May be undefined
  };
}

// ✅ CORRECT - Always returns safe shape with guaranteed fields
function transformContentForSection(content: SectionContent | null): SectionViewModel {
  // Return safe default when input is null
  if (!content) {
    return {
      id: '',
      packages: [], // ← Always array, never null/undefined
      features: [],
      testimonials: [],
    };
  }

  return {
    id: content.id,
    packages: content.packages?.map(transformPackage) ?? [], // ← Guaranteed array
    features: content.features?.map(transformFeature) ?? [],
    testimonials: content.testimonials ?? [],
  };
}
```

#### The "Null Defeats Defaults" Problem

```typescript
// React component with default parameter
function PackageGrid({ packages = [] }: { packages?: Package[] }) {
  return packages.map(...); // Works if packages is undefined, crashes if null!
}

// Why?
PackageGrid({ packages: undefined }); // ✅ Uses default: []
PackageGrid({ packages: null });      // ❌ Bypasses default: null !== undefined
PackageGrid({});                       // ✅ Uses default: []
```

**Rule:** Transformation layers MUST return arrays (`[]`) for array fields, NEVER `null` or `undefined`

#### Transformation Layer Checklist

When writing transformation functions:

- [ ] Return type explicitly defines all fields (no optional fields that are actually required)
- [ ] Array fields return `[]` when source is null/undefined (use `?? []`)
- [ ] Object fields return safe defaults when source is null (use `?? { id: '', name: '' }`)
- [ ] Boolean fields return explicit `true` or `false` (use `?? false`)
- [ ] String fields return `''` when source is null (use `?? ''`)
- [ ] Field names match frontend expectations (no rename without documentation)
- [ ] Unit test covers null input → safe output
- [ ] Integration test covers transformed data → component rendering

#### Example: Complete Transformation Pattern

```typescript
// Define view model type explicitly
export type SectionViewModel = {
  id: string;
  type: string;
  title: string;
  packages: PackageViewModel[]; // Always array
  features: FeatureViewModel[]; // Always array
  testimonials: TestimonialViewModel[]; // Always array
  settings: SectionSettings; // Always object
};

// Transformation with safe defaults
export function transformContentForSection(content: SectionContent | null): SectionViewModel {
  if (!content) {
    return {
      id: '',
      type: 'unknown',
      title: '',
      packages: [],
      features: [],
      testimonials: [],
      settings: { visible: true, layout: 'grid' },
    };
  }

  return {
    id: content.id,
    type: content.type,
    title: content.title ?? '',
    packages: (content.packages ?? []).map(transformPackage),
    features: (content.features ?? []).map(transformFeature),
    testimonials: content.testimonials ?? [],
    settings: content.settings ?? { visible: true, layout: 'grid' },
  };
}

// Test the transformation
describe('transformContentForSection', () => {
  it('returns safe defaults when input is null', () => {
    const result = transformContentForSection(null);

    expect(result.packages).toEqual([]); // Not undefined or null
    expect(result.features).toEqual([]);
    expect(result.testimonials).toEqual([]);
    expect(result.settings).toEqual({ visible: true, layout: 'grid' });
  });

  it('transforms packages to view models', () => {
    const content = createTestSectionContent({
      packages: [{ id: 'pkg-1', name: 'Wedding', price: 5000 }],
    });

    const result = transformContentForSection(content);

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]).toMatchObject({
      id: 'pkg-1',
      name: 'Wedding',
      price: 5000,
    });
  });
});
```

#### Array Transformation Safety Pattern

```typescript
// ✅ PATTERN 1: Null-coalescing before map
packages: (content.packages ?? []).map(transformPackage);

// ✅ PATTERN 2: Optional chaining + fallback
packages: content.packages?.map(transformPackage) ?? [];

// ✅ PATTERN 3: Guard clause
const packages = content.packages ?? [];
return packages.map(transformPackage);

// ❌ WRONG: Optional chaining without fallback
packages: content.packages?.map(transformPackage); // Returns undefined!

// ❌ WRONG: Nullable return type
packages: content.packages?.map(transformPackage) ?? null; // Null defeats defaults!
```

---

### 3. Agent Tool Response Validation

**Problem:** Agent tools use type assertions on external API responses, causing silent failures when shape changes

**Solution:** Zod safeParse on ALL external responses (Reference: Pitfall #56, ZOD_PARAMETER_VALIDATION_PREVENTION.md)

#### Pattern: Agent Tool with Response Validation

```typescript
// ❌ WRONG - Type assertion without validation
const BuildFirstDraftTool = new FunctionTool({
  name: 'build_first_draft',
  description: 'Generate first draft of storefront',

  async execute(context: ToolContext, params: Record<string, unknown>) {
    const response = await fetch(`${baseUrl}/api/agent/storefront/build-first-draft`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as { pages: Page[] }; // ❌ Assumes shape

    return {
      success: true,
      pages: data.pages, // ❌ Runtime crash if API changed
    };
  },
});

// ✅ CORRECT - Zod validation on response
const BuildFirstDraftResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      content: z.record(z.unknown()),
    })
  ),
});

const BuildFirstDraftTool = new FunctionTool({
  name: 'build_first_draft',
  description: 'Generate first draft of storefront',

  async execute(context: ToolContext, params: Record<string, unknown>) {
    // Step 1: Validate input params (see ZOD_PARAMETER_VALIDATION_PREVENTION.md)
    const paramsResult = BuildFirstDraftParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return {
        success: false,
        error: paramsResult.error.errors[0]?.message || 'Invalid parameters',
      };
    }

    // Step 2: Call API
    const response = await fetch(`${baseUrl}/api/agent/storefront/build-first-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paramsResult.data),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    // Step 3: Validate response shape
    const json = await response.json();
    const dataResult = BuildFirstDraftResponseSchema.safeParse(json);

    if (!dataResult.success) {
      // Log the mismatch for debugging
      logger.error(
        {
          expected: BuildFirstDraftResponseSchema,
          received: json,
          error: dataResult.error,
        },
        'build_first_draft API response shape mismatch'
      );

      return {
        success: false,
        error: 'API response validation failed. Expected sections array, got different shape.',
      };
    }

    // Step 4: Return validated data
    return {
      success: true,
      sections: dataResult.data.sections,
      sectionCount: dataResult.data.sections.length,
    };
  },
});
```

#### Checklist: Agent Tool External API Calls

When agent tools call backend APIs:

- [ ] **Input validation** via Zod safeParse BEFORE fetch (Pitfall #56)
- [ ] **Response schema** defined for API response shape
- [ ] **Response validation** via Zod safeParse AFTER json()
- [ ] **Validation failure** logged with expected vs received shapes
- [ ] **Error handling** for network errors (fetch throws)
- [ ] **Error handling** for HTTP errors (response.ok)
- [ ] **Error handling** for JSON parse errors
- [ ] **Error handling** for schema validation failures
- [ ] **Success response** includes validated data, not `as` assertions
- [ ] **Test coverage** for successful response
- [ ] **Test coverage** for API shape changes (validation fails)

#### Common Response Validation Mistakes

```typescript
// ❌ Mistake 1: Type assertion on response
const data = await response.json() as MyType;

// ✅ Fix: Zod validation
const json = await response.json();
const result = MyTypeSchema.safeParse(json);
if (!result.success) return { success: false, error: 'Invalid response' };
const data = result.data;

// ❌ Mistake 2: Assuming service response = API response
// Service returns: { pages: Page[] }
// API transforms to: { sections: Section[] }
const data = await apiCall() as { pages: Page[] }; // WRONG!

// ✅ Fix: Define separate schemas for service vs API
const ServiceResponseSchema = z.object({ pages: z.array(...) });
const ApiResponseSchema = z.object({ sections: z.array(...) });

// ❌ Mistake 3: No logging on validation failure
if (!result.success) return { success: false, error: 'Invalid' };

// ✅ Fix: Log expected vs received for debugging
if (!result.success) {
  logger.error({
    tool: 'build_first_draft',
    expected: BuildFirstDraftResponseSchema,
    received: json,
    zodError: result.error,
  }, 'API response validation failed');
  return { success: false, error: 'Invalid response shape' };
}

// ❌ Mistake 4: Throwing errors instead of returning error result
if (!result.success) throw new Error('Invalid response');

// ✅ Fix: Return AgentToolResult with success: false
if (!result.success) {
  return { success: false, error: 'Response validation failed' };
}
```

#### Response Validation Template

```typescript
// 1. Define response schema at module level
const MyToolResponseSchema = z.object({
  field1: z.string(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
});

// 2. Validate in execute function
async execute(context: ToolContext, params: Record<string, unknown>) {
  // ... input validation ...

  // Call API
  const response = await fetch(url, options);

  // HTTP error handling
  if (!response.ok) {
    return {
      success: false,
      error: `API returned ${response.status}: ${response.statusText}`,
    };
  }

  // Parse JSON
  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    return {
      success: false,
      error: 'API returned invalid JSON',
    };
  }

  // Validate response shape
  const result = MyToolResponseSchema.safeParse(json);
  if (!result.success) {
    logger.error({
      tool: 'my_tool',
      expected: 'MyToolResponseSchema',
      received: json,
      zodError: result.error.errors,
    }, 'API response validation failed');

    return {
      success: false,
      error: 'API response validation failed',
    };
  }

  // Use validated data
  return {
    success: true,
    ...result.data,
  };
}
```

---

## Detection Checklist

Use this checklist during code review to catch these patterns:

### API Contract Verification

```bash
# Find routes without contract definition
rg "router\.(get|post|put|delete)" server/src/routes/ --type ts | \
  grep -v "contract\."

# Find fetch calls without contract client
rg "fetch\(" apps/web/src/ --type ts | grep -v "apiClient"

# Find Authorization headers (check if contract specifies query param instead)
rg "Authorization.*Bearer" apps/web/src/ --type ts -A 2

# Find mismatched field names (camelCase vs snake_case)
rg "user_id|tenant_id|customer_id" packages/contracts/src/ --type ts
```

### Transformation Layer Safety

```bash
# Find transformations that may return null for arrays
rg "return null" server/src/services/ --type ts -A 2 -B 5 | grep -E "(packages|items|features)"

# Find optional chaining without null coalescing on arrays
rg "\?\\.map\(" server/src/ --type ts | grep -v "?? \[\]"

# Find nullable array types in view models
rg "packages\?:" apps/web/src/ --type ts | grep -v "Package\[\]"

# Find components with array defaults that may receive null
rg "= \[\].*\}" apps/web/src/components/ --type ts -B 2
```

### Agent Tool Response Validation

```bash
# Find type assertions on API responses
rg "await.*\.json\(\) as" server/src/agent-v2/ --type ts

# Find fetch calls without response validation
rg "await fetch" server/src/agent-v2/ --type ts -A 10 | grep -v "safeParse"

# Find tools using response data without validation
rg "data\.pages|data\.sections|data\.items" server/src/agent-v2/ --type ts -B 5 | grep -v "safeParse"

# Verify Pitfall #56 compliance (no type assertions in tools)
rg "params as \{" server/src/agent-v2/deploy/**/tools/ --type ts
```

### Quick Self-Review Before Commit

Run these 3 commands:

```bash
# 1. Contract consistency check
npm run typecheck && npm run test:contracts

# 2. Transformation safety check
rg "return null" server/src/services/ --type ts | grep -E "transform|toViewModel"

# 3. Agent tool validation check
rg "as \{" server/src/agent-v2/ --type ts | grep -v "// @ts-expect-error"
```

---

## Integration with Existing Patterns

### Related to Pitfall #56: Zod Parameter Validation

This prevention guide extends Pitfall #56 to cover:

- **Inbound validation** (Pitfall #56): Validate `params` on tool input
- **Outbound validation** (This guide): Validate API responses on tool output

**Combined pattern:**

```typescript
async execute(context: ToolContext, params: Record<string, unknown>) {
  // INBOUND: Validate input params (Pitfall #56)
  const paramsResult = ParamsSchema.safeParse(params);
  if (!paramsResult.success) {
    return { success: false, error: paramsResult.error.errors[0]?.message };
  }

  // Call API with validated params
  const response = await fetch(url, { body: JSON.stringify(paramsResult.data) });
  const json = await response.json();

  // OUTBOUND: Validate API response (This guide)
  const responseResult = ResponseSchema.safeParse(json);
  if (!responseResult.success) {
    logger.error({ expected: ResponseSchema, received: json });
    return { success: false, error: 'API response validation failed' };
  }

  return { success: true, data: responseResult.data };
}
```

### Related to Pitfall #43: Tools Return Instructions

Pitfall #43: "Tools return instructions - FunctionTool.execute must return results, not `{instruction: "Generate..."}` for LLM"

**This guide prevents similar issue:** Tool returns assumed shape without validation

```typescript
// ❌ WRONG (Pitfall #43): Return instruction instead of data
return { instruction: 'Show the preview to the user' };

// ❌ WRONG (This guide): Assume response shape without validation
const data = (await response.json()) as { pages: Page[] };
return { pages: data.pages }; // What if API changed to { sections: Section[] }?

// ✅ CORRECT: Validate response, return actual data
const result = ResponseSchema.safeParse(await response.json());
if (!result.success) return { success: false, error: 'Invalid response' };
return { success: true, sections: result.data.sections };
```

### Related to Pitfall #47: ADK FunctionTool API

Pitfall #47: "ADK uses `parameters`/`execute` not `inputSchema`/`func`"

**This guide complements:** Response validation happens inside `execute()`, not schema definition

```typescript
const tool = new FunctionTool({
  name: 'my_tool',
  description: 'Does something',

  // Pitfall #47: Use 'parameters' not 'inputSchema'
  parameters: {
    type: 'object',
    properties: { ... },
  },

  // This guide: Validate response inside execute
  async execute(context, params) {
    // Input validation (Pitfall #56)
    const paramsResult = ParamsSchema.safeParse(params);
    if (!paramsResult.success) return { success: false, error: ... };

    // Call API
    const response = await fetch(...);

    // Response validation (This guide)
    const responseResult = ResponseSchema.safeParse(await response.json());
    if (!responseResult.success) return { success: false, error: ... };

    return { success: true, data: responseResult.data };
  },
});
```

---

## Common Pitfalls Reference

| Pitfall | Problem                           | Solution                                        |
| ------- | --------------------------------- | ----------------------------------------------- |
| #6      | Type assertion `as any`           | Use Zod safeParse or type guards                |
| #43     | Tools return instructions         | Return actual data, validate shape              |
| #47     | FunctionTool API mismatch         | Use `parameters`/`execute`, validate in execute |
| #56     | Type assertion without validation | Always use Zod safeParse on params              |
| NEW     | Auth mechanism mismatch           | Document in contract, test both sides           |
| NEW     | Null defeats array defaults       | Return `[]` in transformations, never `null`    |
| NEW     | Response shape assumption         | Validate API responses with Zod, log mismatches |

---

## Test Patterns

### Contract Verification Test

```typescript
// server/src/routes/__tests__/api-contract.test.ts
import { previewContract } from '@macon/contracts';
import { testApiClient } from '../test-utils';

describe('API Contract Verification', () => {
  describe('Preview API', () => {
    it('accepts token via query param as specified in contract', async () => {
      const token = generateTestToken();

      const response = await testApiClient.preview.getPreview({
        query: { slug: 'test-tenant', token },
      });

      expect(response.status).toBe(200);
    });

    it('returns 401 when token is missing (contract compliance)', async () => {
      const response = await testApiClient.preview.getPreview({
        query: { slug: 'test-tenant', token: '' },
      });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: 'Unauthorized' });
    });
  });
});
```

### Transformation Safety Test

```typescript
// server/src/services/__tests__/section-content.service.test.ts
describe('transformContentForSection', () => {
  it('returns safe defaults when content is null', () => {
    const result = transformContentForSection(null);

    // CRITICAL: Arrays must be [], not null or undefined
    expect(result.packages).toEqual([]);
    expect(result.features).toEqual([]);
    expect(result.testimonials).toEqual([]);

    // Objects must be defined
    expect(result.settings).toBeDefined();
  });

  it('handles missing array fields gracefully', () => {
    const content = createTestSectionContent({
      packages: undefined, // Simulates missing field
    });

    const result = transformContentForSection(content);

    // Must return [], not undefined
    expect(result.packages).toEqual([]);
  });
});
```

### Agent Tool Response Validation Test

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/__tests__/build_first_draft.test.ts
describe('build_first_draft tool', () => {
  it('validates API response shape', async () => {
    // Mock API with unexpected response shape
    fetchMock.mockResponseOnce(
      JSON.stringify({
        // Wrong shape: API returns 'sections' but tool expects 'pages'
        sections: [{ id: 's1', type: 'hero' }],
      })
    );

    const result = await tool.execute(context, validParams);

    // Tool should detect mismatch and return error
    expect(result.success).toBe(false);
    expect(result.error).toContain('validation failed');
  });

  it('handles API errors gracefully', async () => {
    fetchMock.mockResponseOnce('Internal Server Error', { status: 500 });

    const result = await tool.execute(context, validParams);

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('returns validated data on success', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        sections: [{ id: 's1', type: 'hero', content: {} }],
      })
    );

    const result = await tool.execute(context, validParams);

    expect(result.success).toBe(true);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toBe('s1');
  });
});
```

---

## Code Review Template

When reviewing PRs with API integrations:

````markdown
## API Contract Checklist

- [ ] Contract defines method, path, query, body, responses
- [ ] Auth mechanism explicitly documented (header? query? body?)
- [ ] Field names use camelCase consistently
- [ ] Array fields default to `[]`, not nullable
- [ ] Frontend uses contract client, not raw fetch
- [ ] Backend handler follows contract schema
- [ ] Contract test verifies both sides

## Transformation Layer Checklist

- [ ] Transformation returns safe defaults for null input
- [ ] Array fields always return `[]`, never `null` or `undefined`
- [ ] Object fields return safe defaults, never `null`
- [ ] Field names match frontend expectations
- [ ] Unit test covers null input → safe output
- [ ] No `return null` for required fields

## Agent Tool Checklist

- [ ] Input params validated with Zod safeParse (Pitfall #56)
- [ ] API response validated with Zod safeParse (This guide)
- [ ] Validation failures logged with expected vs received
- [ ] No type assertions (`as`) on params or responses
- [ ] Error handling for HTTP errors, JSON parse errors, validation failures
- [ ] Test coverage for API shape changes

## Quick Grep Checks

```bash
# Contract violations
rg "fetch\(" apps/web/src/ --type ts | grep -v "apiClient"

# Unsafe transformations
rg "return null" server/src/services/ --type ts | grep transform

# Missing response validation
rg "await.*\.json\(\) as" server/src/agent-v2/ --type ts
```
````

---

## Related Documentation

- **Pitfall #56:** [ZOD_PARAMETER_VALIDATION_PREVENTION.md](./ZOD_PARAMETER_VALIDATION_PREVENTION.md)
- **Pitfall #43:** Tools Return Instructions (CLAUDE.md)
- **Pitfall #47:** ADK FunctionTool API (CLAUDE.md)
- **Agent Tools Index:** [AGENT_TOOLS_PREVENTION_INDEX.md](./AGENT_TOOLS_PREVENTION_INDEX.md)
- **Prevention Quick Reference:** [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md)

---

## Summary

Three critical patterns to prevent:

1. **API Contract Mismatch** → Explicit contract specification + automated tests
2. **Null Defeats Defaults** → Transformations return `[]` for arrays, never `null`
3. **Response Shape Assumptions** → Zod safeParse on ALL external responses

**Key insight:** Type safety at compile time (TypeScript) doesn't protect against runtime data (API responses, transformations). Use Zod validation as the trust boundary.

**Before merging:** Run detection checklist, verify contract tests pass, check transformation tests cover null inputs.

---

**Created:** 2026-02-05
**Last Updated:** 2026-02-05
