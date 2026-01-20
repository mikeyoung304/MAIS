# ESLint Rule Setup for Wrapper Format Prevention

This document describes how to set up and use the `landing-page-config-wrapper` ESLint rule.

---

## File Locations

- **Rule Implementation:** `server/eslint-rules/landing-page-config-wrapper.js`
- **Configuration:** Add to `server/.eslintrc.json` or `server/.eslintrc.js`

---

## Setup Instructions

### Step 1: Create Rule File

The rule file already exists at:

```
server/eslint-rules/landing-page-config-wrapper.js
```

This rule detects patterns like:

```typescript
// ❌ WRONG - Detected by rule
{
  landingPageConfig: {
    published: draftConfig;
  }
}

// ✅ CORRECT - Not flagged
{
  landingPageConfig: createPublishedWrapper(draftConfig);
}
```

### Step 2: Register Rule in ESLint Config

Edit `server/.eslintrc.json` (or create if doesn't exist):

```json
{
  "rules": {
    "landing-page-config-wrapper": "error"
  }
}
```

If using `.eslintrc.js`:

```javascript
module.exports = {
  rules: {
    'landing-page-config-wrapper': 'error',
  },
};
```

### Step 3: Register Custom Rules Plugin

If not already done, register the custom rules directory in ESLint config:

```json
{
  "plugins": ["./eslint-rules"],
  "rules": {
    "landing-page-config-wrapper": "error"
  }
}
```

Or in `.eslintrc.js`:

```javascript
module.exports = {
  plugins: ['./eslint-rules'],
  rules: {
    'landing-page-config-wrapper': 'error',
  },
};
```

---

## Usage

### Run ESLint Check

```bash
# Check entire server directory
npm run lint

# Check specific file
npx eslint server/src/routes/internal-agent.routes.ts --rule 'landing-page-config-wrapper: error'

# Fix auto-fixable issues
npm run lint -- --fix

# Show only this rule
npx eslint . --rule 'landing-page-config-wrapper: error' --rule 'no-unused-vars: off'
```

### IDE Integration

**VS Code:**

Add to `.vscode/settings.json`:

```json
{
  "eslint.validate": ["javascript", "typescript"],
  "eslint.rules.customizations": [
    {
      "rule": "landing-page-config-wrapper",
      "severity": "error"
    }
  ]
}
```

**WebStorm/IntelliJ:**

1. Go to Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. Enable ESLint
3. Set "Configuration file:" to `server/.eslintrc.json`

---

## What the Rule Catches

### Pattern 1: Direct Object in Update

```typescript
// ❌ CAUGHT
await tenantRepo.update(tenantId, {
  landingPageConfig: {
    published: draftConfig,
  },
});
```

Error message:

```
Use createPublishedWrapper() helper for landingPageConfig updates.
Manually constructed objects are missing the publishedAt timestamp.
```

### Pattern 2: Object Property Assignment

```typescript
// ❌ CAUGHT
const data = {
  landingPageConfig: {
    published: someConfig,
    draft: null,
  },
};
```

### Pattern 3: Missing publishedAt

```typescript
// ❌ CAUGHT
const wrapper = {
  draft: null,
  draftUpdatedAt: null,
  published: config,
  // Missing: publishedAt
};
```

### Correct Usage (Not Flagged)

```typescript
// ✅ NOT flagged
import { createPublishedWrapper } from '../lib/landing-page-utils';

await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig),
  landingPageConfigDraft: null,
});

// ✅ NOT flagged (variable reference, not object literal)
const wrapper = createPublishedWrapper(draftConfig);
await tenantRepo.update(tenantId, {
  landingPageConfig: wrapper,
  landingPageConfigDraft: null,
});
```

---

## Pre-commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Check landing page config wrapper rule
npx eslint server/src --rule 'landing-page-config-wrapper: error' --max-warnings 0

if [ $? -ne 0 ]; then
  echo "ESLint check failed: landing-page-config-wrapper violations found"
  exit 1
fi
```

Or add to `package.json` scripts:

```json
{
  "scripts": {
    "lint": "eslint . --rule 'landing-page-config-wrapper: error'",
    "lint:fix": "eslint . --fix --rule 'landing-page-config-wrapper: error'",
    "precommit": "npm run lint"
  }
}
```

---

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/lint.yml`:

```yaml
name: ESLint Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Check landing-page-config-wrapper rule
        run: npx eslint server/src --rule 'landing-page-config-wrapper: error' --max-warnings 0
```

### Pre-deployment Check

Add to deployment script:

```bash
#!/bin/bash
set -e

echo "Checking ESLint rules..."
npx eslint server/src --rule 'landing-page-config-wrapper: error' --max-warnings 0

if [ $? -ne 0 ]; then
  echo "❌ ESLint check failed"
  exit 1
fi

echo "✅ ESLint check passed"
npm run build
npm run deploy
```

---

## Testing the Rule

### Test Case 1: Catch Violation

Create `test-violation.ts`:

```typescript
import { something } from '@macon/contracts';

// This should be flagged
const badCode = {
  tenantId: 'test',
  landingPageConfig: {
    published: { pages: { home: { sections: [] } } },
  },
};
```

Run ESLint:

```bash
npx eslint test-violation.ts --rule 'landing-page-config-wrapper: error'
```

Expected output:

```
  2:3  error  Use createPublishedWrapper() helper for landingPageConfig updates...
```

### Test Case 2: Allow Correct Pattern

Create `test-correct.ts`:

```typescript
import { createPublishedWrapper } from '../lib/landing-page-utils';

// This should NOT be flagged
const goodCode = {
  tenantId: 'test',
  landingPageConfig: createPublishedWrapper(draftConfig),
};
```

Run ESLint:

```bash
npx eslint test-correct.ts --rule 'landing-page-config-wrapper: error'
```

Expected output:

```
✔ No errors
```

---

## Troubleshooting

### Rule Not Running

**Problem:** Rule isn't being triggered despite violations

**Solution:**

1. Verify rule is registered in `.eslintrc.json`:

   ```json
   {
     "rules": {
       "landing-page-config-wrapper": "error"
     }
   }
   ```

2. Check rule file exists:

   ```bash
   ls server/eslint-rules/landing-page-config-wrapper.js
   ```

3. Verify ESLint version (should be v8+):
   ```bash
   npx eslint --version
   ```

### Rule Too Aggressive

**Problem:** Rule is flagging valid code

**Solution:** The rule currently checks for:

- Object expressions with `published` property
- Missing `publishedAt` property

If getting false positives, it may be catching unrelated objects with `published` property. Update the rule to be more specific:

```javascript
// More specific check - only in tenantRepo.update or similar calls
CallExpression(node) {
  if (node.callee.property?.name === 'update') {
    // Only check in update() calls
  }
}
```

### Rule Not Auto-fixing

**Problem:** `eslint --fix` isn't fixing the violations

**Solution:** The rule supports auto-fix for simple cases. For complex cases, manual fix is needed:

```typescript
// ❌ Detected but not auto-fixable (complex object)
const update = {
  landingPageConfig: {
    published: computeConfig(),
    draft: maybeNull(),
  },
};

// ✅ Recommended manual fix
import { createPublishedWrapper } from '../lib/landing-page-utils';

const draftConfig = computeConfig();
const update = {
  landingPageConfig: createPublishedWrapper(draftConfig),
};
```

---

## Disabling the Rule (When Needed)

### For Specific Line

```typescript
// eslint-disable-next-line landing-page-config-wrapper
const update = {
  landingPageConfig: { published: config },
};
```

### For Specific File

```typescript
/* eslint-disable landing-page-config-wrapper */

// code here...
```

### For Specific Block

```typescript
/* eslint-disable landing-page-config-wrapper */
const update = {
  landingPageConfig: { published: config },
};
/* eslint-enable landing-page-config-wrapper */
```

**Note:** Disabling should be rare and require comment explaining why.

---

## Maintenance

### Updating the Rule

If the rule needs changes, edit `server/eslint-rules/landing-page-config-wrapper.js` and:

1. Run tests to verify changes
2. Update documentation
3. Test with existing codebase
4. Deploy with new ESLint config

### Monitoring

Check periodically for new violations:

```bash
# Find all landingPageConfig assignments
grep -r "landingPageConfig:" server/src --include="*.ts"

# Check if any bypass the rule
grep -r "landingPageConfig.*{" server/src --include="*.ts"
```

---

## Documentation Links

- **Rule Implementation:** `server/eslint-rules/landing-page-config-wrapper.js`
- **Prevention Guide:** `docs/solutions/WRAPPER_FORMAT_PREVENTION.md`
- **Quick Reference:** `docs/solutions/patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md`
- **Bug Reference:** #697 - Dual draft system publish mismatch fix
