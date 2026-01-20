# ADK A2A Protocol "load" Error

## Problem

Specialist agents (Storefront, Marketing, Research) return HTTP 500 when called via A2A protocol from the Concierge orchestrator, with error:

```
Cannot read properties of undefined (reading 'load')
```

### Symptoms

1. Agent chat shows "That didn't work" after delegation
2. Concierge logs show successful session creation, then 500 error
3. All specialist agents affected - not specific to one agent
4. Error happens during `/run` endpoint processing, not session creation

### Log Evidence

```
[Concierge] Created session on storefront_specialist: 96bab4be-...
[Concierge] Sending message to storefront_specialist, session: 96bab4be-...
[Concierge] storefront_specialist error: 500 - {"error":"Cannot read properties of undefined (reading 'load')"}
```

## Root Cause (SOLVED ✅)

**Name mismatch between what Concierge sends and how ADK registers agents.**

ADK's `AgentLoader` registers agents by **directory name**, not by the `agent.name` property:

```javascript
// ADK AgentLoader code:
async loadAgentFromDirectory(t) {
  let n = (await Oe(t.path)).find(r => r.isFile && r.name === "agent" && je(r.ext));
  if (n) {
    let r = new $(n.path, this.options);
    await r.load();
    this.preloadedAgents[t.name] = r;  // <-- Uses DIRECTORY name: "storefront"
  }
}
```

| What Concierge Was Sending         | How ADK Registers Agent        | Match? |
| ---------------------------------- | ------------------------------ | ------ |
| `appName: "storefront_specialist"` | Directory name: `"storefront"` | ❌ NO  |
| `appName: "marketing_specialist"`  | Directory name: `"marketing"`  | ❌ NO  |
| `appName: "research_specialist"`   | Directory name: `"research"`   | ❌ NO  |

**Why session creation succeeded:** The session creation endpoint just stores the appName - it doesn't validate that the agent exists.

**Why /run failed:** The `/run` endpoint validates the session exists, THEN tries to load the agent by appName. Since `agentLoader.getAgentFile("storefront_specialist")` returns `undefined`, calling `.load()` on undefined causes the error.

## Solution

Changed all `appName` values in Concierge to use directory names:

```typescript
// Before (WRONG)
callSpecialistAgent(SPECIALIST_URLS.storefront, 'storefront_specialist', ...)
callSpecialistAgent(SPECIALIST_URLS.marketing, 'marketing_specialist', ...)
callSpecialistAgent(SPECIALIST_URLS.research, 'research_specialist', ...)

// After (CORRECT)
callSpecialistAgent(SPECIALIST_URLS.storefront, 'storefront', ...)
callSpecialistAgent(SPECIALIST_URLS.marketing, 'marketing', ...)
callSpecialistAgent(SPECIALIST_URLS.research, 'research', ...)
```

## Prevention Pattern

**CRITICAL RULE**: When using ADK A2A protocol, the `appName` must match the **directory name** of the agent deployment, NOT the `agent.name` property.

```
deploy/
├── storefront/          ← Directory name = "storefront"
│   └── src/
│       └── agent.ts     ← agent.name = "storefront_specialist" (IGNORED)
├── marketing/           ← Directory name = "marketing"
│   └── src/
│       └── agent.ts     ← agent.name = "marketing_specialist" (IGNORED)
└── research/            ← Directory name = "research"
    └── src/
        └── agent.ts     ← agent.name = "research_specialist" (IGNORED)
```

**Use directory name in all A2A calls:**

- Session creation: `/apps/{DIRECTORY_NAME}/users/{userId}/sessions`
- Message sending: `{ appName: "{DIRECTORY_NAME}", ... }`

## Environment

- ADK Version: `@google/adk@^0.2.4`
- Platform: Cloud Run (us-central1)
- Agent Types: LlmAgent with FunctionTool
- Model: `gemini-2.0-flash`

## Related Files

- `server/src/agent-v2/deploy/concierge/src/agent.ts` - Concierge orchestrator (FIXED)
- `server/src/agent-v2/deploy/storefront/src/agent.ts` - Storefront specialist
- `server/src/agent-v2/deploy/marketing/src/agent.ts` - Marketing specialist
- `server/src/agent-v2/deploy/research/src/agent.ts` - Research specialist

