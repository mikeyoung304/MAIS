# Production Deployment Prevention - Quick Reference

**Print this page and keep it visible during deployments.**

---

## 30-Second Pre-Deployment Checklist

```bash
# 1. Run this locally BEFORE pushing
npm run typecheck    # Must be 0 errors
npm run lint         # Fix all issues
npm test             # All passing

# 2. Check that all interface changes are implemented
git diff HEAD~1 server/src/lib/ports.ts  # Any interface changes?
  └─ If yes: grep -r "interface MailProvider" server/src/
       └─ Must implement in: postmark.adapter.ts, mock/index.ts

# 3. Verify environment vars are documented
cat server/.env.example  # All required vars present?
```

## The 4 Critical Problems & How to Catch Them

| #     | Problem                    | Symptoms                                  | Prevention                                    |
| ----- | -------------------------- | ----------------------------------------- | --------------------------------------------- |
| **1** | TypeScript mismatches      | Build fails, "Type X not assignable to Y" | `npm run typecheck`                           |
| **2** | Missing env vars           | App starts but features broken silently   | Health check endpoint + startup logs          |
| **3** | Email not sending          | Customers don't get emails                | Postmark domain verified + `GET /health/live` |
| **4** | Security vulns (XSS, CRLF) | Data leaks, malicious input accepted      | Zod validation + integration tests            |

---

## Deployment Workflow

### 1. Local Validation (5 min)

```bash
npm run typecheck && npm run lint && npm test
```

### 2. GitHub Actions (Automatic)

```
Runs in deploy-production.yml:
✅ typecheck
✅ Build contracts & shared
✅ Tests
✅ (Only if all pass) → Deploy
```

### 3. Render.com Dashboard

```
Required vars (sync: false):
✅ JWT_SECRET
✅ TENANT_SECRETS_ENCRYPTION_KEY
✅ DATABASE_URL + DIRECT_URL
✅ POSTMARK_SERVER_TOKEN (optional, has fallback)
✅ STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
✅ CORS_ORIGIN + PORT + NODE_ENV + ADAPTERS_PRESET
```

### 4. Post-Deploy Verification

```bash
curl https://your-domain.com/health/live | jq '.checks'

# Should show:
{
  "postmark": { "status": "healthy", "latency": 45 },
  "stripe": { "status": "healthy" },
  "database": { "status": "healthy" }
}

# If postmark shows "file sink fallback" → POSTMARK_SERVER_TOKEN not set
```

---

## Common Errors & Fixes

### Error: "Type X is not assignable to type Y"

```
Cause: New method added to interface but not implemented in adapter
Fix:
  1. Find the interface definition (likely in server/src/lib/ports.ts)
  2. Find all implementations (search for "implements MailProvider")
  3. Add missing method to each implementation
  4. npm run typecheck  # Verify
```

### Error: "POSTMARK_SERVER_TOKEN is not defined"

```
Cause: Email adapter not receiving token
Fix:
  1. Check render.yaml for POSTMARK_SERVER_TOKEN entry
  2. Verify in Render dashboard: env var is set
  3. Redeploy (env vars picked up on restart)
  4. Check health: curl /health/live (should show Postmark healthy)
```

### Error: "Logger is not defined"

```
Cause: Missing import in middleware or service
Fix:
  1. Check file for: import { logger } from '...'
  2. If missing, add: import { logger } from '../lib/core/logger'
  3. npm run typecheck
```

---

## Postmark Email Setup (One-time)

1. Create account: postmarkapp.com
2. Add sender domain: Settings → Sender Signatures
3. Verify domain: Add DNS records (SPF, DKIM, DMARC)
4. Generate API token: API Tokens
5. Copy to render.yaml:
   ```yaml
   - key: POSTMARK_SERVER_TOKEN
     value: <token> # e.g., 1a2b3c4d5e6f7g8h9i0j...
   ```
6. Set from email:
   ```yaml
   - key: POSTMARK_FROM_EMAIL
     value: noreply@example.com # Must match verified domain
   ```

---

## Interface Update Workflow (Adding a Method)

When you add a method to an interface:

