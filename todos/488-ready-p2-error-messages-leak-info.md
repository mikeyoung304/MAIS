# P2: Error Messages May Leak Resource Existence Information

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Security Issue**

## Description

Error messages in executors include entity IDs and specific guidance that could help attackers enumerate valid resource IDs. Messages distinguish between "not found" and "access denied", confirming whether an ID exists.

## Location

- `server/src/agent/executors/index.ts` (lines 72-73, 128-133, 197-202, 475-479, 543-548)

## Current Code

```typescript
throw new Error(
  `${modelName} "${id}" not found or you do not have permission to access it. Verify the ${model} ID belongs to your business.`
);
```

## Expected Code

```typescript
throw new ResourceNotFoundError(modelName, id, 'Please check the ID and try again.');
// Generic message that doesn't confirm existence
```

## Impact

- **Security**: Information disclosure about valid resource IDs
- **Enumeration**: Attackers could probe different IDs to build lists
- **Privacy**: Confirms existence of resources

## Fix Steps

1. Use generic error messages that don't distinguish not-found from access-denied
2. Log detailed errors for debugging but don't expose to user
3. Use consistent error format across all executors
4. Review all error messages for information leakage

## Related Files

- `server/src/agent/errors/agent-error.ts` - Error class definitions
- `server/src/agent/customer/customer-tools.ts` - Customer-facing errors

## Testing

- Probe with valid ID from different tenant
- Probe with invalid ID
- Verify error messages are identical

## Tags

security, agent, information-disclosure, error-handling, code-review