## Date Identified

2026-01-20

## Date Fixed

2026-01-19

## Key Learnings

1. **ADK uses directory names** - The `agent.name` property is for display only; routing uses directory structure
2. **Session creation doesn't validate** - Sessions can be created for non-existent agents, masking misconfigurations
3. **Error message was misleading** - "Cannot read properties of undefined (reading 'load')" pointed to ADK internals, but root cause was our misconfiguration
4. **Always verify appName** - Use `/list-apps` endpoint to confirm how agents are registered

---

## Prevention Strategies

### Strategy 1: Post-Deploy Verification (PRIMARY)

**Always run this after deploying any ADK agent:**

```bash
#!/bin/bash
# server/src/agent-v2/scripts/verify-app-registration.sh

SERVICE_URL=$1
EXPECTED_APP_NAMES=$2  # e.g., "storefront,marketing,research"

if [ -z "$SERVICE_URL" ] || [ -z "$EXPECTED_APP_NAMES" ]; then
  echo "Usage: ./verify-app-registration.sh <service-url> <expected-apps>"
  echo "Example: ./verify-app-registration.sh https://storefront-agent.run.app storefront"
  exit 1
fi

# Get identity token for authentication
TOKEN=$(gcloud auth print-identity-token --audiences="$SERVICE_URL" 2>/dev/null)

# Call /list-apps endpoint
RESPONSE=$(curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$SERVICE_URL/list-apps")

echo "Service: $SERVICE_URL"
echo "Registered Apps: $RESPONSE"
echo ""

# Validate each expected app
IFS=',' read -ra APPS <<< "$EXPECTED_APP_NAMES"
MISSING=0

for app in "${APPS[@]}"; do
  if echo "$RESPONSE" | grep -q "\"$app\""; then
    echo "✅ App found: $app"
  else
    echo "❌ App MISSING: $app"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "ERROR: $MISSING expected apps not registered!"
  echo "Check agent directory names match expected app names."
  exit 1
else
  echo ""
  echo "SUCCESS: All apps registered correctly"
fi
```

**Add to post-deploy CI workflow:**

```yaml
# .github/workflows/deploy-agents.yml (post-deploy step)
- name: Verify app registration
  run: |
    bash server/src/agent-v2/scripts/verify-app-registration.sh \
      $STOREFRONT_AGENT_URL "storefront"
    bash server/src/agent-v2/scripts/verify-app-registration.sh \
      $MARKETING_AGENT_URL "marketing"
    bash server/src/agent-v2/scripts/verify-app-registration.sh \
      $RESEARCH_AGENT_URL "research"
```

---

### Strategy 2: Naming Convention Enforcement

**CRITICAL RULE:** The `appName` in A2A calls MUST match the directory structure, NOT the `agent.name` property.

#### Directory Structure Requirements

```
deploy/
├── storefront/              ← Directory name (MUST be used as appName)
│   ├── src/
│   │   └── agent.ts        ← agent.name = "storefront_specialist" (IGNORED)
│   └── package.json
├── marketing/              ← Directory name (MUST be used as appName)
│   └── src/
│       └── agent.ts        ← agent.name = "marketing_specialist" (IGNORED)
└── research/               ← Directory name (MUST be used as appName)
    └── src/
        └── agent.ts        ← agent.name = "research_specialist" (IGNORED)
```

#### Code Review Checklist

Add this to PR template for agent-related changes:

```markdown
## A2A Agent Name Verification

- [ ] A2A appName matches DIRECTORY name (e.g., "storefront", not "storefront_specialist")
- [ ] agent.name property is for display only - not used for routing
- [ ] Ran `/list-apps` verification script after deploy
- [ ] All A2A requests use directory name as appName
```

#### Automated Detection Script

