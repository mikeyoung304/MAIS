# ADK Agent Deployment TypeScript Errors - rootDir and Type Narrowing

---

title: "ADK Agent Deployment TypeScript Errors - rootDir and Type Narrowing"
slug: adk-agent-deployment-rootdir-errors
category: build-errors
severity: blocking
component: agent-v2/project-hub
symptoms:

- TS6059: File is not under rootDir
- TS2322: Type 'string | undefined' is not assignable to type 'string'
- TS2554: Expected 1 argument but got 2
  root_cause: ADK agents have isolated tsconfig with restricted rootDir - cannot import from shared modules outside deploy directory
  solution_verified: true
  created: 2026-01-21
  pitfall_id: null
  related_issues:
- ADK_A2A_PREVENTION_INDEX.md
- ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
  tags:
- adk
- cloud-run
- typescript
- deployment

---

## Problem Statement

When deploying the Project Hub agent to Cloud Run, the TypeScript compilation failed with three distinct errors that blocked deployment:

```
error TS6059: File '/Users/.../shared/tenant-context.ts' is not under 'rootDir' '/Users/.../project-hub/src'. 'rootDir' is expected to contain all source files.

error TS2322: Type 'string | undefined' is not assignable to type 'string'.

error TS2554: Expected 1 arguments, but got 2.
```

## Root Cause Analysis

### Why ADK Agents Have Isolated rootDir

ADK agents under `server/src/agent-v2/deploy/*/` are designed to be **self-contained deployable units**. Each agent has its own `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true
  }
}
```

This architecture means:

- Agents **cannot** import from `../../../shared/`
- Agents **cannot** import from `../../utils/`
- Each agent must contain all code needed for deployment

This is intentional - it ensures agents deploy cleanly to Cloud Run without missing dependencies.

## Solutions

### Fix 1: TS6059 - Import Outside rootDir

**Problem:** Importing `getTenantId` from shared module violated rootDir constraint.

```typescript
// BEFORE (broken):
import { getTenantId } from '../../../shared/tenant-context';
```

**Solution:** Inline the function directly in agent.ts:

```typescript
// AFTER (working):
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

### Fix 2: TS2322 - Type Not Narrowed

**Problem:** `INTERNAL_API_SECRET` typed as `string | undefined` when used in headers.

TypeScript doesn't narrow module-level variables after a conditional check because the variable could theoretically be modified between the check and use.

```typescript
// BEFORE (broken):
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
// Later in headers:
headers: { 'x-internal-secret': INTERNAL_API_SECRET }  // Error: could be undefined
```

**Solution:** Use intermediate variable, validate, then create typed constant:

```typescript
// AFTER (working):
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
// TypeScript doesn't narrow module-level vars, so we create a typed constant
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
```

This pattern:

1. Checks at module load time (fail-fast)
2. Creates a new constant that TypeScript knows is definitely `string`
3. Provides clear error message if misconfigured

### Fix 3: TS2554 - Argument Count Mismatch

**Problem:** After inlining, function calls passed extra arguments.

```typescript
// BEFORE (broken):
const tenantId = getTenantId(ctx, { agentName: 'ProjectHub' });
```

The shared version had an optional logging options parameter, but the inlined version was simplified.

**Solution:** Remove the unused second argument:

```typescript
// AFTER (working):
const tenantId = getTenantId(ctx);
```

## Verification

After applying fixes:

```bash
cd server/src/agent-v2/deploy/project-hub

# Typecheck first
npx tsc --noEmit
# ✓ No errors

# Deploy
INTERNAL_API_SECRET="your-secret" npm run deploy
# ✓ Deployed to Cloud Run
```

## Prevention Strategies

### 1. ADK Agent Self-Contained Rule

When creating agent code that needs shared utilities:

- **INLINE** the code directly in agent.ts
- Add a comment noting the source: `// (inlined from shared/tenant-context.ts for deployment)`
- This is intentional architecture, not a workaround

### 2. Environment Variable Type Narrowing Pattern

Always use this pattern for required environment variables:

```typescript
const _VAR = process.env.REQUIRED_VAR;
if (!_VAR) {
  throw new Error('REQUIRED_VAR environment variable is required');
}
const VAR: string = _VAR;
```

### 3. Pre-Deploy TypeCheck

Always run typecheck before deploying:

```bash
npx tsc --noEmit  # Check for errors first
npm run deploy     # Then deploy
```

### 4. Inlining Checklist

When inlining a function from shared modules:

- [ ] Copy the entire function body
- [ ] Check if the function signature matches how you call it
- [ ] Remove unused parameters from the inlined version
- [ ] Update all call sites to match new signature
- [ ] Add source comment for future maintainers

## Related Documentation

- [ADK_A2A_PREVENTION_INDEX.md](../patterns/ADK_A2A_PREVENTION_INDEX.md) - Comprehensive ADK patterns
- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](../patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md) - Agent development checklist
- [CLAUDE.md Pitfalls 32-44](../../../CLAUDE.md) - ADK/A2A pitfall reference

## Files Changed

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`
  - Lines 19-61: Inlined `getTenantId` function
  - Lines 91-96: Environment variable type narrowing
  - All tool execute functions: Removed extra arguments

## Keywords

ADK, Cloud Run, TypeScript, rootDir, deployment, TS6059, TS2322, TS2554, tenant context, environment variables
