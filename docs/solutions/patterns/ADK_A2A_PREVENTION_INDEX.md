---
title: ADK A2A Prevention Strategies
category: patterns
component: agent-v2
severity: P1
tags: [google-adk, a2a, prevention, code-review, testing, cloud-run, orchestration]
created: 2026-01-18
updated: 2026-01-19
related:
  - adk-agent-deployment-pattern.md
  - adk-a2a-orchestrator-pattern.md
  - ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md
  - A2A_SESSION_STATE_PREVENTION.md
---

# ADK A2A Prevention Strategies

Prevention strategies for the 8 common issues discovered during ADK agent development and A2A orchestration.

## Issue Summary

| #   | Issue                      | Impact                                   | Detection                       |
| --- | -------------------------- | ---------------------------------------- | ------------------------------- |
| 1   | snake_case vs camelCase    | 400 errors, silent failures              | Unit test, code review          |
| 2   | App Name Mismatch          | Session not found errors                 | Smoke test after deploy         |
| 3   | Unsupported Zod Types      | Deploy failures, runtime errors          | Static analysis, unit test      |
| 4   | Response Format Variations | Missing agent responses                  | Unit test with mocks            |
| 5   | Identity Token Auth        | Auth failures in production              | Manual test, integration test   |
| 6   | LLM Tool Calling           | LLM echoes instead of calling tools      | Prompt review, integration test |
| 7   | URL Discovery              | Hardcoded URLs break across environments | Code review, env validation     |
| 8   | FunctionTool API Mismatch  | 41+ TypeScript errors, build failures    | TypeScript compilation          |

---

## Issue 1: A2A Parameter Naming (camelCase)

### Problem

Google ADK's A2A protocol uses **camelCase** for all parameters (`appName`, `userId`, `sessionId`, `newMessage`). This was discovered through debugging - the ADK rejects snake_case parameters with "Session not found" errors.

```typescript
// WRONG - snake_case (will fail silently)
body: JSON.stringify({
  app_name: agentName,       // ❌ ADK rejects this
  user_id: tenantId,         // ❌ ADK rejects this
  session_id: sessionId,     // ❌ ADK rejects this
  new_message: { ... },      // ❌ ADK rejects this
})

// CORRECT - camelCase for all A2A fields
body: JSON.stringify({
  appName: agentName,        // ✅
  userId: tenantId,          // ✅
  sessionId: sessionId,      // ✅
  newMessage: {              // ✅
    role: 'user',
    parts: [{ text: message }],
  },
})
```

### Prevention Checklist

- [ ] A2A request body uses `appName`, `userId`, `sessionId`, `newMessage` (camelCase)
- [ ] Message parts use same camelCase (`role`, `parts`, `text`)
- [ ] Code review specifically checks for snake_case mistakes

### Test Case

```typescript
// server/src/agent-v2/__tests__/a2a-format.test.ts
describe('A2A Protocol Format', () => {
  it('should use camelCase for all A2A fields', () => {
    const request = buildA2ARequest({
      agentName: 'marketing_specialist',
      tenantId: 'tenant-123',
      sessionId: 'session-456',
      message: 'Generate headlines',
    });

    const body = JSON.parse(request.body);

    // All fields must be camelCase
    expect(body).toHaveProperty('appName');
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('newMessage');

    // Must NOT have snake_case variants (ADK rejects these)
    expect(body).not.toHaveProperty('app_name');
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('session_id');
    expect(body).not.toHaveProperty('new_message');
  });
});
```

### Code Review Guideline

> When reviewing A2A communication code, verify that HTTP request bodies use **camelCase** for all protocol fields (`appName`, `userId`, `sessionId`, `newMessage`). Snake_case will cause silent "Session not found" failures.

---

## Issue 2: App Name Mismatch

### Problem

The `app_name` in A2A requests must EXACTLY match the `name` property of the target LlmAgent. If mismatched, you get "app not found" or "session not found" errors.

```typescript
// Agent definition
export const marketingAgent = new LlmAgent({
  name: 'marketing_specialist', // THIS is the app_name to use
  // ...
});

// WRONG - using "marketing" instead of "marketing_specialist"
body: JSON.stringify({
  app_name: 'marketing', // Mismatch!
});

// CORRECT - matches agent's name property
body: JSON.stringify({
  app_name: 'marketing_specialist',
});
```

### Prevention Checklist

- [ ] Run `/list-apps` on deployed service to verify app name
- [ ] App name in delegation tool matches agent's `name` property
- [ ] After deploy, smoke test verifies app name is accessible

