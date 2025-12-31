# P3: Error Message Consistency in Agent System

## Status

**COMPLETE** - 2025-12-29

## Priority

**P3 - Minor (Code Quality)**

## Summary

Standardized error messages across the agent system to be user-friendly for chatbot responses. Created a structured error class hierarchy with error codes for programmatic handling and localization support.

## Changes Made

### 1. Created AgentError Class Hierarchy

**Files:**

- `server/src/agent/errors/agent-error.ts` (new)
- `server/src/agent/errors/index.ts` (new)

**Error Classes:**

- `AgentError` - Base class with code, userMessage, and details
- `MissingFieldError` - For missing required fields
- `ResourceNotFoundError` - For resources not found (with tenant isolation context)
- `DateUnavailableError` - For date availability issues (booked, blocked, past)
- `InvalidStateError` - For invalid state transitions
- `UnknownToolError` - For unknown tool requests
- `ConfigurationError` - For configuration issues
- `ApiError` - For API failures
- `ValidationError` - For validation failures

**Error Codes:**

- MISSING_FIELD, INVALID_FORMAT, INVALID_DATE, INVALID_EMAIL
- NOT_FOUND, PERMISSION_DENIED, RESOURCE_INACTIVE, TENANT_NOT_FOUND
- DATE_UNAVAILABLE, DATE_BLOCKED, DATE_IN_PAST, ALREADY_BOOKED
- ALREADY_CANCELLED, ALREADY_REFUNDED, INVALID_STATE
- TOOL_UNKNOWN, API_ERROR, CONFIGURATION_ERROR, UNEXPECTED_ERROR

### 2. Updated Error Messages in Key Files

**server/src/agent/executors/index.ts:**

- `'Package name/title is required'` -> `MissingFieldError('name', 'package')`
- `'Package price is required'` -> `MissingFieldError('price', 'package')`
- Package not found errors -> `ResourceNotFoundError('package', id, suggestion)`
- Booking not found errors -> `ResourceNotFoundError('booking', id, suggestion)`
- Date already booked -> `DateUnavailableError(date, 'booked', suggestion)`
- Date blocked -> `DateUnavailableError(date, 'blocked', suggestion)`
- Already cancelled -> `InvalidStateError('booking', status, 'cancel')`
- Already refunded -> `InvalidStateError('booking', 'fully refunded', 'process refund')`
- Stripe not configured -> `ConfigurationError('Payment processing', suggestion)`

**server/src/agent/customer/customer-tools.ts:**

- `'Failed to load services'` -> `ErrorMessages.LOAD_SERVICES`
- `'Service not found'` -> `ErrorMessages.SERVICE_NOT_FOUND`
- `'Failed to check availability'` -> `ErrorMessages.CHECK_AVAILABILITY`
- `'Service not found or unavailable'` -> `ErrorMessages.SERVICE_UNAVAILABLE`
- `'Cannot book dates in the past'` -> User-friendly message
- `'Business information not found'` -> `ErrorMessages.BUSINESS_INFO`

**server/src/agent/orchestrator/orchestrator.ts:**

- `'Unknown tool'` -> User-friendly message

**server/src/agent/customer/customer-orchestrator.ts:**

- `'Unknown tool'` -> User-friendly message

**server/src/agent/customer/customer-booking-executor.ts:**

- Service errors -> `ResourceNotFoundError`
- Date errors -> `DateUnavailableError`
- Customer errors -> `ResourceNotFoundError`

### 3. Error Message Format

All error messages now follow the pattern: "Unable to [action]: [reason]"

Examples:

- "Unable to create package: name is required."
- "Unable to find package: it may not exist or you may not have access."
- "Unable to book a past date. Please choose an upcoming date."
- "Unable to cancel: this booking is already cancelled."

## Design Principles Applied

1. **User-friendly messages** - Non-technical language suitable for chatbot responses
2. **Technical details preserved** - Stored in `error.cause` or logged
3. **Consistent format** - "Unable to [action]: [reason]"
4. **Error codes** - For programmatic handling and future localization
5. **Helpful suggestions** - Guide users to the correct action

## Files Modified

- `server/src/agent/errors/agent-error.ts` (created)
- `server/src/agent/errors/index.ts` (created)
- `server/src/agent/executors/index.ts`
- `server/src/agent/customer/customer-tools.ts`
- `server/src/agent/orchestrator/orchestrator.ts`
- `server/src/agent/customer/customer-orchestrator.ts`
- `server/src/agent/customer/customer-booking-executor.ts`

## Verification

- TypeScript typecheck passes
- Error classes properly exported and imported
- Backward compatible - existing error handling still works

## Tags

errors, consistency, agent, ux, i18n
