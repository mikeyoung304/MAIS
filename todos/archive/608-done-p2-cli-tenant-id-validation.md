# P2: CLI Tenant ID Option Lacks Validation

**Status:** open
**Priority:** P2 (Important)
**Category:** Security
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 83-84

## Problem

The `--tenant-id` argument is accepted without validation:

```typescript
} else if (arg.startsWith('--tenant-id=')) {
  options.tenantId = arg.split('=')[1]; // No validation
}
```

**Issues:**

1. Empty string (`--tenant-id=`) silently sets `tenantId: ''`
2. Malformed input causes confusing "no tenants found" message
3. No UUID format check

## Fix

Add basic validation:

```typescript
} else if (arg.startsWith('--tenant-id=')) {
  const tenantId = arg.split('=')[1]?.trim();
  if (!tenantId) {
    console.error('Error: --tenant-id requires a value');
    process.exit(1);
  }
  // Optional: UUID format check
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    console.error('Error: --tenant-id must be a valid UUID');
    process.exit(1);
  }
  options.tenantId = tenantId;
}
```

## Source

Code review of commit b2cab182 - Security reviewer finding
