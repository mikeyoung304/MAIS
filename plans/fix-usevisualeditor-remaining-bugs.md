# Visual Editor: Ship Existing Fixes + Add E2E Tests

## Overview

Two bugs in the visual editor have already been fixed. This plan documents shipping those fixes and adding E2E test coverage to prevent regressions.

## Status Summary

| Bug                                       | Priority | Status                                       |
| ----------------------------------------- | -------- | -------------------------------------------- |
| Draft Field Deletion Loss (`??` operator) | P1       | **FIXED** in `catalog.repository.ts:506-511` |
| Type Assertion `as any`                   | P1       | **FIXED** in `EditableText.tsx:47-48`        |
| Race condition in publishAll              | P2       | **WONTFIX** - theoretical, UI already locks  |

## What Was Fixed

### Fix 1: Draft Field Deletion Loss

**Problem:** Using `??` operator prevented intentional field clearing (empty strings fell back to original).

**Solution (already applied):**

```typescript
// catalog.repository.ts:506-511
name: pkg.draftTitle !== null ? pkg.draftTitle : pkg.name,
description: pkg.draftDescription !== null ? pkg.draftDescription : pkg.description,
basePrice: pkg.draftPriceCents !== null ? pkg.draftPriceCents : pkg.basePrice,
```

### Fix 2: Type Safety for Refs

**Problem:** Using `ref: inputRef as any` to bypass TypeScript.

**Solution (already applied):**

```typescript
// EditableText.tsx:47-48
const inputRef = useRef<HTMLInputElement>(null);
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

### Why We're Skipping the Race Condition Fix

Per DHH-style review:

- The UI already locks with `setIsPublishing(true)`
- Race window is ~16ms (1 React frame)
- No evidence this has ever occurred in production
- The proposed fix would add `packages` to deps, causing more re-renders

## E2E Test Coverage

Create `e2e/tests/visual-editor.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTenantAdmin, createTestTenant } from '../helpers';

test.describe('Visual Editor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTenantAdmin(page);
    await page.goto('/tenant/visual-editor');
  });

  test('loads packages in visual editor', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /visual editor/i })).toBeVisible();
    await expect(page.locator('[data-testid="package-card"]').first()).toBeVisible();
  });

  test('edits package title inline', async ({ page }) => {
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    await titleField.fill('Updated Package Title');
    await titleField.blur();

    // Verify draft indicator appears
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('edits package price inline', async ({ page }) => {
    const priceField = page.locator('[aria-label="Package price"]').first();
    await priceField.click();
    await priceField.fill('99.99');
    await priceField.blur();

    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('edits package description inline', async ({ page }) => {
    // Expand card first
    await page.getByRole('button', { name: /more/i }).first().click();

    const descField = page.locator('[aria-label="Package description"]').first();
    await descField.click();
    await descField.fill('Updated description text');
    await descField.blur();

    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('auto-saves draft after 1s debounce', async ({ page }) => {
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    await titleField.fill('Auto-save test');
    await titleField.blur();

    // Wait for debounce + save
    await page.waitForTimeout(1500);

    // Reload and verify draft persisted
    await page.reload();
    await expect(page.locator('[aria-label="Package title"]').first()).toHaveValue(
      'Auto-save test'
    );
  });

  test('publishes all drafts', async ({ page }) => {
    // Make an edit
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    await titleField.fill('Published Title');
    await titleField.blur();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Publish
    await page.getByRole('button', { name: /publish all/i }).click();
    await expect(page.getByText(/published \d+ package/i)).toBeVisible();

    // Verify no more draft indicator
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();
  });

  test('discards all drafts', async ({ page }) => {
    // Make an edit
    const titleField = page.locator('[aria-label="Package title"]').first();
    const originalValue = await titleField.inputValue();

    await titleField.click();
    await titleField.fill('Will be discarded');
    await titleField.blur();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Discard
    await page.getByRole('button', { name: /discard all/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click(); // Confirmation dialog

    await expect(page.getByText(/discarded/i)).toBeVisible();
    await expect(titleField).toHaveValue(originalValue);
  });

  test('UI is disabled during publish', async ({ page }) => {
    // Make an edit first
    const titleField = page.locator('[aria-label="Package title"]').first();
    await titleField.click();
    await titleField.fill('Test');
    await titleField.blur();
    await page.waitForTimeout(1500);

    // Click publish and immediately check disabled state
    await page.getByRole('button', { name: /publish all/i }).click();

    // Fields should be disabled during publish
    await expect(titleField).toBeDisabled();
  });
});
```

## Acceptance Criteria

- [ ] Existing fixes verified working (manual test)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (771 server tests)
- [ ] E2E tests created and passing
- [ ] Manual verification: edit → auto-save → publish flow works

## Implementation Steps

1. **Verify existing fixes** (5 min)

   ```bash
   npm run typecheck
   npm test
   ```

2. **Create E2E test file** (15 min)
   - Create `e2e/tests/visual-editor.spec.ts`
   - Add test helpers if needed

3. **Run E2E tests** (5 min)

   ```bash
   npm run test:e2e -- e2e/tests/visual-editor.spec.ts
   ```

4. **Commit and ship**
   ```bash
   git add .
   git commit -m "test(visual-editor): add E2E coverage for inline editing"
   ```

## Files to Create/Modify

```
e2e/tests/
└── visual-editor.spec.ts (NEW - E2E tests)
```

No code changes needed - fixes are already in place.
