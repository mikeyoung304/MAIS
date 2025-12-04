---
title: 'React UI Patterns & Audit Logging Code Review Patterns'
category: 'code-review-patterns'
severity: ['p3']
components:
  - 'useVisualEditor'
  - 'EditablePackageCard'
  - 'PackageDraftService'
tags:
  - 'accessibility'
  - 'react-performance'
  - 'audit-logging'
  - 'window-confirm'
  - 'useMemo'
  - 'structured-logging'
  - 'code-review'
date_solved: '2025-12-02'
total_issues: 3
p3_issues: 3
related_todos: ['141', '142', '143']
---

# React UI Patterns & Audit Logging Code Review Patterns

## Problem Statement

During visual editor code review, three P3 issues were identified related to React UI patterns and backend logging. While not critical blockers, these patterns represent technical debt that compounds at scale and makes debugging difficult.

## Issues Identified

### P3 Quality Improvements

| ID   | Issue                                 | Category      | Impact                                     |
| ---- | ------------------------------------- | ------------- | ------------------------------------------ |
| #141 | window.confirm() anti-pattern         | Accessibility | Poor UX, not themeable, blocks main thread |
| #142 | Missing useMemo for calculated values | Performance   | Unnecessary recalculations on every render |
| #143 | Missing audit logging                 | Debugging     | No trail for draft operations              |

---

## Pattern 1: AlertDialog vs window.confirm()

### Detection: How to Spot the Anti-Pattern

**ESLint Search:**

```bash
# Search for window.confirm usage
grep -r "window\.confirm" client/src/

# Search for window.alert and window.prompt too
grep -rE "window\.(confirm|alert|prompt)" client/src/
```

**Visual Inspection:**
Look for:

- `if (!window.confirm(...))` in event handlers
- `const confirmed = window.confirm(...)`
- Any use of browser's built-in dialogs

**Why it's an anti-pattern:**

1. **Not themeable** - Doesn't match application design
2. **Accessibility issues** - Limited screen reader support
3. **Blocks main thread** - Synchronous, freezes UI
4. **No customization** - Can't add icons, formatting, or loading states
5. **Mobile UX** - Poor experience on touch devices

### Fix: Standard Solution

**Use Radix UI AlertDialog instead:**

```typescript
// ❌ BEFORE: Browser confirm (anti-pattern)
const discardAll = async () => {
  if (!window.confirm(`Are you sure you want to discard all ${draftCount} unsaved changes?`)) {
    return;
  }
  await performDiscard();
};

// ✅ AFTER: AlertDialog component
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const [showDiscardDialog, setShowDiscardDialog] = useState(false);

const handleDiscardClick = () => {
  setShowDiscardDialog(true);
};

const handleConfirmDiscard = async () => {
  setShowDiscardDialog(false);
  await performDiscard();
};

// In JSX:
<>
  <Button onClick={handleDiscardClick} variant="destructive">
    Discard All
  </Button>

  <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard All Changes?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to discard all {draftCount} unsaved changes?
          This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={handleConfirmDiscard}
          className="bg-destructive"
        >
          Discard All
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</>
```

### Example: Complete Implementation

See working examples in codebase:

- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/BlackoutsManager/DeleteConfirmationDialog.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/photos/PhotoDeleteDialog.tsx`

**Complete Example (DeleteConfirmationDialog):**

```typescript
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemToDelete: ItemDto | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  itemToDelete,
  onConfirm,
  onCancel
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-macon-navy-800 border-white/20">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-danger-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-danger-700" />
            </div>
            <AlertDialogTitle className="text-2xl">Delete Item?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-macon-navy-600 dark:text-white/60">
            Are you sure you want to delete this item? This action cannot be undone.
          </AlertDialogDescription>
          <div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-sm text-danger-800 dark:text-danger-300 font-medium">
              ⚠️ This action cannot be undone
            </p>
            <ul className="mt-2 text-sm text-danger-700 dark:text-danger-400 space-y-1 list-disc list-inside">
              <li>All associated data will be removed</li>
              <li>This change is permanent</li>
            </ul>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={onCancel}
            className="bg-macon-navy-100 hover:bg-macon-navy-200 text-macon-navy-900 border-macon-navy-300"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Item
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Code Review Checklist: AlertDialog Pattern

When reviewing confirmation flows:

