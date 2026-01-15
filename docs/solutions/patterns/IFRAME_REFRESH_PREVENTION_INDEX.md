# Iframe Refresh Prevention Strategy

**Issue ID:** Server-side data changes don't reflect in iframe-rendered preview without manual refresh
**Root Cause:** React Query cache invalidation affects React components only; iframes require full reload for server-rendered content
**Solution Pattern:** "Refresh key" mechanism in Zustand store

---

## Problem Pattern

When data changes on the server (packages, pricing, hero text) via agent tool executors, the preview iframe doesn't automatically update because:

1. **Cache invalidation is React-specific**: `queryClient.invalidateQueries()` only refreshes React Query cache, not iframe content
2. **PostMessage can't update server-rendered data**: PostMessage protocol handles real-time `draftConfig` updates for client-rendered sections, but not server-rendered content (prices, package lists)
3. **Iframes need full reload**: Server-side-rendered content (Next.js `generateMetadata`, HTML strings) requires complete iframe reload via `iframe.src = url`

### Current Implementation

**Frontend State Management** (`apps/web/src/stores/agent-ui-store.ts`):

- `previewRefreshKey: number` - Counter that increments to trigger iframe reload
- `refreshPreview()` action - Increments counter by 1
- `selectPreviewRefreshKey()` selector - Exposes key to components

**Preview Component** (`apps/web/src/components/preview/PreviewPanel.tsx`):

- Subscribes to `previewRefreshKey` via selector
- `useEffect` watches for key changes (skips initial value to avoid unnecessary reload)
- When key changes, resets iframe state and reloads `iframe.src = iframeUrl`

**Tool Executor Trigger** (`apps/web/src/components/agent/AgentPanel.tsx` - `handleToolComplete`):

- Checks for `packages` in tool result data
- If present, calls `agentUIActions.refreshPreview()` after 150ms delay
- Delay ensures database transaction commit before iframe reload

**Server Executor** (`server/src/agent/executors/onboarding-executors.ts`):

- `upsert_services` executor returns `packages` and `packageCount` in result
- `update_storefront` executor returns `hasDraft: true` (used by frontend for invalidation)

---

## Prevention Strategies

### 1. Pattern Recognition - Data Change Detection

When adding new agent tool executors that modify server-rendered content, recognize these signatures:

**Server-Rendered Content Indicators:**

- ✓ Pricing, package names, descriptions (returned in HTML)
- ✓ Hero text, headlines, taglines (server-rendered Next.js)
- ✓ Images, media URLs (server-side config)
- ✗ Real-time state that changes during session (user messages, draft edits)
- ✗ CSS variables, theme toggles (client-side styles)

**Decision Tree:**

```
Does tool executor modify data?
├─ If ONLY draft config → ✓ PostMessage update via draftConfig
├─ If packages/pricing → ✓ Return 'packages' in result + refreshPreview()
├─ If hero/branding (server-rendered) → ✓ Return 'hasDraft' + refreshPreview()
└─ If hero/branding (draft-only) → PostMessage is sufficient
```

### 2. Checklist for New Executor Implementations

**When creating a new tool executor that modifies displayable data:**

- [ ] Does the executor modify data that's server-rendered in the iframe?
  - Packages list, pricing, hero text, image URLs
  - If YES, proceed to next items
- [ ] Does the executor return data in the result object?
  - [ ] If returning `packages`, include all fields: `id`, `name`, `priceCents`
  - [ ] If returning `hasDraft: true`, include it alongside main result
  - [ ] Document the fields in JSDoc for frontend consumption
- [ ] Is there a trigger in `AgentPanel.tsx` `handleToolComplete` for this data type?
  - [ ] If not, add detection logic and `agentUIActions.refreshPreview()` call
  - [ ] Add appropriate delay (150ms for database commit safety)
  - [ ] Add type guard to safely extract data from result
- [ ] Will the iframe load new data on full reload?
  - [ ] Verify preview URL includes draft token (for draft content access)
  - [ ] Confirm server uses `landingPageConfigDraft` or published config appropriately

**Example Structure for New Executor:**

```typescript
// Server: Return data + indicator
return {
  action: 'updated',
  packages: [
    /* array with id, name, priceCents */
  ],
  packageCount: 3,
  previewUrl: 'http://...',
  hasDraft: true, // Frontend will use this
};

// Frontend: Detect and refresh
const resultWithPackages = toolResults?.find(
  (r): r is ToolResultWithPackages =>
    r.success &&
    r.data != null &&
    typeof r.data === 'object' &&
    ('packages' in r.data || 'packageCount' in r.data)
);

if (resultWithPackages) {
  setTimeout(() => {
    agentUIActions.refreshPreview();
  }, 150);
}
```

### 3. Code Review Checklist

**When reviewing PRs involving agent tool executors:**

