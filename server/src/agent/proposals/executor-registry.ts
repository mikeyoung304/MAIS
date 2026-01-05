/**
 * Proposal Executor Registry
 *
 * Centralized registry for proposal executors.
 * Extracted to its own module to avoid circular dependencies between:
 * - agent.routes.ts (needs AgentOrchestrator)
 * - orchestrator.ts (needs getProposalExecutor)
 * - executors/index.ts (needs registerProposalExecutor)
 */

import { logger } from '../../lib/core/logger';

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

/**
 * List of all tools that require registered executors.
 * When a tool is added to the agent system, add it here to ensure
 * the executor registration is validated at startup.
 *
 * IMPORTANT: If you add a new write tool to the agent system,
 * you MUST add its name to this list AND register its executor
 * in executors/index.ts. Otherwise the server will fail to start.
 */
const REQUIRED_EXECUTOR_TOOLS = [
  // Package management
  'upsert_package',
  'delete_package',

  // Add-on management
  'upsert_addon',
  'delete_addon',

  // Booking management
  'create_booking',
  'cancel_booking',
  'update_booking',
  'process_refund',

  // Blackout/availability management
  'add_blackout_date',
  'remove_blackout_date',
  'manage_blackout', // Legacy combined action

  // Segment management
  'upsert_segment',
  'delete_segment',

  // Tenant configuration
  'update_branding',
  'update_landing_page',
  'update_deposit_settings',

  // Onboarding
  'start_trial',
  'initiate_stripe_onboarding',

  // Storefront Build Mode
  'update_page_section',
  'remove_page_section',
  'reorder_page_sections',
  'toggle_page_enabled',
  'update_storefront_branding',
  'publish_draft',
  'discard_draft',

  // Booking link management
  'manage_bookable_service',
  'manage_working_hours',
  'manage_date_overrides',
] as const;

/**
 * Validate that all required tools have registered executors.
 * Call this at server startup AFTER registerAllExecutors().
 *
 * @throws Error if any required executor is missing (fatal startup error)
 */
export function validateExecutorRegistry(): void {
  const missingExecutors = REQUIRED_EXECUTOR_TOOLS.filter(
    (toolName) => !proposalExecutors.has(toolName)
  );

  if (missingExecutors.length > 0) {
    const errorMessage =
      `FATAL: Missing executors for tools: ${missingExecutors.join(', ')}. ` +
      `Add executor registrations in server/src/agent/executors/index.ts`;
    logger.error({ missingExecutors }, errorMessage);
    throw new Error(errorMessage);
  }

  logger.info(
    { count: REQUIRED_EXECUTOR_TOOLS.length },
    'All required tool executors registered successfully'
  );
}

/**
 * Get the list of all tools that should have executors.
 * Useful for documentation and testing.
 */
export function getRequiredExecutorTools(): readonly string[] {
  return REQUIRED_EXECUTOR_TOOLS;
}
