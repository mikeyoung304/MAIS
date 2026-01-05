'use client';

import { cn } from '@/lib/utils';
import { PAGE_NAMES, type PageName, type PagesConfig } from '@macon/contracts';
import { Home, User, Package, HelpCircle, Mail, Image, MessageSquare } from 'lucide-react';

interface PageSelectorProps {
  currentPage: PageName;
  pages: PagesConfig | null;
  onChange: (page: PageName) => void;
}

/**
 * Page icons mapping
 */
const PAGE_ICONS: Record<PageName, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  about: <User className="h-4 w-4" />,
  services: <Package className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  contact: <Mail className="h-4 w-4" />,
  gallery: <Image className="h-4 w-4" />,
  testimonials: <MessageSquare className="h-4 w-4" />,
};

/**
 * Page display names
 */
const PAGE_LABELS: Record<PageName, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  faq: 'FAQ',
  contact: 'Contact',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
};

/**
 * PageSelector - Horizontal page tab selector
 *
 * Displays all available pages as horizontal tabs.
 * Disabled pages are shown with reduced opacity.
 */
export function PageSelector({ currentPage, pages, onChange }: PageSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
      {PAGE_NAMES.map((pageName) => {
        const pageConfig = pages?.[pageName];
        const isEnabled = pageConfig?.enabled ?? true;
        const isActive = currentPage === pageName;

        return (
          <button
            key={pageName}
            onClick={() => onChange(pageName)}
            disabled={!isEnabled && pageName !== 'home'} // Home is always enabled
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
              'transition-all duration-200',
              isActive
                ? 'bg-white text-sage shadow-sm'
                : isEnabled
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
                  : 'text-neutral-400 cursor-not-allowed opacity-50'
            )}
            title={!isEnabled ? `${PAGE_LABELS[pageName]} page is disabled` : undefined}
          >
            {PAGE_ICONS[pageName]}
            <span className="hidden sm:inline">{PAGE_LABELS[pageName]}</span>
          </button>
        );
      })}
    </div>
  );
}
