# ADK Agent TypeScript Build Errors - Prevention Strategies

**Date:** 2026-01-21
**Problem:** TypeScript compilation failures when deploying ADK agents due to rootDir restrictions, type narrowing issues, and function signature mismatches
**Status:** Resolved in commit `9862d3fa`
**Root Cause:** ADK's isolated tsconfig prevents imports from parent directories; environment variables require proper type narrowing; inlined functions must match call signatures

---

## Problem Overview

ADK (Agent Development Kit) agents deployed under `server/src/agent-v2/deploy/*/` operate with isolated TypeScript configurations and restricted root directories. This isolation is by design for deployment encapsulation, but creates common build failures:

1. **Import Path Errors** - Attempting to import shared utilities from outside the agent's `src/` directory
2. **Type Narrowing Failures** - Environment variables typed as `string | undefined` causing type errors in strict mode
3. **Function Signature Mismatches** - Inlining code from shared modules without adjusting function signatures

---

## Prevention Strategy 1: ADK Agent Self-Contained Architecture

### The Rule

ADK agents are **completely self-contained**. They operate in isolated deployment environments (Cloud Run) and have restricted import paths defined in their tsconfig.json:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**What this means:**

- ✅ Import from: `./src/**/*`, `node_modules/**`
- ❌ Cannot import from: `../../../shared/`, `../../utils/`, any parent directory
- ❌ Cannot import from: `@macon/shared`, `@macon/contracts` (monorepo packages)

### Implementation

When you need shared functionality in an ADK agent:

**Option A: Inline the Code** (Recommended)

```typescript
// ❌ DON'T - Will cause import error
// import { getTenantId } from '../../../shared/tenant-context';

// ✅ DO - Inline the function in the agent
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

  // Tier 3 & 4: Extract from userId
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

**Option B: Use npm Packages Only**

```typescript
// ✅ OK - Published npm package
import { z } from 'zod';
import { LlmAgent, FunctionTool } from '@google/adk';

// ❌ NOT OK - Monorepo package
import { getTenantId } from '@macon/shared';
```

### Inlining Checklist

When copying code from shared modules into an agent:

- [ ] **Copy entire function** - Don't leave references to missing imports
- [ ] **Check function signature** - Verify parameters match how you call it
  - If the shared function takes unused parameters, remove them in the inlined version
  - Adjust return type if needed for local context
- [ ] **Verify all dependencies** - Does the function use other shared utilities?
  - If yes, inline those too
- [ ] **Update all call sites** - Match the new signature
- [ ] **Test locally** - Run `npm run build` in the agent directory to verify TypeScript compilation
- [ ] **Add inline documentation** - Include comment about where code came from

Example: Inlining `logger` utility:

```typescript
// CORRECT - Inlined logger with documentation
/**
 * Lightweight structured logger for Cloud Run agents (inlined from shared/logger)
 * Outputs JSON for easy parsing in Cloud Logging
 */
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};
```

---

## Prevention Strategy 2: Environment Variable Type Narrowing

### The Problem

TypeScript strict mode requires proper type narrowing. Environment variables are typed as `string | undefined`, and you can't use them in contexts expecting `string`:

```typescript
// ❌ WRONG - Type error in strict mode
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
// Type: string | undefined
// Error when used: Type 'string | undefined' is not assignable to type 'string'

// ❌ WRONG - Silent misconfiguration
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
// If env var is missing, uses empty string and crashes later with auth error
```

### The Solution: Two-Step Type Narrowing

**Step 1:** Check and throw at startup (fail-fast)

```typescript
// Intermediate variable with check
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
```

**Step 2:** Create typed constant after verification

```typescript
// Now TypeScript knows this is definitely a string
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
```

**Why this pattern?**

- ✅ Fails immediately at agent startup (before requests)
- ✅ Clear error message in logs
- ✅ Type system satisfied (no `as any` needed)
- ✅ No silent failures with empty strings
- ✅ Easier debugging than auth failures later

### Complete Pattern

```typescript
// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

// 1. Check required variables at module load time
const _MAIS_API_URL = process.env.MAIS_API_URL;
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const _AGENT_API_PATH = process.env.AGENT_API_PATH;

