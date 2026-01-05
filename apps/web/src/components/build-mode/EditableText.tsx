'use client';

/**
 * EditableText - Inline text editing component for Build Mode
 *
 * Renders as a contenteditable span when in edit mode.
 * Changes are debounced and sent to the parent via postMessage.
 *
 * Usage:
 * ```tsx
 * <EditableText
 *   value={section.headline}
 *   field="headline"
 *   sectionIndex={0}
 *   isEditMode={true}
 *   className="text-4xl font-bold"
 * />
 * ```
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { sendToParent } from '@/lib/build-mode/protocol';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import type { PageName } from '@macon/contracts';

interface EditableTextProps {
  /** Current text value */
  value: string;
  /** Field name in the section config (e.g., 'headline', 'subheadline') */
  field: string;
  /** Section index in the page */
  sectionIndex: number;
  /** Current page ID */
  pageId?: PageName;
  /** Whether Build Mode is active */
  isEditMode?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Element type to render (div, span, h1, h2, p, etc.) */
  as?: keyof JSX.IntrinsicElements;
  /** Placeholder when empty */
  placeholder?: string;
  /** Callback when value changes locally */
  onLocalChange?: (value: string) => void;
}

export function EditableText({
  value,
  field,
  sectionIndex,
  pageId = 'home',
  isEditMode = false,
  className,
  as: Component = 'span',
  placeholder = 'Click to edit...',
  onLocalChange,
}: EditableTextProps) {
  const contentRef = useRef<HTMLElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
    if (contentRef.current && contentRef.current.textContent !== value) {
      contentRef.current.textContent = value;
    }
  }, [value]);

  // Handle content changes
  const handleInput = useCallback(() => {
    const newValue = contentRef.current?.textContent || '';
    setLocalValue(newValue);
    onLocalChange?.(newValue);

    // Debounce sending to parent
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      sendToParent({
        type: 'BUILD_MODE_SECTION_EDIT',
        data: {
          pageId,
          sectionIndex,
          field,
          value: newValue,
        },
      });
    }, BUILD_MODE_CONFIG.timing.debounce.textEdit);
  }, [pageId, sectionIndex, field, onLocalChange]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent form submission on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      contentRef.current?.blur();
    }
    // Allow Escape to cancel
    if (e.key === 'Escape') {
      contentRef.current?.blur();
    }
  }, []);

  // In edit mode, render as contenteditable
  if (isEditMode) {
    return (
      <Component
        ref={contentRef as React.RefObject<HTMLDivElement>}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          className,
          'outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2',
          'cursor-text',
          !localValue && 'text-neutral-400'
        )}
        data-placeholder={placeholder}
        data-editable-field={field}
      >
        {localValue || placeholder}
      </Component>
    );
  }

  // Normal mode - just render the value
  return <Component className={className}>{value}</Component>;
}
