import { useState } from 'react';
import { api } from '@/lib/api';

/**
 * useWaitlistForm - Shared hook for early access waitlist forms
 *
 * Handles form state, validation, submission, and error handling
 * for both HeroSection and WaitlistCTASection.
 *
 * @returns Form state and handlers
 *
 * @example
 * ```tsx
 * const { email, setEmail, submitted, isLoading, error, handleSubmit } = useWaitlistForm();
 *
 * <form onSubmit={handleSubmit}>
 *   <input value={email} onChange={(e) => setEmail(e.target.value)} />
 *   {error && <p>{error}</p>}
 * </form>
 * ```
 */
export function useWaitlistForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.requestEarlyAccess({ body: { email } });

      if (result.status === 200) {
        setSubmitted(true);
      } else if (result.status === 429) {
        setError('Too many requests. Please try again later.');
      } else if (result.status === 400) {
        setError('Please enter a valid email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    submitted,
    isLoading,
    error,
    handleSubmit,
  };
}
