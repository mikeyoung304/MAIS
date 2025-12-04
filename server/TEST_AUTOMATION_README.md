# Error Handling Test Automation - Quick Start Guide

## Overview

This test automation suite provides comprehensive validation of error handling for the package photo upload feature. It tests 13 scenarios across 5 error categories to ensure proper HTTP status codes and error messages.

## Files Created

| File                                   | Purpose                        | Status              |
| -------------------------------------- | ------------------------------ | ------------------- |
| `test-error-handling-comprehensive.sh` | Main test script (13 tests)    | ✓ Ready             |
| `test-results-before-fix.json`         | Baseline results (31% passing) | ✓ Created           |
| `test-results-after-fix.json`          | Expected results template      | ✓ Template          |
| `error-handling-improvement-report.md` | Detailed comparison report     | ✓ Created           |
| `compare-test-results.cjs`             | Results comparison script      | ✓ Ready             |
| `TEST_AUTOMATION_README.md`            | This file                      | ✓ You're reading it |

## Quick Start

### 1. Prerequisites

Ensure the API server is running:

```bash
npm run dev
# Server should be running on http://localhost:3001
```

Ensure test setup is complete:

```bash
# This should exist from previous setup
cat TEST_SETUP_COMPLETE.json | jq '.authToken'
```

### 2. Run Tests (Before Fixes)

```bash
# Make script executable (already done)
chmod +x test-error-handling-comprehensive.sh

# Run comprehensive test suite
./test-error-handling-comprehensive.sh

# Results saved to: test-results-comprehensive.json
```

### 3. View Current Results

```bash
# Compare before/after (shows only BEFORE if after doesn't exist yet)
node compare-test-results.cjs

# View JSON results
cat test-results-comprehensive.json | jq '.summary'

# View full report
less error-handling-improvement-report.md
```

### 4. After Fixes Are Applied

Once the Error Handling Fix Agent completes their work:

```bash
# Restart API server to load changes
# (In your server terminal: Ctrl+C, then npm run dev)

# Run tests again
./test-error-handling-comprehensive.sh

# Copy results for comparison
cp test-results-comprehensive.json test-results-after-fix.json

# Compare before/after
node compare-test-results.cjs
```

## Test Categories

### 1. Authentication Errors (401) - 2 tests

- Upload without auth token
- Upload with invalid token

**Expected:** Already passing (100%)

### 2. Validation Errors (400) - 5 tests

- Upload without file
- Upload non-image file
- Upload 1-byte file
- Upload 6th photo (exceeds max 5)
- Upload with special characters in filename

**Expected:** 0% → 80-100% after fixes

### 3. Authorization Errors (403) - 2 tests

- Upload to another tenant's package
- Delete another tenant's photo

**Expected:** 50% → 100% after fixes

### 4. Not Found Errors (404) - 2 tests

- Upload to non-existent package
- Delete non-existent photo

**Expected:** 50% → 100% after fixes

### 5. File Size Errors (413) - 2 tests

- Upload 4MB file (within limit)
- Upload 6MB file (over limit)

**Expected:** 0% → 100% after fixes

## Understanding Test Output

### Color Coding

- **Green (✓)**: Test passed
- **Red (✗)**: Test failed
- **Yellow (⚠)**: Warning or note
- **Blue**: Informational
- **Cyan**: Section headers

### Example Output

```bash
═══════════════════════════════════════════════════════════════
COMPREHENSIVE ERROR HANDLING TEST SUITE
═══════════════════════════════════════════════════════════════

▶ AUTHENTICATION ERRORS (401)
───────────────────────────────────────────────────────────────

✓ PASS: Upload without auth token
   Expected: 401, Got: 401
   Should reject unauthorized requests

✓ PASS: Upload with invalid token
   Expected: 401, Got: 401
   Should reject malformed/invalid tokens

▶ VALIDATION ERRORS (400)
───────────────────────────────────────────────────────────────

✗ FAIL: Upload without file
   Expected: 400, Got: 500
   Should return 400 with 'No photo uploaded' message
```

### JSON Results Structure

```json
{
  "timestamp": "2025-11-07T19:30:00Z",
  "summary": {
    "totalTests": 13,
    "passed": 4,
    "failed": 9,
    "passRate": "31%"
  },
  "categories": {
    "authentication": { "total": 2, "passed": 2, "failed": 0 },
    "validation": { "total": 5, "passed": 0, "failed": 5 }
  },
  "results": [
    {
      "category": "authentication",
      "test": "Upload without auth token",
      "expected": 401,
      "actual": 401,
      "status": "PASS",
      "details": "Correctly rejected unauthorized request"
    }
  ]
}
```

