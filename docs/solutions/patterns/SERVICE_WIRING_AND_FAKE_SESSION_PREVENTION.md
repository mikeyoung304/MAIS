---
title: Service Wiring & Fake Session Prevention Strategies
category: patterns
component: backend, agent-integration
severity: P1
tags: [service-layer, dependency-injection, adk, sessions, prevention, code-review]
created: 2026-01-25
related:
  - ADK_A2A_PREVENTION_INDEX.md
  - ESLINT_PREVENTION_INDEX.md
  - A2A_SESSION_STATE_PREVENTION.md
---

# Service Wiring & Fake Session Prevention Strategies

Prevention strategies for two critical issues discovered during Project Hub Phase 1 debugging:

1. **Orphan Service Pattern** - Service class created but never wired to routes
2. **Fake Session Pattern** - Local session IDs instead of real ADK sessions

## Issue Summary

| #   | Issue          | Impact                      | Detection Time | Root Cause                                |
| --- | -------------- | --------------------------- | -------------- | ----------------------------------------- |
| 1   | Orphan Service | Agent calls fail silently   | Production     | Service exists but routes use inline code |
| 2   | Fake Sessions  | Chat appears broken forever | Production     | Local ID generation instead of ADK call   |

---

## Issue 1: Orphan Service Pattern

### Problem Statement

A new `ProjectHubAgentService` was created with proper Cloud Run authentication (Identity Token, timeout handling, Zod validation), but the routes file continued using old inline `fetch()` code. The service existed but was never imported or called.

**What happened:**

```typescript
// File: server/src/services/project-hub-agent.service.ts
// 600+ lines of proper service implementation
export class ProjectHubAgentService {
  async createSession(...) { /* proper ADK session creation */ }
  async sendMessage(...) { /* proper ADK /run invocation */ }
}
export function createProjectHubAgentService() { ... }

// File: server/src/routes/public-project.routes.ts
// PROBLEM: Still using inline fetch, never imports the service!
const response = await fetch(`${agentUrl}/chat`, {
  method: 'POST',
  body: JSON.stringify({ message, sessionId }),  // No Identity Token!
});
```

**Why it happened:**

- Developer created service in one session
- Route updates were done in another session
- No automated check verified the service was actually used
- ESLint doesn't catch unused exports in different files

### Detection Strategies

#### 1. Export Usage Analysis (Automated)

```bash
#!/bin/bash
# scripts/check-orphan-exports.sh
# Find exported functions/classes that are never imported elsewhere

echo "Checking for orphan service exports..."

# Get all exported service classes
EXPORTS=$(grep -rn "^export class.*Service" server/src/services/*.ts | \
  sed 's/.*export class \([A-Za-z]*Service\).*/\1/')

for SERVICE in $EXPORTS; do
  # Count imports of this service (excluding its own file)
  IMPORT_COUNT=$(grep -rn "import.*$SERVICE" server/src/ | \
    grep -v "$SERVICE.ts" | wc -l)

  if [ "$IMPORT_COUNT" -eq 0 ]; then
    echo "WARNING: $SERVICE is exported but never imported!"
  fi
done
```

#### 2. Factory Function Call Verification

```bash
# Check that factory functions are actually called somewhere
grep -rn "export function create.*Service" server/src/services/*.ts | while read line; do
  FACTORY=$(echo "$line" | sed 's/.*export function \(create[A-Za-z]*Service\).*/\1/')
  USAGE=$(grep -rn "$FACTORY(" server/src/ | grep -v "export function" | wc -l)

  if [ "$USAGE" -eq 0 ]; then
    echo "WARNING: Factory $FACTORY is never called!"
  fi
done
```

#### 3. TypeScript Dead Export Detection

Add to `tsconfig.json` for development:

