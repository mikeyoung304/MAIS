---
status: pending
priority: p2
issue_id: '577'
tags: [code-review, dependencies, nextauth, production]
dependencies: []
---

# P2: NextAuth v5 Beta in Production

## Problem Statement

The application uses `next-auth@5.0.0-beta.30` in production:

```json
"next-auth": "5.0.0-beta.30"
```

Beta software in production creates risks:

- **API changes**: Breaking changes possible in future betas
- **Security**: No guaranteed security review/patching
- **Stability**: May have undiscovered bugs
- **Support**: Limited community help for beta-specific issues

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/package.json`

**Current version:** `5.0.0-beta.30`
**Latest beta:** `5.0.0-beta.30` (we're current on beta track)
**Stable v4:** `4.x` available but different API

**Identified by:** Dependency Detective agent

**Context:**

- NextAuth v5 was chosen for App Router compatibility
- v5 has been in beta for extended period
- Many production apps use v5 beta due to App Router requirements

## Proposed Solutions

### Option A: Pin Exact Version and Monitor (Recommended)

**Pros:** Prevents surprise breaking changes, allows planned upgrades
**Cons:** Must manually track updates
**Effort:** Small
**Risk:** Low

```json
"next-auth": "5.0.0-beta.30"  // Already exact, good
```

### Option B: Downgrade to v4 Stable

**Pros:** Stable, well-tested
**Cons:** Different API, significant refactor, may not support App Router patterns
**Effort:** Large
**Risk:** High

### Option C: Wait for v5 Stable

**Pros:** Will get stable version eventually
**Cons:** Unknown timeline
**Effort:** None now, Small later
**Risk:** Low

## Recommended Action

**Choose Option A + C** - Keep pinned version, monitor for stable release

## Technical Details

**Action items:**

1. Ensure version is pinned exactly (no `^` or `~`)
2. Document beta-specific patterns used
3. Set up alert for v5 stable release
4. Plan migration when stable releases

**Affected files:**

- `apps/web/package.json` - Verify pinning
- `docs/` - Document beta usage

## Acceptance Criteria

- [ ] Version pinned without range specifier
- [ ] NextAuth patterns documented
- [ ] GitHub watch set for next-auth releases
- [ ] Migration plan documented for when v5 stabilizes

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- [NextAuth v5 Beta](https://authjs.dev/)
- [NextAuth GitHub Releases](https://github.com/nextauthjs/next-auth/releases)
