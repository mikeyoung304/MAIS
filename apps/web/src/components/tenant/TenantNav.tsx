'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import type { TenantPublicDto } from '@macon/contracts';

interface TenantNavProps {
  tenant: TenantPublicDto;
}

interface NavItem {
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
export function TenantNav({ tenant }: TenantNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLAnchorElement>(null);

  const basePath = `/t/${tenant.slug}`;

  const navItems: NavItem[] = [
    { label: 'Home', href: basePath },
    { label: 'Services', href: `${basePath}/services` },
    { label: 'About', href: `${basePath}/about` },
    { label: 'FAQ', href: `${basePath}/faq` },
    { label: 'Contact', href: `${basePath}/contact` },
  ];

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

  const isActiveLink = (href: string) => {
    if (href === basePath) {
      return pathname === basePath;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Skip link - first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-sage focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

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
              <span className="font-semibold text-text-primary">{tenant.name}</span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden items-center gap-8 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isActiveLink(item.href)
                      ? 'text-sage'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Button asChild variant="sage" size="sm">
                <a href={`${basePath}#packages`}>Book Now</a>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-neutral-100 md:hidden"
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
          className={`fixed inset-x-0 top-[65px] bottom-0 z-40 bg-white transition-transform duration-300 md:hidden ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          } motion-reduce:transition-none`}
          aria-hidden={!isOpen}
        >
          <div className="flex h-full flex-col px-6 py-8">
            <nav className="flex flex-col gap-4">
              {navItems.map((item, index) => (
                <Link
                  key={item.href}
                  ref={index === 0 ? firstFocusableRef : undefined}
                  href={item.href}
                  className={`rounded-lg px-4 py-3 text-lg font-medium transition-colors ${
                    isActiveLink(item.href)
                      ? 'bg-sage/10 text-sage'
                      : 'text-text-primary hover:bg-neutral-50'
                  }`}
                  tabIndex={isOpen ? 0 : -1}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8">
              <Button
                asChild
                variant="sage"
                size="xl"
                className="w-full"
                tabIndex={isOpen ? 0 : -1}
              >
                <a href={`${basePath}#packages`}>Book Now</a>
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
