# ADK Agent Deployment TypeScript Errors - Complete Solution

**Problem:** The Project Hub agent failed to build for Render Cloud Run deployment with three critical TypeScript errors that prevent compilation.

**Status:** RESOLVED - All three errors fixed and agent successfully deployed.

---

## Error Summary

| Error                   | Code   | Issue                                                                        | Fix                                                           |
| ----------------------- | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Import outside rootDir  | TS6059 | Importing from `../../../shared/tenant-context.ts` violates tsconfig rootDir | Inline the utility function                                   |
| Type not narrowed       | TS2322 | `INTERNAL_API_SECRET` could be undefined in headers object                   | Create intermediate variable, check, assign to typed constant |
| Argument count mismatch | TS2554 | Function called with 2 arguments but inlined version takes 1                 | Remove second argument when calling inlined function          |

---

## Fix 1: TS6059 - Import outside rootDir

### The Problem

**TypeScript Error:**

```
error TS6059: File is not under 'rootDir'.
Outgoing: ../../../shared/tenant-context.ts
```

**Root Cause:** The agent's `tsconfig.json` specifies `"rootDir": "./src"`, which means all imports must resolve within the `src/` directory. Importing from `../../../shared/tenant-context.ts` (outside the agent package) violates this constraint.

The original pattern was:

```typescript
// BROKEN - TS6059 error
import { getTenantId } from '../../../shared/tenant-context';
```

### The Solution

Inline the `getTenantId` utility function directly in `agent.ts`. This function is critical for extracting the tenant ID from ADK's ToolContext using a 4-tier defensive pattern.

**Location in file:** Lines 19-61

```typescript
// =============================================================================
// TENANT CONTEXT UTILITIES (inlined from shared/tenant-context.ts for deployment)
// =============================================================================

/**
 * Extract tenant ID from ADK ToolContext using 4-tier defensive pattern.
 * Handles: state.get(), state object, userId with colon, userId direct.
 */
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;

  // Tier 1: Map-like API (direct ADK)
  try {
    const fromState = context.state?.get<string>('tenantId');
    if (fromState) return fromState;
  } catch {
    // state.get() might not be available
  }

  // Tier 2: Plain object access (A2A protocol)
  try {
    const stateObj = context.state as unknown as Record<string, unknown>;
    if (stateObj && typeof stateObj === 'object' && 'tenantId' in stateObj) {
      const tenantId = stateObj.tenantId as string;
      if (tenantId) return tenantId;
    }
  } catch {
    // state object access failed
  }

  // Tier 3 & 4: Extract from userId (format: "tenantId:userId" or just tenantId)
  const userId = context.invocationContext?.session?.userId;
  if (userId) {
    if (userId.includes(':')) {
      const [tenantId] = userId.split(':');
      if (tenantId) return tenantId;
    } else {
      return userId;
    }
  }

  return null;
}
```

### Why This Works

1. **No imports across package boundaries** - The function is self-contained within agent.ts
2. **tsconfig.json compliance** - All code exists within `rootDir: "./src"`
3. **Maintains 4-tier pattern** - Handles all possible tenantId locations in ADK context
4. **Type-safe** - Properly typed return value `string | null`

---

## Fix 2: TS2322 - Type not narrowed

### The Problem

**TypeScript Error:**

```
error TS2322: Type 'string | undefined' is not assignable to type 'string'.
```

**Location in code:** Lines 91-96

**Root Cause:** Environment variables are typed as `string | undefined`. When using `process.env.INTERNAL_API_SECRET` directly in the headers object, TypeScript cannot guarantee it's a string (not undefined).

The broken pattern:

```typescript
// BROKEN - TS2322 error
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
// Later: headers: { 'x-internal-secret': INTERNAL_API_SECRET }  // Error: could be undefined
```

### The Solution

Use a two-step pattern: create an intermediate variable, validate it exists, then assign to a typed constant.

**Implementation:**

```typescript
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
// TypeScript doesn't narrow module-level vars, so we create a typed constant
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
```

### How It Works

1. **Step 1** - Get raw value: `const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;`
   - Type is `string | undefined`

2. **Step 2** - Validate and fail-fast: `if (!_INTERNAL_API_SECRET) throw new Error(...)`
   - Ensures the value exists before proceeding
   - Provides clear error message for debugging

3. **Step 3** - Assign to typed constant: `const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;`
   - TypeScript recognizes this as safe narrowing
   - The constant is now guaranteed to be `string`

### Why This Approach

- **Type-safe** - TypeScript compiler validates the assignment
- **Fail-fast** - Missing env var throws immediately at startup
- **Clear intent** - Code explicitly documents the requirement
- **Debugging** - Error message tells operator what's missing

