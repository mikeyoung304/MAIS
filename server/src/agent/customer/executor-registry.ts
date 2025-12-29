/**
 * Customer Proposal Executor Registry
 *
 * Separate module to avoid circular dependency between executor and routes.
 */

/**
 * Executor for customer booking proposals
 */
export type CustomerProposalExecutor = (
  tenantId: string,
  customerId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/**
 * Registry for customer proposal executors
 */
const customerProposalExecutors = new Map<string, CustomerProposalExecutor>();

/**
 * Register a customer proposal executor
 */
export function registerCustomerProposalExecutor(
  operation: string,
  executor: CustomerProposalExecutor
): void {
  customerProposalExecutors.set(operation, executor);
}

/**
 * Get a registered executor by operation name
 */
export function getCustomerProposalExecutor(
  operation: string
): CustomerProposalExecutor | undefined {
  return customerProposalExecutors.get(operation);
}
