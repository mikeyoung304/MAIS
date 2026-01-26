---
title: Service Wiring & Fake Session Quick Reference
category: patterns
component: backend
severity: P1
tags: [quick-reference, service-layer, adk, sessions]
created: 2026-01-25
---

# Service Wiring & Fake Session Quick Reference

**Print this and pin it next to your monitor.**

---

## Issue 1: Orphan Service Pattern

### The Problem

You create a service file, but the routes still use inline code.

```
server/src/services/my.service.ts  <-- EXISTS but unused
server/src/routes/my.routes.ts     <-- Still has inline fetch()
```

### 30-Second Detection

```bash
# Find orphan services (exports without imports)
grep -rn "export.*Service" server/src/services/*.ts | \
  while read line; do
    SERVICE=$(echo "$line" | sed 's/.*class \([A-Za-z]*\).*/\1/')
    if [ -z "$(grep -rn "import.*$SERVICE" server/src/ | grep -v ".service.ts")" ]; then
      echo "ORPHAN: $SERVICE"
    fi
  done
```

### Fix Checklist

```
[ ] Service is imported in route file
[ ] Factory function is called: const svc = createXyzService()
[ ] Service method is invoked: await svc.doSomething()
[ ] No inline fetch() duplicating service logic
```

### Prevention Rule

> When you create a new service, IMMEDIATELY add the import to the consuming file - even before you finish writing the service.

---

## Issue 2: Fake Session Pattern

### The Problem

Session endpoint creates local IDs instead of real ADK sessions.

```typescript
// WRONG - Fake session
const sessionId = `project-${projectId}-${Date.now()}`;

// RIGHT - Real ADK session
const sessionId = await agentService.createSession(...);
```

### 30-Second Detection

| Session ID Pattern          | Real or Fake?        |
| --------------------------- | -------------------- |
| `project-123-1706123456789` | FAKE                 |
| `session-123`               | FAKE                 |
| `sess_abc123xyz`            | Real (ADK)           |
| `LOCAL:tenant:project:123`  | Intentional fallback |
| UUID format                 | Usually real         |

### Fix Checklist

```
[ ] Session ID comes from service.createSession()
[ ] No Date.now() or Math.random() in session ID
[ ] E2E test sends 2+ messages (fake sessions fail on message 2)
[ ] Error handling for "Session not found"
```

### Prevention Rule

> E2E tests MUST send at least 2 messages. Fake sessions fail on the second message with "Session not found".

---

## Quick Detection Commands

```bash
# Check for orphan services
grep -l "export.*Service" server/src/services/*.ts | \
  xargs -I{} basename {} | \
  while read f; do
    echo "Checking $f..."
    grep -rn "from.*${f%.ts}" server/src/routes/ || echo "  NOT IMPORTED!"
  done

# Check for fake session patterns
grep -rn "Date.now()" server/src/routes/ | grep -i session
grep -rn "Math.random()" server/src/routes/ | grep -i session
grep -rn '`project-\${' server/src/routes/
```

---

## Code Review Red Flags

### Orphan Service Signals

| What You See                 | What It Means               |
| ---------------------------- | --------------------------- |
| New `*.service.ts` file      | Check for imports in routes |
| Service has factory function | Verify factory is called    |
| Inline `fetch()` in routes   | Service probably not wired  |
| Different log prefixes       | Old code vs new service     |

### Fake Session Signals

| What You See                       | What It Means         |
| ---------------------------------- | --------------------- |
| Template literal with `Date.now()` | Fake session ID       |
| Session creation without `await`   | Service not called    |
| "Session not found" on 2nd message | Fake session detected |
| First message works, second fails  | Fake session detected |

---

## The Two Tests That Catch Everything

### Test 1: Service Wiring

```typescript
it('route uses service', async () => {
  const mockService = { doThing: vi.fn() };
  vi.mock('../../services/my.service', () => ({
    createMyService: () => mockService,
  }));

  await request(app).post('/route').send({...});

  expect(mockService.doThing).toHaveBeenCalled(); // Fails if orphan
});
```

### Test 2: Session Persistence

```typescript
it('session works for 2+ messages', async ({ page }) => {
  // Message 1
  await page.fill('[data-testid="input"]', 'Hello');
  await page.click('[data-testid="send"]');
  await page.waitForSelector('[data-testid="response"]');

  // Message 2 - THIS CATCHES FAKE SESSIONS
  await page.fill('[data-testid="input"]', 'Follow up');
  await page.click('[data-testid="send"]');

  const response = await page.textContent('[data-testid="response"]:last-child');
  expect(response).not.toContain('session'); // No session errors
});
```

---

## PR Template Addition

```markdown
## Service & Session Checklist

If adding new services:

- [ ] Service is imported AND called in routes
- [ ] Ran: grep -rn "import.\*ServiceName" server/src/

If handling sessions:

- [ ] Session IDs from service.createSession()
- [ ] E2E test sends 2+ messages
```

---

**Full documentation:** `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