### Usage in Headers

Now safe to use in headers:

```typescript
const response = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Secret': INTERNAL_API_SECRET, // ✅ No error - guaranteed string
  },
});
```

---

## Fix 3: TS2554 - Argument count mismatch

### The Problem

**TypeScript Error:**

```
error TS2554: Expected 1 argument, but got 2.
```

**Root Cause:** When the original `getTenantId` was imported from `shared/tenant-context.ts`, it had a different signature that accepted an options parameter:

```typescript
// Original shared function signature
function getTenantId(
  context: ToolContext | undefined,
  options?: { agentName: string }
): string | null;
```

But the inlined version (Fix 1) only accepts one parameter:

```typescript
// Inlined function signature
function getTenantId(context: ToolContext | undefined): string | null;
```

When both versions exist in the codebase, existing code calling with two arguments will fail TypeScript checking against the inlined version.

### The Solution

Remove the second argument when calling the inlined `getTenantId` function.

**Search and replace pattern:**

```typescript
// BEFORE (broken)
const tenantId = getTenantId(ctx, { agentName: 'ProjectHub' });

// AFTER (working)
const tenantId = getTenantId(ctx);
```

### Locations in Code

The `getTenantId` function is called in two places:

1. **Line 395** - In `getContextFromSession()` helper:

   ```typescript
   function getContextFromSession(ctx: ToolContext): SessionContext {
     const tenantId = getTenantId(ctx); // ✅ Single argument
     if (!tenantId) {
       // error handling...
     }
   }
   ```

2. **Line 27** - Function definition itself is single-argument

### Why the Options Parameter Was Removed

The options parameter (`{ agentName: string }`) was only used for logging in the shared version to track which agent called the function. In the inlined version:

- Logging is already contextual (we know we're in ProjectHub agent)
- The agent name is embedded in log messages via structured logging
- The function is simpler and more focused
- One less parameter to maintain across multiple call sites

---

## Deployment Impact

These fixes ensure:

1. **Clean TypeScript compilation** - No TS errors block the build
2. **Successful Cloud Run deployment** - Agent can build and deploy to Render
3. **Multi-deployment support** - Each agent can inline their own versions of shared utilities
4. **Type safety maintained** - All type guarantees remain in place

---

## How to Apply These Fixes

### File: `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub/src/agent.ts`

#### Step 1: Verify the inlined getTenantId function (Lines 19-61)

Confirm it matches the solution exactly above. This function should be the ONLY definition in the file.

#### Step 2: Verify the environment variable pattern (Lines 91-96)

```typescript
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
```

#### Step 3: Verify all getTenantId calls use single argument

Search for `getTenantId(` in the file and confirm all calls use exactly one argument:

```typescript
const tenantId = getTenantId(ctx);
```

### Build and Deploy

```bash
cd /Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub

# Clean build
rm -rf dist/ tsconfig.tsbuildinfo

# Type-check
npm run typecheck

# Build
npm run build

# Deploy with environment variable
INTERNAL_API_SECRET="[secret-from-server/.env]" npm run deploy
```

---

## Verification Checklist

After applying fixes:

- [ ] `npm run typecheck` passes with no TS errors
- [ ] `npm run build` completes successfully
- [ ] `dist/agent.js` is generated without warnings
- [ ] `npm run deploy` succeeds (requires INTERNAL_API_SECRET env var)
- [ ] Cloud Run deployment status shows "Active"
- [ ] Agent responds to bootstrap requests in Project Hub

---

## Related Documentation

- **Pitfall #45** - Empty secret fallback anti-pattern (use `requireEnv()` for fail-fast)
- **Pitfall #62** - Type assertion without validation (always use Zod `safeParse()`)
- **Pitfall #70** - Missing Zod safeParse in agent tools
- **ADK Deployment** - See `AGENT_DEPLOYMENT_CICD_SETUP.md` for full CI/CD patterns

---

## Prevention for Future Agents

To avoid these issues in future agent deployments:

1. **Don't import from parent packages** - Inline shared utilities instead, or publish as shared npm module
2. **Always validate environment variables** - Use fail-fast pattern with typed constant reassignment
3. **Keep function signatures single-package** - Don't maintain multiple versions of the same function
4. **Test tsconfig.json** - Verify `rootDir` constraint before writing code

---

## References

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub/src/agent.ts`

- getTenantId function: Lines 19-61
- Environment config: Lines 86-105
- Function calls to getTenantId: Line 395 in getContextFromSession()

**Build configuration:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub/tsconfig.json`

**Related agents:**

- Project Hub (this fix)
- Discovery Agent (similar pattern)
- Onboarding Agent (similar pattern)

All future standalone agents should follow this pattern for maximum compatibility.
