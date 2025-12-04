import type { FormError } from '@/components/ui/ErrorSummary';
import type { PackageFormData } from '../hooks/usePackageForm';

/**
 * ValidationService
 *
 * Centralized validation logic for the PackageForm.
 * Provides field-level and form-level validation functions.
 */
export class ValidationService {
  /**
   * Validate a single field
   */
  static validateField(
    field: keyof PackageFormData,
    value: string | boolean
  ): { errors: FormError[]; fieldError?: string } {
    const errors: FormError[] = [];
    let fieldError: string | undefined;

    switch (field) {
      case 'title':
        if (typeof value === 'string' && !value.trim()) {
          const message = 'Package title is required';
          errors.push({ field: 'title', message });
          fieldError = message;
        }
        break;

      case 'description':
        if (typeof value === 'string' && !value.trim()) {
          const message = 'Package description is required';
          errors.push({ field: 'description', message });
          fieldError = message;
        }
        break;

      case 'priceCents':
        if (typeof value === 'string') {
          if (!value) {
            const message = 'Price is required';
            errors.push({ field: 'priceCents', message });
            fieldError = message;
          } else if (parseInt(value, 10) < 0) {
            const message = 'Price must be a positive number';
            errors.push({ field: 'priceCents', message });
            fieldError = message;
          }
        }
        break;

      case 'minLeadDays':
        if (typeof value === 'string' && value && parseInt(value, 10) < 0) {
          const message = 'Min lead days must be a positive number';
          errors.push({ field: 'minLeadDays', message });
          fieldError = message;
        }
        break;
    }

    return { errors, fieldError };
  }

  /**
   * Validate the entire form
   */
  static validateForm(form: PackageFormData): FormError[] {
    const errors: FormError[] = [];

    // Title validation
    if (!form.title.trim()) {
      errors.push({ field: 'title', message: 'Package title is required' });
    }

    // Description validation
    if (!form.description.trim()) {
      errors.push({ field: 'description', message: 'Package description is required' });
    }

    // Price validation
    if (!form.priceCents) {
      errors.push({ field: 'priceCents', message: 'Price is required' });
    } else if (parseInt(form.priceCents, 10) < 0) {
      errors.push({ field: 'priceCents', message: 'Price must be a positive number' });
    }

    // Min lead days validation
    if (form.minLeadDays && parseInt(form.minLeadDays, 10) < 0) {
      errors.push({ field: 'minLeadDays', message: 'Min lead days must be a positive number' });
    }

    return errors;
  }

  /**
   * Generate slug from title
   */
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}
