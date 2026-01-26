---
status: closed
priority: p2
issue_id: '606'
tags: [code-review, code-quality, cli, yagni]
dependencies: []
triage_notes: "WON'T FIX: YAGNI - Manual arg parsing works fine for 4 flags. Adding util.parseArgs adds no user value and risks breaking working code."
closed_at: '2026-01-26'
---

# P2: Manual Argument Parsing in CLI Script

**Status:** CLOSED - YAGNI
**Priority:** P2 (Important)
**Category:** Code Simplicity
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 66-112

## Problem

The CLI script hand-rolls argument parsing (40+ lines) for only 4 flags:

```typescript
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { maxPerTenant: 50, dryRun: false, help: false };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--max-per-tenant=')) {
      // ...
    }
    // ... more cases
  }
  return options;
}
```

## Fix

Use Node's built-in `util.parseArgs` (Node 18.3+):

```typescript
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'max-per-tenant': { type: 'string', default: '50' },
    'dry-run': { type: 'boolean', default: false },
    'tenant-id': { type: 'string' },
    concurrency: { type: 'string', default: '5' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const options: CliOptions = {
  maxPerTenant: parseInt(values['max-per-tenant'] || '50', 10),
  dryRun: values['dry-run'] || false,
  tenantId: values['tenant-id'],
  concurrency: parseInt(values['concurrency'] || '5', 10),
  help: values.help || false,
};
```

**Lines saved:** ~30 lines

## Source

Code review of commit b2cab182 - Code Simplicity reviewer finding