```json
{
  "compilerOptions": {
    // Helps IDE show unused exports (not enforced at build)
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### 4. Integration Test Coverage

```typescript
// server/src/routes/__tests__/public-project.routes.test.ts
describe('Service Integration', () => {
  it('chat endpoint uses ProjectHubAgentService', async () => {
    // Mock the service
    const mockService = {
      createSession: vi.fn().mockResolvedValue('session-123'),
      sendMessage: vi.fn().mockResolvedValue({ response: 'Hello' }),
    };
    vi.mock('../../services/project-hub-agent.service', () => ({
      createProjectHubAgentService: () => mockService,
    }));

    // Make request to chat endpoint
    await request(app)
      .post('/api/v1/public/projects/proj-1/chat/message')
      .send({ message: 'test', token: validToken });

    // Verify service was actually called (not inline fetch)
    expect(mockService.sendMessage).toHaveBeenCalled();
  });
});
```

### Prevention Strategies

#### Strategy 1: Import-First Development

**Rule:** When creating a new service, IMMEDIATELY add the import to the consuming file.

```typescript
// Step 1: Create service file
// server/src/services/my-new.service.ts
export class MyNewService {}
export function createMyNewService() {}

// Step 2: IMMEDIATELY add import to routes (even before implementation)
// server/src/routes/my-routes.ts
import { createMyNewService } from '../services/my-new.service';
// Now TypeScript will error if the service doesn't exist
```

#### Strategy 2: Compile-Time Verification

Add a barrel export file that TypeScript will check:

```typescript
// server/src/services/index.ts
// Re-export all services - unused exports become visible
export { createProjectHubAgentService } from './project-hub-agent.service';
export { createVertexAgentService } from './vertex-agent.service';
// ...

// Then use import from barrel
import { createProjectHubAgentService } from '../services';
```

#### Strategy 3: PR Description Template

Add to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Service Wiring Checklist (if creating new services)

- [ ] New service is imported in at least one route/controller
- [ ] Ran `grep -rn "import.*ServiceName" server/src/` and confirmed results
- [ ] Integration test verifies service is called (not mocked away entirely)
```

#### Strategy 4: Pre-Commit Hook for New Services

```bash
#!/bin/bash
# .husky/pre-commit (addition)

# Check for new service files
NEW_SERVICES=$(git diff --cached --name-only --diff-filter=A | \
  grep "server/src/services/.*\.service\.ts")

if [ -n "$NEW_SERVICES" ]; then
  for SERVICE_FILE in $NEW_SERVICES; do
    # Extract the main export
    SERVICE_NAME=$(grep -m1 "export class.*Service" "$SERVICE_FILE" | \
      sed 's/.*export class \([A-Za-z]*Service\).*/\1/')

    if [ -n "$SERVICE_NAME" ]; then
      # Check if it's imported anywhere in staged files
      IMPORTS=$(git diff --cached --name-only | \
        xargs grep -l "import.*$SERVICE_NAME" 2>/dev/null | \
        grep -v "$SERVICE_FILE")

      if [ -z "$IMPORTS" ]; then
        echo "ERROR: New service $SERVICE_NAME is not imported anywhere!"
        echo "Did you forget to wire it to routes?"
        exit 1
      fi
    fi
  done
fi
```

### Code Review Checklist for Issue 1

When reviewing PRs that add new services:

```markdown
## Service Wiring Review

□ New service file exists: `server/src/services/xyz.service.ts`
□ Service is imported in routes: `import { createXyzService } from '../services/xyz.service'`
□ Factory function is called: `const service = createXyzService()`
□ Service methods are invoked: `await service.doSomething()`
□ No inline fetch/axios calls duplicating service functionality
□ Integration test mocks the service (proves wiring exists)
```

### Test Cases for Issue 1

```typescript
// server/src/services/__tests__/service-wiring.test.ts

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

describe('Service Wiring Verification', () => {
  const servicesDir = path.join(__dirname, '..');
  const srcDir = path.join(__dirname, '../../..');

  it('all exported services are imported somewhere', async () => {
    const serviceFiles = await glob(`${servicesDir}/*.service.ts`);

    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const exportMatches = content.matchAll(/export (?:class|function) (\w+)/g);

      for (const match of exportMatches) {
        const exportName = match[1];

        // Search for imports of this export
        const importPattern = new RegExp(`import.*${exportName}`, 'g');
        const files = await glob(`${srcDir}/**/*.ts`, { ignore: [file] });

        let found = false;
        for (const searchFile of files) {
          const searchContent = fs.readFileSync(searchFile, 'utf-8');
          if (importPattern.test(searchContent)) {
            found = true;
            break;
          }
        }

        expect(found).toBe(
          true,
          `Export "${exportName}" from ${path.basename(file)} is never imported`
        );
      }
    }
  });

  it('all service factory functions are called', async () => {
    const serviceFiles = await glob(`${servicesDir}/*.service.ts`);

    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const factoryMatches = content.matchAll(/export function (create\w+Service)/g);

      for (const match of factoryMatches) {
        const factoryName = match[1];

        // Search for calls to this factory
        const callPattern = new RegExp(`${factoryName}\\(`, 'g');
        const files = await glob(`${srcDir}/**/*.ts`, { ignore: [file] });

        let found = false;
        for (const searchFile of files) {
          const searchContent = fs.readFileSync(searchFile, 'utf-8');
          if (callPattern.test(searchContent)) {
            found = true;
            break;
          }
        }

        expect(found).toBe(
          true,
          `Factory "${factoryName}" from ${path.basename(file)} is never called`
        );
      }
    }
  });
});
```

