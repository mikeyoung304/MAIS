# Prisma Upgrade Checklist (JSON Type Safety)

**Purpose:** Prevent regression of JSON type issues when upgrading Prisma
**Print & Pin:** Yes - keep near desk during upgrades
**Time to Run:** ~30 minutes
**Level:** All engineers

---

## Pre-Upgrade Prep (30 mins before upgrade)

### [ ] 1. Document Current State

```bash
# Get current Prisma version
npm list prisma

# Document in upgrade notes
echo "Current: $(npm list prisma)" >> UPGRADE_NOTES.md
echo "Date: $(date)" >> UPGRADE_NOTES.md
echo "Performed by: $(git config user.name)" >> UPGRADE_NOTES.md
```

### [ ] 2. Run All Tests (Baseline)

```bash
# Full test suite before changes
npm test 2>&1 | tee BEFORE_UPGRADE_TESTS.log

# Integration tests specifically (touch database)
npm run test:integration 2>&1 | tee BEFORE_UPGRADE_INTEGRATION.log

# Verify baseline metrics
echo "Test baseline captured"
```

### [ ] 3. Backup Database (if dev/staging)

```bash
# PostgreSQL backup (if available)
pg_dump $DATABASE_URL > backup_pre_upgrade.sql

echo "Database backed up to backup_pre_upgrade.sql"
```

---

## JSON Field Code Audit (15 mins)

### [ ] 4. Find All JSON Read Casts

```bash
# Find problematic read casts
grep -r "as.*\[\]" server/src --include="*.ts" | grep -v "unknown as" > JSON_READ_ISSUES.txt

# Inspect results
wc -l JSON_READ_ISSUES.txt
cat JSON_READ_ISSUES.txt
```

**For each match:**

- [ ] Is it `as unknown as TargetType`? (✓ GOOD)
- [ ] Is it `as Type[]` directly? (✗ FIX REQUIRED)

**Fix pattern:**

```typescript
// Before
const arr = value as PhotoType[];

// After
const arr = value as unknown as PhotoType[];
```

### [ ] 5. Find All JSON Write Casts

```bash
# Find JSON writes using InputJsonValue
grep -r "InputJsonValue" server/src --include="*.ts" -A1 -B1 > JSON_WRITES.txt

# Verify pattern
grep -r "as.*as Prisma.InputJsonValue" server/src --include="*.ts" > JSON_WRITES_CORRECT.txt

echo "Found $(wc -l < JSON_WRITES.txt) lines with InputJsonValue"
echo "Correct pattern: $(wc -l < JSON_WRITES_CORRECT.txt) lines"
```

**For each write:**

- [ ] Does it use `Prisma.InputJsonValue`? (✓ GOOD)
- [ ] Does it cast through `unknown` if needed? (✓ GOOD)
- [ ] No direct `null` assignments? (✓ GOOD)

**Fix pattern:**

```typescript
// Before (problematic)
data: {
  field: value as InputJsonValue;
}

// After (correct)
data: {
  field: value as unknown as Prisma.InputJsonValue;
}
```

### [ ] 6. Check All Null Assignments

```bash
# Find potential null issues
grep -r ":\s*null[,}]" server/src --include="*.ts" | grep -i "data:\|update\|create" > NULL_ASSIGNMENTS.txt

# Find correct DbNull usage
grep -r "DbNull" server/src --include="*.ts" > DBNULL_USAGE.txt

echo "Potential null issues: $(wc -l < NULL_ASSIGNMENTS.txt)"
echo "Correct DbNull usage: $(wc -l < DBNULL_USAGE.txt)"
```

**For each JSON field null:**

- [ ] Is it `Prisma.DbNull`? (✓ GOOD)
- [ ] Not direct `null`? (✓ GOOD)

**Fix pattern:**

```typescript
// Before
data: {
  draftPhotos: null;
}

// After
data: {
  draftPhotos: Prisma.DbNull;
}
```

### [ ] 7. Find All Prisma Extensions

```bash
# Locate extensions
grep -r "\$extends" server/src --include="*.ts" -B2 -A10 > PRISMA_EXTENSIONS.txt

# Check for type extraction attempts
grep -r "ReturnType.*extends\|typeof.*extends" server/src --include="*.ts" > TYPE_EXTRACTIONS.txt

echo "Extensions found: $(grep -c '\$extends' server/src --include="*.ts")"
echo "Type extraction attempts: $(wc -l < TYPE_EXTRACTIONS.txt)"
```

**For each extension:**

- [ ] Not trying to extract return type? (✓ GOOD)
- [ ] Using simple type alias? (✓ GOOD)

**Fix pattern:**

```typescript
// Before (unreliable)
type Client = ReturnType<typeof createExtendedClient>;

// After (simple)
type Client = PrismaClient;
```

