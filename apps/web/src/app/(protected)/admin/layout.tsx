import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';

/**
 * Admin Layout
 *
 * Protected layout for all /admin/* routes.
 * Requires PLATFORM_ADMIN role and blocks access while impersonating.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Only PLATFORM_ADMIN can access admin routes
  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    redirect('/tenant/dashboard');
  }

  // Cannot access admin routes while impersonating
  if (session?.user?.impersonation) {
    redirect('/tenant/dashboard');
  }

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <main className="lg:pl-72 transition-all duration-300">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
