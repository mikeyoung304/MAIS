---
title: ADK Agent Deployment Pattern
category: patterns
component: agent-v2
tags: [google-adk, cloud-run, deployment, vertex-ai, agents]
created: 2026-01-18
---

# ADK Agent Deployment Pattern

A reusable pattern for deploying Google ADK agents to Cloud Run from within a monorepo.

## The Pattern

Create a **standalone deployment package** for each agent that has:

1. Zero imports from the main codebase
2. All code inlined into a single file
3. Its own package.json with minimal dependencies
4. CommonJS output format

## Directory Structure

```
server/src/agent-v2/deploy/{agent-name}/
├── src/
│   └── agent.ts       # Everything inlined here
├── package.json       # Standalone deps
├── tsconfig.json      # CommonJS config
└── dist/
    └── agent.js       # Compiled output
```

## Template Files

### package.json

```json
{
  "name": "handled-{agent-name}-agent",
  "version": "1.0.0",
  "main": "dist/agent.js",
  "scripts": {
    "build": "tsc",
    "deploy": "npm run build && npx adk deploy cloud_run dist/agent.js --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={agent-name}-agent"
  },
  "dependencies": {
    "@google/adk": "^0.2.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@google/adk-devtools": "^0.2.4",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### agent.ts Structure

```typescript
import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

// =============================================================================
// CONFIGURATION
// =============================================================================
const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// =============================================================================
// SYSTEM PROMPT (Inline - no imports)
// =============================================================================
const SYSTEM_PROMPT = `Your agent instructions here...

IMPORTANT: Use tools to discover context at runtime.
Do not use template variables like {variable}.
`;

// =============================================================================
// TOOL SCHEMAS (Inline Zod schemas)
// =============================================================================
const MyToolParams = z.object({
  param1: z.string().describe('Description'),
});

// =============================================================================
// HELPERS
// =============================================================================
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  return context.state?.get<string>('tenantId') ?? null;
}

async function callMaisApi(endpoint: string, tenantId: string, params = {}) {
  const response = await fetch(`${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_API_SECRET,
    },
    body: JSON.stringify({ tenantId, ...params }),
  });
  if (!response.ok) return { ok: false, error: `API error: ${response.status}` };
  return { ok: true, data: await response.json() };
}

// =============================================================================
// TOOLS
// =============================================================================
const myTool = new FunctionTool({
  name: 'my_tool',
  description: 'What this tool does',
  parameters: MyToolParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { error: 'No tenant context available' };

    const result = await callMaisApi('/my-endpoint', tenantId, params);
    return result.ok ? result.data : { error: result.error };
  },
});

// =============================================================================
// AGENT
// =============================================================================
export const myAgent = new LlmAgent({
  name: 'my_agent',
  description: 'What this agent does',
  model: 'gemini-2.0-flash',
  generateContentConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  instruction: SYSTEM_PROMPT,
  tools: [myTool],
});

export default myAgent;
```

## Deploy Workflow

```bash
# 1. Navigate to agent deploy directory
cd server/src/agent-v2/deploy/{agent-name}

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Test locally (optional)
npx adk run dist/agent.js

# 5. Deploy
npm run deploy
```

## Critical Rules

### DO

- Inline ALL code (prompts, schemas, tools)
- Use CommonJS module format
- Match @google/adk versions with @google/adk-devtools
- Use tools for dynamic context (not template variables)
- Test with `adk run` locally before deploying
- **ALWAYS specify `--service_name={agent}-agent` in deploy scripts** (prevents multi-agent conflicts)

### DON'T

- Import from main codebase (`../../../lib/...`)
- Use ESM format (`"type": "module"`)
- Use template variables in prompts (`{variable}`)
- Mix ADK versions between packages
- **NEVER omit `--service_name` from deploy commands** (causes agents to overwrite each other)

### Service Naming (CRITICAL)

Every agent MUST have a unique, explicit service name:

```bash
# CORRECT - explicit service name
--service_name=booking-agent

# WRONG - relies on default (will conflict!)
# (no --service_name flag)
```

**Validation:** Run `bash server/src/agent-v2/scripts/validate-deploy-config.sh` before deploying.

**Registry:** Check `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` for existing names.

## Tenant Context

Tenant ID is injected into session state when creating a session. Tools access it via:

```typescript
const tenantId = context.state?.get<string>('tenantId');
```

The MAIS backend creates sessions with tenant context:

```typescript
// Backend code (not in agent)
await agentService.createSession({
  appName: 'agent',
  userId: customerId,
  state: { tenantId: tenant.id },
});
```

## Testing

```bash
# Get auth token
TOKEN=$(gcloud auth print-identity-token)

# List agents
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL/list-apps

# Create session
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$SERVICE_URL/apps/agent/users/test/sessions/test-1"

# Send message
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appName":"agent","userId":"test","sessionId":"test-1","newMessage":{"role":"user","parts":[{"text":"Hello"}]}}' \
  "$SERVICE_URL/run"
```

## Deployed Services

| Agent      | Service URL                                              |
| ---------- | -------------------------------------------------------- |
| Booking    | `https://booking-agent-506923455711.us-central1.run.app` |
| Marketing  | TBD                                                      |
| Storefront | TBD                                                      |
| Research   | TBD                                                      |

## Related Documentation

- [ADK Agent-Backend Integration Pattern](./adk-agent-backend-integration-pattern.md) - Backend endpoints for agent communication
- [ADK Bundler Issue](../integration-issues/adk-cloud-run-bundler-transitive-imports.md) - Solving transitive import issues
- [Service Name Prevention](../../../docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md) - Preventing multi-agent deployment conflicts
- [Service Registry](../../../server/src/agent-v2/deploy/SERVICE_REGISTRY.md) - Track deployed services
- `plans/VERTEX-AI-EXECUTION-PLAN.md`