### [ ] 8. Find All JSON Validations

```bash
# Check Zod usage with JSON
grep -r "safeParse\|\.parse(" server/src --include="*.ts" | grep -B2 -A2 "payload\|Json" > JSON_VALIDATIONS.txt

# Find missing validation
grep -r "event\.payload\|\.photos\|\.branding" server/src --include="*.ts" | grep -v "safeParse\|Schema\|parse" > MISSING_VALIDATION.txt

echo "JSON validations: $(wc -l < JSON_VALIDATIONS.txt)"
echo "Potential missing validations: $(wc -l < MISSING_VALIDATION.txt)"
```

**For each JSON read:**

- [ ] Followed by schema validation? (✓ GOOD)
- [ ] Uses `safeParse` (not throwing `.parse()`)? (✓ GOOD)
- [ ] Error path logged/handled? (✓ GOOD)

**Fix pattern:**

```typescript
// Before
const data = event.payload as SomeType;

// After
const parsed = SomeSchema.safeParse(event.payload);
if (!parsed.success) {
  logger.warn({ error: parsed.error }, 'Validation failed');
  return;
}
const data = parsed.data;
```

---

## Upgrade Execution (15 mins)

### [ ] 9. Update Prisma

```bash
# Check latest version
npm view prisma dist-tags.latest

# Update to latest
npm install prisma@latest @prisma/client@latest

# Verify install
npm list prisma
```

### [ ] 10. Generate Prisma Client

```bash
# Regenerate after version bump
npm exec prisma generate

# Verify no build errors
npm run build
```

### [ ] 11. Check Schema Compatibility

```bash
# Inspect schema for breaking changes
npm exec prisma validate

# View migration check
npm exec prisma migrate status
```

---

## Post-Upgrade Testing (30 mins)

### [ ] 12. Run Type Check

```bash
# Full type check
npm run typecheck 2>&1 | tee TYPE_CHECK_AFTER.log

# Compare before/after
diff TYPE_CHECK_BEFORE.log TYPE_CHECK_AFTER.log || echo "Type checking..."

# Extract JSON-related errors
grep -i "json\|Json\|InputJsonValue" TYPE_CHECK_AFTER.log > JSON_ERRORS.txt

if [ -s JSON_ERRORS.txt ]; then
  echo "⚠️  JSON type errors detected!"
  cat JSON_ERRORS.txt
else
  echo "✓ No JSON type errors"
fi
```

### [ ] 13. Build All Workspaces

```bash
# Build everything
npm run build 2>&1 | tee BUILD_AFTER.log

# Check for build errors
if grep -q "error" BUILD_AFTER.log; then
  echo "⚠️  Build errors detected!"
  grep "error" BUILD_AFTER.log
else
  echo "✓ Build successful"
fi
```

### [ ] 14. Run Unit Tests

```bash
# Unit tests only (no database)
npm run test:unit 2>&1 | tee UNIT_TESTS_AFTER.log

# Check pass rate
PASS_RATE=$(grep -o "[0-9]* passed" UNIT_TESTS_AFTER.log | head -1)
echo "Unit tests: $PASS_RATE"

# Compare with baseline
diff <(grep "passed" BEFORE_UPGRADE_TESTS.log) <(grep "passed" UNIT_TESTS_AFTER.log) || true
```

### [ ] 15. Run Integration Tests

```bash
# Integration tests (touches database)
npm run test:integration 2>&1 | tee INTEGRATION_TESTS_AFTER.log

# Look for JSON-related failures
grep -i "json\|Json\|InputJsonValue\|DbNull" INTEGRATION_TESTS_AFTER.log || echo "✓ No JSON-specific failures"

# Check overall pass rate
grep -E "passed|failed" INTEGRATION_TESTS_AFTER.log | tail -5
```

### [ ] 16. Test JSON Operations Specifically

```bash
# Run JSON-focused tests
npm test -- --grep "json|Json|JSON|payload|photos|branding" 2>&1 | tee JSON_TESTS_AFTER.log

echo "JSON test results:"
tail -10 JSON_TESTS_AFTER.log

# Check for failures
if grep -q "FAIL\|fail" JSON_TESTS_AFTER.log; then
  echo "⚠️  JSON tests failed!"
  grep -i "fail\|error" JSON_TESTS_AFTER.log
else
  echo "✓ All JSON tests passed"
fi
```

### [ ] 17. Manual Smoke Test

```bash
# Start dev server in mock mode (no database required)
ADAPTERS_PRESET=mock npm run dev:api &
SERVER_PID=$!
sleep 5

# Test a few endpoints
echo "Testing catalog endpoint..."
curl -s http://localhost:3001/v1/public/packages \
  -H "X-Tenant-Key: pk_live_test_xyz" | jq . | head -20

echo "Testing audit endpoint..."
curl -s http://localhost:3001/v1/admin/audit \
  -H "X-Tenant-Key: pk_live_test_xyz" \
  -H "Authorization: Bearer test-token" | jq . | head -20

# Kill server
kill $SERVER_PID
```

