/**
 * Unit tests for validation utilities
 *
 * SECURITY-CRITICAL: Tests for price validation bounds.
 * Prevents integer overflow attacks and aligns with Stripe's limits.
 *
 * Tests cover:
 * - Price upper bound validation (max $999,999.99 / 99999999 cents)
 * - Price lower bound validation (non-negative)
 * - User-friendly error messages
 */

import { describe, it, expect } from 'vitest';
import {
  validatePrice,
  MAX_PRICE_CENTS,
  validateSlug,
  validateEmail,
  sanitizeString,
  validateRequiredFields,
  validateNonEmptyString,
  validatePositiveInteger,
} from '../../src/lib/validation';
import { ValidationError } from '../../src/lib/errors';

describe('validatePrice', () => {
  describe('valid prices', () => {
    it('accepts zero price (free items)', () => {
      expect(() => validatePrice(0)).not.toThrow();
    });

    it('accepts typical price of $100.00 (10000 cents)', () => {
      expect(() => validatePrice(10000)).not.toThrow();
    });

    it('accepts maximum allowed price of $999,999.99 (99999999 cents)', () => {
      expect(() => validatePrice(99999999)).not.toThrow();
    });

    it('accepts price just under maximum (99999998 cents)', () => {
      expect(() => validatePrice(99999998)).not.toThrow();
    });
  });

  describe('invalid prices - lower bound', () => {
    it('rejects negative price', () => {
      expect(() => validatePrice(-1)).toThrow(ValidationError);
      expect(() => validatePrice(-1)).toThrow('price must be non-negative');
    });

    it('rejects large negative price', () => {
      expect(() => validatePrice(-1000000)).toThrow(ValidationError);
    });
  });

  describe('invalid prices - upper bound (TODO-198)', () => {
    it('rejects price exceeding Stripe maximum ($999,999.99)', () => {
      expect(() => validatePrice(100000000)).toThrow(ValidationError);
      expect(() => validatePrice(100000000)).toThrow(
        'price exceeds maximum allowed value ($999,999.99)'
      );
    });

    it('rejects price just over maximum (100000000 cents)', () => {
      expect(() => validatePrice(100000000)).toThrow(ValidationError);
    });

    it('rejects potential integer overflow values', () => {
      expect(() => validatePrice(2147483647)).toThrow(ValidationError); // Max 32-bit int
      expect(() => validatePrice(Number.MAX_SAFE_INTEGER)).toThrow(ValidationError);
    });
  });

  describe('custom field name', () => {
    it('uses custom field name in error message', () => {
      expect(() => validatePrice(-1, 'packagePrice')).toThrow(
        'packagePrice must be non-negative'
      );
    });

    it('uses custom field name for upper bound error', () => {
      expect(() => validatePrice(100000000, 'addOnPrice')).toThrow(
        'addOnPrice exceeds maximum allowed value ($999,999.99)'
      );
    });
  });

  describe('MAX_PRICE_CENTS constant', () => {
    it('exports MAX_PRICE_CENTS as 99999999 ($999,999.99)', () => {
      expect(MAX_PRICE_CENTS).toBe(99999999);
    });

    it('MAX_PRICE_CENTS equals $999,999.99 in dollars', () => {
      expect(MAX_PRICE_CENTS / 100).toBe(999999.99);
    });
  });
});

describe('validateSlug', () => {
  it('accepts valid slug', () => {
    expect(() => validateSlug('wedding-package')).not.toThrow();
  });

  it('rejects uppercase letters', () => {
    expect(() => validateSlug('Wedding-Package')).toThrow(ValidationError);
  });

  it('rejects spaces', () => {
    expect(() => validateSlug('wedding package')).toThrow(ValidationError);
  });
});

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(() => validateEmail('test@example.com')).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => validateEmail('not-an-email')).toThrow(ValidationError);
  });
});

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('normalizes multiple spaces', () => {
    expect(sanitizeString('hello    world')).toBe('hello world');
  });
});

describe('validateRequiredFields', () => {
  it('passes when all required fields present', () => {
    expect(() =>
      validateRequiredFields({ name: 'Test', email: 'test@example.com' }, ['name', 'email'])
    ).not.toThrow();
  });

  it('fails when required field is missing', () => {
    expect(() =>
      validateRequiredFields({ name: 'Test' }, ['name', 'email'], 'User')
    ).toThrow(ValidationError);
  });
});

describe('validateNonEmptyString', () => {
  it('accepts non-empty string', () => {
    expect(() => validateNonEmptyString('hello', 'field')).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateNonEmptyString('', 'field')).toThrow(ValidationError);
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateNonEmptyString('   ', 'field')).toThrow(ValidationError);
  });
});

describe('validatePositiveInteger', () => {
  it('accepts positive integer', () => {
    expect(() => validatePositiveInteger(1, 'count')).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => validatePositiveInteger(0, 'count')).toThrow(ValidationError);
  });

  it('rejects negative numbers', () => {
    expect(() => validatePositiveInteger(-1, 'count')).toThrow(ValidationError);
  });

  it('rejects non-integers', () => {
    expect(() => validatePositiveInteger(1.5, 'count')).toThrow(ValidationError);
  });
});
