# ADK Agent Deployment TypeScript Fixes - Quick Reference

**Quick guide to fixing TypeScript errors when deploying standalone ADK agents.**

---

## The Three Common TypeScript Errors

### Error 1: TS6059 - Import outside rootDir

**Symptom:** Agent build fails with "File is not under 'rootDir'"

**Root Cause:** Importing from parent packages (e.g., `../../../shared/...`)

**Fix:** Inline the utility function directly in agent.ts

```typescript
// DON'T DO THIS
import { getTenantId } from '../../../shared/tenant-context';

// DO THIS INSTEAD
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  // ... implementation ...
  return null;
}
```

**Why:** Each agent package is independent. tsconfig.json `rootDir` constraint prevents cross-package imports.

---

### Error 2: TS2322 - Type not narrowed

**Symptom:** "Type 'string | undefined' is not assignable to type 'string'"

**Root Cause:** Using `process.env.VAR` directly where string is required

**Fix:** Two-step pattern with intermediate variable and type assertion

```typescript
// DON'T DO THIS
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
headers: { 'X-Internal-Secret': INTERNAL_API_SECRET }  // ❌ Error

// DO THIS INSTEAD
const _INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!_INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
const INTERNAL_API_SECRET: string = _INTERNAL_API_SECRET;
headers: { 'X-Internal-Secret': INTERNAL_API_SECRET }  // ✅ OK
```

**Why:** Fail-fast at startup if required env vars are missing. Makes the narrowing explicit.

---

### Error 3: TS2554 - Argument count mismatch

**Symptom:** "Expected 1 argument, but got 2"

**Root Cause:** Function signature changed (e.g., removing options parameter)

**Fix:** Update all function calls to match the new signature

```typescript
// DON'T DO THIS
const tenantId = getTenantId(ctx, { agentName: 'ProjectHub' }); // ❌ 2 args

// DO THIS INSTEAD
const tenantId = getTenantId(ctx); // ✅ 1 arg
```

**Why:** When inlining functions, simplify the signature. Remove unused parameters.

---

## Checklist for Deploying ADK Agents

Before running `npm run deploy`:

- [ ] No cross-package imports in agent code
- [ ] Environment variables use fail-fast pattern with typed reassignment
- [ ] Function signatures simplified (remove unused params)
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` completes successfully
- [ ] INTERNAL_API_SECRET is set before deploy

---

## Deploy Command

```bash
cd server/src/agent-v2/deploy/[agent-name]

# Verify build
npm run typecheck
npm run build

# Deploy with required env var
INTERNAL_API_SECRET="$(grep INTERNAL_API_SECRET ../../.env | cut -d= -f2)" npm run deploy
```

---

## Examples by Agent

### Project Hub Agent

**File:** `server/src/agent-v2/deploy/project-hub/src/agent.ts`

- getTenantId inlined at lines 19-61
- Environment config pattern at lines 91-96
- All calls use single argument: `getTenantId(ctx)`

### Discovery Agent

**File:** `server/src/agent-v2/deploy/discovery/src/agent.ts`

- Same patterns apply
- Inline shared utilities specific to this agent
- Keep tsconfig.json rootDir tight

### Onboarding Agent

**File:** `server/src/agent-v2/deploy/onboarding/src/agent.ts`

- Same patterns apply
- Each agent is independent deployment unit

---

## Why This Matters

- **TypeScript Strictness** - Standalone agents have strict tsconfig for reliability
- **Deployment Independence** - Each agent deploys independently (Cloud Run container)
- **Fail-Fast** - Missing env vars caught immediately at startup, not runtime
- **Type Safety** - No `any` types or unsafe assertions

---

## See Also

- `ADK_AGENT_DEPLOYMENT_TYPESCRIPT_ERRORS_FIX.md` - Complete solution with all details
- `AGENT_DEPLOYMENT_CICD_SETUP.md` - Full CI/CD and deployment architecture
- `ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` - General agent development patterns

---

## Common Questions

**Q: Can I import from the shared package?**
A: Not with cross-relative imports (`../../../`). Either:

1. Inline the function in your agent
2. Publish shared utils as an npm package to workspace
3. Use symbolic links (not recommended - causes double compilation)

**Q: Why fail on missing env var instead of defaulting?**
A: Fail-fast catches misconfiguration immediately. Silent defaults hide problems until runtime.

**Q: Do all agents need this pattern?**
A: Only standalone Cloud Run deployments (ADK agents). Monolith Express routes don't have tsconfig rootDir constraints.

---

## References

- TypeScript TS6059: https://www.typescriptlang.org/docs/handbook/compiler-options.html#rootDir
- TypeScript TS2322: Type assignment not assignable
- TypeScript TS2554: Parameter count mismatch

Last updated: 2026-01-21