### Test Case

```typescript
// server/src/agent-v2/__tests__/app-name-discovery.test.ts
describe('App Name Discovery', () => {
  it('should verify app name matches deployed agent', async () => {
    // This test runs against deployed service
    const serviceUrl = process.env.MARKETING_AGENT_URL;
    if (!serviceUrl) return; // Skip if not configured

    const response = await fetch(`${serviceUrl}/list-apps`, {
      headers: await getAuthHeaders(serviceUrl),
    });

    const apps = await response.json();

    // Verify expected app name is in the list
    expect(apps).toContain('marketing_specialist');
  });
});
```

### Smoke Test Script

```bash
#!/bin/bash
# server/src/agent-v2/scripts/verify-app-name.sh

SERVICE_URL=$1
EXPECTED_APP=$2

if [ -z "$SERVICE_URL" ] || [ -z "$EXPECTED_APP" ]; then
  echo "Usage: ./verify-app-name.sh <service-url> <expected-app-name>"
  exit 1
fi

TOKEN=$(gcloud auth print-identity-token)
APPS=$(curl -s -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/list-apps")

if echo "$APPS" | grep -q "\"$EXPECTED_APP\""; then
  echo "SUCCESS: App '$EXPECTED_APP' found in $SERVICE_URL"
  exit 0
else
  echo "FAILURE: App '$EXPECTED_APP' not found. Available apps: $APPS"
  exit 1
fi
```

### Deployment Checklist Addition

```markdown
## Post-Deploy Verification

- [ ] Run `./verify-app-name.sh $SERVICE_URL $AGENT_NAME`
- [ ] Confirm output shows expected app name
- [ ] If mismatch, check agent.ts `name` property
```

---

## Issue 3: Unsupported Zod Types

### Problem

ADK's schema conversion doesn't support all Zod types. These will cause deploy failures or runtime errors:

- `z.record()` - Use `z.any()` or `z.object().passthrough()`
- `z.tuple()` - Use `z.array()` with union types
- `z.intersection()` - Flatten to single `z.object()`
- `z.lazy()` - Not supported at all

```typescript
// WRONG - z.record() not supported
const Params = z.object({
  metadata: z.record(z.string()), // Will fail
});

// CORRECT - use z.any() with description
const Params = z.object({
  metadata: z.any().describe('Key-value metadata object'),
});
```

### Prevention Checklist

- [ ] No `z.record()` in tool parameter schemas
- [ ] No `z.tuple()` in tool parameter schemas
- [ ] No `z.intersection()` in tool parameter schemas
- [ ] No `z.lazy()` in tool parameter schemas
- [ ] Complex objects use `z.any()` with descriptive `.describe()`

### Test Case

```typescript
// server/src/agent-v2/__tests__/zod-schema-validation.test.ts
import { z } from 'zod';

// List of schema files to check
const SCHEMA_FILES = [
  'concierge/src/agent.ts',
  'marketing/src/agent.ts',
  'storefront/src/agent.ts',
  'research/src/agent.ts',
];

describe('ADK Zod Schema Compatibility', () => {
  it('should not use unsupported Zod types in agent schemas', async () => {
    for (const file of SCHEMA_FILES) {
      const content = await fs.readFile(`server/src/agent-v2/deploy/${file}`, 'utf-8');

      // Check for unsupported patterns
      expect(content).not.toMatch(/z\.record\(/);
      expect(content).not.toMatch(/z\.tuple\(/);
      expect(content).not.toMatch(/z\.intersection\(/);
      expect(content).not.toMatch(/z\.lazy\(/);
    }
  });
});
```

### Documentation: ADK Zod Limitations

Add to `server/src/agent-v2/deploy/ZOD_LIMITATIONS.md`:

```markdown
# ADK Zod Type Limitations

Google ADK converts Zod schemas to Gemini function declarations. These types are NOT supported:

| Unsupported Type   | Alternative     | Example                                         |
| ------------------ | --------------- | ----------------------------------------------- |
| `z.record()`       | `z.any()`       | `metadata: z.any().describe('Key-value pairs')` |
| `z.tuple()`        | `z.array()`     | `coords: z.array(z.number()).length(2)`         |
| `z.intersection()` | Flatten         | Merge into single `z.object()`                  |
| `z.lazy()`         | Avoid recursion | Flatten or limit depth                          |

## Safe Types

- `z.string()`, `z.number()`, `z.boolean()`
- `z.array()`
- `z.object()`
- `z.enum()`
- `z.optional()`, `z.default()`
- `z.describe()` (highly recommended!)
- `z.any()` (with `.describe()` for LLM guidance)
```

