# Connection Pool Exhaustion: Detection Patterns

**Automated detection patterns for catching connection pool violations before they cause test failures.**

---

## ESLint Rules (Automated)

Add to your `.eslintrc.json` to catch violations at lint time:

### Rule 1: Prevent Direct PrismaClient Instantiation in Tests

```json
{
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "NewExpression[callee.name='PrismaClient']",
            "message": "❌ VIOLATION: Direct PrismaClient instantiation in test files causes connection pool exhaustion. Use getTestPrisma() or setupIntegrationTest() instead. See docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md"
          }
        ]
      }
    }
  ]
}
```

**What it catches:**
```typescript
❌ const prisma = new PrismaClient(); // ESLint error!

✅ const { prisma } = setupIntegrationTest(); // Pass
✅ const prisma = getTestPrisma(); // Pass
```

---

## Grep Patterns (Manual Detection)

Run these to find violations in your codebase:

### Pattern 1: Find Direct PrismaClient Creation

```bash
# Show all occurrences with line numbers
grep -rn "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts"

# Just count
grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" | wc -l

# Show file paths only
grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" -l

# Show with context (surrounding 5 lines)
grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" -B2 -A2
```

**Expected output:**
```
server/src/services/catalog.service.integration.test.ts:13:const prisma = new PrismaClient();
```

---

### Pattern 2: Find Missing Cleanup

Tests without proper cleanup leak connections:

```bash
# Find test files with no afterEach or afterAll
find server/src -name "*.test.ts" -o -name "*.spec.ts" | \
  while read file; do
    if ! grep -q "afterEach\|afterAll" "$file"; then
      echo "❌ Missing cleanup: $file"
    fi
  done

# Find afterEach without calling cleanup (dangerous!)
grep -r "afterEach\|afterAll" server/src --include="*.test.ts" -A3 | \
  grep -B3 "^\s*});" | \
  grep -v "cleanup\|disconnect\|\.cleanup()" | \
  head -20
```

---

### Pattern 3: Find Generic Test Slugs

Generic slugs like `'test'` conflict when tests run in parallel:

```bash
# Find generic slugs
grep -rn "createMultiTenantSetup.*'test'" server/src --include="*.test.ts"

# Show full line with context
grep -rn "createMultiTenantSetup" server/src --include="*.test.ts" -B1 -A1

# Expected to see: createMultiTenantSetup(prisma, 'booking-service');
# NOT:              createMultiTenantSetup(prisma, 'test');
```

---

### Pattern 4: Find Hardcoded Slugs in Test Data

Hardcoded slugs cause duplicate key errors when tests run in parallel:

```bash
# Find hardcoded slug values (common culprits)
grep -rn "slug:\s*['\"]test" server/src --include="*.test.ts"
grep -rn "slug:\s*['\"]my-test" server/src --include="*.test.ts"
grep -rn "slug:\s*['\"]integration" server/src --include="*.test.ts"

# Show context
grep -rn "slug:\s*['\"]" server/src --include="*.test.ts" -B2 -A2 | \
  grep -v "factory\|Factory"
```

---

### Pattern 5: Find Missing tenantId Filters

Data isolation depends on filtering all queries by tenantId:

```bash
# Find queries without tenantId filter (risky)
grep -rn "prisma\.[a-z]*\.findMany" server/src --include="*.test.ts" | \
  grep -v "tenantId"

# More specific: find findMany/findFirst without where clause
grep -rn "\.findMany()" server/src --include="*.test.ts"
grep -rn "\.findFirst()" server/src --include="*.test.ts"

# Find bare property access (missing filter)
grep -rn "where:\s*{" server/src --include="*.test.ts" | \
  grep -v "tenantId"
```

---

## CI/CD Integration

### GitHub Actions Workflow

Add automated detection to your CI pipeline:

```yaml
# .github/workflows/test-validation.yml
name: Test Connection Pool Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for PrismaClient violations
        run: |
          echo "Checking for direct PrismaClient instantiation in tests..."
          violations=$(grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" | wc -l)
          if [ $violations -gt 0 ]; then
            echo "❌ Found $violations PrismaClient violation(s):"
            grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" -l
            echo ""
            echo "Fix: Use getTestPrisma() instead"
            exit 1
          else
            echo "✅ No PrismaClient violations found"
          fi

      - name: Check for missing cleanup
        run: |
          echo "Checking for missing cleanup in test files..."
          # Find test files with no afterEach/afterAll
          missing=$(find server/src -name "*.test.ts" -o -name "*.spec.ts" | \
            while read f; do
              if ! grep -q "afterEach\|afterAll" "$f"; then
                echo "$f"
              fi
            done | wc -l)

          if [ $missing -gt 0 ]; then
            echo "❌ Found $missing test file(s) without cleanup"
            find server/src -name "*.test.ts" -o -name "*.spec.ts" | \
              while read f; do
                if ! grep -q "afterEach\|afterAll" "$f"; then
                  echo "  - $f"
                fi
              done
            exit 1
          else
            echo "✅ All test files have cleanup"
          fi

      - name: Check for generic slugs
        run: |
          echo "Checking for generic test slugs..."
          generic=$(grep -r "createMultiTenantSetup.*'test'" server/src --include="*.test.ts" | wc -l)
          if [ $generic -gt 0 ]; then
            echo "⚠️  Found $generic generic slug(s) that may conflict:"
            grep -r "createMultiTenantSetup.*'test'" server/src --include="*.test.ts" -l
            echo ""
            echo "Use file-specific slugs like 'booking-service' instead of 'test'"
          fi

      - name: ESLint connection pool rules
        run: |
          npm run lint -- --rule "no-restricted-syntax: error"
          # If ESLint finds violations, this step fails
```

### Pre-commit Hook

Add to `.husky/pre-commit` to catch issues before they're committed:

```bash
#!/bin/sh

echo "🔍 Checking for connection pool violations..."

# Check for PrismaClient violations
if grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts" > /dev/null; then
  echo "❌ ABORT: Found direct PrismaClient() in test files"
  echo "Use getTestPrisma() or setupIntegrationTest() instead"
  exit 1
fi

# Check for test files without cleanup
missing_cleanup=$(find server/src -name "*.test.ts" -o -name "*.spec.ts" | \
  while read f; do
    if ! grep -q "afterEach\|afterAll" "$f"; then
      echo "$f"
    fi
  done)

if [ ! -z "$missing_cleanup" ]; then
  echo "❌ ABORT: Found test files without cleanup:"
  echo "$missing_cleanup"
  exit 1
fi

echo "✅ Connection pool checks passed"
exit 0
```

---

## Monitoring & Alerting

### Health Check Script

Run this during test execution to monitor connection pool:

```bash
#!/bin/bash
# scripts/monitor-connection-pool.sh

DATABASE_URL=$1
POLLING_INTERVAL=2
THRESHOLD=50

echo "🔌 Monitoring connection pool (threshold: $THRESHOLD connections)"
echo "Press Ctrl+C to stop"

while true; do
  count=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();" 2>/dev/null || echo "?")

  if [ "$count" != "?" ]; then
    if [ "$count" -gt "$THRESHOLD" ]; then
      echo "⚠️  WARNING: $count connections (exceeds threshold of $THRESHOLD)"
    else
      echo "✅ $count connections"
    fi
  else
    echo "❌ Unable to connect to database"
  fi

  sleep $POLLING_INTERVAL
done
```

**Usage:**

```bash
# In one terminal: start tests
npm test

# In another terminal: monitor pool
bash scripts/monitor-connection-pool.sh $DATABASE_URL
```

---

## Test Matrix Detection

### Find Tests That Should Be Sequential

```bash
# Find tests that access database (likely need sequential)
grep -r "setupIntegrationTest\|getTestPrisma\|PrismaClient" server/src \
  --include="*.test.ts" -l | \
  xargs grep -L "describe.sequential"
```

