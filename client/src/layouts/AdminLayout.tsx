/**
 * AdminLayout - Persistent sidebar layout for admin interfaces
 *
 * Features:
 * - Collapsible sidebar with RoleBasedNav
 * - Header with user info and role badge
 * - Main content area with proper spacing
 * - Responsive mobile behavior
 * - Logout functionality
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoleBasedNav } from '../components/navigation/RoleBasedNav';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Logo } from '../components/brand/Logo';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import '@/styles/a11y.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; path?: string }>;
}

export function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Keyboard navigation: Escape key closes mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  if (!user) {
    return null;
  }

  const roleLabel = user.role === 'PLATFORM_ADMIN' ? 'Platform Admin' : 'Tenant Admin';
  const roleVariant = user.role === 'PLATFORM_ADMIN' ? 'destructive' : 'secondary';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip link for keyboard navigation (WCAG 2.4.1) */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-macon-navy-900 border-b border-macon-navy-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo size="sm" linkTo="/" className="w-8 h-8" />
            <span className="text-white font-semibold text-base tracking-tight">MACON</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={roleVariant} className="text-xs">
              {roleLabel}
            </Badge>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-macon-orange-500 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 mt-[57px]"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-macon-navy-900 border-r border-macon-navy-700 z-40 transition-all duration-300',
          // Desktop
          'hidden lg:block',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64',
          // Mobile
          mobileMenuOpen ? 'block w-64 mt-[57px]' : 'hidden'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Desktop Logo & Toggle */}
          <div className="hidden lg:flex items-center justify-between px-4 py-4 border-b border-macon-navy-700">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <Logo size="sm" linkTo="/" className="w-10 h-10" />
                <span className="text-white font-semibold text-lg tracking-tight">MACON</span>
              </div>
            ) : (
              <Logo size="sm" linkTo="/" className="w-10 h-10 mx-auto" />
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-white/60 hover:text-white transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {!sidebarCollapsed ? (
              <RoleBasedNav variant="sidebar" />
            ) : (
              <div className="space-y-2">
                {/* Collapsed icons only - you could enhance RoleBasedNav to support this */}
                <div className="text-xs text-white/50 text-center">Menu</div>
              </div>
            )}
          </div>

          {/* User Info & Logout */}
          <div className="px-4 py-4 border-t border-macon-navy-700">
            {!sidebarCollapsed ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium text-white">{user.email}</div>
                    <Badge variant={roleVariant} className="mt-1 text-xs">
                      {roleLabel}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="default"
                  className="w-full border-white/30 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full flex justify-center text-white/60 hover:text-white transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          // Desktop padding
          'lg:pl-64',
          sidebarCollapsed && 'lg:pl-20',
          // Mobile padding for fixed header
          'pt-[57px] lg:pt-0'
        )}
      >
        {/* Header with Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400">/</span>}
                  {crumb.path ? (
                    <Link
                      to={crumb.path}
                      className="text-gray-600 hover:text-macon-navy-900 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-macon-navy-900 font-medium">{crumb.label}</span>
                  )}
                </div>
              ))}
            </nav>
          </header>
        )}

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
