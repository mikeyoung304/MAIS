'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import type { TenantPublicDto, PagesConfig } from '@macon/contracts';
import { getAnchorNavigationItems, buildAnchorNavHref } from './navigation';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useActiveSection } from '@/hooks/useActiveSection';

interface TenantNavProps {
  tenant: TenantPublicDto;
  /** Pages configuration from SectionContent */
  pages?: PagesConfig | null;
  /** Base path for navigation links (e.g., '/t/jane-photography' or '') */
  basePath?: string;
}

interface NavItemWithHref {
  label: string;
  href: string;
}

/**
 * TenantNav - Accessible navigation component for tenant storefronts
 *
 * Features:
 * - Skip link for keyboard users
 * - Sticky header with blur backdrop
 * - Mobile hamburger menu with focus trap
 * - Escape key closes mobile menu
 * - Route change closes mobile menu
 * - Respects prefers-reduced-motion
 */
export function TenantNav({ tenant, pages, basePath: basePathProp }: TenantNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLAnchorElement>(null);

  // Use provided basePath or default to slug-based path
  const basePath = basePathProp ?? `/t/${tenant.slug}`;

  // Memoize navItems — uses anchor navigation for single-page scroll
  const navItems = useMemo<NavItemWithHref[]>(
    () =>
      getAnchorNavigationItems(pages).map((item) => ({
        label: item.label,
        href: buildAnchorNavHref(basePath, item),
      })),
    [basePath, pages]
  );

  // Section IDs for active nav highlighting via Intersection Observer
  const sectionIds = useMemo(
    () =>
      navItems
        .map((item) => {
          const hash = item.href.split('#')[1];
          return hash || null;
        })
        .filter((id): id is string => id !== null),
    [navItems]
  );

  const activeSection = useActiveSection(sectionIds);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Focus trap in mobile menu
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);

    // Focus first element when menu opens
    firstFocusableRef.current?.focus();

    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Swipe-to-close gesture for mobile menu
  const swipeState = useSwipeGesture(menuRef, {
    threshold: 50,
    velocityThreshold: 0.3,
    directions: ['right'],
    enabled: isOpen,
    onSwipeMove: (deltaX) => {
      // Only track positive (rightward) swipes
      if (deltaX > 0 && menuRef.current) {
        menuRef.current.style.transform = `translateX(${deltaX}px)`;
      }
    },
    onSwipe: () => {
      setIsOpen(false);
      menuButtonRef.current?.focus();
    },
    onSwipeEnd: () => {
      // Reset position if swipe didn't complete
      if (menuRef.current) {
        menuRef.current.style.transform = '';
      }
    },
  });

  /**
   * Determines if a navigation link is active based on current scroll position.
   *
   * Uses Intersection Observer (via useActiveSection) to track which section
   * is most visible in the viewport and highlights the corresponding nav link.
   *
   * @param href - The navigation link href to check
   * @returns true if the link should be styled as active
   */
  const isActiveLink = useCallback(
    (href: string) => {
      // For anchor links, check against activeSection from IO
      const hash = href.split('#')[1];
      if (hash) {
        return activeSection === hash;
      }

      // For home link (no anchor), active when no section is highlighted
      // or when we're at the top of the page
      if (!activeSection) {
        const hrefPath = href.split('?')[0] || '/';
        const homeHref = basePath || '/';
        return pathname === hrefPath || pathname === homeHref || pathname === '/';
      }

      return false;
    },
    [basePath, pathname, activeSection]
  );

  return (
    <>
      {/* Skip link is provided by root layout.tsx */}
      <header className="sticky top-0 z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-lg">
        <nav aria-label="Main navigation" className="mx-auto max-w-6xl px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and tenant name */}
            <Link
              href={basePath}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              {tenant.branding?.logoUrl && (
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image
                    src={tenant.branding.logoUrl}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="32px"
                  />
                </div>
              )}
              <span className="font-semibold text-primary">{tenant.name}</span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden items-center gap-8 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActiveLink(item.href) ? 'page' : undefined}
                  className={`text-sm font-medium transition-colors ${
                    isActiveLink(item.href)
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Button asChild variant="accent" size="sm">
                <a href={`${basePath}#services`}>Book Now</a>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-neutral-100 md:hidden"
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div
          ref={menuRef}
          id="mobile-menu"
          className={`fixed inset-x-0 top-[65px] bottom-0 z-40 bg-white md:hidden ${
            swipeState.isSwiping ? '' : 'transition-transform duration-300'
          } ${isOpen ? 'translate-x-0' : 'translate-x-full'} motion-reduce:transition-none`}
          aria-hidden={!isOpen}
        >
          <div className="flex h-full flex-col px-6 py-8">
            <nav className="flex flex-col gap-4">
              {navItems.map((item, index) => (
                <Link
                  key={item.href}
                  ref={index === 0 ? firstFocusableRef : undefined}
                  href={item.href}
                  aria-current={isActiveLink(item.href) ? 'page' : undefined}
                  className={`rounded-lg px-4 py-3 text-lg font-medium transition-colors ${
                    isActiveLink(item.href)
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground hover:bg-neutral-50'
                  }`}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => {
                    document.body.style.overflow = '';
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8">
              <Button
                asChild
                variant="accent"
                size="xl"
                className="w-full"
                tabIndex={isOpen ? 0 : -1}
              >
                <a
                  href={`${basePath}#services`}
                  onClick={() => {
                    document.body.style.overflow = '';
                    setIsOpen(false);
                  }}
                >
                  Book Now
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay for mobile menu */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