```bash
#!/bin/bash
# server/src/agent-v2/scripts/detect-app-name-mismatches.sh

echo "Checking for A2A appName mismatches..."
echo "======================================="

CONCIERGE_FILE="server/src/agent-v2/deploy/concierge/src/agent.ts"

if [ ! -f "$CONCIERGE_FILE" ]; then
  echo "ERROR: Concierge file not found"
  exit 1
fi

# Extract all appName usage patterns
echo ""
echo "Current appName assignments in Concierge:"
grep -n "appName.*:" "$CONCIERGE_FILE" | head -20

echo ""
echo "Expected pattern: appName: 'storefront' (directory name)"
echo ""

# List all directories and their expected appName
echo "Available agent directories:"
for dir in server/src/agent-v2/deploy/*/; do
  dirname=$(basename "$dir")
  if [ -f "$dir/src/agent.ts" ]; then
    agent_name=$(grep -oP "name:\s*['\"]?\K[^'\"]*" "$dir/src/agent.ts" | head -1)
    echo "  Directory: $dirname → appName should be: '$dirname'"
    echo "              agent.name: '$agent_name' (for display only, don't use for routing)"
  fi
done

echo ""
echo "Run this check before deploying any changes to Concierge or agents"
```

---

### Strategy 3: Unit Test for A2A Request Format

```typescript
// server/src/agent-v2/__tests__/a2a-app-name-accuracy.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('A2A Protocol - App Name Accuracy', () => {
  it('should use directory name as appName, not agent.name', () => {
    // Read Concierge agent code
    const conciergeCode = readFileSync(
      'server/src/agent-v2/deploy/concierge/src/agent.ts',
      'utf-8'
    );

    // These patterns should NOT exist (would cause "load" error)
    expect(conciergeCode).not.toContain("appName: 'storefront_specialist'");
    expect(conciergeCode).not.toContain('appName: "storefront_specialist"');
    expect(conciergeCode).not.toContain("appName: 'marketing_specialist'");
    expect(conciergeCode).not.toContain("appName: 'research_specialist'");

    // These patterns SHOULD exist (correct directory names)
    expect(conciergeCode).toContain("appName: 'storefront'");
    expect(conciergeCode).toContain("appName: 'marketing'");
    expect(conciergeCode).toContain("appName: 'research'");
  });

  it('should map directory names to appName consistently', () => {
    // Map of directory → expected appName
    const expectedAppNames = {
      storefront: 'storefront',
      marketing: 'marketing',
      research: 'research',
      concierge: 'concierge', // If calling itself
    };

    const conciergeCode = readFileSync(
      'server/src/agent-v2/deploy/concierge/src/agent.ts',
      'utf-8'
    );

    for (const [_dir, appName] of Object.entries(expectedAppNames)) {
      const pattern = `appName: '${appName}'`;
      expect(conciergeCode, `Missing appName reference to ${appName}`).toContain(pattern);
    }
  });

  it('should not have trailing _specialist suffix in A2A appName', () => {
    const conciergeCode = readFileSync(
      'server/src/agent-v2/deploy/concierge/src/agent.ts',
      'utf-8'
    );

    // Use word boundary to catch appName assignments
    const appNameMatches = conciergeCode.match(/appName:\s*['"]([^'"]+)['"]/g);

    if (appNameMatches) {
      appNameMatches.forEach((match) => {
        const appName = match.match(/['"]([^'"]+)['"]/)?.[1];
        expect(appName, `appName "${appName}" should not have "_specialist" suffix`).not.toMatch(
          /_specialist$/
        );
      });
    }
  });
});
```

---

### Strategy 4: Documentation - Where to Find App Names

Create `server/src/agent-v2/deploy/APP_NAME_REFERENCE.md`:

````markdown
# ADK App Name Reference

## Important: appName vs agent.name

- **appName** (used for A2A routing) = **DIRECTORY NAME**
- **agent.name** (used for display) = Human-readable name with "specialist" suffix

## App Registration Mapping

| Directory  | appName (A2A) | agent.name               | Cloud Run Service  |
| ---------- | ------------- | ------------------------ | ------------------ |
| storefront | `storefront`  | `storefront_specialist`  | `storefront-agent` |
| marketing  | `marketing`   | `marketing_specialist`   | `marketing-agent`  |
| research   | `research`    | `research_specialist`    | `research-agent`   |
| concierge  | `concierge`   | `concierge_orchestrator` | `concierge-agent`  |

## Key Points

1. **A2A Calls**: Always use the "appName" column

   ```typescript
   // CORRECT
   {
     appName: ('storefront', userId, sessionId, newMessage);
   }

   // WRONG
   {
     appName: ('storefront_specialist', userId, sessionId, newMessage);
   }
   ```
````

