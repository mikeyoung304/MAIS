---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: server/types, routes
severity: P2
related_commit: e2d6545
tags: [type-safety, express, middleware, declaration-files, typescript]
---

# Quick Reference: Express Middleware Type Safety

## The Problem

```typescript
// ❌ TypeScript Error: Property 'tenantId' does not exist on type 'Request'
const tenantId = req.tenantId;

// ❌ TypeScript Error: Cannot assign to 'tenantId' on 'Request'
req.tenantId = extractedTenantId;
```

Middleware adds properties at runtime that TypeScript doesn't know about.

## The Solution (30 seconds)

### Step 1: Create Declaration File

```typescript
// server/src/types/express.d.ts
import type { TenantTokenPayload } from '../lib/ports';

declare global {
  namespace Express {
    interface Request {
      /** Tenant ID set by tenant middleware for public routes */
      tenantId?: string;
    }
    interface Locals {
      tenantAuth?: TenantTokenPayload;
      logger?: any;
    }
  }
}
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "typeRoots": ["./src/types", "./node_modules/@types"]
  }
}
```

### Step 3: Use Safely

```typescript
// ✅ Now type-safe
const tenantId = req.tenantId;

// ✅ Middleware can assign
app.use((req, res, next) => {
  req.tenantId = extractTenant(req);
  next();
});
```

## Pattern Template

```typescript
// server/src/types/express.d.ts

declare global {
  namespace Express {
    interface Request {
      // PUBLIC routes (no auth required)
      tenantId?: string; // From X-Tenant-Key header
      // or
      sessionId?: string; // From URL/header

      // PROTECTED routes (auth required)
      userId?: string; // From JWT
      auth?: { userId: string }; // Full auth object
    }

    interface Locals {
      tenantAuth?: {
        tenantId: string;
        role: string;
      };
    }
  }
}
```

## Usage by Route Type

### Public Routes (No Auth)

```typescript
// server/src/routes/public-customer-chat.routes.ts
app.use((req, res, next) => {
  req.tenantId = extractTenant(req); // ✅ Type-safe
  next();
});

app.get('/chat', (req, res) => {
  const tenantId = req.tenantId; // ✅ Can be undefined
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant' });
    return;
  }
  // tenantId is now narrowed to string
});
```

### Protected Routes (With Auth)

```typescript
// server/src/routes/admin.routes.ts
app.use((req, res, next) => {
  const user = verifyJWT(req.headers.authorization);
  req.userId = user.id; // ✅ Type-safe
  next();
});

app.get('/admin', (req, res) => {
  const userId = req.userId!; // ✅ Know it exists (middleware ran)
  // Proceed with userId...
});
```

## Type Narrowing Pattern

```typescript
// ✅ Option 1: Optional + null check
if (req.tenantId) {
  // req.tenantId is now string (not undefined)
  const tenantId = req.tenantId;
}

// ✅ Option 2: Non-null assertion (if you control middleware)
const tenantId = req.tenantId!;

// ✅ Option 3: Helper function
function getTenantId(req: Request): string | null {
  return req.tenantId ?? null;
}
```

## Advanced Pattern: Multiple Middleware Layers

```typescript
// server/src/types/express.d.ts

declare global {
  namespace Express {
    interface Request {
      // Layer 1: Public middleware (always runs)
      tenantId?: string;

      // Layer 2: Optional auth middleware
      userId?: string;
      auth?: { userId: string; role: string };

      // Layer 3: Custom middleware
      logger?: any;
      requestId?: string;
    }
  }
}

// Usage:
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID(); // ✅ All routes have requestId
  next();
});

app.use(publicTenantMiddleware); // ✅ Public routes have tenantId

app.use(optionalAuthMiddleware); // ✅ Routes can check req.userId

app.get('/public', (req, res) => {
  // Has: tenantId, requestId
  // May have: userId
});

app.get('/admin', (req, res) => {
  // Has: tenantId, requestId, userId (or 403 from middleware)
  const userId = req.userId!;
});
```

## Strict Mode Check

Enable TypeScript strict mode to catch missing properties:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true
  }
}
```

## File Structure

```
server/src/
├── types/
│   └── express.d.ts          ← ✅ Augment Express here
├── middleware/
│   ├── tenant.ts             ← Sets req.tenantId
│   └── auth.ts               ← Sets req.userId
└── routes/
    └── *.routes.ts           ← Uses req.tenantId, req.userId
```

## Checklist for Review

- [ ] Middleware properties declared in `express.d.ts`?
- [ ] `declare global` used for Express augmentation?
- [ ] `typeRoots` includes `./src/types` in tsconfig.json?
- [ ] No `req as any` workarounds?
- [ ] Middleware sets typed properties before next()?
- [ ] Routes safely check for properties (null checks)?

## ESLint Rules

```javascript
// .eslintrc.js
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error'
  }
}
```

## Common Mistakes

| Mistake                     | Problem                    | Fix                                      |
| --------------------------- | -------------------------- | ---------------------------------------- |
| Declare in individual files | Not global                 | Use `express.d.ts` with `declare global` |
| Use `as any` to bypass      | Hide real type issues      | Add to declaration file instead          |
| Optional on required props  | Type confusion             | Set properly in middleware               |
| Forget `declare global`     | Not visible in other files | Add the keyword                          |
| Multiple declaration files  | Conflicting types          | One `express.d.ts` only                  |

## Testing Declaration Files

```typescript
// test/types.test.ts
import type { Request } from 'express';

test('Request has tenantId property', () => {
  const req: Request = {} as any;
  // This should compile without errors:
  const tenantId: string | undefined = req.tenantId;
  expect(tenantId).toBeUndefined();
});
```

---

**Use This Document:** When adding middleware that sets properties on Request
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #2
