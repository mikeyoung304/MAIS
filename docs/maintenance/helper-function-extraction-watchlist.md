# Helper Function Extraction Watchlist

## Overview

This document tracks helper functions scoped to single files that may benefit from extraction if they grow in complexity or begin appearing in multiple domains. Monitored as part of ongoing code quality and maintainability efforts.

## Watched Functions

### 1. Booking Routes Helper Function

- **File:** `server/src/routes/internal-agent/booking.routes.ts:64`
- **Current Status:** Single-use, domain-specific
- **Complexity:** Simple
- **Extraction Trigger:** Duplication across domains OR growth beyond 20 lines
- **Effort to Extract:** ~15 minutes
- **Related Todo:** #5245 (schema centralization)

### 2. Marketing Routes Helper Function

- **File:** `server/src/routes/internal-agent/marketing.routes.ts:106`
- **Current Status:** Single-use, domain-specific
- **Complexity:** Simple
- **Extraction Trigger:** Duplication across domains OR growth beyond 20 lines
- **Effort to Extract:** ~15 minutes
- **Related Todo:** #5245 (schema centralization)

### 3. [Third Helper Function to be identified]

- **File:** To be documented during code review phases
- **Current Status:** Pending identification
- **Complexity:** TBD
- **Extraction Trigger:** Duplication across domains OR growth beyond 20 lines
- **Effort to Extract:** TBD
- **Related Todo:** #5245 (schema centralization)

## Extraction Criteria

Extract helper functions to shared utilities when:

1. **Duplication Rule:** Function appears in 2+ domains/files
2. **Complexity Rule:** Function exceeds 20 lines of logic
3. **Scope Rule:** Function benefits multiple callers and improves code clarity
4. **Dependencies Rule:** No circular dependencies or excessive coupling introduced

## Extraction Destination

When extraction is warranted:

- **Location:** `server/src/lib/internal-agent-helpers.ts` (or domain-specific utilities)
- **Pattern:** Export as named utility function with clear documentation
- **Testing:** Add unit tests in `server/test/lib/internal-agent-helpers.test.ts`

## Review Schedule

- **Quarterly Review:** Check for duplication or growth
- **Code Review Gate:** Mention in PR reviews if function appears multiple times
- **Refactoring Sprint:** Include in future "code health" sprints if complexity increases

## Related Decisions

- **ADR:** #5245 - Schema Centralization (blocks extraction decisions)
- **Philosophy:** Avoid premature abstraction; extract only when benefit is clear
- **Owner:** Refactoring sprint leads during quarterly reviews

## Last Updated

- **Date:** 2026-02-10
- **By:** Claude Code (documentation-only todo #5259)
- **Next Review:** 2026-05-10 (quarterly)
