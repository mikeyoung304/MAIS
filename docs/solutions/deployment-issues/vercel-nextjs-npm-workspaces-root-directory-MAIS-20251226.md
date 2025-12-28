# Vercel Deployment Failure: Next.js in npm Workspaces Monorepo

---

title: "Vercel Deployment Failure: Next.js App in npm Workspaces Monorepo - Root Directory Configuration"
category: deployment-issues
severity: P1
symptoms:

- "Cannot find module 'tailwindcss'" during Vercel build
- Build fails with missing PostCSS/Tailwind dependencies
- ESLint errors block production build (unused variables, unescaped entities)
- Build succeeds locally but fails on Vercel
- Internal workspace packages (@macon/contracts, @macon/shared) fail to resolve
  components:
- apps/web (Next.js 14 App Router)
- packages/contracts
- packages/shared
- vercel.json
- package.json (root + workspace)
  tags:
- vercel
- nextjs
- npm-workspaces
- monorepo
- tailwindcss
- eslint
- deployment
- root-directory-configuration
  date_documented: 2025-12-26
  time_to_resolve: "1-2 hours"

---

## Problem Summary

Vercel deployment fails for a Next.js 14 App Router application (`apps/web`) in an npm workspaces monorepo. The initial symptom is a "Cannot find module 'tailwindcss'" error during the Vercel build process, despite tailwindcss being correctly listed in devDependencies.

## Symptoms

1. **Primary Error**: `Cannot find module 'tailwindcss'` or similar missing module errors
2. **Secondary Errors**: After fixing module resolution, ESLint errors block the build
3. Build succeeds locally but fails on Vercel
4. Internal workspace packages (`@macon/contracts`, `@macon/shared`) fail to resolve

## Root Cause

**The Vercel project had "Root Directory" set to `apps/web`**, which breaks npm workspace dependency hoisting.

### Why This Happens

When Root Directory is set to a subdirectory in an npm workspaces monorepo:

1. Vercel runs `npm install` in `apps/web/` first (isolated from monorepo)
2. Custom `vercel-build` script then runs install at root
3. This restructures `node_modules/`, causing hoisted dependencies to be lost
4. `next build` fails because tailwindcss and other deps aren't found

```
# What Vercel does with Root Directory set to apps/web:
1. cd apps/web
2. npm install          # Only installs apps/web deps, no hoisting
3. npm run vercel-build # Our script: "cd ../.. && npm install && ..."
4. npm install at root  # Restructures node_modules
5. next build           # FAILS - tailwindcss not hoisted properly
```

## Solution

### Step 1: Clear Root Directory Setting in Vercel

1. Go to Vercel Dashboard → Your Project
2. Navigate to **Settings → Build and Deployment**
3. Find **Root Directory** field
4. **Clear it** (leave empty or set to `.`)
5. Save changes

### Step 2: Configure vercel.json at Repo Root

Create or update `vercel.json` at the **repository root** (not in apps/web):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

### Step 3: Add vercel-build Script to Root package.json

```json
{
  "scripts": {
    "vercel-build": "npm run build -w @macon/contracts && npm run build -w @macon/shared && cd apps/web && next build"
  }
}
```

This ensures:

- Workspace dependencies build first (contracts, shared)
- Next.js build runs last with all deps available
- npm workspaces hoisting remains intact

### Step 4: Fix ESLint Errors

After fixing the module resolution, ESLint errors may be revealed. Common fixes:

#### Unused Variables

```typescript
// Before (error)
const router = useRouter(); // Never used

// After (fix option 1: remove)
// Remove the line entirely

// After (fix option 2: prefix with underscore)
const _router = useRouter();
```

#### Unescaped Entities in JSX

```tsx
// Before (error)
<p>The package you're looking for doesn't exist.</p>

// After (fix)
<p>The package you&apos;re looking for doesn&apos;t exist.</p>

// Quotes
<p>Click "Continue" to proceed.</p>  // Error
<p>Click &quot;Continue&quot; to proceed.</p>  // Fixed
```

#### Case Block Declarations

```typescript
// Before (error)
switch (e.key) {
  case 'ArrowDown':
    const nextIndex = (index + 1) % items.length; // Lexical declaration
    break;
}

// After (fix: wrap in braces)
switch (e.key) {
  case 'ArrowDown': {
    const nextIndex = (index + 1) % items.length;
    break;
  }
}
```

## Prevention Checklist

- [ ] Never set Vercel "Root Directory" for npm workspaces monorepos
- [ ] Keep `vercel.json` at repository root with `outputDirectory` pointing to app's `.next`
- [ ] Use `vercel-build` script that builds workspace deps before the app
- [ ] Run `npm run build` locally before pushing to catch ESLint errors
- [ ] Configure ESLint to allow apostrophes/quotes in JSX (optional):

```javascript
// .eslintrc.cjs
'react/no-unescaped-entities': [
  'error',
  {
    forbid: [
      { char: '>', alternatives: ['&gt;'] },
      { char: '<', alternatives: ['&lt;'] },
    ],
  },
],
```

## Quick Reference: ESLint Entity Escaping

| Character          | Wrong     | Correct                              |
| ------------------ | --------- | ------------------------------------ |
| `'` (apostrophe)   | `don't`   | `don&apos;t` or `{"don't"}`          |
| `"` (quote)        | `"hello"` | `&quot;hello&quot;` or `{'"hello"'}` |
| `<` (less than)    | `<`       | `&lt;`                               |
| `>` (greater than) | `>`       | `&gt;`                               |

## Verification

After applying fixes, verify locally:

```bash
# Clean build from repo root
cd /path/to/monorepo
rm -rf apps/web/.next node_modules/.cache
npm run vercel-build
```

If this succeeds, the Vercel build should also succeed.

## Related Documentation

- [CI/CD Quick Reference](../../deployment/CI_CD_QUICK_REFERENCE.md)
- [Vercel Build Prevention Guide](../../deployment/VERCEL_BUILD_PREVENTION_GUIDE.md)
- [TypeScript Incremental Build Cache](./vercel-vite-monorepo-typescript-incremental-cache.md)
- [Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)

## Key Insight

**npm workspaces + Vercel Root Directory = broken module resolution**

Always build from the repository root for npm workspaces monorepos. Use `vercel.json` to specify the output directory instead of changing the Root Directory setting.
