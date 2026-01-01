'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

/**
 * MobileNav - Hamburger menu for mobile navigation
 *
 * Slides in from the right with overlay backdrop.
 * Closes on link click or backdrop tap.
 */

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#preview', label: 'Preview' },
  { href: '/login', label: 'Login' },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsOpen(false);

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

  return (
    <>
      {/* Hamburger button - visible only on mobile */}
      <button
        ref={menuButtonRef}
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Slide-in menu */}
      <div
        ref={menuRef}
        className={`fixed top-0 right-0 h-full w-72 bg-surface border-l border-neutral-800 z-50 md:hidden ${
          swipeState.isSwiping ? '' : 'transform transition-transform duration-300 ease-in-out'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'} motion-reduce:transition-none`}
      >
        {/* Close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={closeMenu}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
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
            <Button
              asChild
              variant="sage"
              className="w-full rounded-full py-3 text-base"
              onClick={closeMenu}
            >
              <Link href="/signup">See My Client Page</Link>
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
}