2. **Verification**: Use `/list-apps` endpoint after deploying

   ```bash
   curl -H "Authorization: Bearer $TOKEN" $AGENT_URL/list-apps
   # Returns: ["storefront", "marketing", "research"]
   # NOT: ["storefront_specialist", "marketing_specialist", ...]
   ```

3. **Error Diagnosis**: If you see:
   ```
   Cannot read properties of undefined (reading 'load')
   ```
   Check that appName matches a directory name, not agent.name.

## How ADK Discovers App Names

ADK scans the deployment directory structure:

```
agents/
├── storefront/    ← ADK registers this as app name "storefront"
│   └── agent.cjs
├── marketing/     ← ADK registers this as app name "marketing"
│   └── agent.cjs
```

The `agent.name` property inside agent.ts is ONLY used for:

- Display in UI/logs
- Identifying the agent type
- NOT for A2A routing or registration

## Troubleshooting

### Symptom: "Cannot read properties of undefined (reading 'load')"

**Root Cause**: appName doesn't match any registered directory

**Fix**:

1. Run verification script: `verify-app-registration.sh $URL storefront`
2. Check that directory name matches appName in code
3. Verify agent is actually deployed: `gcloud run services describe storefront-agent`

### How to Find The Right appName

For any agent deployment:

1. Get the service URL from Cloud Run
2. Call: `curl -H "Authorization: Bearer $TOKEN" $URL/list-apps`
3. Use the names returned in the response

````

---

### Strategy 5: Integration Test - E2E A2A Communication

```typescript
// server/src/agent-v2/__tests__/a2a-e2e.test.ts
import { describe, it, expect } from 'vitest';

/**
 * These tests verify A2A communication end-to-end.
 * Run AFTER deploying agents to Cloud Run.
 *
 * Required env vars:
 * - CONCIERGE_AGENT_URL
 * - STOREFRONT_AGENT_URL
 * - MARKETING_AGENT_URL
 * - RESEARCH_AGENT_URL
 * - GOOGLE_CLOUD_PROJECT
 */

describe('A2A Communication (E2E)', () => {
  it('should list apps with correct registered names', async () => {
    const url = process.env.STOREFRONT_AGENT_URL;
    if (!url) {
      console.log('Skipping - STOREFRONT_AGENT_URL not set');
      return;
    }

    const token = await getIdentityToken(url);
    const response = await fetch(`${url}/list-apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const apps = await response.json();

    // Should show directory name, not agent.name
    expect(apps).toContain('storefront');
    expect(apps).not.toContain('storefront_specialist');
  });

  it('should successfully call specialist agent via A2A', async () => {
    const conciergeUrl = process.env.CONCIERGE_AGENT_URL;
    const storefrontUrl = process.env.STOREFRONT_AGENT_URL;

    if (!conciergeUrl || !storefrontUrl) {
      console.log('Skipping - agent URLs not configured');
      return;
    }

    const token = await getIdentityToken(conciergeUrl);
    const tenantId = 'test-tenant-123';

    // Step 1: Create session on storefront specialist
    const sessionResponse = await fetch(
      `${storefrontUrl}/apps/storefront/users/${tenantId}/sessions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json();
    const sessionId = session.sessionId || session.name;

    // Step 2: Send message via A2A with CORRECT appName
    const runResponse = await fetch(`${storefrontUrl}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appName: 'storefront', // ✅ Directory name, not "storefront_specialist"
        userId: tenantId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: 'Test message' }],
        },
        state: { tenantId },
      }),
    });

    // Should NOT get "Cannot read properties of undefined" error
    expect(runResponse.status).toBe(200);
    const result = await runResponse.json();
    expect(result).toBeDefined();
  });
});
````

---

### Strategy 6: Documentation - A2A Request Format Spec

Create `server/src/agent-v2/deploy/A2A_REQUEST_SPEC.md`:

````markdown
# A2A Request Format Specification

## Overview

Agent-to-Agent (A2A) communication uses the `/run` endpoint with a specific JSON format.

## Request Format

```json
{
  "appName": "storefront", // ← CRITICAL: DIRECTORY NAME, not agent.name
  "userId": "tenant-id-123", // ← Tenant ID or user ID
  "sessionId": "session-abc", // ← From /apps/{appName}/users/{userId}/sessions
  "newMessage": {
    "role": "user",
    "parts": [
      {
        "text": "Your message here"
      }
    ]
  },
  "state": {
    // ← Optional context state
    "tenantId": "tenant-id-123"
  }
}
```
````

