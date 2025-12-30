/**
 * Proposal Executor Registry
 *
 * Centralized registry for proposal executors.
 * Extracted to its own module to avoid circular dependencies between:
 * - agent.routes.ts (needs AgentOrchestrator)
 * - orchestrator.ts (needs getProposalExecutor)
 * - executors/index.ts (needs registerProposalExecutor)
 */

/**
 * Type for proposal executor functions
 */
export type ProposalExecutor = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/**
 * Registry map - stores tool name -> executor function
 */
const proposalExecutors = new Map<string, ProposalExecutor>();

/**
 * Register a proposal executor for a tool
 * Called by executors/index.ts during initialization
 */
export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void {
  proposalExecutors.set(toolName, executor);
}

/**
 * Get executor for a tool name
 * Used by orchestrator to execute T2 soft-confirmed proposals
 */
export function getProposalExecutor(toolName: string): ProposalExecutor | undefined {
  return proposalExecutors.get(toolName);
}
