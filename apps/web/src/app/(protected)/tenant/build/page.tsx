import { redirect } from 'next/navigation';

/**
 * Build Mode Redirect
 *
 * Legacy /tenant/build URL now redirects to the unified dashboard with preview.
 * The agent-first architecture consolidates Build Mode into the main dashboard,
 * where the agent can trigger preview mode dynamically.
 *
 * @see components/dashboard/ContentArea.tsx for preview rendering
 * @see stores/agent-ui-store.ts for view state management
 */
export default function BuildModeRedirect() {
  redirect('/tenant/dashboard?showPreview=true');
}