## Critical Fields

| Field                    | Value             | Notes                                                   |
| ------------------------ | ----------------- | ------------------------------------------------------- |
| appName                  | Directory name    | MUST match directory in deployment, NOT agent.name      |
| userId                   | string            | Typically tenant ID                                     |
| sessionId                | string            | From `/apps/{appName}/users/{userId}/sessions` response |
| newMessage.role          | "user" or "model" | Usually "user" for incoming messages                    |
| newMessage.parts[0].text | string            | The actual message content                              |

## Common Mistakes → Errors

| Mistake                            | Error                                                  | Fix                                         |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `appName: "storefront_specialist"` | `Cannot read properties of undefined (reading 'load')` | Use `appName: "storefront"`                 |
| `user_id` instead of `userId`      | Silent failure / 400 error                             | Use camelCase `userId`                      |
| Missing `sessionId`                | Session not found                                      | Create session first                        |
| Wrong session for appName          | 404 not found                                          | Verify session was created on correct agent |

## Working Example

```typescript
async function delegateToStorefront(storefrontUrl: string, tenantId: string, message: string) {
  // 1. Create session
  const sessionResponse = await fetch(
    `${storefrontUrl}/apps/storefront/users/${tenantId}/sessions`,
    { method: 'POST', headers: getAuthHeaders() }
  );
  const { sessionId } = await sessionResponse.json();

  // 2. Send message with CORRECT appName
  const response = await fetch(`${storefrontUrl}/run`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: 'storefront', // ✅ DIRECTORY NAME
      userId: tenantId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: message }],
      },
      state: { tenantId },
    }),
  });

  return response.json();
}
```

````

---

### Strategy 7: CLAUDE.md Pitfall Documentation

Add to `CLAUDE.md` pitfalls section:

```markdown
## ADK A2A Pitfalls (Updated)

32. **A2A appName must be directory name** - Use directory name (e.g., "storefront"), NOT agent.name (e.g., "storefront_specialist"). Mismatch causes "Cannot read properties of undefined (reading 'load')" error. Always verify with `/list-apps` endpoint after deploy.

33. **appName vs agent.name confusion** - The `agent.name` property is ONLY for display. ADK registers agents by directory name for routing. Review the APP_NAME_REFERENCE.md if unsure.

34. **Skip post-deploy verification** - Must run `verify-app-registration.sh` after any agent deployment to ensure appName matches directory structure before A2A communication attempts.
````

---

## Verification Checklist (Copy & Pin)

```
ADK A2A Communication Verification
===================================

BEFORE A2A Integration:
[ ] Agent deployed to Cloud Run
[ ] Directory name is the agent identifier (e.g., "storefront")
[ ] agent.name property set for display (e.g., "storefront_specialist")
[ ] /list-apps endpoint shows directory names, not agent.name values

BEFORE EACH A2A CALL:
[ ] appName matches directory name from /list-apps output
[ ] appName is NOT the agent.name value
[ ] userId/tenantId is valid
[ ] sessionId created on correct agent (/apps/{appName}/users/{userId}/sessions)
[ ] Request uses camelCase: appName, userId, sessionId, newMessage

WHEN DEBUGGING "Cannot read properties of undefined (reading 'load')":
[ ] Check appName matches directory (run verify-app-registration.sh)
[ ] Check agent is actually deployed (gcloud run services describe)
[ ] Check /list-apps shows expected apps
[ ] Review agent.ts - agent.name should NOT match appName
[ ] Check sessionId was created on correct agent
```

---

## Testing Approach Summary

| Test Type   | Command                          | Catches                  |
| ----------- | -------------------------------- | ------------------------ |
| Static      | `grep -n "appName" src/agent.ts` | Obvious name mismatches  |
| Unit        | `a2a-app-name-accuracy.test.ts`  | Code violations          |
| Integration | `a2a-e2e.test.ts`                | Runtime failures         |
| Post-Deploy | `verify-app-registration.sh`     | Deployment config issues |
| Manual      | `/list-apps` endpoint            | Real-world verification  |
