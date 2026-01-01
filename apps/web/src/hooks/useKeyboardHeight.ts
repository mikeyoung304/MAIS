'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Discriminated union for keyboard state.
 */
export type KeyboardState =
  | { readonly status: 'hidden'; readonly height: 0 }
  | { readonly status: 'visible'; readonly height: number };

/**
 * Hook to detect virtual keyboard height using the Visual Viewport API.
 *
 * This is essential for mobile forms to avoid keyboard covering inputs.
 * Uses the Visual Viewport API which is supported in modern browsers.
 *
 * @returns KeyboardState with visibility and height
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const keyboard = useKeyboardHeight();
 *
 *   return (
 *     <div style={{ paddingBottom: keyboard.height }}>
 *       <input type="text" />
 *       {keyboard.status === 'visible' && (
 *         <span>Keyboard is open</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useKeyboardHeight(): KeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const updateKeyboardHeight = useCallback(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    // The keyboard height is the difference between the window height
    // and the visual viewport height
    const windowHeight = window.innerHeight;
    const viewportHeight = viewport.height;

    // Account for offset from top (like when browser UI is shown)
    const offset = viewport.offsetTop;

    // Calculate keyboard height
    const height = Math.max(0, windowHeight - viewportHeight - offset);

    setKeyboardHeight(height);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    // Initial check
    updateKeyboardHeight();

    // Listen for viewport changes
    viewport.addEventListener('resize', updateKeyboardHeight);
    viewport.addEventListener('scroll', updateKeyboardHeight);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardHeight);
      viewport.removeEventListener('scroll', updateKeyboardHeight);
    };
  }, [updateKeyboardHeight]);

  if (keyboardHeight === 0) {
    return { status: 'hidden', height: 0 };
  }

  return { status: 'visible', height: keyboardHeight };
}

/**
 * Hook that returns true when the virtual keyboard is visible.
 */
export function useIsKeyboardVisible(): boolean {
  const keyboard = useKeyboardHeight();
  return keyboard.status === 'visible';
}

/**
 * Hook that returns the keyboard height (0 when hidden).
 */
export function useKeyboardOffset(): number {
  const keyboard = useKeyboardHeight();
  return keyboard.height;
}
