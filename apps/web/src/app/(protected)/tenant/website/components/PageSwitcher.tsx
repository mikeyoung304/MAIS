'use client';

import { useState } from 'react';
import { useAgentUIStore } from '@/stores/agent-ui-store';
import { cn } from '@/lib/utils';
import {
  Home,
  User,
  Briefcase,
  Image,
  HelpCircle,
  Mail,
  Palette,
  Search,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { PageName } from '@macon/contracts';

interface PageSwitcherProps {
  currentPage: PageName;
  tenantSlug: string;
}

interface PageItem {
  id: PageName;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

/**
 * PageSwitcher - Left sidebar for navigating site pages
 *
 * Shows:
 * - All available landing pages (Home, About, Services, Gallery, FAQ, Contact)
 * - Packages section (with count)
 * - Branding section
 * - SEO settings
 *
 * Clicking a page updates the preview iframe via agent-ui-store.
 */
export function PageSwitcher({ currentPage, tenantSlug }: PageSwitcherProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const setPreviewPage = useAgentUIStore((state) => state.setPreviewPage);

  // Standard landing pages (matches PageName type from contracts)
  const pages: PageItem[] = [
    { id: 'home', label: 'Home', icon: <Home className="h-4 w-4" />, enabled: true },
    { id: 'about', label: 'About', icon: <User className="h-4 w-4" />, enabled: true },
    { id: 'services', label: 'Services', icon: <Briefcase className="h-4 w-4" />, enabled: true },
    { id: 'gallery', label: 'Gallery', icon: <Image className="h-4 w-4" />, enabled: true },
    {
      id: 'testimonials',
      label: 'Testimonials',
      icon: <Image className="h-4 w-4" />,
      enabled: true,
    },
    { id: 'faq', label: 'FAQ', icon: <HelpCircle className="h-4 w-4" />, enabled: true },
    { id: 'contact', label: 'Contact', icon: <Mail className="h-4 w-4" />, enabled: true },
  ];

  const filteredPages = pages.filter((page) =>
    page.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePageClick = (pageId: PageName) => {
    setPreviewPage(pageId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-700">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Site Pages</h2>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface rounded-lg border border-neutral-700
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
          />
        </div>
      </div>

      {/* Page List */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {filteredPages.map((page) => (
            <button
              key={page.id}
              onClick={() => handlePageClick(page.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                currentPage === page.id
                  ? 'bg-sage text-white shadow-md'
                  : 'text-text-muted hover:bg-surface hover:text-text-primary'
              )}
            >
              {page.icon}
              <span className="flex-1 text-left font-medium">{page.label}</span>
              {currentPage === page.id && <ChevronRight className="h-4 w-4 opacity-70" />}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-neutral-700" />

        {/* Quick Actions */}
        <div className="space-y-1">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-text-muted hover:bg-surface hover:text-text-primary transition-all"
          >
            <Palette className="h-4 w-4" />
            <span className="flex-1 text-left font-medium">Branding</span>
          </button>
        </div>
      </nav>

      {/* Footer - View Live Link */}
      <div className="p-4 border-t border-neutral-700">
        <a
          href={`/t/${tenantSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4
                     bg-surface hover:bg-surface-alt rounded-lg text-sm font-medium
                     text-text-primary transition-all"
        >
          <ExternalLink className="h-4 w-4" />
          View Live Site
        </a>
      </div>
    </div>
  );
}
