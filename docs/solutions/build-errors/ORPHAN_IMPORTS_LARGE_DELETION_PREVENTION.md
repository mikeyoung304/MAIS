---
module: MAIS
date: 2026-01-27
problem_type: build_failure
component: typescript
symptoms:
  - CI clean build fails with "cannot find module" errors
  - Local incremental build passes but CI fails
  - Deleted function still imported in unchanged files
  - Archive branches created but build not verified
root_cause: Incremental TypeScript compilation skips unchanged files that import deleted exports
resolution_type: prevention
severity: P2
tags: [typescript, build, deletion, refactoring, ci-cd, incremental-builds, orphan-imports]
---

# Prevention: Orphan Imports After Large Deletions

## Problem Pattern

1. Delete function/file from module A
2. Forget to update file B that imports from A
3. Incremental TypeScript build passes (B wasn't changed, not recompiled)
4. Clean build in CI fails with "cannot find module" or "has no exported member"

**Key insight:** Archive branches (like `archive/legacy-agent-orchestrators`) provide rollback insurance but do NOT prevent the build failure. The failure occurs because TypeScript's incremental compilation caches `.d.ts` files and skips type-checking unchanged files.

---

## Prevention Strategies

### 1. Pre-Commit Checklist for Large Deletions

Before deleting any exported function, class, or file:

```bash
# Step 1: Find all usages BEFORE deletion
rg "import.*{.*DeletedFunctionName" --type ts
rg "from.*'./path/to/deleted-file'" --type ts

# Step 2: Update all importing files FIRST
# Then delete the source

# Step 3: Clean build BEFORE committing
rm -rf server/dist packages/*/dist apps/web/.next
npm run typecheck

# Step 4: Only then commit
git add -A && git commit -m "refactor: remove DeletedFunctionName and all usages"
```

### 2. Commands to Run (Clean Build Verification)

**Add to your deletion workflow:**

```bash
# Full clean build (catches all orphan imports)
npm run build:clean  # or implement as shown below

# Quick version if you know the affected workspace
rm -rf server/dist && npm run typecheck

# For Next.js changes specifically
rm -rf apps/web/.next && npm run build --workspace=apps/web
```

**Recommended script to add to `package.json`:**

```json
{
  "scripts": {
    "build:clean": "rm -rf server/dist packages/*/dist apps/web/.next && npm run typecheck && npm run build --workspaces --if-present",
    "verify-deletion": "rm -rf server/dist packages/*/dist && npm run typecheck"
  }
}
```

### 3. CI/CD Improvements (GitHub Actions)

The current pipeline already does clean builds (good!), but add explicit verification:

**Add to `.github/workflows/main-pipeline.yml` in the `typecheck` job:**

```yaml
typecheck:
  name: TypeScript Type Check
  runs-on: ubuntu-latest
  timeout-minutes: 5

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    # ADD THIS: Ensure no stale build artifacts from cache
    - name: Clean build artifacts
      run: |
        rm -rf server/dist packages/*/dist apps/web/.next
        echo "Cleaned all build artifacts for fresh typecheck"

    - name: Run TypeScript type checking
      run: npm run typecheck
```

**Add orphan import detection job:**

```yaml
# Add after typecheck job
orphan-import-check:
  name: Orphan Import Detection
  runs-on: ubuntu-latest
  timeout-minutes: 5
  if: github.event_name == 'pull_request'

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Full history for diff

    - name: Check for deleted exports
      run: |
        # Get deleted TypeScript files in this PR
        DELETED_FILES=$(git diff --name-only --diff-filter=D origin/main...HEAD | grep -E '\.tsx?$' || true)

        if [ -n "$DELETED_FILES" ]; then
          echo "::warning::Deleted TypeScript files detected. Verifying no orphan imports..."
          for file in $DELETED_FILES; do
            # Extract the import path pattern
            IMPORT_PATTERN=$(echo "$file" | sed 's/\.tsx\?$//' | sed 's/^/from.*/')

            # Search for imports of deleted file
            if rg "$IMPORT_PATTERN" --type ts -l; then
              echo "::error::Orphan imports found for deleted file: $file"
              exit 1
            fi
          done
        fi

        echo "No orphan imports detected"

    - name: Verify clean build after deletions
      run: |
        rm -rf server/dist packages/*/dist apps/web/.next
        npm ci
        npm run typecheck
```

### 4. IDE Settings That Help

**VS Code (`settings.json`):**

```json
{
  // Force TypeScript to show errors from the entire project, not just open files
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,

  // Don't cache type information between sessions
  "typescript.tsserver.maxTsServerMemory": 4096,

  // Show problems for all files, not just open ones
  "typescript.preferences.includePackageJsonAutoImports": "on",

  // Auto-update imports when files are moved/renamed
  "typescript.updateImportsOnFileMove.enabled": "always",

  // Show unused imports as warnings
  "editor.showUnused": true
}
```

**WebStorm/IntelliJ:**

- Enable: Settings > Editor > Inspections > TypeScript > Unresolved function or method call
- Enable: Settings > Editor > Inspections > TypeScript > Unresolved variable
- Run: Code > Inspect Code... on full project before large deletions

### 5. ESLint Configuration

**Add to `.eslintrc.cjs`:**

```javascript
module.exports = {
  // ... existing config
  rules: {
    // Catch imports from non-existent modules during lint (not just build)
    'import/no-unresolved': 'error',

    // Catch named imports that don't exist
    'import/named': 'error',

    // Catch default imports from modules without default export
    'import/default': 'error',

    // Ensure import paths are valid
    'import/no-absolute-path': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json', './server/tsconfig.json', './apps/web/tsconfig.json'],
      },
    },
  },
};
```

**Required dependencies:**

```bash
npm install -D eslint-plugin-import eslint-import-resolver-typescript
```

### 6. TypeScript Configuration Enhancement

**Add to `tsconfig.json` (project root):**

```json
{
  "compilerOptions": {
    // Force recompilation on any change (slower but catches orphans)
    "incremental": false, // Only for CI, keep true locally

    // Or use composite projects with build info
    "composite": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

**For faster local dev but safe CI:**

```json
// tsconfig.ci.json (extends base, disables incremental)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "incremental": false
  }
}
```

Then in CI: `tsc -p tsconfig.ci.json --noEmit`

---

## Pre-Commit Hook Enhancement

**Update `.husky/pre-commit` for large deletions:**

```bash
#!/bin/sh
set -e