---

## Issue 4: Response Format Variations

### Problem

A2A responses may return data in different formats depending on the agent's response:

- Array of messages: `{ messages: [...] }`
- Single content: `{ content: {...} }`
- Direct response: `{ response: "..." }`

```typescript
// WRONG - assumes single format
const agentResponse = data.messages?.find((m) => m.role === 'model')?.parts?.[0]?.text;

// CORRECT - handle multiple formats
const data = await response.json();

// Format 1: messages array
let agentResponse = data.messages
  ?.find((m: any) => m.role === 'model')
  ?.parts?.find((p: any) => p.text)?.text;

// Format 2: direct content
if (!agentResponse && data.content?.parts) {
  agentResponse = data.content.parts.find((p: any) => p.text)?.text;
}

// Format 3: simple response
if (!agentResponse && data.response) {
  agentResponse = data.response;
}

// Fallback: stringify entire response
return agentResponse || JSON.stringify(data);
```

### Prevention Checklist

- [ ] Response parsing handles `messages[]` format
- [ ] Response parsing handles `content.parts[]` format
- [ ] Response parsing handles direct `response` field
- [ ] Fallback to JSON.stringify if all else fails

### Test Case

```typescript
// server/src/agent-v2/__tests__/a2a-response-parsing.test.ts
describe('A2A Response Parsing', () => {
  const parseA2AResponse = (data: unknown): string => {
    // Implementation being tested
  };

  it('should parse messages array format', () => {
    const data = {
      messages: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] },
      ],
    };
    expect(parseA2AResponse(data)).toBe('Hi there!');
  });

  it('should parse content.parts format', () => {
    const data = {
      content: {
        role: 'model',
        parts: [{ text: 'Response text' }],
      },
    };
    expect(parseA2AResponse(data)).toBe('Response text');
  });

  it('should parse direct response format', () => {
    const data = { response: 'Direct response' };
    expect(parseA2AResponse(data)).toBe('Direct response');
  });

  it('should fallback to JSON.stringify for unknown formats', () => {
    const data = { unknown: 'format', nested: { data: true } };
    const result = parseA2AResponse(data);
    expect(result).toContain('unknown');
    expect(result).toContain('format');
  });

  it('should handle empty response gracefully', () => {
    const data = { messages: [] };
    const result = parseA2AResponse(data);
    expect(result).toBeDefined();
  });
});
```

---

## Issue 5: Identity Token Authentication

### Problem

Cloud Run services require identity tokens for authentication. Two different patterns are needed:

1. **Agent-to-Agent**: Uses GCP metadata service
2. **Backend-to-Agent**: Uses GoogleAuth library
3. **Local Development**: Must gracefully skip auth

```typescript
// Agent-to-Agent (in deployed agent)
const metadataUrl =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
  agentUrl;

try {
  const tokenResponse = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (tokenResponse.ok) {
    const token = await tokenResponse.text();
    authHeader = `Bearer ${token}`;
  }
} catch {
  // Local dev - no metadata server
  console.log('No metadata server - running in dev mode');
}

// Backend-to-Agent (in MAIS server)
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();
try {
  const client = await auth.getIdTokenClient(agentUrl);
  const headers = await client.getRequestHeaders();
  authHeader = headers['Authorization'];
} catch {
  // Local dev - skip auth
  console.log('No GCP credentials - running in dev mode');
}
```

### Prevention Checklist

- [ ] Agent-to-Agent uses metadata service URL pattern
- [ ] Backend-to-Agent uses GoogleAuth library
- [ ] Both patterns have try/catch for local dev fallback
- [ ] Local dev mode is logged (not silent failure)
- [ ] Token audience is the FULL service URL

### Test Case

```typescript
// server/src/agent-v2/__tests__/identity-token.test.ts
describe('Identity Token Authentication', () => {
  describe('getIdentityTokenFromMetadata', () => {
    it('should construct correct metadata URL with audience', () => {
      const agentUrl = 'https://marketing-agent-123.us-central1.run.app';
      const expectedUrl =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
        agentUrl;

      const metadataUrl = buildMetadataUrl(agentUrl);
      expect(metadataUrl).toBe(expectedUrl);
    });

    it('should include Metadata-Flavor header', () => {
      const headers = getMetadataHeaders();
      expect(headers['Metadata-Flavor']).toBe('Google');
    });
  });

  describe('local dev fallback', () => {
    it('should return null when metadata service unavailable', async () => {
      // Mock fetch to throw (simulating local dev)
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const token = await getIdentityToken('https://example.run.app', mockFetch);
      expect(token).toBeNull();
    });
  });
});
```

