---
issue_id: 11054
status: pending
priority: p2
tags: [performance, caching, availability]
effort: Medium
---

# P2: In-Memory Availability Cache Is Unbounded and Per-Replica

## Problem Statement

The in-memory availability cache has no TTL configuration and is unbounded in size. On multi-replica deployments, each replica maintains its own independent cache, causing inconsistent availability responses — one replica may return stale cached data while another returns fresh data. This leads to phantom availability inconsistencies that are hard to debug.

## Findings

- The availability cache is implemented as an in-memory store (Map or similar).
- No maximum size or TTL is configured — entries accumulate indefinitely until process restart.
- Under horizontal scaling (multiple Cloud Run instances), each replica has its own isolated cache.
- A booking confirmed on replica A invalidates that replica's cache, but replica B still serves stale availability data.
- This can cause double-booking exposure in high-traffic scenarios despite the advisory lock protection at write time.

## Proposed Solutions

Option A (preferred): Move the availability cache to Redis. Use the existing Redis infrastructure. Key format: `tenant:{tenantId}:availability:{date}`. Set TTL appropriate for availability data (e.g., 5 minutes). This provides a single consistent cache across all replicas.

Option B (fallback if Redis migration is blocked): Add TTL-based eviction and a maximum size cap to the in-memory cache. Implement LRU eviction. This does not fix the cross-replica inconsistency but prevents memory leaks.

Recommended: Option A. The Redis infrastructure is already present; this is a targeted migration of one cache.

## Acceptance Criteria

- [ ] Availability cache is backed by Redis (or has documented TTL + size bounds if Redis migration deferred).
- [ ] Cache entries expire after a configured TTL (default: 5 minutes).
- [ ] Cache is consistent across all replicas (all read from and write to the same Redis instance).
- [ ] Cache keys include `tenantId` for multi-tenant isolation.
- [ ] Cache is invalidated on booking creation/cancellation for the affected date/tenant.
- [ ] Tests verify cache hit, miss, and invalidation behavior.

## Work Log

_(empty)_
