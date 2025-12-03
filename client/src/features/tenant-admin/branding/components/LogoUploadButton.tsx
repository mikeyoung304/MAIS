import React, { useRef, useState } from "react";
import { Upload, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

interface LogoUploadButtonProps {
  currentLogoUrl?: string;
  onUploadSuccess: (logoUrl: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export function LogoUploadButton({
  currentLogoUrl,
  onUploadSuccess,
  onUploadError,
  disabled = false,
}: LogoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentLogoUrl);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      onUploadError?.("Please upload a valid image file (PNG, JPG, SVG, or WebP)");
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      onUploadError?.("Logo file must be less than 2MB");
      return;
    }

    // Create local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload file
    uploadLogo(file);
  };

  const uploadLogo = async (file: File) => {
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${api.baseUrl}/v1/tenant-admin/logo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || "Failed to upload logo");
      }

      const result = await response.json();
      onUploadSuccess(result.url);
      setUploadSuccess(true);

      // Clear success indicator after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Logo upload failed:", error);
      }
      onUploadError?.(error instanceof Error ? error.message : "Failed to upload logo");
      // Reset preview on error
      setPreviewUrl(currentLogoUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(undefined);
    onUploadSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Preview area */}
      {previewUrl && (
        <div className="relative w-full p-4 bg-macon-navy-900 border border-white/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/70">Logo Preview</span>
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={disabled || isUploading}
              className="p-1 text-white/60 hover:text-white/90 hover:bg-macon-navy-700 rounded transition-colors"
              title="Remove logo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-center bg-white/5 rounded p-4">
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-h-24 max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      <Button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || isUploading}
        variant="outline"
        className="w-full border-white/20 text-white/90 hover:bg-macon-navy-700 hover:text-white"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : uploadSuccess ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" aria-hidden="true" />
            Logo Uploaded!
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
            {previewUrl ? "Change Logo" : "Upload Logo"}
          </>
        )}
      </Button>

      {/* Helper text */}
      <p className="text-sm text-white/60">
        Recommended: Square image, PNG or SVG format, max 2MB
      </p>
    </div>
  );
}