```typescript
// 1. Update interface in server/src/lib/ports.ts
interface MailProvider {
  sendEmail(...): Promise<void>;
  sendPasswordReset(...): Promise<void>;
  sendNewMethod(...): Promise<void>; // ← ADD HERE
}

// 2. Implement in all adapters
// File: server/src/adapters/postmark.adapter.ts
class PostmarkMailAdapter implements MailProvider {
  async sendNewMethod(...) { /* implementation */ } // ← ADD HERE
}

// File: server/src/adapters/mock/index.ts
class MockMailAdapter implements MailProvider {
  async sendNewMethod(...) { /* implementation */ } // ← ADD HERE
}

// 3. Update any route/controller that uses the interface
// File: server/src/routes/index.ts
router.post('/new-endpoint', async (req) => {
  await container.mailProvider.sendNewMethod(...); // ← NOW AVAILABLE
});

// 4. Verify
npm run typecheck  # Must be 0 errors
npm test           # All tests pass
```

---

## Health Check Interpretation

### Healthy (All Green)

```json
{
  "status": "ok",
  "checks": {
    "postmark": {
      "status": "healthy",
      "latency": 45
    },
    "stripe": {
      "status": "healthy",
      "latency": 23
    },
    "database": {
      "status": "healthy",
      "latency": 12
    }
  }
}
```

### Postmark with Fallback (File Sink)

```json
{
  "postmark": {
    "status": "healthy",
    "error": "Using file sink fallback (no POSTMARK_SERVER_TOKEN)"
  }
}
```

**Action:** This is OK for development. In production, set POSTMARK_SERVER_TOKEN.

### Postmark Unhealthy (Invalid Credentials)

```json
{
  "postmark": {
    "status": "unhealthy",
    "error": "HTTP 401: Invalid API key"
  }
}
```

**Action:** Check POSTMARK_SERVER_TOKEN in render.yaml. Regenerate if needed.

---

## Test Coverage for Prevention

Before submitting PR, ensure these test patterns exist:

### TypeScript Compilation

```typescript
// Tests that interface is properly implemented
describe('Interface Compliance', () => {
  it('should have MailProvider methods in PostmarkMailAdapter', () => {
    const methods = ['sendEmail', 'sendPasswordReset'];
    const adapter = new PostmarkMailAdapter({...});
    for (const m of methods) {
      expect(typeof adapter[m]).toBe('function');
    }
  });
});
```

### Environment Variables

```typescript
// Tests that app starts with/without optional vars
describe('Environment Setup', () => {
  it('should have email adapter status in health check', async () => {
    const health = await service.checkPostmark();
    expect(health.status).toBe('healthy');
  });
});
```

### Security

```typescript
// Tests that dangerous inputs are rejected
describe('Security', () => {
  it('should reject XSS payloads in email field', async () => {
    const response = await request(app)
      .post('/v1/auth/early-access')
      .send({ email: '<script>alert(1)</script>' })
      .expect(400);
  });
});
```

---

## Emergency Rollback

If deployment breaks production:

1. **Identify the issue:**

   ```bash
   curl https://your-domain.com/health/live
   # Check logs: Render dashboard → Logs tab
   ```

2. **Rollback to previous version:**

   ```bash
   # In Render dashboard:
   # Deployments tab → Select previous version → Redeploy
   ```

3. **Root cause analysis:**
   - Check: `git log --oneline` (which commit broke it?)
   - Review: `npm run typecheck` (compilation errors?)
   - Test: `npm test` (test failures missed?)

4. **Fix and redeploy:**
   ```bash
   git revert <bad-commit>
   npm run typecheck && npm test
   git push main
   # Render auto-deploys on push
   ```

---

## CI/CD Pipeline Status

Deployment blocked if any step fails:

```
git push main
   ↓
GitHub Actions starts
   ↓
typecheck ← MUST PASS (0 errors)
   ↓
build contracts ← MUST PASS
   ↓
build shared ← MUST PASS
   ↓
tests ← MUST PASS (all tests)
   ↓
(Only if all above pass)
   ↓
Deploy to Render
   ↓
POST-DEPLOY CHECKS
   ↓
curl /health/live ← Must show healthy adapters
```

---

## Links

- **Full Guide:** `docs/solutions/PRODUCTION-DEPLOYMENT-PREVENTION-STRATEGIES.md`
- **Render Config:** `render.yaml`
- **Email Adapter:** `server/src/adapters/postmark.adapter.ts`
- **Health Check:** `server/src/services/health-check.service.ts`
- **CI/CD Workflow:** `.github/workflows/deploy-production.yml`
- **Postmark Setup:** https://postmarkapp.com/why-postmark/features/reliability

---

**Last Updated:** 2025-12-06 (commit cfd0435)
**Status:** Production-Ready Prevention Framework
