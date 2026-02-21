---
status: pending
priority: p2
issue_id: '11076'
tags: [code-review, security]
pr: 68
---

# F-012: SSRF Protection Misses IPv4-Mapped IPv6 Addresses

## Problem Statement

The SSRF protection in the onboarding intake service checks for private IPv4 ranges but does not account for IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`, `::ffff:10.0.0.1`). An attacker can bypass the SSRF filter by using these mapped addresses to reach internal services.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/onboarding-intake.service.ts:47-58`
- **Impact:** SSRF filter bypass allows an attacker to probe or interact with internal network services, potentially accessing metadata endpoints, databases, or other infrastructure behind the firewall.

## Proposed Solution

Add `::ffff:` prefixed patterns to the SSRF blocklist covering all existing private ranges:

- `::ffff:127.0.0.0/8`
- `::ffff:10.0.0.0/8`
- `::ffff:172.16.0.0/12`
- `::ffff:192.168.0.0/16`

Also consider blocking `::1` (IPv6 loopback) and `fe80::/10` (link-local) if not already covered.

## Effort

Small

## Acceptance Criteria

- [ ] IPv4-mapped IPv6 addresses (`::ffff:` prefix) are blocked for all private ranges
- [ ] IPv6 loopback (`::1`) and link-local (`fe80::/10`) are blocked
- [ ] Add tests confirming `::ffff:127.0.0.1`, `::ffff:10.0.0.1`, `::1` are rejected
- [ ] Existing SSRF tests continue to pass
