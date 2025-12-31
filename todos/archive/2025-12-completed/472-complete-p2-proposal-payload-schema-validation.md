# P2: Proposal Payload Schema Validation

## Status

**COMPLETE** - 2025-12-29

## Priority

**P2 - Important**

## Description

The T2 proposal execution retrieves payload from the database and passes it directly to executors without validating its schema. If the payload was corrupted or maliciously modified, the executor could fail unpredictably or cause security issues.

## Solution Implemented

### Created executor-schemas.ts with Zod Schemas for All Executors

**File:** `server/src/agent/proposals/executor-schemas.ts`

Defined comprehensive Zod schemas for all 18+ executor payloads:

- **Package operations:** `UpsertPackagePayloadSchema`, `DeletePackagePayloadSchema`
- **Blackout operations:** `ManageBlackoutPayloadSchema`, `AddBlackoutDatePayloadSchema`, `RemoveBlackoutDatePayloadSchema`
- **Branding operations:** `UpdateBrandingPayloadSchema`, `UpdateLandingPagePayloadSchema`
- **Add-on operations:** `UpsertAddonPayloadSchema`, `DeleteAddonPayloadSchema`
- **Booking operations:** `CancelBookingPayloadSchema`, `CreateBookingPayloadSchema`, `UpdateBookingPayloadSchema`, `ProcessRefundPayloadSchema`
- **Segment operations:** `UpsertSegmentPayloadSchema`, `DeleteSegmentPayloadSchema`
- **Tenant settings:** `UpdateDepositSettingsPayloadSchema`, `StartTrialPayloadSchema`, `InitiateStripeOnboardingPayloadSchema`
- **Customer-facing (T3):** `CreateCustomerBookingPayloadSchema`

Key features:

- Schema registry for dynamic validation
- `validateExecutorPayload()` function for consistent validation
- Backward compatibility: accepts both old and new field names (e.g., `title`/`name`, `priceCents`/`basePrice`)
- Falls back gracefully if no schema is registered (for new executors)

### Added Validation at 3 Entry Points

1. **orchestrator.ts** (T2 soft-confirm execution)
   - Validates before executing T2 soft-confirmed proposals
   - On validation failure: logs error, marks proposal as FAILED, adds to failedProposals list

2. **agent.routes.ts** (T3 explicit confirmation)
   - Validates before executing admin proposals
   - On validation failure: returns 400 with descriptive error message

3. **public-customer-chat.routes.ts** (Customer T3 booking confirmation)
   - Validates before executing customer booking proposals
   - On validation failure: returns 400 with user-friendly error

## Code Pattern

```typescript
// Validate payload schema before execution (prevents malformed/malicious payloads)
const rawPayload = (proposal.payload as Record<string, unknown>) || {};
let validatedPayload: Record<string, unknown>;
try {
  validatedPayload = validateExecutorPayload(proposal.toolName, rawPayload);
} catch (validationError) {
  const errorMessage =
    validationError instanceof Error ? validationError.message : String(validationError);
  logger.error(
    { proposalId, toolName: proposal.toolName, error: errorMessage },
    'Proposal payload validation failed'
  );
  // Handle failure (mark as failed, return error, etc.)
}
```

## Files Modified

- `server/src/agent/proposals/executor-schemas.ts` (NEW - 390+ lines)
- `server/src/agent/orchestrator/orchestrator.ts` (added import + validation)
- `server/src/routes/agent.routes.ts` (added import + validation)
- `server/src/routes/public-customer-chat.routes.ts` (added import + validation)

## Verification

- TypeScript typecheck passes: `npm run typecheck`
- All schemas tested against actual executor payload shapes
- Backward compatibility ensured with `.refine()` for field alternatives

## Impact

- **Reliability**: Clear validation errors instead of runtime crashes
- **Security**: Malformed/malicious payloads rejected before execution
- **Debugging**: Structured error messages with specific field failures
- **Observability**: Validation failures logged for monitoring

## Tags

validation, agent, proposal, zod, executor, security
