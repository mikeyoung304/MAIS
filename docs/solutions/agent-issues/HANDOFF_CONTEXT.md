# Handoff Context: GCP Deployment Permission Issue

**Date:** 2026-01-27
**Status:** ✅ RESOLVED (2026-01-27 ~21:45 UTC)
**Issue:** GitHub Actions workflow failing to deploy AI agents to Cloud Run with PERMISSION_DENIED

## ✅ Resolution Summary

The deployment now works! The root cause was **missing IAM permissions** for the `github-actions-deploy` service account. ADK's `deploy cloud_run` uses Cloud Build for source-based deployments, which requires multiple roles beyond just Cloud Run Admin.

**Required IAM Roles (all 6 needed):**

1. Artifact Registry Writer - Write container images
2. Cloud Build Service Account - Trigger builds
3. Cloud Run Admin - Deploy to Cloud Run
4. Service Account User - Run as service account
5. **Service Usage Consumer** - Consume GCP services (THIS WAS THE FINAL MISSING PIECE)
6. Storage Admin - Access build artifacts

**Successful deployment:**

- Workflow run: https://github.com/mikeyoung304/MAIS/actions/runs/21412493727
- New revision: `concierge-agent-00016-9ks`
- Service URL: https://concierge-agent-506923455711.us-central1.run.app

---

## ⚠️ CRITICAL: Changes Made to Google Cloud Console

### IAM Role Change #1 (2026-01-27 ~20:58 UTC)

**What was changed:**
| Action | Role | Service Account |
|--------|------|-----------------|
| ❌ REMOVED | `Cloud Run Developer` | `github-actions-deploy@handled-484216.iam.gserviceaccount.com` |
| ✅ ADDED | `Cloud Run Admin` | `github-actions-deploy@handled-484216.iam.gserviceaccount.com` |

**How it was changed:**

1. Navigated to GCP Console → IAM & Admin → IAM
2. Located the service account `github-actions-deploy@handled-484216.iam.gserviceaccount.com`
3. Clicked the edit (pencil) icon
4. In the role picker, searched for "Cloud Run Admin"
5. Selected `Cloud Run Admin` (which auto-removed `Cloud Run Developer`)
6. Clicked "Save"
7. GCP showed confirmation: "Policy updated. It may take a few minutes for these changes to become active."

**Result:** Workflow still failed with PERMISSION_DENIED (3 re-runs attempted)

---

### IAM Role Change #2 (2026-01-27 ~21:15 UTC)

**What was changed:**
| Action | Role | Service Account |
|--------|------|-----------------|
| ✅ ADDED | `Cloud Build Service Account` (`roles/cloudbuild.builds.builder`) | `github-actions-deploy@handled-484216.iam.gserviceaccount.com` |

**How it was changed:**

1. Navigated to GCP Console → IAM & Admin → IAM
2. Located the service account `github-actions-deploy@handled-484216.iam.gserviceaccount.com`
3. Clicked the edit (pencil) icon
4. Clicked "Add another role"
5. Searched for "Cloud Build"
6. Selected `Cloud Build Service Account` - "Can perform builds"
7. Clicked "Save"
8. GCP showed confirmation: "Policy updated. It may take a few minutes for these changes to become active."

**Rationale:** ADK's `deploy cloud_run` uses source-based deployment, which creates a Dockerfile and invokes Cloud Build to build the container image. Without `roles/cloudbuild.builds.builder`, the service account cannot trigger builds.

**Result:** Workflow progressed further but failed with a NEW error requesting `roles/serviceusage.serviceUsageConsumer`

---

### IAM Role Change #3 (2026-01-27 ~21:45 UTC)

**What was changed:**
| Action | Role | Service Account |
|--------|------|-----------------|
| ✅ ADDED | `Service Usage Consumer` (`roles/serviceusage.serviceUsageConsumer`) | `github-actions-deploy@handled-484216.iam.gserviceaccount.com` |

**How it was changed:**

1. Navigated to GCP Console → IAM & Admin → IAM
2. Located the service account `github-actions-deploy@handled-484216.iam.gserviceaccount.com`
3. Clicked the edit (pencil) icon
4. Clicked "Add another role" (Role 6 slot appeared)
5. Searched for "Service Usage Consumer"
6. Selected `Service Usage Consumer` - "Ability to inspect service states and operations, and consume quota and billing for a consumer project"
7. Clicked "Save"
8. GCP showed confirmation: "Policy updated. It may take a few minutes for these changes to become active."

**Rationale:** The Cloud Build process failed with:

```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: Build failed because the default service account is missing required IAM permissions...
Grant the caller the roles/serviceusage.serviceUsageConsumer role, or a custom role with the serviceusage.services.use permission
```

**What was NOT changed:**

- Other IAM roles were NOT modified
- No service accounts were deleted or created
- No Workload Identity Pool configurations were modified
- No secrets were changed in GitHub

### Things to Question (for the next agent)