- [ ] No `window.confirm()`, `window.alert()`, or `window.prompt()` usage
- [ ] Uses AlertDialog component from `@/components/ui/alert-dialog`
- [ ] Dialog has proper open/close state management
- [ ] Dialog includes clear title and description
- [ ] Action buttons are clearly labeled (not just "OK" / "Cancel")
- [ ] Destructive actions use danger/destructive styling
- [ ] Dialog is keyboard accessible (Escape to close, Tab navigation)
- [ ] Focus is returned to trigger element after close
- [ ] Dialog includes icon for visual hierarchy (optional but recommended)
- [ ] "Cannot be undone" warnings for destructive actions

**ESLint Rule to Enforce:**

```json
{
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "name": "confirm",
        "message": "Use AlertDialog component instead of window.confirm()"
      },
      {
        "name": "alert",
        "message": "Use toast notifications or Dialog component instead of window.alert()"
      },
      {
        "name": "prompt",
        "message": "Use Dialog with form fields instead of window.prompt()"
      }
    ]
  }
}
```

---

## Pattern 2: useMemo for Derived Values

### Detection: How to Spot Missing Memoization

**Visual Inspection:**
Look for calculated values inside functional components that are:

1. Computed from props or state
2. Used multiple times in render
3. Not wrapped in `useMemo()`
4. Involving object/array operations, filtering, or transformations

**Common patterns that need memoization:**

```typescript
// ❌ Recalculated on EVERY render
const effectiveTitle = pkg.draftTitle ?? pkg.title;
const effectiveDescription = pkg.draftDescription ?? pkg.description ?? '';
const effectivePriceCents = pkg.draftPriceCents ?? pkg.priceCents;

// ❌ Boolean checks recalculated on EVERY render
const hasTitleDraft = pkg.draftTitle !== null && pkg.draftTitle !== pkg.title;
const hasDescriptionDraft =
  pkg.draftDescription !== null && pkg.draftDescription !== pkg.description;

// ❌ Array operations recalculated on EVERY render
const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
const filteredItems = items.filter((item) => item.active);
```

**Grep search for potential issues:**

```bash
# Find components with many derived values
grep -A 20 "export.*function.*Component" client/src/**/*.tsx | grep -E "(const .* = .*\?\?|const .* = .*\.filter|const .* = .*\.map|const .* = .*\.sort)"
```

### Fix: Standard Solution

**When to use useMemo:**

- Expensive calculations (array operations, filtering, sorting)
- Derived objects/arrays used as props (prevents unnecessary re-renders)
- Values used in multiple places in render
- Boolean flags derived from complex comparisons

**When NOT to use useMemo:**

- Simple primitive assignments (`const x = 5`)
- Single string concatenation
- Values only used once
- Premature optimization (profile first!)

```typescript
// ❌ BEFORE: Recalculated on every render
const effectiveTitle = pkg.draftTitle ?? pkg.title;
const effectiveDescription = pkg.draftDescription ?? pkg.description ?? '';
const effectivePriceCents = pkg.draftPriceCents ?? pkg.priceCents;
const effectivePhotos = pkg.draftPhotos ?? pkg.photos ?? [];

const hasTitleDraft = pkg.draftTitle !== null && pkg.draftTitle !== pkg.title;
const hasDescriptionDraft =
  pkg.draftDescription !== null && pkg.draftDescription !== pkg.description;
const hasPriceDraft = pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents;
const hasPhotoDraft = pkg.draftPhotos !== null;

// ✅ AFTER: Memoized (recalculated only when dependencies change)
const effectiveValues = useMemo(
  () => ({
    title: pkg.draftTitle ?? pkg.title,
    description: pkg.draftDescription ?? pkg.description ?? '',
    priceCents: pkg.draftPriceCents ?? pkg.priceCents,
    photos: pkg.draftPhotos ?? pkg.photos ?? [],
  }),
  [
    pkg.draftTitle,
    pkg.title,
    pkg.draftDescription,
    pkg.description,
    pkg.draftPriceCents,
    pkg.priceCents,
    pkg.draftPhotos,
    pkg.photos,
  ]
);

const draftFlags = useMemo(
  () => ({
    hasTitle: pkg.draftTitle !== null && pkg.draftTitle !== pkg.title,
    hasDescription: pkg.draftDescription !== null && pkg.draftDescription !== pkg.description,
    hasPrice: pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents,
    hasPhotos: pkg.draftPhotos !== null,
  }),
  [
    pkg.draftTitle,
    pkg.title,
    pkg.draftDescription,
    pkg.description,
    pkg.draftPriceCents,
    pkg.priceCents,
    pkg.draftPhotos,
  ]
);
```