## Expected Improvements

### Before Fixes

```
Tests: 4/13 passing (31%)
█████░░░░░░░░░░░░░░░ 31%

Authentication: ██████████ 100% (2/2)
Validation:     ░░░░░░░░░░   0% (0/5)
Authorization:  █████░░░░░  50% (1/2)
Not Found:      █████░░░░░  50% (1/2)
File Size:      ░░░░░░░░░░   0% (0/2)
```

### After Fixes

```
Tests: 12/13 passing (92%)
████████████████████ 92%

Authentication: ██████████ 100% (2/2)
Validation:     ████████░░  80% (4/5)
Authorization:  ██████████ 100% (2/2)
Not Found:      ██████████ 100% (2/2)
File Size:      ██████████ 100% (2/2)
```

### Improvement: +61 percentage points (+200% relative improvement)

## Fixes Required

The test suite will verify these fixes are applied:

### Fix 1: Add Multer Error Handler

**Location:** `src/routes/tenant-admin.routes.ts:354-357`
**Impact:** Fixes 2 file size tests

### Fix 2: Explicit File Presence Check

**Location:** `src/routes/tenant-admin.routes.ts:368-370`
**Impact:** Fixes 1 validation test

### Fix 3: Improved Catch Block

**Location:** `src/routes/tenant-admin.routes.ts:415-422`
**Impact:** Fixes 6 tests across multiple categories

## Troubleshooting

### Tests Fail to Run

**Problem:** Script exits with "Test setup file not found"

```bash
# Solution: Ensure setup file exists
ls -la TEST_SETUP_COMPLETE.json

# If missing, run setup first
node test-photo-upload.cjs
```

**Problem:** "Cannot connect to API"

```bash
# Solution: Start the API server
npm run dev

# Verify it's running
curl http://localhost:3001/health
```

### Unexpected Test Results

**Problem:** More tests failing than expected

```bash
# Check API logs for errors
# Look for error stack traces in server console

# Verify test data
cat TEST_SETUP_COMPLETE.json | jq .

# Run single curl command to debug
curl -X POST http://localhost:3001/v1/tenant-admin/packages/PACKAGE_ID/photos \
  -H "Authorization: Bearer TOKEN" \
  -F "photo=@/tmp/test-photo.jpg"
```

**Problem:** Tests pass but shouldn't

```bash
# Verify fixes weren't already applied
git diff src/routes/tenant-admin.routes.ts

# Check error handling code
grep -A 10 "catch (error)" src/routes/tenant-admin.routes.ts
```

## Advanced Usage

### Run Specific Categories

The script runs all tests sequentially. To test specific scenarios:

```bash
# Edit test-error-handling-comprehensive.sh
# Comment out sections you don't want to run

# Example: Only test authentication
# Comment out lines 113-299 (other test categories)
```

### Custom Test Configuration

Edit these variables at the top of the script:

```bash
API_BASE="http://localhost:3001"  # Change if API on different port
TEMP_DIR="/tmp/elope-comprehensive-test"  # Change temp directory
```

### Integration with CI/CD

```yaml
# .github/workflows/test.yml
- name: Run Error Handling Tests
  run: |
    npm run dev &
    sleep 5  # Wait for server
    ./test-error-handling-comprehensive.sh

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results-comprehensive.json
```

## Next Steps

1. **Wait for fixes** - Error Handling Fix Agent will apply code changes
2. **Restart server** - Load updated code
3. **Run tests** - Execute comprehensive test suite
4. **Compare results** - Use comparison script to verify improvements
5. **Document** - Update test-results-after-fix.json with actual results
6. **Celebrate** - Enjoy improved error handling! 🎉

## Support

For questions or issues:

- Review error-handling-improvement-report.md for detailed analysis
- Check FINAL_ERROR_CASE_REPORT.json for original findings
- Examine test script for test implementation details

## Test File Locations

All test files are in: `/Users/mikeyoung/CODING/Elope/server/`

```
server/
├── test-error-handling-comprehensive.sh  ← Main test script
├── test-results-before-fix.json          ← Baseline (before)
├── test-results-after-fix.json           ← Results (after)
├── test-results-comprehensive.json       ← Latest run
├── compare-test-results.cjs              ← Comparison tool
├── error-handling-improvement-report.md  ← Full report
└── TEST_AUTOMATION_README.md             ← This file
```

---

**Created:** 2025-11-07
**Author:** Error Handling Test Automation Specialist
**Version:** 1.0
**Status:** Ready for Use
