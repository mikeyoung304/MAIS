# Deferred Items

Simple tracking for items intentionally deferred. Review monthly (15 min).

## Active Deferrals

| TODO | Description | Reason | Revisit Trigger | Next Review |
|------|-------------|--------|-----------------|-------------|
| 155 | BookingService refactor | Tests pass, working fine | Service > 2000 LOC or causes bugs | 2026-01-23 |
| 197 | Audit logging add-ons | YAGNI | Compliance requirement | 2026-01-23 |
| 226 | Analytics tracking | No provider selected | Analytics provider decision | 2026-01-23 |
| 280 | Slot optimization | No performance issue | P99 > 100ms in production | 2026-01-23 |
| 281 | Recurring appointments | Feature not requested | 3 customer requests | 2026-01-23 |
| 282 | Group classes | Feature not requested | 3 customer requests | 2026-01-23 |
| 283 | Prepaid packages | Feature not requested | 3 customer requests | 2026-01-23 |
| 285 | SMS reminders | Feature not requested | 3 customer requests | 2026-01-23 |
| 286 | Intake forms | Feature not requested | 3 customer requests | 2026-01-23 |

## Monthly Review Process

1. Check each trigger condition
2. If triggered: move to active sprint
3. If 6+ months without activity: consider closing as WONTFIX
4. Update "Next Review" date

## Closed Items

| TODO | Closed Date | Reason |
|------|-------------|--------|
| 012 | 2025-12-23 | WONTFIX - zero business value |
| 220 | 2025-12-23 | WONTFIX - no infrastructure |
| 287 | 2025-12-23 | WONTFIX - duplicate of 155 |
