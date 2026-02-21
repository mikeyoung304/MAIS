---
status: pending
priority: p3
issue_id: '11094'
tags: [code-review, security]
pr: 68
---

# F-030: Build error messages exposed to frontend without sanitization

## Problem Statement

When background build fails, the raw error message is stored and returned to the frontend via the build status API. Internal error details (stack traces, database errors, file paths) could leak to the client, exposing implementation details that aid attackers.

## Location

`server/src/services/background-build.service.ts:529`

## Proposed Solution

1. Sanitize error messages before storing in the build status record — map known errors to user-friendly messages.
2. Store the full error in server logs (already happening via logger).
3. Return only a generic "Build failed — please try again or contact support" to the frontend, with a correlation ID for debugging.
4. Optionally, maintain an error code enum for known failure modes so the frontend can show contextual help.

## Effort

Small-Medium — ~1-2 hours. Add error sanitization layer, update status response type.
