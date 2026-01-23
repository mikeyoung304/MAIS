---
status: ready
priority: p2
issue_id: '5182'
tags: [code-review, testing, quality, dry]
dependencies: []
---

# Storefront Tools Tests - DRY Refactoring

## Problem Statement

The storefront-tools.test.ts file has significant code duplication, particularly in mock setup and context configuration. This makes tests harder to maintain and increases the chance of inconsistencies.

**Why it matters:** DRY tests are easier to maintain, modify, and understand. Repetitive setup code obscures what each test is actually testing.

## Findings

### 1. Tenant Mock Setup (~30 occurrences)

The same pattern is duplicated throughout:

```typescript
mockPrisma.tenant.findUnique.mockResolvedValue({
  id: 'test-tenant-123',
  slug: 'test-studio',
  landingPageConfig: mockConfig,
  landingPageConfigDraft: null,
});
```

### 2. Cached Draft Config Setup (~8 occurrences)

```typescript
mockContext.draftConfig = {
  pages: mockConfig.pages as any,
  hasDraft: true,
  slug: 'test-studio',
  rawDraftConfig: mockConfig as any,
  rawLiveConfig: null,
};
```

### 3. Magic Strings Throughout

Constants like `'test-tenant-123'`, `'test-studio'`, `'session-456'` appear repeatedly.

### 4. Redundant Trust Tier Tests

Individual trust tier tests duplicate what's already covered by the parameterized `it.each(allTools)` test.

## Proposed Solutions

### Option 1: Helper Functions (Recommended)

```typescript
// Constants
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_SLUG = 'test-studio';
const TEST_SESSION_ID = 'session-456';

// Helper: Setup tenant mock
function setupTenantMock(options?: {
  liveConfig?: ReturnType<typeof createMockLandingPageConfig> | null;
  draftConfig?: ReturnType<typeof createMockLandingPageConfig> | null;
  slug?: string;
}) {
  const config = options?.liveConfig ?? createMockLandingPageConfig();
  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: TEST_TENANT_ID,
    slug: options?.slug ?? TEST_SLUG,
    landingPageConfig: config,
    landingPageConfigDraft: options?.draftConfig ?? null,
  });
  return config;
}

// Helper: Setup cached draft config
function setContextDraftCache(
  config: ReturnType<typeof createMockLandingPageConfig>,
  hasDraft = true
) {
  mockContext.draftConfig = {
    pages: config.pages as any,
    hasDraft,
    slug: TEST_SLUG,
    rawDraftConfig: hasDraft ? (config as any) : null,
    rawLiveConfig: hasDraft ? null : (config as any),
  };
}
```

**Pros:** Simple, reduces ~300 lines, improves readability
**Cons:** Need to define helpers at top of file
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option 2: Test Fixture Factory Pattern

```typescript
function createTestScenario(scenario: 'withDraft' | 'withLive' | 'withDefaults') {
  const mockConfig = createMockLandingPageConfig();
  switch (scenario) {
    case 'withDraft':
      mockPrisma.tenant.findUnique.mockResolvedValue({...});
      mockContext.draftConfig = {...};
      break;
    // etc
  }
  return { mockConfig };
}
```

**Pros:** Even more DRY, encapsulates common scenarios
**Cons:** More abstraction, may obscure test intent
**Effort:** Medium (3 hours)
**Risk:** Medium - over-abstraction

### Option 3: Remove Redundant Tests Only

Just remove the individual trust tier tests that duplicate the parameterized tests.

**Pros:** Quick win, ~40 lines saved
**Cons:** Doesn't address larger duplication
**Effort:** Small (30 mins)
**Risk:** Very low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/agent/tools/storefront-tools.test.ts`

**Estimated line reduction:** ~300 lines (20% of file)

## Acceptance Criteria

- [ ] Tenant mock setup uses helper function
- [ ] Draft config caching uses helper function
- [ ] Magic strings replaced with constants
- [ ] Redundant trust tier tests removed or consolidated
- [ ] All tests still pass

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2026-01-15 | Created from code review | Identified major duplication patterns |

## Resources

- Test file: `server/test/agent/tools/storefront-tools.test.ts`
