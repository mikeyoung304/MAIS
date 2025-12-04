import { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoUploadButtonProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  disabled: boolean;
  allowedTypes: string[];
}

/**
 * PhotoUploadButton Component
 *
 * Upload button with hidden file input
 */
export function PhotoUploadButton({
  onFileSelect,
  isUploading,
  disabled,
  allowedTypes,
}: PhotoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input to allow re-uploading same file
    event.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <Button
        onClick={triggerFileInput}
        disabled={isUploading || disabled}
        className="bg-macon-navy hover:bg-macon-navy-dark text-base h-10 px-4"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo
          </>
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