// 2. Fail fast with clear errors
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}

// 3. Create typed constants after checks
const MAIS_API_URL: string = _MAIS_API_URL || 'https://api.gethandled.ai'; // OK to have default
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET; // Now guaranteed non-empty
const AGENT_API_PATH: string = _AGENT_API_PATH || '/v1/internal/agent'; // OK to have default

// 4. Optional: Helper for consistency
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Usage: const SECRET = requireEnv('SECRET_NAME');
```

### Environment Variables Checklist

For each environment variable in your agent:

- [ ] Is it **required** for the agent to function?
  - YES → Use fail-fast pattern with throw
  - NO → Use with `||` default or optional chaining
- [ ] Does the code depend on it being non-empty?
  - YES → Don't use empty string default (`|| ''`)
  - NO → Safe to have default
- [ ] Is it a secret/sensitive value?
  - YES → Only defined in deployment environment, never committed
  - NO → Safe to have defaults for local development

Example decision tree:

```
MAIS_API_URL
├─ Required? YES (agent calls it)
└─ Action: requireEnv('MAIS_API_URL') with optional default to gethandled.ai

INTERNAL_API_SECRET
├─ Required? YES (auth header requires non-empty)
└─ Action: requireEnv('INTERNAL_API_SECRET') with NO default, throw if missing

DEBUG_MODE
├─ Required? NO (optional feature)
└─ Action: const DEBUG_MODE = process.env.DEBUG_MODE === 'true' // default false
```

---

## Prevention Strategy 3: Pre-Deploy TypeScript Check

### The Workflow

Before deploying any ADK agent, always verify TypeScript compilation:

```bash
# 1. Navigate to agent directory
cd server/src/agent-v2/deploy/project-hub

# 2. Run typecheck FIRST (catches errors before deploy)
npx tsc --noEmit

# 3. If successful, then deploy
npm run deploy
```

### What to Look For

TypeScript errors typically indicate:

**Import errors:**

```
error TS2307: Cannot find module '../../../shared/tenant-context'
```

→ Fix: Inline the code (see Strategy 1)

**Type narrowing errors:**

```
error TS2322: Type 'string | undefined' is not assignable to type 'string'
```

→ Fix: Use two-step narrowing (see Strategy 2)

**Function signature mismatches:**

```
error TS2345: Argument of type 'T' is not assignable to parameter of type 'S'
```

→ Fix: Verify inlined function matches call site (see Strategy 1)

### CI/CD Integration

In GitHub Actions, ensure typecheck runs before deploy:

```yaml
- name: Check TypeScript compilation
  run: |
    cd server/src/agent-v2/deploy/project-hub
    npx tsc --noEmit

- name: Deploy to Cloud Run
  if: success()
  run: npm run deploy
```

Never skip the typecheck step, even if it adds 30 seconds to deployment.

---

## Prevention Strategy 4: Function Inlining Verification

### The Checklist

When inlining a function from shared code:

1. **Identify all parameters**

   ```typescript
   // Shared version - BEFORE inlining
   function getTenantId(
     context: ToolContext | undefined,
     fallback?: string // Do we use this?
   ): string | null {
     // ...
   }
   ```

2. **Check call sites in agent**

   ```typescript
   // In agent - how are we calling it?
   const tenantId = getTenantId(ctx); // NO fallback passed!
   ```

3. **Remove unused parameters**

   ```typescript
   // Inlined version - REMOVE unused fallback parameter
   function getTenantId(context: ToolContext | undefined): string | null {
     // Same implementation, but signature matches how we call it
   }
   ```

4. **Update return type if needed**

   ```typescript
   // Shared version
   function getTenantId(context): string | null { ... }

   // If we change logic in inlined version
   function getTenantId(context): string {
     // Now always returns string (or throws)
   }
   ```

### Common Inlining Mistakes

**Mistake 1: Leaving unused imports**

```typescript
// ❌ WRONG - Imports will fail at compile time
import { formatDate } from '../../../shared/date-utils';