**Output:** Test files using database but not marked as sequential.

---

## Pattern Report Generation

### Generate CSV Report

```bash
# Generate a CSV of all test files with metrics
echo "file,has_prisma_violation,has_cleanup,uses_setup_helper,slug" > test-report.csv

find server/src -name "*.test.ts" -o -name "*.spec.ts" | while read f; do
  has_violation=$(grep -q "new PrismaClient()" "$f" && echo "YES" || echo "NO")
  has_cleanup=$(grep -q "afterEach\|afterAll" "$f" && echo "YES" || echo "NO")
  uses_helper=$(grep -q "setupIntegrationTest\|setupCompleteIntegrationTest" "$f" && echo "YES" || echo "NO")
  slug=$(grep "createMultiTenantSetup" "$f" | sed "s/.*createMultiTenantSetup.*'\([^']*\)'.*/\1/" | head -1)

  echo "$f,$has_violation,$has_cleanup,$uses_helper,$slug" >> test-report.csv
done

# View report
column -t -s',' test-report.csv
```

---

## Quick Command Reference

Copy-paste these commonly used commands:

```bash
# Find all violations
grep -r "new PrismaClient()" server/src --include="*.test.ts" -l

# Find missing cleanup
find server/src -name "*.test.ts" | while read f; do
  grep -q "afterEach\|afterAll" "$f" || echo "❌ $f"
done

# Find generic slugs
grep -r "createMultiTenantSetup.*'test'" server/src --include="*.test.ts" -l

# Count violations by type
echo "=== Connection Pool Violations ==="
echo -n "PrismaClient: "
grep -r "new PrismaClient()" server/src --include="*.test.ts" 2>/dev/null | wc -l
echo -n "Missing cleanup: "
find server/src -name "*.test.ts" | while read f; do
  grep -q "afterEach\|afterAll" "$f" || echo "$f"
done | wc -l

# ESLint check only
npm run lint -- server/src --rule "no-restricted-syntax: error"

# Monitor pool during tests
watch -n 1 "psql \$DATABASE_URL -t -c \"SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();\""
```

---

## Integration with Code Quality Gates

### Add to Quality Checks

In your CI pipeline AFTER tests pass, verify prevention:

```yaml
- name: Verify test connection pool safety
  if: success()  # Run only if tests passed
  run: |
    echo "Verifying connection pool prevention measures..."

    # Check all prevention measures
    bash scripts/validate-connection-pool-prevention.sh

    # Generate report
    bash scripts/generate-test-metrics.sh > test-metrics.txt

    # Fail if critical violations found
    if grep -q "CRITICAL" test-metrics.txt; then
      echo "❌ Critical violations detected"
      cat test-metrics.txt
      exit 1
    fi
```

---

## Troubleshooting Detection

### False Positives

Some patterns might match incorrectly:

```bash
# Exclude node_modules, vendor files
grep -r "new PrismaClient()" server/src \
  --include="*.test.ts" \
  --exclude-dir=node_modules \
  --exclude-dir=dist

# Exclude seed scripts and migrations
grep -r "new PrismaClient()" server \
  --include="*.test.ts" \
  --exclude-dir=prisma \
  --exclude="*seed*" \
  --exclude="*migrate*"
```

### Complex Patterns

For more sophisticated detection, use Ripgrep:

```bash
# Find PrismaClient instantiation (any variation)
rg "new\s+PrismaClient\s*\(" --type ts --glob "*.test.ts"

# Find tenantId filtering
rg "where.*tenantId" --type ts --glob "*.test.ts" -c

# Find factory usage
rg "Factory\(\)|factory\.create" --type ts --glob "*.test.ts"
```

---

## References

- **Prevention Guide:** `/docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md`
- **Quick Checklist:** `/docs/solutions/database-issues/CONNECTION_POOL_QUICK_CHECKLIST.md`
- **Test Isolation Strategies:** `/docs/solutions/TEST_ISOLATION_PREVENTION_STRATEGIES.md`
- **Multi-Tenant Guide:** `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