- [ ] **Executor returns indicator data?**
  - [ ] `packages` array returned if modifying package data
  - [ ] `hasDraft: true` if modifying draft config
  - [ ] All fields properly typed and populated

- [ ] **Frontend detects result?**
  - [ ] `handleToolComplete` includes type guard for this result type
  - [ ] Detection logic uses safe type narrowing (not `any`)
  - [ ] Refresh delay accounts for DB transaction (150ms minimum)

- [ ] **Preview reloads correctly?**
  - [ ] `PreviewPanel` subscribes to `selectPreviewRefreshKey`
  - [ ] Effect properly skips initial value (line 151 check: `previewRefreshKey > 0`)
  - [ ] Frame state reset before reload (loading, error, isReady flags)

- [ ] **Data is accessible after reload?**
  - [ ] Draft token included in preview URL (for draft content)
  - [ ] Server returns updated data on page load (not cached stale response)

---

## Architecture Overview

### Data Flow: Agent Tool Execution → Preview Update

```
1. User message in AgentPanel chat
   ↓
2. Agent orchestrator processes request
   ↓
3. Tool proposal executor runs on server
   ├─ Validates tenant ownership
   ├─ Updates database (packages, storefront config)
   ├─ Returns result with indicator (packages, hasDraft)
   └─ Returns in tool response
   ↓
4. Frontend PanelAgentChat receives tool result
   ├─ Calls handleToolComplete(toolResults)
   ├─ Detects 'packages' in result
   └─ Calls agentUIActions.refreshPreview() after 150ms
   ↓
5. Zustand store action increments previewRefreshKey
   ├─ State: { ...state, previewRefreshKey: 3 }
   └─ Notifies subscribers
   ↓
6. PreviewPanel useEffect watches refreshKey
   ├─ Detects change from 0 to 3
   ├─ Sets iframe loading state
   ├─ Sets iframe.src = newUrl (triggers full reload)
   └─ Resets ready/loading/error flags
   ↓
7. Browser loads iframe with fresh URL
   ├─ Includes preview token for draft access
   ├─ Server renders fresh HTML with updated packages
   └─ Iframe emits BUILD_MODE_READY message
   ↓
8. PreviewPanel message handler sees READY
   ├─ Sets isIframeReady = true
   ├─ Sends BUILD_MODE_INIT with fresh draftConfig
   └─ Preview shows updated content ✓
```

### File Locations and Responsibilities

| File                                                 | Responsibility      | Key Functions                                             |
| ---------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| `apps/web/src/stores/agent-ui-store.ts`              | State management    | `refreshPreview()`, `selectPreviewRefreshKey()`           |
| `apps/web/src/components/preview/PreviewPanel.tsx`   | Preview rendering   | Subscribe to `previewRefreshKey`, reload iframe           |
| `apps/web/src/components/agent/AgentPanel.tsx`       | Agent integration   | `handleToolComplete()` detects results, triggers refresh  |
| `server/src/agent/executors/onboarding-executors.ts` | Database operations | Return `packages` or `hasDraft` indicators                |
| `apps/web/src/hooks/useDraftConfig.ts`               | Cache management    | React Query cache for draft config (separate from iframe) |

---

## Test Cases

### Regression Tests (Prevent #32 - Iframe not updating)

#### Test 1: Agent Creates Package → Preview Updates

```typescript
test('should refresh preview when agent creates package via upsert_services', async ({
  authenticatedPage,
  testTenant,
  agentChat,
}) => {
  // 1. Show preview in dashboard
  await agentChat.sendMessage('Show me the preview');
  await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible();

  // 2. Get initial package count from iframe
  const initialCount = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelectorAll('[data-package-item]').length || 0;
  });

  // 3. Agent creates package
  await agentChat.sendMessage('Create a service package called "Deluxe Photography" for $5000');

  // 4. Wait for tool execution (includes 150ms delay)
  await authenticatedPage.waitForTimeout(2000);

  // 5. Verify refresh key changed (iframe reloaded)
  const refreshKeyAfter = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });
  expect(refreshKeyAfter).toBeGreaterThan(0);

  // 6. Verify iframe reloaded and shows new package
  const updatedCount = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelectorAll('[data-package-item]').length || 0;
  });
  expect(updatedCount).toBeGreaterThan(initialCount);
});
```

#### Test 2: Agent Updates Pricing → Preview Price Changes

