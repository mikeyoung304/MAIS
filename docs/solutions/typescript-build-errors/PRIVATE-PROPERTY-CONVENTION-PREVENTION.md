---
module: MAIS
date: 2025-12-29
problem_type: build_error
component: server/services/, server/adapters/
symptoms:
  - TS2341: Property 'repository' is private and can only be accessed within class 'ServiceName'
  - IDE marks private properties without underscore prefix as errors
  - ESLint reports missing underscore on private fields
root_cause: Private properties defined without underscore prefix convention, causing TypeScript strict mode violations
resolution_type: code_style_pattern
severity: P2
related_files:
  - server/src/services/*.service.ts
  - server/src/adapters/*.adapter.ts
tags: [typescript, naming-conventions, private-properties, build-errors, eslint]
---

# Prevention Strategy: Private Property Convention

## Problem Summary

**Issue:** TypeScript strict mode enforces that private properties be prefixed with underscore, but code uses properties like `private repository` instead of `private _repository`.

**Root Cause:** Inconsistent application of TypeScript's private property naming convention. Some code follows the pattern, some doesn't.

**Impact:**

- Build fails with TS2341 or ESLint errors
- IDE shows warnings on private properties
- Inconsistent codebase style

**Example:**

```typescript
// ❌ WRONG - Private property without underscore prefix

export class BookingService {
  constructor(private repository: BookingRepository) {}
  // ↑ ESLint error: Private property 'repository' should be prefixed with underscore

  private validate() {
    // ✅ Methods are OK without underscore
    // ...
  }
}

// ✅ CORRECT - Underscore prefix for private properties

export class BookingService {
  constructor(private _repository: BookingRepository) {}
  // ↑ Preferred in strict TypeScript projects

  private validate() {
    // ✅ Methods don't need prefix
    // ...
  }
}
```

---

## Prevention Strategy

### 1. Understanding Private Property Conventions

**TypeScript has three ways to mark properties as private:**

```typescript
// ❌ Option 1: public property (not recommended for deps)
export class BookingService {
  repository: BookingRepository; // Anyone can access
  constructor(repo: BookingRepository) {
    this.repository = repo;
  }
}

// ❌ Option 2: private without underscore (old style, avoided)
export class BookingService {
  private repository: BookingRepository; // TypeScript-only privacy
  constructor(repo: BookingRepository) {
    this.repository = repo;
  }
}
// Problem: Compiles to JavaScript without underscore signal
// Other developers don't know it's "private" in JS

// ✅ Option 3: private with underscore (recommended)
export class BookingService {
  private _repository: BookingRepository; // TypeScript + JavaScript convention
  constructor(repo: BookingRepository) {
    this._repository = repo;
  }

  getRepository() {
    return this._repository; // ← Use with underscore
  }
}

// ✅ Option 4: #private field (modern TypeScript/JS)
export class BookingService {
  #repository: BookingRepository; // True privacy, can't access from subclass
  constructor(repo: BookingRepository) {
    this.#repository = repo;
  }
}
// Most modern approach - added in TypeScript 3.8
```

### 2. MAIS Project Convention: Underscore Prefix

**For MAIS, use underscore prefix for private properties:**

Document in CLAUDE.md:

````markdown
## Private Property Naming Convention

All private properties MUST be prefixed with underscore (`_`):

### Pattern

```typescript
export class MyService {
  private _repository: MyRepository;
  private _eventEmitter: EventEmitter;
  private _logger: Logger;
  private _cache: Map<string, any>;

  constructor(repository: MyRepository, eventEmitter: EventEmitter, logger: Logger) {
    this._repository = repository;
    this._eventEmitter = eventEmitter;
    this._logger = logger;
    this._cache = new Map();
  }

  // Use underscore prefix in methods
  private _validateInput(data: any): boolean {
    return !!data;
  }

  // Method to access private property
  getRepository(): MyRepository {
    return this._repository;
  }
}
```
````

### Why Underscore?

1. **Signal to developers** - Underscore is a universal convention
2. **Works in JavaScript** - Not just TypeScript privacy
3. **IDE support** - Editors highlight differently
4. **Consistency** - Matches Node.js standard library
5. **Linter friendly** - ESLint can enforce the pattern

### When NOT to Use Underscore

Methods don't need underscore prefix:

```typescript
export class BookingService {
  private _repository: BookingRepository;

  // ✅ Method is private, but no underscore needed
  private validate(): boolean {
    return true;
  }

  // ✅ Method is private, no underscore
  private async executeTransaction() {
    // ...
  }
}
```

### Exceptions

The only exception is when TypeScript forces public access:

```typescript
// ❌ Avoid if possible
export class BookingService {
  public readonly _repository: BookingRepository; // Weird: public but marked private
}

// ✅ Better: Either truly private or truly public
export class BookingService {
  private _repository: BookingRepository; // Private - use underscore

  public getRepository(): BookingRepository {
    // Public method - no underscore
    return this._repository;
  }
}
```

````

### 3. ESLint Configuration to Enforce

**Add to `.eslintrc.json` or `.eslintrc.cjs`:**

```json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "memberLike",
        "modifiers": ["private"],
        "format": ["camelCase"],
        "leadingUnderscore": "require"  // ← ENFORCE underscore
      },
      {
        "selector": "memberLike",
        "modifiers": ["private"],
        "format": ["camelCase"],
        "leadingUnderscore": "require",
        "filter": {
          "match": false,
          "regex": "^_"
        }
      }
    ]
  }
}
````

**Or simpler rule:**

```json
{
  "rules": {
    "no-underscore-dangle": [
      "off" // Allow underscores
    ],
    "id-denylist": [
      "error"
      // Don't disallow private properties with underscore
    ]
  }
}
```

**Run ESLint to catch violations:**

```bash
npm run lint  # Should fail on missing underscores
npm run lint -- --fix  # Auto-fix simple cases
```

---

## Code Review Checklist

### When Reviewing Class Definitions

```yaml
Private Property Naming Review:
  □ Are all private properties prefixed with underscore?
    └─ Check all fields marked 'private'
    └─ Verify each has '_' prefix: private _name
    └─ No 'private name' without underscore

  □ Are private methods also using underscore prefix?
    └─ Check pattern: private _methodName() { }
    └─ Inconsistent style: some with, some without

  □ Are public properties/methods without underscore?
    └─ Public should never have underscore
    └─ Check 'public' and non-declared properties

  □ Is the readonly keyword used correctly?
    └─ private readonly _repository: Repository
    └─ No mixing: readonly always with private

  □ Constructor parameter shortcuts correct?
    └─ Check: constructor(private _repo: Repository)
    └─ VS: constructor(repo: Repository) { this._repo = repo; }
```

### Pull Request Template Addition

```markdown
## TypeScript Convention Checklist

- [ ] All private properties are prefixed with underscore: `private _name`
- [ ] All private methods are prefixed with underscore: `private _methodName()`
- [ ] All public properties/methods are NOT prefixed with underscore
- [ ] Readonly keyword paired with private: `private readonly _name`
- [ ] ESLint passes: `npm run lint`
- [ ] TypeScript strict mode passes: `npm run typecheck`
- [ ] Constructor shortcuts use underscore: `constructor(private _repo)`

### If new class added:

- [ ] All injected dependencies are private with underscore
- [ ] At least one public method exposes each dependency if needed
- [ ] No public access to internal state unless intentional
```

---

## IDE Configuration to Catch This

### VSCode Settings

**Add to `.vscode/settings.json`:**

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    }
  },
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.enable": true,
  "eslint.run": "onSave"
}
```

**Result:** ESLint will auto-fix some issues, flag others in editor

### Pre-Commit Hook

**Add to `.husky/pre-commit`:**

```bash
#!/bin/bash
set -e

echo "Checking private property naming convention..."
npm run lint -- --rule "@typescript-eslint/naming-convention: off" --rule "no-underscore-dangle: off"

# Stricter check: look for 'private [property]' without underscore
VIOLATIONS=$(grep -r "private [a-zA-Z_]" server/src --include="*.ts" | grep -v "_" || true)

if [ ! -z "$VIOLATIONS" ]; then
  echo ""
  echo "ERROR: Found private properties without underscore prefix:"
  echo "$VIOLATIONS"
  echo ""
  echo "Fix: Prefix with underscore"
  echo "  Example: private _repository: Repository"
  exit 1
fi

echo "✓ Private property naming check passed"
```

---

## Quick Reference: Underscore Rules

```
Is this a private property?
├─ YES
│  ├─ Use underscore prefix: private _propertyName
│  ├─ Use in methods: this._propertyName
│  └─ Readonly? Use: private readonly _propertyName
└─ NO

Is this a private method?
├─ YES
│  ├─ Use underscore prefix: private _methodName()
│  └─ Call with: this._methodName()
└─ NO

Is this public?
├─ YES
│  ├─ NO underscore prefix
│  ├─ Use directly: propertyName or methodName()
│  └─ Consider exposing as method: getProperty()
└─ NO
```

---

## Common Patterns in MAIS

### ✅ CORRECT Pattern

**In `server/src/services/booking.service.ts`:**

```typescript
import type { BookingRepository, PaymentProvider } from '../lib/ports';
import { logger } from '../lib/core/logger';

export class BookingService {
  private _bookingRepo: BookingRepository;
  private _paymentProvider: PaymentProvider;

  constructor(bookingRepo: BookingRepository, paymentProvider: PaymentProvider) {
    this._bookingRepo = bookingRepo;
    this._paymentProvider = paymentProvider;
  }

  // Public method
  async createBooking(tenantId: string, data: CreateBookingInput) {
    // Validate using private method
    this._validateBookingData(data);

    // Use private repository
    const booking = await this._bookingRepo.create(tenantId, data);

    // Use private payment provider
    await this._paymentProvider.createPaymentIntent(booking.id);

    return booking;
  }

  // Private method - also uses underscore
  private _validateBookingData(data: CreateBookingInput): void {
    if (!data.eventDate) {
      throw new Error('Event date is required');
    }
  }
}
```

**Or with constructor shortcut:**

```typescript
export class BookingService {
  constructor(
    private _bookingRepo: BookingRepository,
    private _paymentProvider: PaymentProvider
  ) {}

  async createBooking(tenantId: string, data: CreateBookingInput) {
    this._validateBookingData(data);
    const booking = await this._bookingRepo.create(tenantId, data);
    await this._paymentProvider.createPaymentIntent(booking.id);
    return booking;
  }

  private _validateBookingData(data: CreateBookingInput): void {
    // ...
  }
}
```

### ✅ CORRECT: Public Access Via Method

```typescript
export class BookingService {
  private _bookingRepo: BookingRepository;

  constructor(bookingRepo: BookingRepository) {
    this._bookingRepo = bookingRepo;
  }

  // Public getter if you need to expose the repository
  public getRepository(): BookingRepository {
    return this._bookingRepo;
  }

  // Or public method that uses it
  public async getBooking(tenantId: string, id: string) {
    return this._bookingRepo.getById(tenantId, id);
  }
}
```

### ❌ INCORRECT Pattern

```typescript
// ❌ WRONG: Missing underscore on private property
export class BookingService {
  private bookingRepo: BookingRepository; // Should be _bookingRepo

  constructor(bookingRepo: BookingRepository) {
    this.bookingRepo = bookingRepo; // Should use _bookingRepo
  }

  async createBooking(tenantId: string, data: CreateBookingInput) {
    const booking = await this.bookingRepo.create(tenantId, data); // Should use _bookingRepo
    return booking;
  }
}

// ❌ WRONG: Mixing styles
export class BookingService {
  private _bookingRepo: BookingRepository; // Has underscore
  private paymentProvider: PaymentProvider; // Missing underscore

  constructor(repo: BookingRepository, provider: PaymentProvider) {
    this._bookingRepo = repo; // Consistent
    this.paymentProvider = provider; // Inconsistent
  }
}

// ❌ WRONG: Public underscore (looks private)
export class BookingService {
  public _bookingRepo: BookingRepository; // Underscore + public = confusing

  constructor(repo: BookingRepository) {
    this._bookingRepo = repo;
  }
}
```

---

## Migration Guide: Fixing Existing Code

### If You Have Codebase Without Underscore Convention

**Automated fix with ESLint:**

```bash
# Analyze what needs fixing
npm run lint -- --report-unused-disable-directives-only

# ESLint might auto-fix some (limited for naming)
npm run lint -- --fix
```

**Manual approach:**

```bash
# Find all private properties without underscore
grep -r "private [a-zA-Z]" server/src --include="*.ts" | grep -v "_" | head -20

# Review each match and manually update:
# private repository → private _repository
# this.repository → this._repository
```

**Script to help:**

```bash
#!/bin/bash
# scripts/fix-private-properties.sh

echo "Finding private properties without underscore..."

for file in $(grep -r "private [a-zA-Z]" server/src --include="*.ts" | cut -d: -f1 | sort -u); do
  echo "Reviewing: $file"
  # Requires manual review - print lines with context
  grep -n "private [a-zA-Z]" "$file" | grep -v "_"
done
```

**Update CLAUDE.md to document the convention, then gradually update code.**

---

## Testing to Verify Convention

### TypeScript Compilation Check

```typescript
// This file's TypeScript check proves convention is followed
import type { BookingRepository } from '../lib/ports';

// If compilation passes, all private properties have underscores
export class BookingService {
  private _repository: BookingRepository;

  constructor(repo: BookingRepository) {
    this._repository = repo;
  }

  // Compilation will fail if you write:
  // private repository: BookingRepository;  // ← Missing underscore
  // this.repository = repo;  // ← Would reference undefined
}
```

### ESLint Test

```bash
# Run ESLint with strict naming rules
npm run lint

# Should pass with all private properties using underscore
# Should fail with output like:
# error  Private property 'repository' should be prefixed with underscore
```

---

## Deployment Verification

### Before Deploying to Render/Production

```bash
# 1. Run linting (catches private property violations)
npm run lint

# 2. Run TypeScript typecheck
npm run typecheck

# 3. Build entire project
npm run build

# 4. Run tests (any private property issues would surface)
npm test
```

### CI/CD Check (GitHub Actions)

**Add to `.github/workflows/ci.yml`:**

```yaml
- name: Lint TypeScript
  run: npm run lint

- name: Check TypeScript Strict Mode
  run: npm run typecheck

- name: Build
  run: npm run build

- name: Verify Private Property Convention
  run: |
    # Find any private properties without underscore
    VIOLATIONS=$(grep -r "private [a-zA-Z_]" server/src --include="*.ts" | grep -v "_" || true)
    if [ ! -z "$VIOLATIONS" ]; then
      echo "ERROR: Found private properties without underscore prefix:"
      echo "$VIOLATIONS"
      exit 1
    fi
```

---

## Summary

**Key Takeaway:** Private property naming mismatches are preventable with:

1. **Clear convention** documented in CLAUDE.md
2. **ESLint enforcement** - rules to catch violations
3. **IDE support** - VSCode will highlight issues
4. **Pre-commit hook** - catch before pushing
5. **Code review** - verify in pull request

**Prevention Checklist:**

- [ ] All private properties prefixed with underscore: `private _name`
- [ ] All private methods prefixed with underscore: `private _methodName()`
- [ ] All public properties/methods have NO underscore
- [ ] ESLint passes: `npm run lint`
- [ ] TypeScript strict passes: `npm run typecheck`
- [ ] Constructor shortcuts use underscore: `constructor(private _repo)`
- [ ] Code review checklist verifies naming convention