### Manual Test Script

```bash
#!/bin/bash
# server/src/agent-v2/scripts/test-auth-flow.sh

echo "Testing identity token authentication..."

# Test 1: gcloud CLI auth
echo "1. Testing gcloud CLI token generation..."
TOKEN=$(gcloud auth print-identity-token --audiences="https://marketing-agent-506923455711.us-central1.run.app" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  echo "   SUCCESS: gcloud token generated"
else
  echo "   WARNING: gcloud token failed - check 'gcloud auth login'"
fi

# Test 2: Application Default Credentials
echo "2. Testing ADC..."
ADC_FILE="$HOME/.config/gcloud/application_default_credentials.json"
if [ -f "$ADC_FILE" ]; then
  echo "   SUCCESS: ADC file exists"
else
  echo "   WARNING: ADC not found - run 'gcloud auth application-default login'"
fi

# Test 3: Test actual endpoint
echo "3. Testing endpoint with token..."
if [ -n "$TOKEN" ]; then
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "https://marketing-agent-506923455711.us-central1.run.app/list-apps")
  if [ "$RESPONSE" = "200" ]; then
    echo "   SUCCESS: Endpoint returned 200"
  else
    echo "   FAILURE: Endpoint returned $RESPONSE"
  fi
fi

echo ""
echo "Local dev setup:"
echo "  - Ensure 'gcloud auth application-default login' completed"
echo "  - Code should gracefully skip auth when not on GCP"
```

---

## Issue 6: LLM Tool Calling (Pattern Matching vs Execution)

### Problem

LLMs pattern-match on example text and output it directly instead of calling tools. This was discovered when the Concierge agent responded with "On it. Check the preview →" without actually calling `delegate_to_marketing`.

**Real Example from Production Debugging:**

The system prompt contained:

```markdown
**Good Response:**
User: "Write me better headlines"
You: "On it. Check the preview →"
[Delegates to Marketing, shows result]
"Got 3 options. Which vibes?"
```

**What the LLM did:** Output `"On it. Check the preview →"` as text
**What we expected:** Call `delegate_to_marketing()` tool first

**Root Cause:** The LLM saw `You: "On it. Check the preview →"` as a template to copy. The bracketed `[Delegates to Marketing]` was ignored as annotation.

### The Fix

```markdown
## WRONG - Copy-pasteable example responses

**Good Response:**
User: "Write me better headlines"
You: "On it. Check the preview →"

## CORRECT - Mandate tool-first, describe action flow

## CRITICAL: Tool-First Protocol

You MUST call the appropriate tool BEFORE responding with text.
Never acknowledge a request without executing it via tool call.

User: "Write me better headlines"
→ Your FIRST action: Call delegate_to_marketing(task="headline", ...)
→ Wait for tool result
→ Then respond with actual generated content
```

### Prevention Checklist

- [ ] No copy-pasteable JSON examples in prompts
- [ ] Explicit "MUST call" or "ALWAYS use" language
- [ ] No example responses that could be echoed
- [ ] Test that tool calls appear in agent response

### Test Case

```typescript
// server/src/agent-v2/__tests__/tool-calling-behavior.test.ts
describe('LLM Tool Calling', () => {
  it('should call tools instead of echoing examples', async () => {
    // This test requires integration with actual agent
    const serviceUrl = process.env.CONCIERGE_AGENT_URL;
    if (!serviceUrl) return; // Skip if not configured

    // Send a request that should trigger tool call
    const response = await sendAgentMessage(serviceUrl, {
      message: 'What services do you offer?',
      tenantId: 'test-tenant',
    });

    // Check for tool call indicators in response
    // The response should show actual tool execution, not fabricated data
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe('get_services');
  });
});
```

### Prompt Review Guideline

> When reviewing agent system prompts, check for:
>
> 1. "MUST call" or "ALWAYS use" language for tool usage
> 2. Absence of copy-pasteable JSON examples
> 3. No example responses that show the exact format the agent should return
> 4. Clear instruction: "Never fabricate data - use tools to get real information"

### Anti-Pattern Detection