### Example: Complete Implementation

See working example in:

- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx`

**Complete Example:**

```typescript
import { useMemo } from "react";

export function EditablePackageCard({
  package: pkg,
  onUpdate,
  onPhotosChange,
  disabled = false,
}: EditablePackageCardProps) {
  // Memoize effective values (draft ?? live)
  const effectiveValues = useMemo(() => ({
    title: pkg.draftTitle ?? pkg.title,
    description: pkg.draftDescription ?? pkg.description ?? "",
    priceCents: pkg.draftPriceCents ?? pkg.priceCents,
    photos: pkg.draftPhotos ?? pkg.photos ?? [],
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos, pkg.photos
  ]);

  // Memoize draft detection flags
  const draftFlags = useMemo(() => ({
    hasTitle: pkg.draftTitle !== null && pkg.draftTitle !== pkg.title,
    hasDescription: pkg.draftDescription !== null && pkg.draftDescription !== pkg.description,
    hasPrice: pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents,
    hasPhotos: pkg.draftPhotos !== null,
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos
  ]);

  // Get primary photo for card display
  const primaryPhoto = effectiveValues.photos[0]?.url || pkg.photoUrl;

  return (
    <Card>
      {/* Use memoized values */}
      <h3>{effectiveValues.title}</h3>
      <p>{effectiveValues.description}</p>
      <span>${(effectiveValues.priceCents / 100).toFixed(2)}</span>

      {/* Draft indicators */}
      {draftFlags.hasTitle && <Badge>Draft Title</Badge>}
      {draftFlags.hasPrice && <Badge>Draft Price</Badge>}
    </Card>
  );
}
```

### Alternative: React.memo for Component-Level Optimization

For components that render frequently with the same props:

```typescript
// ✅ Wrap entire component with React.memo
export const EditablePackageCard = React.memo(function EditablePackageCard({
  package: pkg,
  onUpdate,
  onPhotosChange,
  disabled = false,
}: EditablePackageCardProps) {
  // Component only re-renders if props change
  // ...
});

// ✅ With custom comparison for complex props
export const EditablePackageCard = React.memo(
  function EditablePackageCard(props) {
    // ...
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return (
      prevProps.package.id === nextProps.package.id && prevProps.disabled === nextProps.disabled
    );
  }
);
```

### Code Review Checklist: useMemo Pattern

When reviewing component performance:

- [ ] Derived values are wrapped in `useMemo()` if:
  - [ ] Used multiple times in render
  - [ ] Involve array/object operations
  - [ ] Depend on props/state that change frequently
- [ ] `useMemo()` dependencies are complete and accurate
- [ ] No premature optimization (only memoize if profiled or obvious)
- [ ] Consider `React.memo()` for components that re-render with same props
- [ ] Expensive list operations use `useMemo()` (filter, map, sort)
- [ ] Objects/arrays passed as props are memoized (prevents child re-renders)

**ESLint Plugin to Enforce:**

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

**Performance Profiling:**

```bash
# Use React DevTools Profiler to identify unnecessary re-renders
# Look for components with high render counts but no prop changes
```

---

## Pattern 3: Audit Logging for Important Operations

### Detection: How to Spot Missing Audit Logs

**Visual Inspection:**
Look for service methods that:

1. Modify data (create, update, delete)
2. Publish/discard changes
3. Change tenant configuration
4. Process payments or refunds
5. Grant/revoke access

**Grep search for missing logs:**

```bash
# Find service methods without logger calls
grep -A 30 "async.*publish\|async.*discard\|async.*delete" server/src/services/*.ts | grep -v "logger\."

# Find mutation methods missing logger
grep -E "async (create|update|delete|save|publish|discard)" server/src/services/*.ts -A 15 | grep -L "logger\."
```

**Common patterns that need audit logging:**

```typescript
// ❌ No audit trail - what changed? who changed it? when?
async saveDraft(tenantId: string, packageId: string, draft: UpdatePackageDraftInput) {
  return this.repository.updateDraft(tenantId, packageId, draft);
}

// ❌ No audit trail - what was discarded?
async discardDrafts(tenantId: string, packageIds?: string[]) {
  const count = await this.repository.discardDrafts(tenantId, packageIds);
  return { discarded: count };
}
```

### Fix: Standard Solution

**What to log:**

- **Action performed** (`package_draft_saved`, `package_drafts_published`, etc.)
- **Tenant ID** (for multi-tenant filtering)
- **Resource ID** (package ID, segment ID, etc.)
- **Changed fields** (what specifically changed)
- **Count of affected records** (for bulk operations)
- **Metadata** (timestamps handled by logger)

**What NOT to log:**

- PII (personally identifiable information)
- Secrets or credentials
- Full request/response bodies (use filtered/sanitized versions)
- Large binary data

```typescript
// ❌ BEFORE: No audit trail
async saveDraft(
  tenantId: string,
  packageId: string,
  draft: UpdatePackageDraftInput
): Promise<PackageWithDraft> {
  const existing = await this.repository.getPackageById(tenantId, packageId);
  if (!existing) {
    throw new NotFoundError(`Package with id "${packageId}" not found`);
  }
  return this.repository.updateDraft(tenantId, packageId, draft);
}

// ✅ AFTER: Structured audit logging
import { logger } from '../lib/core/logger';

async saveDraft(
  tenantId: string,
  packageId: string,
  draft: UpdatePackageDraftInput
): Promise<PackageWithDraft> {
  const existing = await this.repository.getPackageById(tenantId, packageId);
  if (!existing) {
    throw new NotFoundError(`Package with id "${packageId}" not found`);
  }

  const result = await this.repository.updateDraft(tenantId, packageId, draft);

  // Audit log with structured data
  logger.info({
    action: 'package_draft_saved',
    tenantId,
    packageId,
    packageSlug: existing.slug,
    changedFields: Object.keys(draft).filter(
      k => draft[k as keyof UpdatePackageDraftInput] !== undefined
    ),
  }, 'Package draft saved');

  return result;
}
```

### Example: Complete Implementation

See working example in:

- `/Users/mikeyoung/CODING/MAIS/server/src/services/package-draft.service.ts`

**Complete Example (Package Draft Service):**

```typescript
import { logger } from '../lib/core/logger';

export class PackageDraftService {
  /**
   * Save a draft for a package (autosave target)
   */
  async saveDraft(
    tenantId: string,
    packageId: string,
    draft: UpdatePackageDraftInput
  ): Promise<PackageWithDraft> {
    const existing = await this.repository.getPackageById(tenantId, packageId);
    if (!existing) {
      throw new NotFoundError(`Package with id "${packageId}" not found`);
    }

    const result = await this.repository.updateDraft(tenantId, packageId, draft);

    // Audit log for draft save
    logger.info(
      {
        action: 'package_draft_saved',
        tenantId,
        packageId,
        packageSlug: existing.slug,
        changedFields: Object.keys(draft).filter(
          (k) => draft[k as keyof UpdatePackageDraftInput] !== undefined
        ),
      },
      'Package draft saved'
    );

    return result;
  }

  /**
   * Publish all drafts to live values
   */
  async publishDrafts(
    tenantId: string,
    packageIds?: string[]
  ): Promise<{ published: number; packages: Package[] }> {
    const packages = await this.repository.publishDrafts(tenantId, packageIds);

    await this.invalidateCatalogCache(tenantId);

    // Audit log for publish operation
    logger.info(
      {
        action: 'package_drafts_published',
        tenantId,
        publishedCount: packages.length,
        packageIds: packages.map((p) => p.id),
        packageSlugs: packages.map((p) => p.slug),
      },
      `Published ${packages.length} package draft(s)`
    );

    return {
      published: packages.length,
      packages,
    };
  }

  /**
   * Discard all drafts without publishing
   */
  async discardDrafts(tenantId: string, packageIds?: string[]): Promise<{ discarded: number }> {
    // Log BEFORE discard to capture what will be lost
    const draftCount = await this.repository.countDrafts(tenantId);

    const discarded = await this.repository.discardDrafts(tenantId, packageIds);

    // Audit log for discard operation
    logger.info(
      {
        action: 'package_drafts_discarded',
        tenantId,
        discardedCount: discarded,
        requestedPackageIds: packageIds ?? 'all',
        previousDraftCount: draftCount,
      },
      `Discarded ${discarded} package draft(s)`
    );

    return { discarded };
  }
}
```

### Log Levels Guide

**Use the right log level:**

```typescript
// logger.info - Normal operations, audit trail
logger.info({ action: 'package_created', tenantId, packageId }, 'Package created');

// logger.warn - Unexpected but handled situations
logger.warn({ tenantId, segmentId }, 'Segment not found, package created without segment');

// logger.error - Errors requiring attention
logger.error({ tenantId, error }, 'Failed to sync with Stripe');

// logger.debug - Development/troubleshooting (not in production logs)
logger.debug({ query, params }, 'Executing database query');
```

### Code Review Checklist: Audit Logging Pattern

When reviewing service methods:

- [ ] All data mutations have structured audit logs
- [ ] Logs include:
  - [ ] Action name (kebab-case: `package_draft_saved`)
  - [ ] Tenant ID (for multi-tenant filtering)
  - [ ] Resource ID(s) (package ID, segment ID, etc.)
  - [ ] Changed fields or count of affected records
- [ ] Logs use `logger` from `lib/core/logger` (NOT `console.log`)
- [ ] Log level is appropriate (info, warn, error, debug)
- [ ] No PII, secrets, or large binary data in logs
- [ ] Destructive operations log BEFORE action (capture what will be lost)
- [ ] Human-readable message included (second parameter)
- [ ] Structured data uses consistent naming (camelCase keys)

**ESLint Rule to Enforce:**

```json
{
  "rules": {
    "no-console": [
      "error",
      {
        "allow": []
      }
    ]
  }
}
```

**Grep Commands for Self-Review:**

```bash
# Check for console.log violations
grep -r "console\." server/src/services/ server/src/routes/

# Verify all mutations have logger calls
grep -E "async (create|update|delete|save|publish|discard)" server/src/services/*.ts -A 20 | grep "logger\."
```

---

## Quick Reference: Decision Tree

### Should I use AlertDialog or window.confirm()?

```
Need user confirmation?
  ├─ For development/testing only? → window.confirm() (acceptable)
  └─ For production code? → AlertDialog component (required)
```

### Should I use useMemo()?

```
Calculating derived value?
  ├─ Simple primitive (const x = a + b)? → No useMemo needed
  ├─ Array operations (filter/map/sort)? → YES, use useMemo
  ├─ Object/array passed as prop? → YES, use useMemo
  ├─ Complex boolean logic? → YES, use useMemo
  ├─ Used once in render? → Profile first, probably no
  └─ Used multiple times? → YES, use useMemo
```

### Should I add audit logging?

```
Service method modifies data?
  ├─ Creates/updates/deletes records? → YES, log it
  ├─ Publishes/discards changes? → YES, log it
  ├─ Changes tenant configuration? → YES, log it
  ├─ Processes payment/refund? → YES, log it
  ├─ Read-only operation? → Usually no (unless sensitive access)
  └─ When in doubt? → Log it (better to have too many than too few)
```

---

## Summary: Before You Commit

**React UI Patterns:**

1. No `window.confirm()` - use `<AlertDialog>` instead
2. Memoize derived values with `useMemo()` (especially array operations)
3. Memoize event handlers with `useCallback()` if passed to memoized children

**Backend Audit Logging:**

1. All mutations log action name, tenant ID, resource ID, and changed fields
2. Use `logger.info()` for audit trail (NOT `console.log`)
3. Log BEFORE destructive operations (capture what will be lost)

**Self-Review Commands:**

```bash
# Check for window.confirm violations
grep -r "window\.confirm" client/src/

# Check for console.log violations
grep -r "console\." server/src/services/ server/src/routes/

# Check mutations have logger calls
grep -E "async (create|update|delete)" server/src/services/*.ts -A 20 | grep "logger\."
```

---

## Related Documentation

- [Prevention Quick Reference](/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-QUICK-REFERENCE.md)
- [Prevention Strategies Index](/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-STRATEGIES-INDEX.md)
- [React Hooks Performance & WCAG Review](/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/react-hooks-performance-wcag-review.md)
- shadcn/ui AlertDialog: https://ui.shadcn.com/docs/components/alert-dialog
- React useMemo: https://react.dev/reference/react/useMemo
- React.memo: https://react.dev/reference/react/memo

---

## Version History

| Date       | Version | Changes                                                                      |
| ---------- | ------- | ---------------------------------------------------------------------------- |
| 2025-12-02 | 1.0     | Initial version: AlertDialog pattern, useMemo pattern, audit logging pattern |
