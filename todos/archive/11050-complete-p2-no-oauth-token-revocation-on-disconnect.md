---
issue_id: 11050
status: complete
priority: p2
tags: [security, google-calendar, oauth]
effort: Small
---

# P2: No OAuth Token Revocation on Google Calendar Disconnect

## Problem Statement

When a tenant removes their Google Calendar configuration, the system deletes the credentials locally but does not call Google's token revocation endpoint. The service account or OAuth token remains valid at Google indefinitely. This is a security gap — a leaked or accidentally deleted credential continues to grant access to the tenant's calendar until Google's natural expiry (service accounts do not expire).

## Findings

- The delete calendar config route removes the record from the database.
- No call is made to `https://oauth2.googleapis.com/revoke` or equivalent Google API.
- For service accounts, the session cannot be revoked the same way as OAuth tokens, but the key can be deleted from the Google Cloud Console. The current flow does neither.
- For any OAuth flow credentials, the token should be explicitly revoked.
- This is a defense-in-depth security requirement: credentials should be invalidated at the provider, not just locally.

## Proposed Solutions

On calendar config deletion:

1. For OAuth tokens: call `POST https://oauth2.googleapis.com/revoke?token={access_token}` before deleting the local record.
2. For service accounts: log a structured warning instructing the tenant (or support) to rotate/delete the service account key in Google Cloud Console. (Full programmatic revocation requires Google Admin SDK or Service Account key deletion API.)
3. Clear the Redis token cache for the tenant immediately.
4. Proceed with local deletion regardless of revocation outcome (best-effort, non-blocking on error).

## Acceptance Criteria

- [ ] On calendar config deletion, a token revocation attempt is made to Google.
- [ ] The Redis access token cache for the tenant is cleared on disconnect.
- [ ] Revocation failure is logged as a warning but does not block local deletion.
- [ ] The local credential record is always deleted even if revocation fails.
- [ ] Tests verify cache invalidation and revocation call on disconnect.

## Work Log

- 2026-02-20: Resolved in GoogleCalendarOAuthService.disconnect(). Calls Google revocation endpoint (best-effort), invalidates Redis cache, then clears local tokens.
