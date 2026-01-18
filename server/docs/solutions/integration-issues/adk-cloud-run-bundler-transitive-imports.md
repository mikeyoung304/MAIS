---
title: ADK Cloud Run Deployment Bundles Entire Codebase
category: integration-issues
component: agent-v2
severity: medium
tags: [google-adk, cloud-run, deployment, bundler, vertex-ai]
created: 2025-01-18
resolved: true
resolution_date: 2026-01-18
root_cause: ADK bundler follows all transitive imports from dist folder
solution: Create physically isolated standalone deployment package
---

# ADK Cloud Run Deployment Bundles Entire Codebase

## Problem Symptom

When running `npx adk deploy cloud_run` on an agent directory within a larger codebase, the bundler fails with errors like:

```
✘ [ERROR] Could not resolve "axios"
    test-cache-isolation.ts:19:18

▲ [WARNING] "import.meta" is not available with the "cjs" output format
```

The bundler picks up test files, unrelated modules, and the entire project despite pointing to a specific agent directory.

## Root Cause

The ADK CLI's `deploy cloud_run` command uses esbuild to bundle the agent. It:

1. Starts from the specified agent directory
2. Follows ALL import statements transitively
3. Bundles everything it finds, even if the agent itself only uses HTTP calls

Even though our agent tools correctly use `fetch()` to call the MAIS backend API (proper isolation at the application level), the **compiled JavaScript files** in the dist folder contain imports to shared modules, which import other modules, eventually reaching test files and dependencies like axios.

## Solution: Standalone Deployment Package ✅

Create a completely isolated directory for ADK deployment with NO imports to the main codebase:

```
server/src/agent-v2/deploy/booking/
├── src/
│   └── agent.ts       # Self-contained (inline ALL code)
├── package.json       # Minimal deps: @google/adk, zod only
├── tsconfig.json      # CommonJS output, isolated compilation
└── dist/
    └── agent.js       # Compiled, standalone
```

### Key Requirements

1. **Inline everything** - System prompt, Zod schemas, tool implementations all in one file
2. **No imports to main codebase** - Only import from npm packages
3. **Use CommonJS output** - ADK CLI loader works better with CJS
4. **Match ADK versions** - `@google/adk` version must match `@google/adk-devtools`

### package.json

```json
{
  "name": "handled-booking-agent",
  "version": "1.0.0",
  "main": "dist/agent.js",
  "scripts": {
    "build": "tsc",
    "deploy": "npm run build && npx adk deploy cloud_run dist/agent.js --project=PROJECT_ID --region=REGION --service_name=SERVICE_NAME"
  },
  "dependencies": {
    "@google/adk": "^0.2.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@google/adk-devtools": "^0.2.4",
    "typescript": "^5.8.0"
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
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

### Deploy Command

```bash
cd server/src/agent-v2/deploy/booking
npm install
npm run build
npx adk deploy cloud_run dist/agent.js \
  --project=handled-484216 \
  --region=us-central1 \
  --service_name=booking-agent
```

## Additional Issue: ADK Version Mismatch

### Symptom

```
No @google/adk BaseAgent class instance found
```

### Cause

The `@google/adk-devtools` CLI has its own dependency on `@google/adk`. If your agent uses a different version, the `isBaseAgent()` check fails because JavaScript class identity is tied to module instance.

### Solution

Ensure versions match:

```bash
npm list @google/adk @google/adk-devtools
# Both should be same version (e.g., 0.2.4)

npm install @google/adk@0.2.4
```

## Additional Issue: Template Variables in System Prompt

### Symptom

```
{"error":"Context variable not found: `business_name`."}
```

### Cause

System prompts with `{variable}` syntax may be interpreted by Gemini as context variable references.

### Solution

Don't use template variables in system prompts. Instead, instruct the agent to discover context via tools:

```typescript
// BAD - template variable
instruction: `You are a booking agent for {business_name}...`;

// GOOD - tool-based discovery
instruction: `At the start of every conversation, use get_business_info to learn about the business...`;
```

## Prevention Strategies

1. **Isolate agent code from the start** - Keep agent deployment packages in separate directories
2. **Test `adk run` locally first** - If it loads, deployment will work
3. **Pin ADK versions** - Use exact versions in both agent and devtools
4. **Avoid template variables** - Use tools for dynamic context

## Key Insight

> **ADK deployment requires physical isolation, not just logical isolation.**
>
> Your agent can correctly use HTTP to call your backend (good architecture), but the bundler doesn't know that. It sees `import` statements and follows them all.

## Files Involved

- `server/src/agent-v2/deploy/booking/` - Standalone deployment package
- `server/src/agent-v2/agents/booking/` - Original agent code (reference only)

## Related Documentation

- [Google ADK Documentation](https://cloud.google.com/vertex-ai/docs/agent-builder/adk)
- `plans/VERTEX-AI-EXECUTION-PLAN.md` - Master implementation plan
- `plans/VERTEX-AI-SESSION-STATUS.md` - Current progress

## Status

**RESOLVED** - Agent successfully deployed to Cloud Run using standalone package pattern.

Service URL: `https://booking-agent-506923455711.us-central1.run.app`