1. **Was the IAM change actually saved?** - The GCP Console showed a confirmation, but you should verify by checking current IAM bindings
2. **Is IAM propagation complete?** - GCP says 7-10 minutes, but could be longer
3. **Is Cloud Run Admin the right role?** - Maybe the error is about a DIFFERENT permission entirely
4. **Is the service account correct?** - Verify `GCP_SERVICE_ACCOUNT` secret matches `github-actions-deploy@handled-484216.iam.gserviceaccount.com`
5. **Is Workload Identity Federation configured correctly?** - The auth step might succeed but with limited permissions

---

## Current State

The GitHub Actions workflow `deploy-agents.yml` is failing at the "Deploy agent to Cloud Run" step with:

```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: The caller does not have permission.
```

### What's Been Done

1. **Fixed .env creation in CI** - Workflow now creates `.env` from GitHub Secrets ✅
   - Before: `[dotenv@17.2.3] injecting env (0) from .env`
   - After: `[dotenv@17.2.3] injecting env (5) from .env`

2. **Added revision verification** - Workflow now detects silent failures ✅
   - Compares Cloud Run revision before/after deployment
   - Exits with code 1 if no new revision created

3. **Changed IAM role via GCP Console** ✅
   - Service Account: `github-actions-deploy@handled-484216.iam.gserviceaccount.com`
   - Changed: `Cloud Run Developer` → `Cloud Run Admin`
   - Change was saved successfully in GCP Console (see detailed change log above)

4. **Re-ran workflow 3 times** - All failed with same PERMISSION_DENIED error ❌

### Current IAM Roles (Updated 2026-01-27 ~21:45 UTC)

For `github-actions-deploy@handled-484216.iam.gserviceaccount.com`:

- Artifact Registry Writer
- Cloud Build Service Account (added 2026-01-27 ~21:15 UTC)
- Cloud Run Admin (added 2026-01-27 ~20:58 UTC)
- Service Account User
- **Service Usage Consumer** (added 2026-01-27 ~21:45 UTC) ← NEW
- Storage Admin

**⚠️ Note:** These are the roles that SHOULD be assigned based on the changes made. Verify actual roles with:

```bash
gcloud projects get-iam-policy handled-484216 \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:github-actions-deploy@handled-484216.iam.gserviceaccount.com"
```

### Workflow Authentication Method

The workflow uses **Workload Identity Federation** (not a service account key):

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
```

---

## Next Steps to Debug

### 1. Check IAM Propagation (Wait 10+ min)

GCP IAM changes can take up to 10 minutes to propagate. Try re-running the workflow after waiting.

### 2. Add Cloud Build Permissions

ADK's `deploy cloud_run` uses Cloud Build under the hood. The service account may need:

```bash
gcloud projects add-iam-policy-binding handled-484216 \
  --member="serviceAccount:github-actions-deploy@handled-484216.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

### 3. Check Workload Identity Pool Bindings

The WIF pool may not allow impersonating the service account for all operations:

```bash
# List Workload Identity Pool bindings
gcloud iam workload-identity-pools describe github-pool \
  --project=handled-484216 \
  --location=global

# Check the provider configuration
gcloud iam workload-identity-pools providers describe github-provider \
  --project=handled-484216 \
  --location=global \
  --workload-identity-pool=github-pool
```

### 4. Check What `gcloud run deploy --source` Needs

Cloud Run source deployments specifically require:

- `roles/run.admin` (have this)
- `roles/iam.serviceAccountUser` (have this)
- `roles/cloudbuild.builds.builder` (might be missing)
- `roles/artifactregistry.writer` (have this)
- Permission to use the Cloud Build service account

### 5. Manual Deploy Test

Test if manual deployment works from local machine with the service account:

```bash
cd server/src/agent-v2/deploy/concierge
npm run deploy
```

If this works but CI doesn't, the issue is specifically with Workload Identity Federation.

---

## Key Files

- **Workflow:** `.github/workflows/deploy-agents.yml`
- **Documentation:** `docs/solutions/agent-issues/AGENT_FAILURES.md`
- **Agent code:** `server/src/agent-v2/deploy/concierge/`

## GitHub Actions Run

- Workflow: "Deploy AI Agents to Cloud Run"
- Run #18, Attempt #3 (all failed)
- URL: https://github.com/mikeyoung304/MAIS/actions/runs/21411903513

## GCP Project

- Project ID: `handled-484216`
- Project Number: `506923455711`
- Region: `us-central1`
- Service Account: `github-actions-deploy@handled-484216.iam.gserviceaccount.com`

---

## Prompt for Next Session

Copy this to start a fresh context:

```
I'm debugging a GitHub Actions workflow that deploys AI agents to Google Cloud Run. The deployment is failing with PERMISSION_DENIED even after adding the Cloud Run Admin IAM role.

Please read these files to understand the situation:
1. docs/solutions/agent-issues/AGENT_FAILURES.md - Full investigation details
2. .github/workflows/deploy-agents.yml - The workflow configuration

The issue is that even with Cloud Run Admin role on the service account, the workflow still fails with:
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: The caller does not have permission.

The workflow uses Workload Identity Federation (google-github-actions/auth@v2), not a service account key.

Current IAM roles for github-actions-deploy@handled-484216.iam.gserviceaccount.com:
- Artifact Registry Writer
- Cloud Run Admin (just added ~15 min ago)
- Service Account User
- Storage Admin

Please help investigate what additional permissions or configurations are needed.
```
