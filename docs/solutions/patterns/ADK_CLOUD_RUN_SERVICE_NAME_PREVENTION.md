---
module: MAIS
date: 2026-01-18
problem_type: deployment_conflict
component: agent-v2/deploy
symptoms:
  - Multiple agents deploy to same Cloud Run service
  - Agent deployment overwrites previous agent
  - "Service already exists" errors during deployment
  - Wrong agent serving requests after deployment
root_cause: ADK deploy cloud_run defaults to generic service name when --service_name not specified
resolution_type: prevention_pattern
severity: P1
tags: [google-adk, cloud-run, deployment, multi-agent, service-name, prevention]
---

# ADK Cloud Run Service Name Prevention

**Problem:** The `adk deploy cloud_run` command defaults to a generic service name when `--service_name` is not explicitly specified. In a multi-agent system, this causes deployment conflicts where agents overwrite each other.

**Impact:** P1 - Agent deployments clobber each other, causing production outages and confusion

---

## Root Cause Analysis

When running:

```bash
npx adk deploy cloud_run --project=my-project --region=us-central1
```

Without `--service_name`, ADK uses a default name (typically derived from the directory or a generic name like `adk-agent`). This works fine for single-agent deployments but causes conflicts in multi-agent architectures.

**What happens:**

1. Deploy booking-agent without `--service_name` -> Creates service named `adk-agent`
2. Deploy storefront-agent without `--service_name` -> Overwrites `adk-agent` with storefront code
3. Booking agent is now unreachable

---

## Prevention Strategies

### Strategy 1: Code Review Checklist for ADK Deploy Scripts

Add this checklist item to all agent-related PRs:

```markdown
## ADK Agent Deployment Checklist

- [ ] `--service_name` is EXPLICITLY specified in deploy script
- [ ] Service name follows convention: `{agent-name}-agent`
- [ ] Service name matches agent's purpose (booking, storefront, etc.)
- [ ] deploy:dry-run script includes same `--service_name`
- [ ] No reliance on ADK default service naming
```

**Grep command for CI/review:**

```bash
# Check all agent package.json files for missing --service_name
find server/src/agent-v2/deploy -name "package.json" -exec grep -L "service_name" {} \;

# If any files are returned, they need --service_name added
```

---

### Strategy 2: Agent Package.json Template

Use this template for ALL new agent deployments:

```json
{
  "name": "handled-{AGENT_NAME}-agent",
  "version": "1.0.0",
  "description": "Standalone {Agent Description} Agent for HANDLED - deployed to Vertex AI Agent Engine",
  "main": "dist/agent.js",
  "scripts": {
    "build": "tsc",
    "dev": "npx adk dev",
    "deploy": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={AGENT_NAME}-agent",
    "deploy:dry-run": "npm run build && npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name={AGENT_NAME}-agent --dry-run"
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

**Required substitutions:**

- `{AGENT_NAME}` - lowercase agent identifier (e.g., `booking`, `storefront`, `research`)
- `{Agent Description}` - human-readable description (e.g., `Booking`, `Storefront Specialist`)

---

### Strategy 3: Pre-Deploy Verification Script

Create a validation script at `server/src/agent-v2/scripts/validate-deploy-config.sh`:

```bash
#!/bin/bash
# Validate ADK agent deployment configurations
# Run before any agent deployment

set -e

DEPLOY_DIR="server/src/agent-v2/deploy"
ERRORS=0

echo "Validating ADK agent deployment configurations..."
echo "================================================="

