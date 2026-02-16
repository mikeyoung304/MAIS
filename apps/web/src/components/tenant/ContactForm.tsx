'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ContactFormProps {
  tenantName: string;
  basePath: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * ContactForm - Accessible contact form with validation
 *
 * Features:
 * - Client-side validation before submit
 * - Loading state during submission
 * - Success state with "Send Another" option
 * - Error state with retry
 * - Accessible form markup with aria-describedby
 *
 * Phase 1: Simulates success (1s delay)
 * Phase 2: Will call POST /v1/inquiries
 */
export function ContactForm({ tenantName: _tenantName, basePath, domainParam }: ContactFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [touched, setTouched] = useState<Set<keyof FormData>>(new Set());

  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build home link with optional domain param
  const homeHref = domainParam ? `/${domainParam}` : basePath;

  // Cleanup on unmount - abort any in-flight requests
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Focus management after state changes
  useEffect(() => {
    if (status === 'success' && successRef.current) {
      successRef.current.focus();
    }
  }, [status]);

  const validateField = useCallback((field: keyof FormData, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'email': {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email';
        return undefined;
      }
      case 'message':
        if (!value.trim()) return 'Message is required';
        if (value.trim().length < 10) return 'Message must be at least 10 characters';
        return undefined;
      default:
        return undefined;
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      message: validateField('message', formData.message),
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  }, [formData, validateField]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Validate on change if field has been touched
      if (touched.has(name as keyof FormData)) {
        const error = validateField(name as keyof FormData, value);
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [touched, validateField]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setTouched((prev) => new Set(prev).add(name as keyof FormData));
      const error = validateField(name as keyof FormData, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    },
    [validateField]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      setTouched(new Set(['name', 'email', 'phone', 'message']));

      if (!validateForm()) {
        return;
      }

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setStatus('submitting');

      try {
        // Phase 1: Simulate success after 1s delay with abort support
        // Phase 2: Replace with actual API call using abortControllerRef.current.signal
        // await fetch(`${API_BASE_URL}/v1/inquiries`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json', 'X-Tenant-Key': apiKey },
        //   body: JSON.stringify(formData),
        //   signal: abortControllerRef.current.signal,
        // });

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 1000);
          abortControllerRef.current!.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });

        // Don't update state if aborted
        if (abortControllerRef.current?.signal.aborted) return;

        setStatus('success');
      } catch (error) {
        // Silently ignore aborted requests
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setStatus('error');
      }
    },
    [validateForm]
  );

  const handleReset = useCallback(() => {
    setFormData({ name: '', email: '', phone: '', message: '' });
    setErrors({});
    setStatus('idle');
    setTouched(new Set());
    formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    setStatus('idle');
  }, []);

  // Success state
  if (status === 'success') {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg text-center"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mx-auto h-16 w-16 text-accent" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold text-text-primary">Message Sent!</h2>
        <p className="mt-2 text-text-muted">
          Thank you for reaching out. We&apos;ll get back to you soon.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleReset} variant="accent">
            Send Another Message
          </Button>
          <Button asChild variant="outline">
            <Link href={homeHref}>Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div
        className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg text-center"
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="mx-auto h-16 w-16 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-text-muted">
          We couldn&apos;t send your message. Please try again.
        </p>
        <Button onClick={handleRetry} variant="accent" className="mt-8">
          Try Again
        </Button>
      </div>
    );
  }

  // Form state
  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg"
      noValidate
      aria-busy={status === 'submitting'}
    >
      <h2 className="text-xl font-bold text-text-primary mb-6">Send us a message</h2>

      {/* Name field */}
      <div className="mb-6">
        <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
          Name{' '}
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          disabled={status === 'submitting'}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 ${
            errors.name
              ? 'border-red-300 focus:border-red-500'
              : 'border-neutral-200 focus:border-accent'
          } disabled:bg-neutral-50 disabled:cursor-not-allowed`}
          aria-describedby={errors.name ? 'name-error' : undefined}
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-required="true"
          autoComplete="name"
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-700" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Email field */}
      <div className="mb-6">
        <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
          Email{' '}
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          disabled={status === 'submitting'}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 ${
            errors.email
              ? 'border-red-300 focus:border-red-500'
              : 'border-neutral-200 focus:border-accent'
          } disabled:bg-neutral-50 disabled:cursor-not-allowed`}
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-required="true"
          autoComplete="email"
          inputMode="email"
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-700" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone field (optional) */}
      <div className="mb-6">
        <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-2">
          Phone <span className="text-text-muted text-xs">(optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          disabled={status === 'submitting'}
          className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-neutral-50 disabled:cursor-not-allowed"
          autoComplete="tel"
          inputMode="tel"
        />
      </div>

      {/* Message field */}
      <div className="mb-6">
        <label htmlFor="message" className="block text-sm font-medium text-text-primary mb-2">
          Message{' '}
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          rows={5}
          disabled={status === 'submitting'}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none ${
            errors.message
              ? 'border-red-300 focus:border-red-500'
              : 'border-neutral-200 focus:border-accent'
          } disabled:bg-neutral-50 disabled:cursor-not-allowed`}
          aria-describedby={errors.message ? 'message-error' : undefined}
          aria-invalid={errors.message ? 'true' : 'false'}
          aria-required="true"
          placeholder={`Tell us about your project or ask a question...`}
        />
        {errors.message && (
          <p id="message-error" className="mt-1 text-sm text-red-700" role="alert">
            {errors.message}
          </p>
        )}
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        variant="accent"
        size="xl"
        className="w-full"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            Sending...
          </>
        ) : (
          'Send Message'
        )}
      </Button>
    </form>
  );
}
