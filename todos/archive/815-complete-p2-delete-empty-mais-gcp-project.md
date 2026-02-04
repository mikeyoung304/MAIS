---
status: pending
priority: p2
issue_id: 815
tags: [code-review, devops, cleanup, gcp]
dependencies: []
---

# Delete Empty MAIS GCP Project (mais-480019)

## Problem Statement

Two GCP projects exist for MAIS/HANDLED, but only one has any services deployed:

| Project     | ID             | Cloud Run Services             | Status            |
| ----------- | -------------- | ------------------------------ | ----------------- |
| **Handled** | handled-484216 | 3 (customer, tenant, research) | ACTIVE - Use this |
| **MAIS**    | mais-480019    | 0                              | EMPTY - Delete    |

The empty project causes confusion and could lead to accidental deployments to the wrong project.

**Why it matters:**

- Developer confusion: "Which project do I deploy to?"
- Potential billing confusion if services ever get deployed here
- Zero references in codebase - serves no purpose

## Findings

**From GCP Agent:**

> Comprehensive search results:
>
> - `mais-480019` in code: 0 matches (only in failure report)
> - `handled-484216`: 35 matches (all documented deployment configs)
> - No hardcoded project references that would break

**All deployments use `handled-484216`:**

```yaml
# .github/workflows/deploy-agents.yml (line 39)
env:
  GOOGLE_CLOUD_PROJECT: handled-484216
```

```json
// All agent package.json deploy scripts use fallback:
"deploy": "npx adk deploy cloud_run --project=${GOOGLE_CLOUD_PROJECT:-handled-484216}"
```

**Verification commands:**

```bash
# Verify no services in MAIS project
gcloud run services list --region=us-central1 --project=mais-480019
# Expected: "No services found in location"

# Verify active services in Handled project
gcloud run services list --region=us-central1 --project=handled-484216
# Expected: customer-agent, tenant-agent, research-agent
```

## Proposed Solutions

### Option A: Delete Project via GCP Console (Recommended)

**Pros:**

- Clean removal
- No confusion going forward
- Frees up project ID for potential future use

**Cons:**

- Requires GCP Owner permissions
- 30-day recovery period

**Effort:** Small (10 minutes)
**Risk:** Low (nothing depends on it)

**Steps:**

1. Go to GCP Console → IAM & Admin → Manage Resources
2. Select `mais-480019`
3. Click "Delete" → Confirm project ID
4. Project enters 30-day shutdown period
5. After 30 days, fully deleted

### Option B: Keep as Staging/Test Project

**Pros:**

- Available for future staging environment
- No deletion action required

**Cons:**

- Continues to cause confusion
- May incur costs if accidentally used

**Effort:** Zero
**Risk:** Medium (confusion persists)

## Recommended Action

Implement Option A. The project has:

- Zero services
- Zero code references
- Zero workflows pointing to it
- Only risk: confusion about which project to use

## Technical Details

**Code references to update: NONE**

All code already uses `handled-484216` exclusively via:

- Environment variable `GOOGLE_CLOUD_PROJECT`
- Fallback in package.json deploy scripts
- GitHub Actions workflow env section

**Post-deletion verification:**

```bash
# Should fail with "project not found" after 30 days
gcloud projects describe mais-480019

# Should still work
gcloud run services list --project=handled-484216
```

## Acceptance Criteria

- [ ] Project `mais-480019` deleted from GCP (or in 30-day shutdown)
- [ ] All team members notified of single-project setup
- [ ] Documentation updated if any references exist
- [ ] Deployment continues to work on `handled-484216`

## Work Log

| Date       | Action            | Learnings                                 |
| ---------- | ----------------- | ----------------------------------------- |
| 2026-02-01 | GCP investigation | MAIS project has zero services, zero refs |
| 2026-02-01 | Codebase search   | All deployments use handled-484216        |

## Resources

- [Failure Report](docs/reports/2026-02-01-agent-testing-failure-report.md) - GCP Finding
- [SERVICE_REGISTRY.md](server/src/agent-v2/deploy/SERVICE_REGISTRY.md)
- [Deploy Agents Workflow](.github/workflows/deploy-agents.yml)
