/**
 * EditableText - Click-to-edit text component with autosave
 *
 * Features:
 * - Display mode shows text with hover indicator
 * - Click to enter edit mode
 * - Auto-focus input on edit
 * - Blur or Enter to save
 * - Escape to cancel
 * - Visual indicator for unsaved changes
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  hasDraft?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

export function EditableText({
  value,
  onChange,
  placeholder = "Click to edit",
  className,
  inputClassName,
  maxLength,
  multiline = false,
  rows = 3,
  hasDraft = false,
  disabled = false,
  "aria-label": ariaLabel,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        setIsEditing(false);
        if (editValue !== value) {
          onChange(editValue);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(value);
        setIsEditing(false);
      }
    },
    [editValue, value, onChange, multiline]
  );

  // Display mode
  if (!isEditing) {
    return (
      <div
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel || `Edit ${placeholder}`}
        className={cn(
          "group relative cursor-pointer rounded px-2 py-1 transition-colors",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          hasDraft && "ring-1 ring-amber-400/50 bg-amber-50/30",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <span className={cn(!value && "text-muted-foreground italic")}>
          {value || placeholder}
        </span>
        {!disabled && (
          <Pencil
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3",
              "text-muted-foreground opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus:opacity-100"
            )}
          />
        )}
      </div>
    );
  }

  // Edit mode
  const commonProps = {
    ref: inputRef as any,
    value: editValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditValue(e.target.value),
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    maxLength,
    placeholder,
    "aria-label": ariaLabel || `Edit ${placeholder}`,
    className: cn(
      "w-full rounded border border-input bg-background px-2 py-1",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      inputClassName
    ),
  };

  if (multiline) {
    return <textarea {...commonProps} rows={rows} />;
  }

  return <input {...commonProps} type="text" />;
}
