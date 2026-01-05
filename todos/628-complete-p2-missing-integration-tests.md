---
status: complete
priority: p2
issue_id: '628'
tags: [code-review, testing, build-mode]
dependencies: []
---

# Missing Integration Tests for Landing Page API Routes

## Problem Statement

The Build Mode feature relies heavily on the tenant admin landing page API routes, but there are no integration tests verifying these endpoints work correctly with a real database.

**What's broken:** Critical paths untested
**Why it matters:** Regressions won't be caught until production

## Findings

### Source: Test Coverage Reviewer

**Untested Endpoints:**

- `GET /v1/tenant-admin/landing-page/draft` - Fetch draft config
- `PUT /v1/tenant-admin/landing-page/draft` - Save draft (autosave)
- `POST /v1/tenant-admin/landing-page/publish` - Publish draft to live
- `DELETE /v1/tenant-admin/landing-page/draft` - Discard draft

**Missing Test Scenarios:**

- Draft save with valid/invalid config
- Publish atomicity (copy draft to live + clear draft)
- Discard clears only draft, preserves live
- Auth: 401/403 for unauthenticated/unauthorized
- Concurrent draft saves from multiple sessions
- Rate limiting behavior (120/min for autosave)

## Proposed Solutions

### Option A: Add integration test file

**Description:** Create comprehensive integration test suite

```typescript
// server/test/integration/landing-page-routes.spec.ts
describe('Landing Page Admin Routes', () => {
  describe('GET /draft', () => {
    it('returns draft config if exists');
    it('returns 404 if no draft');
    it('requires tenant auth');
  });

  describe('PUT /draft', () => {
    it('saves valid draft config');
    it('rejects invalid config structure');
    it('creates draft if none exists');
  });

  describe('POST /publish', () => {
    it('copies draft to live config');
    it('clears draft after publish');
    it('returns 400 if no draft to publish');
  });

  describe('DELETE /draft', () => {
    it('clears draft config');
    it('preserves live config');
    it('returns 400 if no draft');
  });
});
```

- **Pros:** Catches regressions, documents expected behavior
- **Cons:** Requires test database setup
- **Effort:** Large (3-4 hours)
- **Risk:** None

## Acceptance Criteria

- [ ] Integration test file created
- [ ] All endpoints tested for happy path
- [ ] Auth failures tested (401, 403)
- [ ] Invalid input tested (400)
- [ ] Tests pass in CI

## Work Log

| Date       | Action                                 | Learnings                                 |
| ---------- | -------------------------------------- | ----------------------------------------- |
| 2026-01-05 | Created from multi-agent code review  | Integration tests catch API contract bugs |
