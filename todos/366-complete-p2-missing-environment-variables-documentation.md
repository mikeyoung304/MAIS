---
status: complete
priority: p2
issue_id: "366"
tags: [code-review, devops, documentation]
dependencies: []
---

# Missing Environment Variables in Configuration

## Problem Statement

Critical environment variables for production are not documented in `.env.example` files. Deployments may fail silently without proper configuration.

**Why it matters:** ISR revalidation fails, custom domains broken, auth issues in production.

## Findings

**Missing from `apps/web/.env.example`:**

| Variable | Required For | Status |
|----------|-------------|--------|
| `NEXTAUTH_SECRET` | Session encryption | Only in .env.local.example |
| `NEXTJS_REVALIDATE_SECRET` | ISR endpoint security | Not documented anywhere |
| `INTERNAL_API_SECRET` | Service-to-service auth | Not in web app config |

**Missing from `server/.env.example`:**

| Variable | Required For | Status |
|----------|-------------|--------|
| `NEXTJS_REVALIDATE_SECRET` | Calling ISR endpoint | Not documented |
| `NEXTJS_APP_URL` | Where to call revalidate | Not documented |

**Impact:** P2 - Silent failures in production, undocumented configuration

## Proposed Solutions

### Option 1: Update All .env.example Files (Required)
- **Description:** Add all required variables with comments
- **Pros:** Clear documentation, deployment checklist
- **Cons:** Minor effort
- **Effort:** Small (15 min)
- **Risk:** Low

## Recommended Action

**FIX NOW** - Update .env.example files with all required variables. This prevents deployment issues and is quick to fix.

## Technical Details

**Add to `apps/web/.env.example`:**
```bash
# NextAuth.js v5 Configuration (REQUIRED)
NEXTAUTH_SECRET=           # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://app.yourdomain.com

# ISR Revalidation (REQUIRED for on-demand cache invalidation)
NEXTJS_REVALIDATE_SECRET=  # Generate: openssl rand -hex 32

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Add to `server/.env.example`:**
```bash
# Next.js ISR Revalidation
NEXTJS_APP_URL=http://localhost:3000
NEXTJS_REVALIDATE_SECRET=  # Same as web app

# Internal API Secret
INTERNAL_API_SECRET=       # Generate: openssl rand -hex 32
```

## Acceptance Criteria

- [ ] All required variables documented in .env.example
- [ ] Generation commands provided in comments
- [ ] Vercel deployment checklist updated
- [ ] README references env configuration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | DevOps issue found |

## Resources

- Vercel Environment Variables: https://vercel.com/docs/environment-variables