---

## Issue 2: Fake Session Pattern

### Problem Statement

The `/chat/session` endpoint was creating local session IDs like `project-${projectId}-${Date.now()}` instead of actually calling the ADK to create real sessions. This resulted in:

- Chat appearing to start ("Starting chat..." then greeting shown)
- All subsequent messages failing with "Session not found"
- No useful error messages to debug

**What happened:**

```typescript
// WRONG: Creating fake local session ID
router.post('/:projectId/chat/session', async (req, res) => {
  // ...validation...

  // This looks like a session ID, but it's NOT in ADK!
  const sessionId = `project-${projectId}-${Date.now()}`;

  res.json({
    sessionId, // Fake ID that ADK doesn't recognize
    greeting: `Hi ${customerName}!`,
  });
});

// CORRECT: Actually create ADK session
router.post('/:projectId/chat/session', async (req, res) => {
  const agentService = createProjectHubAgentService();

  // Creates REAL session on ADK
  const sessionId = await agentService.createSession(tenantId, customerId, projectId, contextType);

  res.json({ sessionId, greeting: `Hi ${customerName}!` });
});
```

**Why it happened:**

- Developer copied pattern from a mock/test file
- Local ID generation looks plausible
- No verification that session worked on first message
- Session creation appeared to "succeed" (returns ID quickly)

### Detection Strategies

#### 1. Session ID Format Verification

ADK sessions have specific formats. Local IDs don't match:

```typescript
// ADK session IDs look like: "sess_abc123..." or UUIDs
// Fake session IDs look like: "project-123-1706123456789"

function isRealAdkSessionId(id: string): boolean {
  // ADK typically uses specific prefixes or UUID format
  const adkPatterns = [
    /^sess_[a-zA-Z0-9]+$/, // sess_ prefix
    /^[a-f0-9-]{36}$/, // UUID format
    /^local:[^:]+:[^:]+:\d+$/, // Our fallback format (intentionally marked)
  ];

  // Suspicious patterns that suggest fake IDs
  const fakePatterns = [
    /^project-.*-\d{13}$/, // project-{id}-{timestamp}
    /^session-\d+$/, // session-{number}
    /^test-/, // test- prefix
  ];

  if (fakePatterns.some((p) => p.test(id))) {
    console.warn(`Suspicious session ID format: ${id}`);
    return false;
  }

  return adkPatterns.some((p) => p.test(id));
}
```

#### 2. Round-Trip Test on Session Creation

```typescript
// After creating session, verify it exists
async function createAndVerifySession(service: ProjectHubAgentService, ...params): Promise<string> {
  const sessionId = await service.createSession(...params);

  // In development, verify the session is real
  if (process.env.NODE_ENV === 'development') {
    try {
      // Send a no-op message to verify session exists
      const result = await service.sendMessage(sessionId, tenantId, '', 'ping');
      if (result.error === 'session_not_found') {
        throw new Error(`Session ${sessionId} doesn't exist on ADK!`);
      }
    } catch (e) {
      console.error('Session verification failed:', e);
      throw e;
    }
  }

  return sessionId;
}
```

#### 3. Log Analysis for Fake Sessions

```bash
# Look for session creation without corresponding ADK calls
grep "session created" server.log | head -20
grep "POST.*sessions" server.log | head -20

# If session created logs >> POST sessions logs, you have fake sessions
```

#### 4. Integration Test with Real ADK

```typescript
// server/src/services/__tests__/project-hub-agent.integration.test.ts

