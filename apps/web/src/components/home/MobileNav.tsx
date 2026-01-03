'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

/**
 * MobileNav - Hamburger menu for mobile navigation
 *
 * Slides in from the right with overlay backdrop.
 * Closes on link click or backdrop tap.
 *
 * Accessibility features:
 * - Focus trap when menu is open (Tab cycles within menu)
 * - Escape key closes menu
 * - Focus returns to hamburger button on close
 * - aria-modal and role="dialog" for screen readers
 */

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#growth', label: 'Growth Plan' },
  { href: '/login', label: 'Login' },
];

// Focusable elements selector
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    // Return focus to hamburger button
    menuButtonRef.current?.focus();
  }, []);

  // Focus trap effect - traps Tab navigation within menu when open
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    // Focus the close button when menu opens
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }

      // Focus trap on Tab
      if (e.key === 'Tab' && menuRef.current) {
        const focusableElements = menuRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift+Tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

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
      closeMenu();
    },
    onSwipeEnd: () => {
      // Reset position if swipe didn't complete
      if (menuRef.current) {
        menuRef.current.style.transform = '';
      }
    },
  });

  return (
    <>
      {/* Hamburger button - visible only on mobile */}
      <button
        ref={menuButtonRef}
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg"
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
      >
        <Menu className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Slide-in menu - focus trapped dialog */}
      <div
        ref={menuRef}
        id="mobile-nav-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 h-full w-72 bg-surface border-l border-neutral-800 z-50 md:hidden ${
          swipeState.isSwiping ? '' : 'transform transition-transform duration-300 ease-in-out'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'} motion-reduce:transition-none`}
      >
        {/* Close button */}
        <div className="flex justify-end p-4">
          <button
            ref={closeButtonRef}
            onClick={closeMenu}
            className="p-2 text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="px-6 py-4">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={closeMenu}
                  className="block py-3 text-text-muted hover:text-text-primary transition-colors text-lg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* CTA button */}
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <Button asChild variant="sage" className="w-full rounded-full py-3 text-base">
              <Link href="/signup" onClick={closeMenu}>
                Get Started
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
}