# Check for deleted TypeScript files
DELETED_TS=$(git diff --cached --name-only --diff-filter=D | grep -E '\.tsx?$' || true)

if [ -n "$DELETED_TS" ]; then
  echo "Deleted TypeScript files detected - running clean typecheck..."
  echo "$DELETED_TS"

  # Clean build artifacts to catch orphan imports
  rm -rf server/dist packages/*/dist

  # Run full typecheck (not incremental)
  npm run typecheck

  echo "Clean typecheck passed - no orphan imports"
fi

# ... rest of existing pre-commit checks
```

---

## Quick Reference: Deletion Workflow

```
1. BEFORE deleting:
   $ rg "import.*{.*FunctionName" --type ts
   $ rg "from.*'path/to/file'" --type ts

2. Update all usages FIRST

3. Delete the source file/function

4. Clean typecheck:
   $ rm -rf server/dist packages/*/dist
   $ npm run typecheck

5. If passes, commit:
   $ git add -A
   $ git commit -m "refactor: remove X and all usages"

6. Archive branch (optional, for rollback):
   $ git checkout -b archive/feature-name
   $ git push origin archive/feature-name
   $ git checkout main
```

---

## Detection Commands

**Find potential orphan imports in current changes:**

```bash
# List all files importing from a path that may have been deleted
rg "from ['\"]\./" --type ts | \
  while read line; do
    file=$(echo "$line" | cut -d: -f1)
    import_path=$(echo "$line" | grep -oE "from ['\"][^'\"]+['\"]" | sed "s/from ['\"]//;s/['\"]//")
    resolved=$(dirname "$file")/"$import_path"
    if [ ! -f "${resolved}.ts" ] && [ ! -f "${resolved}.tsx" ] && [ ! -f "${resolved}/index.ts" ]; then
      echo "ORPHAN: $file imports $import_path"
    fi
  done
```

**After a failed CI build, find the specific orphan:**

```bash
# From the CI error message like "Module not found: Can't resolve './deleted-module'"
rg "from.*deleted-module" --type ts
```

---

## Related Documentation

- [ESLINT_PREVENTION_INDEX.md](../patterns/ESLINT_PREVENTION_INDEX.md) - Dead code detection
- [SILENT_CI_FAILURES_PREVENTION.md](../ci-cd/SILENT_CI_FAILURES_PREVENTION.md) - CI reliability
- [ADK_AGENT_TYPESCRIPT_BUILD_PREVENTION.md](../patterns/ADK_AGENT_TYPESCRIPT_BUILD_PREVENTION.md) - Agent-specific builds

---

## CLAUDE.md Entry

Add to Common Pitfalls section:

```markdown
87. Orphan imports after deletion - Deleted file/function but forgot to update importers; incremental build passes, clean CI build fails; run `rm -rf server/dist && npm run typecheck` before committing deletions. See `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`
```

---

**Last Updated:** 2026-01-27
