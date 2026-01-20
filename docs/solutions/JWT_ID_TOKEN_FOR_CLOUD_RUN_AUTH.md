# JWT ID Token for Cloud Run Authentication from Render

## Problem

Cloud Run agents require identity tokens for authentication. On Render/non-GCP environments:

- No Application Default Credentials (ADC) available
- No `gcloud` CLI available
- `GoogleAuth.getIdTokenClient(audience).getRequestHeaders()` returns empty headers for service accounts

### Symptoms

```
[VertexAgent] No identity token available - Cloud Run calls will be unauthenticated
/bin/sh: 1: gcloud: not found
```

Agent chat shows "That didn't work" because Cloud Run rejects unauthenticated requests.

## Root Cause

The `GoogleAuth({ credentials })` approach initializes correctly, but `getIdTokenClient(audience)` doesn't properly generate ID tokens using the service account's private key. The method silently returns empty headers instead of throwing an error.

## Solution

Use `JWT.fetchIdToken()` directly with service account credentials:

```typescript
import { GoogleAuth, JWT } from 'google-auth-library';

export class VertexAgentService {
  private auth: GoogleAuth;
  private serviceAccountCredentials: { client_email: string; private_key: string } | null = null;

  constructor() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.auth = new GoogleAuth({ credentials });
        // Store credentials for JWT-based ID token generation
        this.serviceAccountCredentials = {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        };
        logger.info('[VertexAgent] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON');
      } catch (e) {
        logger.error({ error: e }, '[VertexAgent] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
        this.auth = new GoogleAuth();
      }
    } else {
      this.auth = new GoogleAuth();
    }
  }

  private async getIdentityToken(): Promise<string | null> {
    // Priority 1: JWT with service account (Render/production)
    if (this.serviceAccountCredentials) {
      try {
        const jwtClient = new JWT({
          email: this.serviceAccountCredentials.client_email,
          key: this.serviceAccountCredentials.private_key,
        });
        const idToken = await jwtClient.fetchIdToken(CLOUD_RUN_URL);
        if (idToken) {
          logger.info('[VertexAgent] Got identity token via JWT (service account)');
          return idToken;
        }
      } catch (e) {
        logger.warn(
          { error: e instanceof Error ? e.message : String(e) },
          '[VertexAgent] JWT fetchIdToken failed'
        );
      }
    }

    // Priority 2: GoogleAuth ADC (GCP environments)
    // Priority 3: gcloud CLI (local development)
    // ... fallback code
  }
}
```

## Key Points

1. **`JWT.fetchIdToken(audience)`** is the correct method for generating ID tokens from service accounts
2. Store credentials separately from `GoogleAuth` for JWT use
3. The target `audience` must match the Cloud Run service URL exactly
4. Priority order: JWT → GoogleAuth → gcloud CLI

## Verification

Logs should show:

```
[VertexAgent] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON  (at startup)
[VertexAgent] Got identity token via JWT (service account)  (for each request)
```

## Environment Variables

- `GOOGLE_SERVICE_ACCOUNT_JSON`: Plain JSON service account key (not base64)
- Service account needs `roles/run.invoker` on the Cloud Run services

## Related Files

- `server/src/services/vertex-agent.service.ts` - Backend service calling Cloud Run
- `server/src/llm/vertex-client.ts` - Similar pattern for Vertex AI API auth (uses temp file)

## See Also

- [ADK A2A Prevention Index](patterns/ADK_A2A_PREVENTION_INDEX.md) - Pitfall #36: Identity token auth
- [Google Auth Library Docs](https://github.com/googleapis/google-auth-library-nodejs)