````bash
# Check prompts for anti-patterns
grep -rn '```json' server/src/agent-v2/deploy/*/src/agent.ts | \
  grep -v 'Example INPUT' | \
  grep -v '// Comment'

# If any results, review for echoed response patterns
````

---

## Issue 7: URL Discovery

### Problem

Cloud Run URLs contain project numbers and can change. Hardcoding URLs causes failures across environments.

```typescript
// WRONG - hardcoded URL
const MARKETING_URL = 'https://marketing-agent-506923455711.us-central1.run.app';

// CORRECT - environment variable with fallback
const MARKETING_URL =
  process.env.MARKETING_AGENT_URL || 'https://marketing-agent-506923455711.us-central1.run.app';
```

### Prevention Checklist

- [ ] All agent URLs come from environment variables
- [ ] Fallback URLs are documented (for reference only)
- [ ] URL discovery command is documented
- [ ] Environment validation checks for URL variables

### Test Case

```typescript
// server/src/agent-v2/__tests__/url-configuration.test.ts
describe('Agent URL Configuration', () => {
  it('should use environment variables for specialist URLs', async () => {
    const content = await fs.readFile('server/src/agent-v2/deploy/concierge/src/agent.ts', 'utf-8');

    // Verify URL comes from env var
    expect(content).toMatch(/MARKETING_AGENT_URL.*=.*process\.env\.MARKETING_AGENT_URL/);
    expect(content).toMatch(/STOREFRONT_AGENT_URL.*=.*process\.env\.STOREFRONT_AGENT_URL/);
    expect(content).toMatch(/RESEARCH_AGENT_URL.*=.*process\.env\.RESEARCH_AGENT_URL/);
  });
});
```

### URL Discovery Command

```bash
# Get Cloud Run service URL
gcloud run services describe booking-agent \
  --region=us-central1 \
  --format='value(status.url)'

# List all services with URLs
gcloud run services list --region=us-central1 --format='table(SERVICE,URL)'

# Export for local dev
export BOOKING_AGENT_URL=$(gcloud run services describe booking-agent \
  --region=us-central1 --format='value(status.url)')
```

### Environment Validation Script

```bash
#!/bin/bash
# server/src/agent-v2/scripts/validate-env.sh

echo "Validating agent environment configuration..."

REQUIRED_VARS=(
  "MAIS_API_URL"
  "INTERNAL_API_SECRET"
  "MARKETING_AGENT_URL"
  "STOREFRONT_AGENT_URL"
  "RESEARCH_AGENT_URL"
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "  MISSING: $VAR"
    MISSING=$((MISSING + 1))
  else
    echo "  OK: $VAR is set"
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "FAILURE: $MISSING required variables not set"
  echo ""
  echo "To discover Cloud Run URLs:"
  echo "  gcloud run services list --region=us-central1 --format='table(SERVICE,URL)'"
  exit 1
else
  echo ""
  echo "SUCCESS: All required variables are set"
fi
```

---

## CLAUDE.md Pitfall Additions

Add these to the Common Pitfalls section:

```markdown
## ADK/A2A Pitfalls (32-39)

32. A2A camelCase required - Use `appName`, `userId`, `sessionId`, `newMessage` for A2A protocol (NOT snake_case - ADK rejects it silently)
33. App name mismatch - Always verify app name with `/list-apps` after deploy; must match agent's `name` property
34. Unsupported Zod types - ADK doesn't support `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`; use `z.any()` with `.describe()`
35. A2A response format - Handle both `messages[]` and `content.parts[]` formats; fallback to JSON.stringify
36. Identity token auth - Agent-to-Agent uses metadata service; Backend-to-Agent uses GoogleAuth; both need graceful local dev fallback
37. LLM echoing prompts - Never include copy-pasteable JSON in prompts; mandate tool-first with "MUST call"
38. Hardcoded Cloud Run URLs - Always use environment variables; URLs contain project numbers that change
```

---

## Code Review Checklist

Add this section to PR templates for agent-related changes:

```markdown
## ADK/A2A Code Review

### A2A Protocol

- [ ] Request body uses camelCase: `appName`, `userId`, `sessionId`, `newMessage` (NOT snake_case!)
- [ ] App name matches target agent's `name` property
- [ ] Response parsing handles multiple formats

### Schema Validation

- [ ] No `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()` in tool schemas
- [ ] Complex objects use `z.any().describe('...')`

### Authentication

- [ ] Identity token uses correct pattern (metadata vs GoogleAuth)
- [ ] Local dev fallback is implemented with logging

### Configuration

- [ ] Agent URLs from environment variables
- [ ] `--service_name` in deploy script
- [ ] No copy-pasteable examples in prompts

### Testing

- [ ] Smoke test verifies app name after deploy
- [ ] Unit tests cover response format variations
```

---

## Test File Index

| Test File                       | Purpose                        | Runs In     |
| ------------------------------- | ------------------------------ | ----------- |
| `a2a-format.test.ts`            | Validates snake_case usage     | Unit        |
| `app-name-discovery.test.ts`    | Verifies deployed app names    | Integration |
| `zod-schema-validation.test.ts` | Checks for unsupported types   | Unit        |
| `a2a-response-parsing.test.ts`  | Tests response format handling | Unit        |
| `identity-token.test.ts`        | Tests auth patterns            | Unit        |
| `tool-calling-behavior.test.ts` | Verifies tools are called      | Integration |
| `url-configuration.test.ts`     | Validates env var usage        | Unit        |

---

## Quick Reference

### Before Writing Agent Code

1. Read `ZOD_LIMITATIONS.md`
2. Use snake_case for A2A fields
3. Get URLs from environment variables
4. Mandate tool-first in prompts

### Before Deploying

1. Verify `--service_name` in package.json
2. Run `validate-deploy-config.sh`
3. Check SERVICE_REGISTRY.md for conflicts

### After Deploying

1. Run `verify-app-name.sh`
2. Test with actual identity token
3. Verify URL is discoverable via gcloud

---

## Issue 8: FunctionTool API Mismatch

### Problem

The ADK `FunctionTool` class uses different property names than typical patterns. Using the wrong properties causes TypeScript errors that block builds.

```typescript
// WRONG - Old/incorrect API
const myTool = new FunctionTool({
  name: 'my_tool',
  description: 'Does something',
  inputSchema: z.object({
    // ❌ Not a valid property
    param: z.string(),
  }),
  func: async ({ param }, ctx) => {
    // ❌ Not a valid property
    return { result: param };
  },
});

// CORRECT - ADK FunctionTool API
const myTool = new FunctionTool({
  name: 'my_tool',
  description: 'Does something',
  parameters: z.object({
    // ✅ Correct property name
    param: z.string(),
  }),
  execute: async (
    // ✅ Correct property name
    { param }: { param: string }, // ✅ Explicit type annotation
    _ctx: ToolContext | undefined // ✅ Context CAN be undefined - ADK passes undefined in some cases
  ) => {
    return { result: param };
  },
});

// WRONG - LlmAgent config
export const agent = new LlmAgent({
  name: 'agent',
  model: 'gemini-2.0-flash',
  config: {
    // ❌ Not a valid property
    temperature: 0.4,
  },
});

// CORRECT - LlmAgent generateContentConfig
export const agent = new LlmAgent({
  name: 'agent',
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    // ✅ Correct property name
    temperature: 0.4,
    maxOutputTokens: 2048,
  },
});
```

### Prevention Checklist

- [ ] FunctionTool uses `parameters` (not `inputSchema`)
- [ ] FunctionTool uses `execute` (not `func`)
- [ ] Execute context typed as `ToolContext | undefined` (not just `ToolContext`)
- [ ] LlmAgent uses `generateContentConfig` (not `config`)
- [ ] Unused context params prefixed with underscore (`_ctx`)
- [ ] Execute function params have explicit type annotations

### Test Case

```typescript
// Run typecheck before committing agent changes
npm run typecheck

// Grep for wrong patterns
grep -rn "inputSchema:" server/src/agent-v2/deploy/
grep -rn "func: async" server/src/agent-v2/deploy/
grep -rn "config: {" server/src/agent-v2/deploy/*/src/agent.ts
```

### Code Review Guideline

> When reviewing ADK agent code, verify FunctionTool definitions use `parameters` and `execute`. Check LlmAgent uses `generateContentConfig` not `config`. Run `npm run typecheck` to catch mismatches.

---

## Related Documentation

- [ADK Agent Deployment Pattern](./adk-agent-deployment-pattern.md)
- [A2A Orchestrator Pattern](./adk-a2a-orchestrator-pattern.md)
- [ADK Backend Integration Pattern](./adk-agent-backend-integration-pattern.md)
- [Service Name Prevention](./ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md)
- [Session & State Prevention](./A2A_SESSION_STATE_PREVENTION.md) - Session isolation, state access patterns
- [Session & State Quick Reference](./A2A_SESSION_STATE_QUICK_REFERENCE.md) - One-page cheat sheet