describe('ProjectHubAgentService Integration', () => {
  // Skip if no agent URL configured
  const agentUrl = process.env.PROJECT_HUB_AGENT_URL;
  const shouldRun = !!agentUrl;

  it.skipIf(!shouldRun)('creates real ADK session', async () => {
    const service = createProjectHubAgentService();

    const sessionId = await service.createSession(
      'test-tenant',
      'test@example.com',
      'test-project',
      'customer'
    );

    // Real ADK sessions should be usable
    const result = await service.sendMessage(sessionId, 'test-tenant', 'test@example.com', 'Hello');

    // Should get a response, not "session not found"
    expect(result.error).not.toBe('session_not_found');
    expect(result.response).toBeDefined();
  });
});
```

### Prevention Strategies

#### Strategy 1: Naming Convention for Fake IDs

If you must generate local IDs (for dev/mock), make it OBVIOUS:

```typescript
// CORRECT: Clearly marked as local/fake
const localSessionId = `LOCAL:${tenantId}:${projectId}:${Date.now()}`;
const mockSessionId = `MOCK:${Date.now()}`;

// WRONG: Looks real but isn't
const sessionId = `project-${projectId}-${Date.now()}`;
const sessionId = `session-${uuid()}`; // Looks like real UUID!
```

#### Strategy 2: Session Creation Must Call Service

Add a linting rule or code review check:

```typescript
// BAD PATTERNS to flag:
const sessionId = `project-${  // Direct string construction
const sessionId = `session-${  // Direct string construction
Date.now()}`;                  // In session ID context

// GOOD PATTERN:
const sessionId = await agentService.createSession(...)  // Service call
```

#### Strategy 3: Development Mode Verification

```typescript
// In route handler
router.post('/:projectId/chat/session', async (req, res) => {
  const agentService = createProjectHubAgentService();

  const sessionId = await agentService.createSession(tenantId, customerId, projectId, contextType);

  // DEV MODE: Verify session is real
  if (process.env.NODE_ENV === 'development') {
    if (!sessionId.match(/^(sess_|local:|[a-f0-9-]{36})/)) {
      console.error(`SUSPICIOUS SESSION ID: ${sessionId}`);
      console.error('This may be a fake session that will fail on /run');
    }
  }

  res.json({ sessionId, greeting });
});
```

#### Strategy 4: E2E Test That Sends Follow-Up Message

```typescript
// apps/web/e2e/project-hub-chat.spec.ts

test('chat session persists across messages', async ({ page }) => {
  // Navigate to project hub
  await page.goto('/t/demo/project/test-123?token=valid');

  // Wait for chat to initialize
  await page.waitForSelector('[data-testid="chat-greeting"]');

  // Send first message
  await page.fill('[data-testid="chat-input"]', 'Hello');
  await page.click('[data-testid="send-button"]');

  // Wait for response
  await page.waitForSelector('[data-testid="assistant-message"]');

  // Send SECOND message (this is where fake sessions fail!)
  await page.fill('[data-testid="chat-input"]', 'What services do you offer?');
  await page.click('[data-testid="send-button"]');

  // Should get a response, not an error
  const secondResponse = await page.waitForSelector(
    '[data-testid="assistant-message"]:nth-child(4)'
  );
  const text = await secondResponse.textContent();

  // Fake sessions would show error here
  expect(text).not.toContain('session expired');
  expect(text).not.toContain('Session not found');
});
```

### Code Review Checklist for Issue 2

When reviewing PRs that handle sessions:

```markdown
## Session Management Review

□ Session IDs come from service.createSession(), not string templates
□ No `Date.now()` or `Math.random()` in session ID generation
□ Service method is awaited (not just called)
□ Error handling for session creation failure
□ If local fallback exists, it's clearly marked (e.g., `LOCAL:` prefix)
□ Test sends multiple messages to verify session persists
```

### Test Cases for Issue 2

