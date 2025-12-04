/**
 * DashboardHeader Component
 *
 * Displays the dashboard title and description
 */
export function DashboardHeader() {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">System Overview</h1>
        <p className="text-neutral-600 mt-1">
          Manage all tenants and monitor platform-wide metrics
        </p>
      </div>
    </div>
  );
}