function getTenantId(context: ToolContext | undefined): string | null {
  // ... never uses formatDate
}
```

**Mistake 2: Different function signatures**

```typescript
// ❌ WRONG - Inlined function has extra parameter
function getTenantId(
  context: ToolContext | undefined,
  options?: { strict: boolean }
): string | null {
  // ...
}

// Called without options
const tenantId = getTenantId(ctx); // Type error!
```

**Mistake 3: Missing null checks after inlining**

```typescript
// ❌ WRONG - Inlined but didn't remove optional chaining
const fromState = context.state?.get<string>('tenantId'); // Still might be undefined

// ✅ RIGHT - Keep defensive checks
const fromState = context.state?.get<string>('tenantId');
if (fromState) return fromState;
```

### Verification Steps

After inlining:

```bash
# 1. TypeScript compilation
npx tsc --noEmit
# Should have zero errors

# 2. Agent local test (if applicable)
npm test
# All tests pass

# 3. Build output
npm run build
# Check dist/ folder has correct output

# 4. Code review
# - Function signature matches all call sites
# - No imports from parent directories
# - All security checks still active
```

---

## Prevention Strategy 5: Agent-Specific Build Configuration

### tsconfig.json Best Practices

Every ADK agent should have this tsconfig:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key settings:**

- `rootDir: ./src` - Only files in src/ are considered
- `strict: true` - Catches type errors early
- `declaration: true` - Generates .d.ts files for type checking
- `skipLibCheck: true` - Speeds up compilation, safe for self-contained agents

### package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "deploy": "npm run build && npm run deploy:gcloud"
  }
}
```

---

## Decision Tree: Import or Inline?

```
Do you need code from ../../../shared/?

├─ YES: Function is stable, won't change often
│  └─ Can we make it an npm package?
│     ├─ YES → Use npm package (better approach)
│     └─ NO → Inline the code
│
└─ NO: Use existing npm packages only
   └─ That's it!
```

---

## Real Example: project-hub Agent

### What Was Done

The project-hub agent successfully applied all prevention strategies:

1. **Self-contained**: All code lives in `server/src/agent-v2/deploy/project-hub/src/`
2. **Environment variables**: Uses two-step narrowing pattern
   ```typescript
   const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
   if (!_INTERNAL_API_SECRET) {
     throw new Error('INTERNAL_API_SECRET environment variable is required');
   }
   const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
   ```
3. **Inlined utilities**: `getTenantId`, `logger`, `fetchWithTimeout` all inlined with proper signatures
4. **Pre-deploy check**: Ran `tsc --noEmit` before deploying
5. **Function signatures**: All tools verify parameters via `safeParse()` before using them

### Result

- ✅ Compiles successfully in isolated environment
- ✅ Deploys to Cloud Run without errors
- ✅ Type-safe throughout (strict: true)
- ✅ All security checks active (Zod validation, context guards)

---

## Related Documentation

- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](./ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md) - 10 Commandments
- [CLAUDE.md](../../CLAUDE.md) - Pitfalls 45-51 cover agent code quality
- [VERTEX-AI-PLAN-RETROSPECTIVE.md](./VERTEX-AI-PLAN-RETROSPECTIVE.md) - Lessons learned
- [PROJECT_HUB_AGENT_POSTMORTEM.md](./PROJECT_HUB_AGENT_POSTMORTEM.md) - Dual-context implementation

---

## Quick Reference Card

| Scenario          | Pattern                    | File Location                                     |
| ----------------- | -------------------------- | ------------------------------------------------- |
| Need shared util  | Inline it                  | `server/src/agent-v2/deploy/[agent]/src/agent.ts` |
| Required env var  | Use fail-fast throw        | Module load time                                  |
| Optional env var  | Use `\|\|` default         | Module load time                                  |
| Inlining function | Remove unused params       | Verify signature matches                          |
| Before deploy     | Run `tsc --noEmit`         | Agent directory                                   |
| Function params   | Always `safeParse()` first | Tool execute function                             |
| Type narrowing    | Two-step pattern           | All required env vars                             |

---

**Author:** Claude Code | **Last Updated:** 2026-01-21