```typescript
// server/src/routes/__tests__/chat-session.test.ts

describe('Chat Session Management', () => {
  describe('Session Creation', () => {
    it('creates real ADK session via service', async () => {
      const mockCreateSession = vi.fn().mockResolvedValue('sess_real123');
      vi.mock('../../services/project-hub-agent.service', () => ({
        createProjectHubAgentService: () => ({
          createSession: mockCreateSession,
        }),
      }));

      const res = await request(app)
        .post('/api/v1/public/projects/proj-1/chat/session')
        .send({ token: validToken });

      // Verify service was called
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.any(String), // tenantId
        expect.any(String), // customerId
        'proj-1', // projectId
        'customer' // contextType
      );

      // Session ID should be from service, not generated
      expect(res.body.sessionId).toBe('sess_real123');
    });

    it('rejects fake-looking session IDs', async () => {
      // This test documents what we DON'T want
      const fakePatterns = ['project-123-1706123456789', 'session-123', `chat-${Date.now()}`];

      for (const fake of fakePatterns) {
        expect(isRealAdkSessionId(fake)).toBe(false);
      }
    });
  });

  describe('Session Persistence', () => {
    it('session works for multiple messages', async () => {
      const mockSendMessage = vi
        .fn()
        .mockResolvedValueOnce({ response: 'Hello!', sessionId: 'sess_123' })
        .mockResolvedValueOnce({ response: 'Here are services...', sessionId: 'sess_123' });

      // First message
      const res1 = await request(app)
        .post('/api/v1/public/projects/proj-1/chat/message')
        .send({ message: 'Hi', sessionId: 'sess_123', token: validToken });

      expect(res1.body.error).toBeUndefined();

      // Second message with same session
      const res2 = await request(app)
        .post('/api/v1/public/projects/proj-1/chat/message')
        .send({ message: 'What services?', sessionId: 'sess_123', token: validToken });

      expect(res2.body.error).toBeUndefined();
      expect(res2.body.message).toBeDefined();
    });
  });
});
```

---

## Combined Prevention Checklist

Add to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Service & Session Integration Checklist

### Service Wiring (if adding new services)

- [ ] Service class/function is imported in consuming file
- [ ] Factory function is called (not just imported)
- [ ] No inline fetch() duplicating service logic
- [ ] Integration test verifies service is invoked

### Session Management (if handling sessions)

- [ ] Session IDs from service.createSession(), not string templates
- [ ] No Date.now()/Math.random() in session ID generation
- [ ] E2E test sends 2+ messages to verify persistence
- [ ] Error state handles "session not found" gracefully
```

---

## CLAUDE.md Pitfall Additions

Add to Common Pitfalls section:

```markdown
### Service Integration Pitfalls (84-85)

84. Orphan service pattern - Creating service class but never importing/calling it in routes; verify with `grep -rn "import.*ServiceName" server/src/`; ESLint doesn't catch unused exports across files. See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`

85. Fake session ID pattern - Generating local IDs like `project-${id}-${Date.now()}` instead of calling ADK createSession(); E2E test must send 2+ messages to catch this; fake sessions fail on second message with "Session not found". See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
```

---

## Quick Reference Card

### Issue 1: Orphan Service

| Signal                 | Detection                                                      | Fix                       |
| ---------------------- | -------------------------------------------------------------- | ------------------------- |
| Service file exists    | Check `server/src/services/*.service.ts`                       | Import in route file      |
| No imports found       | `grep -rn "import.*ServiceName"` returns only the service file | Add import statement      |
| Inline fetch in routes | Routes have raw `fetch()` calls                                | Replace with service call |
| Tests mock differently | Mock targets route logic, not service                          | Mock the service instead  |

### Issue 2: Fake Sessions

| Signal                   | Detection                          | Fix                           |
| ------------------------ | ---------------------------------- | ----------------------------- |
| Session ID has timestamp | `project-123-1706123456789` format | Use `service.createSession()` |
| First message works      | Greeting appears                   | Send second message to verify |
| Second message fails     | "Session not found" error          | Session ID isn't real         |
| No ADK HTTP calls        | Logs show no `/sessions` POST      | Wire up service properly      |

---

## Related Documentation

- [ADK A2A Prevention Strategies](./ADK_A2A_PREVENTION_INDEX.md) - ADK-specific patterns
- [A2A Session State Prevention](./A2A_SESSION_STATE_PREVENTION.md) - Session state management
- [ESLint Prevention Index](./ESLINT_PREVENTION_INDEX.md) - Dead code detection
- [Project Hub Phase 1 Plan](../../plans/2026-01-25-feat-project-hub-phase-1-chat-fix-plan.md) - Original fix plan
