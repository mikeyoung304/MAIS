import { redirect } from 'next/navigation';

/**
 * Admin Dashboard
 *
 * Redirects to the tenants page for now.
 * Future: Could show platform metrics and overview.
 */
export default function AdminPage() {
  redirect('/admin/tenants');
}
