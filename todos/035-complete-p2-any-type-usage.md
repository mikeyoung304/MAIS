---
status: complete
priority: p2
issue_id: '035'
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Multiple `any` Type Usage Without Justification

## Problem Statement

Widespread use of `any` type in route handlers and middleware violates strict TypeScript requirement from CLAUDE.md.

**Why this matters:** Type safety bypass enables runtime errors to slip through, defeating purpose of TypeScript.

## Findings

### Code Evidence

**Location:** `server/src/routes/index.ts`

- Line 296: `} as any)` - ts-rest router type assertion

**Location:** `server/src/middleware/tenant.ts`

- Line 17: `branding: any` - Prisma Json field without proper typing

## Solution Implemented

### TenantBranding Interface

Created proper TypeScript interface for Prisma Json field:

```typescript
export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logo?: string;
  [key: string]: unknown; // Allow additional properties for future extensibility
}
```

### ts-rest Type Assertion

Replaced `as any` with documented type assertion:

```typescript
type RouterImplementation = ReturnType<typeof s.router>;
// ... router implementation ...
}) as RouterImplementation
```

Added detailed comment explaining ts-rest v3 has known type compatibility issues with Express 4.x middleware signatures.

## Acceptance Criteria

- [x] No `any` types in route handlers
- [x] Custom request types defined (TenantBranding interface)
- [x] Multer file types properly typed (Express.Multer.File)
- [x] TypeScript strict mode passes (npm run typecheck: ✅)
- [x] All tests pass (913 passing, 1 pre-existing failure unrelated)

## Work Log

| Date       | Action   | Notes                                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 2025-11-27 | Created  | Found during code quality review                                                                        |
| 2025-12-02 | Resolved | Created TenantBranding interface, replaced `as any` with documented type assertion, all typechecks pass |