```typescript
test('should update package price in preview without manual refresh', async ({
  authenticatedPage,
  testTenant,
  agentChat,
}) => {
  // 1. Create initial package
  await agentChat.sendMessage('Create a standard photography package for $2000');
  await authenticatedPage.waitForTimeout(2000);

  // 2. Read current price from iframe
  const initialPrice = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelector('[data-package-price]')?.textContent;
  });
  expect(initialPrice).toContain('2000');

  // 3. Get initial refresh key
  const refreshKeyBefore = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });

  // 4. Agent updates pricing
  await agentChat.sendMessage('Change that package price to $2500');
  await authenticatedPage.waitForTimeout(2000);

  // 5. Verify refresh key incremented (triggers reload)
  const refreshKeyAfter = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });
  expect(refreshKeyAfter).toBeGreaterThan(refreshKeyBefore);

  // 6. Wait for iframe to reload with fresh content
  await authenticatedPage.waitForTimeout(500);

  // 7. Verify price updated in iframe
  const updatedPrice = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelector('[data-package-price]')?.textContent;
  });
  expect(updatedPrice).toContain('2500');
});
```

#### Test 3: Agent Updates Hero Text → Preview Updates

```typescript
test('should refresh preview when agent updates hero section', async ({
  authenticatedPage,
  testTenant,
  agentChat,
}) => {
  // 1. Start with preview visible
  await agentChat.sendMessage('Show preview');
  await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible();

  // 2. Get initial hero text from iframe
  const initialHeadline = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelector('[data-hero-headline]')?.textContent;
  });

  // 3. Agent updates hero section
  await agentChat.sendMessage('Update my hero headline to "Award-Winning Photography Services"');

  // 4. Wait for refresh
  await authenticatedPage.waitForTimeout(2000);

  // 5. Verify refresh happened
  const refreshKey = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });
  expect(refreshKey).toBeGreaterThan(0);

  // 6. Verify updated text in iframe
  const updatedHeadline = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelector('[data-hero-headline]')?.textContent;
  });
  expect(updatedHeadline).toContain('Award-Winning');
});
```

#### Test 4: Multiple Updates → Iframe Handles Rapid Reloads

```typescript
test('should handle multiple rapid package updates without errors', async ({
  authenticatedPage,
  testTenant,
  agentChat,
}) => {
  await agentChat.sendMessage('Show preview');
  await expect(authenticatedPage.locator('[data-testid="preview-panel"]')).toBeVisible();

  // Rapid updates
  await agentChat.sendMessage('Create package "Basic" for $500');
  await authenticatedPage.waitForTimeout(300);

  await agentChat.sendMessage('Create package "Premium" for $1000');
  await authenticatedPage.waitForTimeout(300);

  await agentChat.sendMessage('Create package "Enterprise" for $2500');
  await authenticatedPage.waitForTimeout(2000);

  // Verify refresh keys incremented 3 times
  const finalRefreshKey = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });
  expect(finalRefreshKey).toBeGreaterThanOrEqual(3);

  // Verify iframe is healthy (loaded without errors)
  const iframeError = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    return (iframe as any).error || null;
  });
  expect(iframeError).toBeNull();

  // Verify all 3 packages visible
  const packageCount = await authenticatedPage.evaluate(() => {
    const iframe = document.querySelector('[data-testid="preview-iframe"]') as HTMLIFrameElement;
    const doc = iframe?.contentDocument;
    return doc?.querySelectorAll('[data-package-item]').length || 0;
  });
  expect(packageCount).toBe(3);
});
```

#### Test 5: Refresh Key Doesn't Re-trigger on 0 (Prevent Infinite Reload)

```typescript
test('should not reload iframe on mount when refreshKey is 0', async ({
  authenticatedPage,
  testTenant,
}) => {
  // 1. Navigate to agent dashboard
  await authenticatedPage.goto('/t/dashboard');

  // 2. Open preview for first time
  const openPreviewButton = authenticatedPage.locator('button:has-text("Preview")');
  await openPreviewButton.click();

  // 3. Monitor iframe loads
  let iframeLoadCount = 0;
  await authenticatedPage.on('framenavigated', () => {
    iframeLoadCount++;
  });

  // 4. Wait for initial load
  await authenticatedPage.waitForTimeout(1000);

  // 5. Verify only 1 load (not reloading due to refreshKey change)
  expect(iframeLoadCount).toBeLessThanOrEqual(1);

  // 6. Refresh key should still be 0 (no changes yet)
  const refreshKey = await authenticatedPage.evaluate(() => {
    return (window as any).useAgentUIStore.getState().previewRefreshKey;
  });
  expect(refreshKey).toBe(0);
});
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Forgetting to Skip Initial RefreshKey Value

**Problem:** Component reloads iframe on mount when `refreshKey` is 0

```typescript
// ❌ WRONG: Reloads on every previewRefreshKey change, including mount
useEffect(() => {
  setIsLoading(true);
  if (iframeRef.current) {
    iframeRef.current.src = iframeUrl;
  }
}, [previewRefreshKey, iframeUrl]);
```

**Solution:** Check that key is > 0 before reloading

```typescript
// ✓ CORRECT: Skips initial 0 value, only reloads on changes
const prevRefreshKeyRef = useRef(previewRefreshKey);
useEffect(() => {
  if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
    prevRefreshKeyRef.current = previewRefreshKey;
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }
  }
}, [previewRefreshKey, iframeUrl]);
```

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/preview/PreviewPanel.tsx` lines 149-161