# Check all agent directories
for agent_dir in "$DEPLOY_DIR"/*/; do
    agent_name=$(basename "$agent_dir")
    package_json="$agent_dir/package.json"

    if [ ! -f "$package_json" ]; then
        echo "[SKIP] $agent_name - no package.json found"
        continue
    fi

    echo ""
    echo "Checking: $agent_name"

    # Check 1: --service_name is present in deploy script
    if ! grep -q "service_name=" "$package_json"; then
        echo "  [FAIL] Missing --service_name in deploy script"
        ERRORS=$((ERRORS + 1))
    else
        # Extract and validate service name
        service_name=$(grep -oP 'service_name=\K[^"]+' "$package_json" | head -1)
        echo "  [OK] service_name=$service_name"

        # Check 2: Service name follows convention
        if [[ ! "$service_name" =~ ^[a-z]+-agent$ ]]; then
            echo "  [WARN] Service name should follow pattern: {name}-agent"
        fi
    fi

    # Check 3: dry-run also has service_name
    if grep -q "deploy:dry-run" "$package_json"; then
        if ! grep -A1 "deploy:dry-run" "$package_json" | grep -q "service_name="; then
            echo "  [WARN] deploy:dry-run missing --service_name"
        fi
    fi
done

echo ""
echo "================================================="

if [ $ERRORS -gt 0 ]; then
    echo "[FAILED] Found $ERRORS configuration errors"
    echo ""
    echo "Fix by adding --service_name={agent}-agent to deploy scripts"
    exit 1
else
    echo "[PASSED] All agent configurations valid"
fi
```

**Add to CI pipeline (GitHub Actions):**

```yaml
# .github/workflows/validate-agents.yml
name: Validate Agent Deployments

on:
  pull_request:
    paths:
      - 'server/src/agent-v2/deploy/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate agent deploy configs
        run: bash server/src/agent-v2/scripts/validate-deploy-config.sh
```

---

### Strategy 4: Service Registry Documentation

Maintain a registry of deployed services in `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`:

````markdown
# ADK Agent Service Registry

This document tracks all deployed ADK agent services to prevent naming conflicts.

## Active Services

| Agent Name | Service Name     | Cloud Run URL                                            | Status |
| ---------- | ---------------- | -------------------------------------------------------- | ------ |
| booking    | booking-agent    | https://booking-agent-{project-hash}.{region}.run.app    | Active |
| storefront | storefront-agent | https://storefront-agent-{project-hash}.{region}.run.app | Active |
| marketing  | marketing-agent  | https://marketing-agent-{project-hash}.{region}.run.app  | Active |
| research   | research-agent   | https://research-agent-{project-hash}.{region}.run.app   | Active |

## Naming Convention

- Pattern: `{agent-name}-agent`
- Examples: `booking-agent`, `storefront-agent`, `research-agent`
- Reserved: `adk-agent` (default - DO NOT USE)

## Adding a New Agent

1. Choose unique agent name following pattern
2. Verify name not already in registry above
3. Add to registry BEFORE deploying
4. Use template from `adk-agent-deployment-pattern.md`

## Verification Command

```bash
# List all Cloud Run services
gcloud run services list --region=us-central1 --project=handled-484216

# Verify expected services exist
gcloud run services describe booking-agent --region=us-central1
```
````

```

---

## Quick Reference Checklist

Print and pin this next to the ADK deployment documentation:

```

## ADK Deploy Quick Check

BEFORE adding new agent:
[ ] Unique service name chosen
[ ] Added to SERVICE_REGISTRY.md
[ ] package.json uses --service_name=xxx-agent
[ ] deploy:dry-run uses same --service_name

BEFORE deploying:
[ ] Run validate-deploy-config.sh
[ ] Double-check service_name in package.json
[ ] Verify not overwriting existing service

AFTER deploying:
[ ] Verify correct URL in gcloud output
[ ] Test the deployed endpoint
[ ] Update SERVICE_REGISTRY.md with URL

````

---

## ESLint-Style Automated Detection

While we can't use ESLint for JSON, add this npm script to root package.json:

```json
{
  "scripts": {
    "lint:agents": "node -e \"const fs = require('fs'); const path = require('path'); const dir = 'server/src/agent-v2/deploy'; fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory()).forEach(agent => { const pkg = JSON.parse(fs.readFileSync(path.join(dir, agent, 'package.json'), 'utf8')); const deploy = pkg.scripts?.deploy || ''; if (!deploy.includes('service_name=')) { console.error('ERROR: ' + agent + '/package.json missing --service_name in deploy script'); process.exit(1); } });\""
  }
}
````

Run with: `npm run lint:agents`

---

## Decision Tree

```
Creating new ADK agent?
├── YES
│   ├── Is service_name in deploy script?
│   │   ├── NO → ADD IT: --service_name={name}-agent
│   │   └── YES → Does it follow {name}-agent pattern?
│   │       ├── NO → FIX IT to follow pattern
│   │       └── YES → Is it unique? (check SERVICE_REGISTRY.md)
│   │           ├── NO → CHOOSE different name
│   │           └── YES → PROCEED with deployment
│   └── Added to SERVICE_REGISTRY.md?
│       ├── NO → ADD IT before deploying
│       └── YES → Safe to deploy
└── NO (modifying existing)
    └── Is service_name still present after changes?
        ├── NO → DO NOT remove it!
        └── YES → Safe to proceed
```

---

## Testing Approach

### Unit Test for package.json Validation

```typescript
// server/src/agent-v2/__tests__/deployment-config.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

describe('Agent Deployment Configuration', () => {
  const deployDir = join(__dirname, '../deploy');
  const agents = readdirSync(deployDir)
    .filter((d) => statSync(join(deployDir, d)).isDirectory())
    .filter((d) => !d.includes('node_modules'));

  it.each(agents)('%s has --service_name in deploy script', (agent) => {
    const pkgPath = join(deployDir, agent, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    expect(pkg.scripts?.deploy).toBeDefined();
    expect(pkg.scripts.deploy).toContain('service_name=');
    expect(pkg.scripts.deploy).toMatch(/service_name=[a-z]+-agent/);
  });

  it.each(agents)('%s has --service_name in deploy:dry-run script', (agent) => {
    const pkgPath = join(deployDir, agent, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    if (pkg.scripts?.['deploy:dry-run']) {
      expect(pkg.scripts['deploy:dry-run']).toContain('service_name=');
    }
  });

  it('all agents have unique service names', () => {
    const serviceNames = new Set<string>();

    for (const agent of agents) {
      const pkgPath = join(deployDir, agent, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const match = pkg.scripts?.deploy?.match(/service_name=([a-z-]+)/);

      if (match) {
        const serviceName = match[1];
        expect(serviceNames.has(serviceName)).toBe(false, `Duplicate service name: ${serviceName}`);
        serviceNames.add(serviceName);
      }
    }
  });
});
```

---

## Related Documentation

- [ADK Agent Deployment Pattern](./adk-agent-deployment-pattern.md) - Full deployment pattern
- [ADK Bundler Issue](../integration-issues/adk-cloud-run-bundler-transitive-imports.md) - Transitive import resolution
- [Prevention Quick Reference](../PREVENTION-QUICK-REFERENCE.md) - General prevention patterns

---

## Summary

| Prevention Layer | Implementation            | Catches When       |
| ---------------- | ------------------------- | ------------------ |
| Template         | Package.json template     | Creating new agent |
| Code Review      | Checklist item            | PR review          |
| CI Validation    | validate-deploy-config.sh | Before merge       |
| Unit Tests       | deployment-config.test.ts | Test runs          |
| Registry         | SERVICE_REGISTRY.md       | Planning           |
| npm lint         | lint:agents script        | Local development  |

**Key Rule:** Every `adk deploy cloud_run` command MUST include `--service_name={agent}-agent`.

---

**Last Updated:** 2026-01-18
**Maintainer:** Auto-generated from compound-engineering workflow
