---
status: pending
priority: p2
issue_id: '11074'
tags: [code-review, security]
pr: 68
---

# F-010: No Password Maximum Length — bcrypt DoS Vector

## Problem Statement

The signup route does not enforce a maximum password length. bcrypt has O(n) cost with input length, and extremely long passwords (e.g., 1MB+) can cause CPU-bound denial of service by tying up the event loop during hashing.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/routes/auth-signup.routes.ts:62-63`
- **Impact:** An attacker can submit arbitrarily long passwords to exhaust server CPU. This is a well-known bcrypt DoS vector that can degrade or crash the service.

## Proposed Solution

Add a maximum password length check (128 characters) before the bcrypt hash call. Reject passwords exceeding this limit with a 400 response. This limit is generous for any real password while blocking abuse.

## Effort

Small

## Acceptance Criteria

- [ ] Passwords longer than 128 characters are rejected with a 400 error before hashing
- [ ] The Zod schema or route handler enforces `password.max(128)`
- [ ] Add a test confirming oversized passwords are rejected
- [ ] Existing password tests continue to pass