### Pitfall 2: Missing Delay in Frontend Trigger

**Problem:** Iframe reloads before database transaction commits, showing stale data

```typescript
// ❌ WRONG: No delay allows race condition
if (resultWithPackages) {
  agentUIActions.refreshPreview(); // Immediate reload!
}
```

**Solution:** Add 150ms delay for database propagation

```typescript
// ✓ CORRECT: 150ms ensures READ COMMITTED is complete
if (resultWithPackages) {
  setTimeout(() => {
    agentUIActions.refreshPreview();
  }, 150);
}
```

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/AgentPanel.tsx` lines 212-219

### Pitfall 3: Not Returning Indicator Data from Executor

**Problem:** Frontend can't detect when to refresh because result has no `packages` field

```typescript
// ❌ WRONG: Frontend won't know to refresh
return {
  action: 'created',
  segmentId: segment.id,
  segmentName: segment.name,
};
```

**Solution:** Always return data that frontend is watching for

```typescript
// ✓ CORRECT: Frontend can detect 'packages' and trigger refresh
return {
  action: 'created',
  segmentId: segment.id,
  segmentName: segment.name,
  packages: createdPackages, // Frontend watches for this
  packageCount: createdPackages.length,
  hasDraft: true,
};
```

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/onboarding-executors.ts` lines 179-188

### Pitfall 4: Executor Doesn't Handle Tenant Isolation

**Problem:** Tool result includes data from wrong tenant's packages

```typescript
// ❌ WRONG: No tenantId check when reading packages
const packages = await tx.package.findMany({
  where: { segmentId: segment.id },
});
```

**Solution:** Always scope by tenantId

```typescript
// ✓ CORRECT: Tenant-scoped query
const packages = await tx.package.findMany({
  where: { segmentId: segment.id, tenantId },
});
```

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/onboarding-executors.ts` line 98

### Pitfall 5: PostMessage Used for Server-Rendered Content

**Problem:** Developer tries to update package prices via PostMessage, but iframe still shows old prices

```typescript
// ❌ WRONG: PostMessage can't update server-rendered content
const updateMessage = {
  type: 'BUILD_MODE_CONFIG_UPDATE',
  data: { packages: newPackages },
};
iframeRef.current.contentWindow.postMessage(updateMessage, origin);
```

**Solution:** Use full iframe reload via refreshPreview() for server-rendered data

```typescript
// ✓ CORRECT: Full iframe reload ensures fresh server rendering
agentUIActions.refreshPreview();
// iframe reloads, server re-renders with fresh data from DB
```

---

## Implementation Checklist

Use this checklist when implementing a new feature that modifies server-rendered preview content:

```
[ ] Executor returns packages/hasDraft indicator
[ ] Frontend handleToolComplete detects result type safely
[ ] Frontend calls agentUIActions.refreshPreview() with 150ms delay
[ ] PreviewPanel subscribes to selectPreviewRefreshKey
[ ] PreviewPanel skips initial 0 value (previewRefreshKey > 0 check)
[ ] PreviewPanel resets iframe state (loading, ready, error flags)
[ ] PreviewPanel sets iframe.src to trigger full reload
[ ] Iframe emits BUILD_MODE_READY after loading
[ ] E2E test verifies: package created → refresh triggered → preview updated
[ ] E2E test verifies: rapid updates → no errors
[ ] E2E test verifies: initial mount → no unnecessary reload
[ ] Code review: type safety on tool result extraction
[ ] Code review: tenant scoping in all DB queries
```

---

## Related Resources

- **Store Implementation:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/stores/agent-ui-store.ts`
- **Preview Component:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/preview/PreviewPanel.tsx`
- **Agent Integration:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/AgentPanel.tsx`
- **Executor Registration:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/onboarding-executors.ts`
- **Architecture:** `/Users/mikeyoung/CODING/MAIS/docs/architecture/BUILD_MODE_VISION.md`
- **Base Prevention:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-QUICK-REFERENCE.md`

---

## Quick Reference Commands

```bash
# Run iframe refresh tests
npm run test -- --grep "refresh|preview|iframe"

# Run full agent integration tests
npm run test:e2e -- agent-ui-control.spec.ts

# Check for stale refresh key issues
grep -r "previewRefreshKey" apps/web/src --include="*.ts" --include="*.tsx"

# Verify executor returns indicator data
grep -r "packages\|hasDraft" server/src/agent/executors --include="*.ts"
```

---

**Last Updated:** 2026-01-14
**Pattern Status:** Stable (in use for package updates, storefront branding)
**Pitfall Count:** 31 in global CLAUDE.md
