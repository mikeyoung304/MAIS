---
status: complete
priority: p2
issue_id: '031'
tags: [code-review, code-quality, logging]
dependencies: []
---

# Console Statements Violate Logging Guidelines

## Problem Statement

Multiple files use `console.log/error` instead of structured logger, violating CLAUDE.md rule: "Use `logger`, never `console.log`".

**Why this matters:** Console output not captured in centralized logging, unstructured format hard to parse, missing context (timestamp, request ID).

## Findings

### Server Files

**Mock Adapters:** `server/src/adapters/mock/index.ts`

- Line 42: `console.log('Mock data seeded...')`
- Lines 312-314: `console.log('[MOCK EMAIL]')`
- Line 463: `console.log('Mock state reset...')`

**Config Validation:** `server/src/config/env.schema.ts:118-149`

- `console.error('Environment validation failed:')`

### Client Files (10+ instances)

- `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx:53`
- `client/src/features/auth/SignupForm.tsx:98`
- `client/src/features/booking/DatePicker.tsx` - Multiple calls

## Proposed Solutions

### Option A: Replace All Console Calls (Recommended)

**Effort:** Small | **Risk:** Low

Server: Replace with `logger.info/debug/error`
Client: Replace with error boundary or dev-only logging

## Acceptance Criteria

- [ ] No `console.log` in server production code
- [ ] Mock adapters use `logger.debug`
- [ ] Client errors use proper error handling
- [ ] Lint rule prevents future violations

## Work Log

| Date       | Action  | Notes                            |
| ---------- | ------- | -------------------------------- |
| 2025-11-27 | Created | Found during code quality review |