---

## Verification Report (5 mins)

### [ ] 18. Compare Test Results

```bash
# Create comparison report
cat > UPGRADE_REPORT.md << EOF
# Prisma Upgrade Report

Date: $(date)
Upgraded by: $(git config user.name)

## Version Change
\`\`\`
$(head -1 UPGRADE_NOTES.md)
\`\`\`

## Code Audit Results

### JSON Read Casts
- Found: $(wc -l < JSON_READ_ISSUES.txt)
- Status: FIXED/REVIEWED

### JSON Write Operations
- Using InputJsonValue: $(wc -l < JSON_WRITES_CORRECT.txt)
- Status: ✓ COMPLIANT

### Null Handling
- DbNull usage verified: $(wc -l < DBNULL_USAGE.txt)
- Status: ✓ COMPLIANT

### Extensions
- Total extensions: $(grep -c '\$extends' server/src --include="*.ts" 2>/dev/null || echo 0)
- Type extraction attempts: $(wc -l < TYPE_EXTRACTIONS.txt)
- Status: ✓ REVIEWED

## Test Results

### Unit Tests
\`\`\`
$(tail -3 UNIT_TESTS_AFTER.log)
\`\`\`

### Integration Tests
\`\`\`
$(tail -3 INTEGRATION_TESTS_AFTER.log)
\`\`\`

### JSON-Specific Tests
\`\`\`
$(tail -3 JSON_TESTS_AFTER.log)
\`\`\`

## Status: ✓ UPGRADE COMPLETE

All JSON type patterns verified and tested.
EOF

cat UPGRADE_REPORT.md
```

### [ ] 19. Commit Upgrade

```bash
# Stage changes
git add -A

# Commit with detailed message
git commit -m "chore(deps): upgrade prisma to latest

- Updated package.json and package-lock.json
- Verified JSON type casting patterns
- Confirmed InputJsonValue usage
- All tests passing (unit + integration)
- Pre/post comparison: UPGRADE_REPORT.md

Migration checklist:
- [x] Type audit completed
- [x] JSON casting verified
- [x] Null handling reviewed
- [x] Tests passing
- [x] No regressions detected"

# Show what was committed
git show --stat
```

---

## Rollback Plan (If Issues Found)

### [ ] Emergency Rollback

```bash
# If tests fail, rollback immediately
git revert HEAD
npm install

# Verify rollback
npm run typecheck
npm test
```

### [ ] Issue Investigation

If you discover JSON type issues during testing:

1. **Document the issue:**

   ```bash
   cat > JSON_ISSUE.md << EOF
   ## Issue Found During Upgrade

   Error: [paste error message]

   Code location: [file path + line]

   Pattern: [describe the pattern]

   Fix: [describe fix needed]
   EOF
   ```

2. **Check against prevention strategies:**
   - Review `/docs/solutions/database-issues/prisma-json-type-prevention-MAIS-20260102.md`
   - Find the matching "Common Errors and Fixes" section
   - Apply the documented fix

3. **Create post-upgrade issue:**
   ```bash
   gh issue create \
     --title "JSON type regression after Prisma upgrade" \
     --body "$(cat JSON_ISSUE.md)" \
     --label "database,prisma" \
     --label "p1"
   ```

---

## Quick Reference

### JSON Read (ALWAYS two-step cast)

```typescript
value as unknown as TargetType;
```

### JSON Write (ALWAYS InputJsonValue)

```typescript
data: {
  field: value as unknown as Prisma.InputJsonValue;
}
```

### Explicit NULL (ALWAYS DbNull)

```typescript
data: {
  field: Prisma.DbNull;
}
```

### Validation (ALWAYS after reads)

```typescript
const parsed = Schema.safeParse(jsonValue);
if (parsed.success) {
  /* use parsed.data */
}
```

---

## Success Criteria

Upgrade is complete when:

- [ ] All type checks pass (`npm run typecheck`)
- [ ] All tests pass (unit + integration)
- [ ] JSON-specific tests pass (`--grep json`)
- [ ] No build errors (`npm run build`)
- [ ] Code audit complete (JSON reads/writes/nulls/extensions)
- [ ] Smoke tests pass (dev server starts + endpoints work)
- [ ] Upgrade report created and committed

**Time estimate:** 45-60 minutes total

---

## Links

- [Full Prevention Strategy Guide](./prisma-json-type-prevention-MAIS-20260102.md)
- [MAIS Event Sourcing Pattern](../../../../../../server/src/agent/onboarding/event-sourcing.ts)
- [Prisma Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guide)
