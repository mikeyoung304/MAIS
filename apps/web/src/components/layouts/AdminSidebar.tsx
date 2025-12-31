'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, logout } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Package,
  Calendar,
  Palette,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Users,
  Building2,
  Globe,
  FileText,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const tenantNavItems: NavItem[] = [
  {
    href: '/tenant/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    description: 'Overview and metrics',
  },
  {
    href: '/tenant/packages',
    label: 'Packages',
    icon: <Package className="h-5 w-5" />,
    description: 'Manage your offerings',
  },
  {
    href: '/tenant/scheduling',
    label: 'Scheduling',
    icon: <Calendar className="h-5 w-5" />,
    description: 'Availability and appointments',
  },
  {
    href: '/tenant/branding',
    label: 'Branding',
    icon: <Palette className="h-5 w-5" />,
    description: 'Colors, logo, and style',
  },
  {
    href: '/tenant/pages',
    label: 'Pages',
    icon: <FileText className="h-5 w-5" />,
    description: 'Manage website pages',
  },
  {
    href: '/tenant/payments',
    label: 'Payments',
    icon: <CreditCard className="h-5 w-5" />,
    description: 'Stripe Connect setup',
  },
  {
    href: '/tenant/domains',
    label: 'Domains',
    icon: <Globe className="h-5 w-5" />,
    description: 'Custom domain setup',
  },
  {
    href: '/tenant/settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    description: 'Account settings',
  },
];

const adminNavItems: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    description: 'Platform overview',
  },
  {
    href: '/admin/tenants',
    label: 'Tenants',
    icon: <Building2 className="h-5 w-5" />,
    description: 'Manage tenants',
  },
  {
    href: '/admin/segments',
    label: 'Segments',
    icon: <Users className="h-5 w-5" />,
    description: 'Customer segments',
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, role, isImpersonating, impersonation } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Determine which nav items to show
  const navItems = isImpersonating() || role === 'TENANT_ADMIN' ? tenantNavItems : adminNavItems;

  const handleLogout = async () => {
    await logout('/login');
  };

  const isActive = (href: string) => {
    if (href === '/tenant/dashboard' || href === '/admin/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
        isActive(item.href)
          ? 'bg-sage text-white shadow-lg'
          : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'
      }`}
      onClick={() => setIsMobileOpen(false)}
    >
      {item.icon}
      {!isCollapsed && (
        <div className="flex-1">
          <span className="font-medium">{item.label}</span>
          {item.description && <p className="text-xs opacity-70">{item.description}</p>}
        </div>
      )}
    </Link>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed left-4 top-4 z-50 rounded-xl bg-surface-alt p-2 shadow-lg lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen bg-surface-alt border-r border-neutral-700 transition-all duration-300
          ${isCollapsed ? 'w-20' : 'w-72'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-700 p-4">
            {!isCollapsed && (
              <Link href="/" className="font-serif text-xl font-bold text-text-primary">
                HANDLED
              </Link>
            )}
            <button
              className="hidden rounded-lg p-1.5 text-text-muted hover:bg-surface-alt lg:block"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft
                className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Impersonation banner */}
          {isImpersonating() && impersonation && (
            <div className="border-b border-amber-700/30 bg-amber-950/30 p-3">
              {!isCollapsed && (
                <>
                  <p className="text-xs font-medium text-amber-400">Impersonating</p>
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {impersonation.tenantEmail}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-neutral-700 p-4">
            {!isCollapsed && (
              <div className="mb-3">
                <p className="truncate text-sm font-medium text-text-primary">{user?.email}</p>
                <p className="text-xs text-text-muted">
                  {isImpersonating() ? 'Admin (Impersonating)' : role}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size={isCollapsed ? 'icon' : 'default'}
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
