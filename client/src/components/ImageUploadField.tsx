/**
 * ImageUploadField Component
 *
 * A reusable drag-drop image upload field with preview.
 * Supports both local filesystem (mock mode) and Supabase Storage (real mode).
 */

import { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getAuthToken } from '@/lib/auth';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadEndpoint: string;
  disabled?: boolean;
  maxSizeMB?: number;
  className?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

export function ImageUploadField({
  label,
  value,
  onChange,
  uploadEndpoint,
  disabled = false,
  maxSizeMB = 5,
  className = '',
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: JPG, PNG, WebP, SVG';
    }
    return null;
  }

  async function uploadFile(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  function handleRemove() {
    onChange('');
    setError(null);
  }

  function handleClick() {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white/90 text-lg">{label}</Label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload zone or preview */}
      {value ? (
        // Image preview with remove button
        <div className="relative group w-32 h-32">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-lg border border-white/20"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Drag-drop zone
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-2 p-6
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${
              isDragging
                ? 'border-macon-orange bg-macon-orange/10'
                : 'border-white/20 hover:border-white/40'
            }
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
              <span className="text-sm text-white/60">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-white/60" />
              <span className="text-sm text-white/60">Drag & drop or click to upload</span>
              <span className="text-xs text-white/40">Max {maxSizeMB}MB - JPG, PNG, WebP, SVG</span>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
