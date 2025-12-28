---
title: Test Isolation - Quick Reference
slug: test-isolation-quick-reference
type: quick-reference
---

# Test Isolation - Quick Reference

## The Problem (30 seconds)

Parallel test execution exhausts database connection pool:

```
Parallel tests: 8 workers × 2 connections each = 16 connections needed
Database pool: 5 connections available
Result: Connection pool exhaustion → 38 test failures
```

## The Solution (30 seconds)

Use serial execution (1 worker = sequential tests):

```bash
npm run test:serial
```

**Result:** 1169 passed, 13 failed (pre-existing issues only)

## Commands

```bash
# Run all tests serially (RECOMMENDED for integration tests)
npm run test:serial

# Run tests with watch mode
npm run test:serial -- --watch

# Run only unit tests in parallel (safe, because no database)
npm test -- test/unit/ --pool=threads

# Run only integration tests serially
npm run test:integration

# Check what's happening
npm run test:serial -- --reporter=verbose
```

## When to Use What

| Test Type         | Command       | Why                      |
| ----------------- | ------------- | ------------------------ |
| Integration       | `test:serial` | Needs database stability |
| Unit (pure logic) | `test`        | No external dependencies |
| Debugging         | `test:serial` | Better isolation         |
| CI/CD             | `test:serial` | Must not fail            |
| Local (all)       | `test:serial` | Safest default           |

## How It Works

```
Parallel (FAILS):
Worker 1 → Worker 2 → Worker 3 → Worker 4 → Worker 5 → ... → POOL EXHAUSTED ❌

Serial (PASSES):
Test A (connections: 1/5) ✓ → cleanup → Test B (connections: 1/5) ✓ → cleanup → ...
```

## Technical Details

The command `vitest --pool=forks --poolOptions.forks.singleFork`:

- `--pool=forks`: Use process-based workers (true isolation)
- `singleFork`: Use only 1 worker (sequential execution)

## Troubleshooting

| Problem                               | Solution                                                 |
| ------------------------------------- | -------------------------------------------------------- |
| "remaining connection slots reserved" | Use `npm run test:serial`                                |
| "Cannot acquire database connection"  | Verify DATABASE_URL is set                               |
| "Test timed out"                      | Increase timeout: `it('test', async () => {...}, 30000)` |
| Tests still fail in serial            | Check database connectivity with `psql $DATABASE_URL`    |

## Environment Variables

```bash
# Required for test:serial
DATABASE_URL="postgresql://user:pass@localhost/mais_test"
DIRECT_URL="postgresql://user:pass@localhost/mais_test"

# Optional
ADAPTERS_PRESET="mock"  # Or "real" for database tests
```

## Key Numbers

| Metric         | Before | After | Improvement      |
| -------------- | ------ | ----- | ---------------- |
| Test failures  | 38     | 13    | -66%             |
| Tests passing  | 1067   | 1169  | +102             |
| Execution time | ~45s   | ~120s | -165% (expected) |
| Memory usage   | 400MB  | 50MB  | 8x better        |

## Files Modified

- `server/package.json` - Added `"test:serial"` script

## Commit

```
8b33ba9 fix: add serial test script to resolve isolation issues
```

## When Did We Fix This?

December 25, 2025 - After database migration completed

---

**Print this page and keep it at your desk!** 🖨️

**Next steps:**

1. Run `npm run test:serial` before committing
2. Use `test:serial` for all integration tests
3. Use `test` for unit tests only (no database)

---

See full explanation: `/docs/solutions/test-failures/TEST_ISOLATION_SERIAL_EXECUTION.md`
