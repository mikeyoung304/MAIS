/**
 * EditableImage Component Tests
 *
 * Tests for the EditableImage component to ensure:
 * - Lazy loading is enabled
 * - Upload shows loading indicator
 * - Aspect ratio support works
 * - File validation works
 * - Drag and drop works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditableImage } from './EditableImage';
import { packagePhotoApi } from '@/lib/package-photo-api';

// Mock the package photo API
vi.mock('@/lib/package-photo-api', () => ({
  packagePhotoApi: {
    uploadPhoto: vi.fn(),
  },
  photoValidation: {
    validateFile: vi.fn(() => null), // Valid by default
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('EditableImage', () => {
  const mockOnUpload = vi.fn();
  const mockOnRemove = vi.fn();
  const packageId = 'pkg_test123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria', () => {
    it('should render EditableImage component successfully', () => {
      render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      expect(screen.getByText(/click or drag to upload image/i)).toBeInTheDocument();
    });

    it('should use loading="lazy" on preview images', () => {
      const testUrl = 'https://example.com/test-image.jpg';

      render(
        <EditableImage
          currentUrl={testUrl}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('src', testUrl);
    });

    it('should show loading indicator during upload', async () => {
      // Mock a slow upload
      vi.mocked(packagePhotoApi.uploadPhoto).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  url: 'https://example.com/uploaded.jpg',
                  filename: 'uploaded.jpg',
                  size: 12345,
                  order: 0,
                }),
              100
            )
          )
      );

      const { container } = render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      // Create a fake file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // Find the hidden file input
      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();

      // Trigger file selection
      fireEvent.change(input!, { target: { files: [file] } });

      // Loading indicator should appear
      await waitFor(() => {
        expect(screen.getByText(/uploading/i)).toBeInTheDocument();
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });
    });

    it('should support different aspect ratios', () => {
      const aspectRatios: Array<'auto' | '16/9' | '1/1' | '4/3'> = ['auto', '16/9', '1/1', '4/3'];

      const expectedStyles = {
        auto: 'auto',
        '16/9': '16 / 9',
        '1/1': '1 / 1',
        '4/3': '4 / 3',
      };

      aspectRatios.forEach((ratio) => {
        const { container } = render(
          <EditableImage
            currentUrl={undefined}
            onUpload={mockOnUpload}
            onRemove={mockOnRemove}
            packageId={packageId}
            aspectRatio={ratio}
          />
        );

        const aspectContainer = container.querySelector('[style*="aspect-ratio"]');
        expect(aspectContainer).toBeInTheDocument();
        expect(aspectContainer).toHaveStyle({ aspectRatio: expectedStyles[ratio] });
      });
    });
  });

  describe('Upload Functionality', () => {
    it('should call onUpload when file is uploaded successfully', async () => {
      const uploadedUrl = 'https://example.com/uploaded.jpg';
      vi.mocked(packagePhotoApi.uploadPhoto).mockResolvedValue({
        url: uploadedUrl,
        filename: 'uploaded.jpg',
        size: 12345,
        order: 0,
      });

      const { container } = render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]');

      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(packagePhotoApi.uploadPhoto).toHaveBeenCalledWith(packageId, file);
        expect(mockOnUpload).toHaveBeenCalledWith(uploadedUrl);
      });
    });

    it('should display error message when upload fails', async () => {
      const errorMessage = 'Upload failed';
      vi.mocked(packagePhotoApi.uploadPhoto).mockRejectedValue(new Error(errorMessage));

      const { container } = render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]');

      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });
    });
  });

  describe('Remove Functionality', () => {
    it('should call onRemove when remove button is clicked', async () => {
      const testUrl = 'https://example.com/test-image.jpg';

      render(
        <EditableImage
          currentUrl={testUrl}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      // Find the remove button (appears on hover)
      const removeButton = screen.getByRole('button', { name: /remove/i });

      fireEvent.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled State', () => {
    it('should disable upload when disabled prop is true', () => {
      const { container } = render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
          disabled={true}
        />
      );

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should include proper ARIA labels', () => {
      const { container } = render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
        />
      );

      const input = container.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('aria-label', 'Upload image');
    });

    it('should use alt text on images', () => {
      const testUrl = 'https://example.com/test-image.jpg';
      const altText = 'Test image description';

      render(
        <EditableImage
          currentUrl={testUrl}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
          alt={altText}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', altText);
    });
  });

  describe('Custom Placeholder', () => {
    it('should display custom placeholder text', () => {
      const customPlaceholder = 'Upload your hero image';

      render(
        <EditableImage
          currentUrl={undefined}
          onUpload={mockOnUpload}
          onRemove={mockOnRemove}
          packageId={packageId}
          placeholder={customPlaceholder}
        />
      );

      expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
    });
  });
});
