/**
 * Role-Based Navigation Component
 * Shows different navigation items based on user role
 * When impersonating a tenant, shows tenant navigation instead of platform admin nav
 */

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Package, Calendar, Settings, Users, Palette, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  description?: string;
}

export function RoleBasedNav({ variant = 'sidebar' }: { variant?: 'sidebar' | 'horizontal' }) {
  const { user, isImpersonating } = useAuth();
  const location = useLocation();

  if (!user) {
    return null;
  }

  const platformAdminNav: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: <Building2 className="w-5 h-5" aria-hidden="true" />,
      description: 'System overview & tenants',
    },
    {
      label: 'Segments',
      path: '/admin/segments',
      icon: <Users className="w-5 h-5" aria-hidden="true" />,
      description: 'Manage customer segments',
    },
  ];

  const tenantAdminNav: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/tenant/dashboard',
      icon: <Building2 className="w-5 h-5" aria-hidden="true" />,
      description: 'Tenant overview',
    },
    // TODO: Uncomment routes as they are implemented
    // {
    //   label: "Packages",
    //   path: "/tenant/packages",
    //   icon: <Package className="w-5 h-5" />,
    //   description: "Manage packages"
    // },
    // {
    //   label: "Bookings",
    //   path: "/tenant/bookings",
    //   icon: <Calendar className="w-5 h-5" />,
    //   description: "View bookings"
    // },
    // {
    //   label: "Blackouts",
    //   path: "/tenant/blackouts",
    //   icon: <XCircle className="w-5 h-5" />,
    //   description: "Blackout dates"
    // },
    // {
    //   label: "Branding",
    //   path: "/tenant/branding",
    //   icon: <Palette className="w-5 h-5" />,
    //   description: "Customize branding"
    // },
    // {
    //   label: "Settings",
    //   path: "/tenant/settings",
    //   icon: <Settings className="w-5 h-5" />,
    //   description: "Tenant settings"
    // }
  ];

  // When impersonating a tenant, show tenant navigation instead of platform admin
  const isCurrentlyImpersonating = isImpersonating();
  const navItems =
    user.role === 'PLATFORM_ADMIN' && !isCurrentlyImpersonating ? platformAdminNav : tenantAdminNav;

  if (variant === 'horizontal') {
    return (
      <nav className="flex gap-6">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'text-white/80 hover:text-white hover:bg-white/10',
                'transition-colors',
                isActive && 'bg-white/10 text-white font-semibold'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Sidebar variant
  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg',
              'text-white/80 hover:text-white hover:bg-white/10',
              'transition-colors group',
              isActive && 'bg-white/10 text-white border-l-4 border-macon-orange'
            )}
          >
            <div
              className={cn(
                'text-white/60 group-hover:text-white',
                isActive && 'text-macon-orange'
              )}
            >
              {item.icon}
            </div>
            <div className="flex-1">
              <div className={cn('font-medium', isActive && 'font-semibold')}>{item.label}</div>
              {item.description && <div className="text-sm text-white/60">{item.description}</div>}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
