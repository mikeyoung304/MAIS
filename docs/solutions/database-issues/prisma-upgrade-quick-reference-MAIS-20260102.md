---
title: 'Prisma Major Upgrade Quick Reference'
category: database-issues
severity: P1
level: all-engineers
print-and-pin: yes
time-to-use: 2-minutes
---

# Prisma Major Upgrade: Print & Pin This Card

## The Problem in 30 Seconds

Prisma 6 → Prisma 7 changes entry point from `index.ts` to `client.ts`. Your imports break in CI because:

- **Local:** Node modules cache has old `index.ts` (works)
- **CI:** Clean install has no `index.ts` (fails with "Cannot find module")
- **Result:** Deployment blocked

## The Solution in 3 Files

### 1. Postgenerate Script

**File:** `server/scripts/prisma-postgenerate.js`

```javascript
#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '../src/generated/prisma/index.ts');

const barrelContent = `export * from './client';`;

try {
  writeFileSync(indexPath, barrelContent, 'utf-8');
  console.log('✅ Prisma barrel file created');
} catch (error) {
  console.error('❌ Failed:', error);
  process.exit(1);
}
```

### 2. Wire to Build

**File:** `server/package.json`

```json
{
  "scripts": {
    "prisma:generate": "prisma generate && node scripts/prisma-postgenerate.js",
    "build": "npm run prisma:generate && tsc -b"
  }
}
```

**Critical:** Build MUST call `prisma:generate` first

### 3. Wrapper (Optional)

**File:** `server/src/db.ts`

```typescript
export * from './generated/prisma/client';
```

Use across codebase: `import { PrismaClient } from './db'`

## Testing Checklist

### Immediate

```bash
npm run prisma:generate
ls -la server/src/generated/prisma/index.ts  # Should exist
npm run typecheck                            # Should pass
```

### Real Test (Clean Environment)

```bash
rm -rf node_modules
npm install
npm run build  # Must pass in clean slate
```

### CI Simulation

```bash
# Test like Render/Vercel would
docker run -it -v $(pwd):/app node:20 bash -c "cd /app && npm ci && npm run build"
```

## Common Mistakes (Don't Do These)

| Mistake                        | Why It Fails             | Fix                                      |
| ------------------------------ | ------------------------ | ---------------------------------------- |
| `npm exec prisma generate`     | Skips postgenerate step  | Use `npm run prisma:generate`            |
| Only test locally              | Uses cached node_modules | Delete `node_modules` first              |
| Build doesn't call generate    | Barrel file not created  | Wire `prisma:generate` to build          |
| No clean environment test      | Masks the real problem   | Test in Docker or clean shell            |
| Missing `DIRECT_URL` on Render | `prisma generate` fails  | Set both `DATABASE_URL` AND `DIRECT_URL` |

## Render Environment Variables (CRITICAL)

Prisma 7 requires **both** URLs on Render:

| Variable       | Purpose                                | Port |
| -------------- | -------------------------------------- | ---- |
| `DATABASE_URL` | Runtime queries (Session Pooler)       | 5432 |
| `DIRECT_URL`   | `prisma generate` schema introspection | 6543 |

Without `DIRECT_URL`, build fails with:

```
PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL
```

## One-Command Verification

```bash
# This single command catches 90% of issues
rm -rf node_modules && npm ci && npm run build
```

**If this works:** Your fix is good for CI/deployment
**If this fails:** Issue is in your build script or postgenerate

## Decision Tree

```
Is Prisma entry point changing in the upgrade?
├─ YES → Implement this 3-file solution
├─ NO → Check Prisma release notes for other breaking changes
└─ UNSURE → Check release notes first, then decide

Have you tested in clean environment?
├─ NO → Must test before claiming victory
└─ YES → Good! Now test in Docker/CI
```

## What to Check Before Upgrade

1. **Release notes:** `prisma.io/docs/orm/more/upgrade-guide`
2. **Entry point:** Search "entry point" or "import path" in notes
3. **Your codebase:** `grep -r "from './generated/prisma'" server/src/`
4. **Dependencies:** Any other packages expecting old entry point?

## Postgenerate Must-Haves

- ✅ ESM syntax (`import`/`export`)
- ✅ `#!/usr/bin/env node` shebang
- ✅ `process.exit(1)` on error (fail fast)
- ✅ Called from `prisma:generate` script
- ✅ Creates idempotent content (same every time)

## Barrel File Must-Have

```typescript
// server/src/generated/prisma/index.ts
export * from './client';
```

**That's it.** Just re-export everything from the new entry point.

## When You're Stuck

1. **"Cannot find module './generated/prisma'"**
   - Check if `src/generated/prisma/index.ts` exists
   - Run `npm run prisma:generate`
   - Check postgenerate script output

2. **"Type errors after upgrade"**
   - This is separate from entry point issue
   - See: `prisma-7-json-type-breaking-changes-MAIS-20260102.md`
   - Look for JSON type casting issues

3. **"Works locally but fails in CI"**
   - You're hitting the local cache issue
   - Delete `node_modules` and rebuild
   - Test in clean Docker container

4. **"Build script takes forever"**
   - Ensure only one `prisma generate` call
   - Check for duplicate prisma calls in build chain
   - Validate script dependencies

## Success Indicators

- [ ] `npm run prisma:generate` exits code 0
- [ ] `server/src/generated/prisma/index.ts` exists
- [ ] `npm run typecheck` passes with no errors
- [ ] `rm -rf node_modules && npm ci && npm run build` succeeds
- [ ] Docker clean build succeeds
- [ ] CI passes
- [ ] Deployment succeeds

## Timeline

- **Pre-upgrade research:** 5 min (check release notes)
- **Implement 3 files:** 10 min (copy-paste the solution)
- **Local testing:** 5 min (`npm run prisma:generate` + build)
- **Clean environment test:** 10 min (Docker or fresh shell)
- **Deploy:** 5 min (push to main, watch CI)

**Total:** ~35 minutes

## Links to Details

- **Full Prevention Guide:** `prisma-major-upgrade-build-failure-prevention-MAIS-20260102.md`
- **JSON Type Changes:** `prisma-7-json-type-breaking-changes-MAIS-20260102.md`
- **Complete Checklist:** `prisma-upgrade-checklist-MAIS-20260102.md`
- **Prisma Docs:** https://www.prisma.io/docs/orm/more/upgrade-guide

## Copy-Paste Commands

```bash
# Test barrel file is created
npm run prisma:generate && test -f server/src/generated/prisma/index.ts && echo "✅ OK"

# Type check
npm run typecheck

# Clean build (the real test)
rm -rf node_modules && npm ci && npm run build

# Docker test (if available)
docker run -v $(pwd):/app node:20 bash -c "cd /app && npm ci && npm run build"
```

---

**Remember:** If it works locally but fails in CI, the cause is almost always local cache. Always test with `rm -rf node_modules` first.
