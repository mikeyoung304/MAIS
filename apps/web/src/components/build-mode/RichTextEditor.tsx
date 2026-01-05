'use client';

/**
 * RichTextEditor - Rich text editing component for Build Mode
 *
 * Uses Tiptap for full rich text editing with basic formatting:
 * - Bold, italic, underline
 * - Headings
 * - Lists
 * - Links
 *
 * Changes are debounced and sent to the parent via postMessage.
 */

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { sendToParent } from '@/lib/build-mode/protocol';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import type { PageName } from '@macon/contracts';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  /** Current HTML content */
  value: string;
  /** Field name in the section config */
  field: string;
  /** Section index in the page */
  sectionIndex: number;
  /** Current page ID */
  pageId?: PageName;
  /** Whether Build Mode is active */
  isEditMode?: boolean;
  /** Additional CSS classes for the editor */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when value changes locally */
  onLocalChange?: (value: string) => void;
}

export function RichTextEditor({
  value,
  field,
  sectionIndex,
  pageId = 'home',
  isEditMode = false,
  className,
  placeholder = 'Start typing...',
  onLocalChange,
}: RichTextEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    editable: isEditMode,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-neutral max-w-none focus:outline-none min-h-[100px]',
          '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.is-editor-empty:first-child::before]:text-neutral-400',
          '[&_.is-editor-empty:first-child::before]:float-left',
          '[&_.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.is-editor-empty:first-child::before]:h-0'
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onLocalChange?.(html);

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
            value: html,
          },
        });
      }, BUILD_MODE_CONFIG.timing.debounce.richTextEdit);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Update editable state when isEditMode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditMode);
    }
  }, [isEditMode, editor]);

  if (!editor) {
    return null;
  }

  // In edit mode, show the editor with toolbar
  if (isEditMode) {
    return (
      <div className={cn('rounded-lg border border-neutral-200 bg-white', className)}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-neutral-200 p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(editor.isActive('bold') && 'bg-neutral-100')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(editor.isActive('italic') && 'bg-neutral-100')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(editor.isActive('bulletList') && 'bg-neutral-100')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(editor.isActive('orderedList') && 'bg-neutral-100')}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Editor */}
        <div className="p-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  // Normal mode - just render the HTML
  return (
    <div
      className={cn('prose prose-neutral max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}
