import { redirect } from 'next/navigation';

/**
 * Admin Root Page
 *
 * Redirects to the dashboard page for platform overview.
 */
export default function AdminPage() {
  redirect('/admin/dashboard');
}
