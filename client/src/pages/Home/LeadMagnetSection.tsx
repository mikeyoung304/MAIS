import { useState, FormEvent } from 'react';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle } from 'lucide-react';

export function LeadMagnetSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');

    // Simulate API call - replace with actual email service integration
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Integrate with email service (Postmark, ConvertKit, etc.)
    // await subscribeToNewsletter(email);

    setStatus('success');
    setEmail('');
  };

  return (
    <section className="py-16 md:py-20 bg-gradient-to-r from-macon-orange/5 via-macon-teal/5 to-macon-orange/5">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-macon-orange/10 rounded-full mb-6">
            <BookOpen className="w-5 h-5 text-macon-orange" />
            <span className="text-sm font-semibold text-macon-orange uppercase tracking-wide">
              Free Guide
            </span>
          </div>

          <h3 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            The Admin Escape Plan
          </h3>
          <p className="text-xl text-macon-orange font-medium mb-4">
            5 Systems Every Small Business Needs
          </p>
          <p className="text-lg text-neutral-600 mb-8">
            Get our step-by-step guide to automating your business—even if you're not tech-savvy.
          </p>

          {status === 'success' ? (
            <div className="flex items-center justify-center gap-3 p-6 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <p className="text-lg text-green-700 font-medium">Check your email for the guide!</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-5 py-4 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-macon-orange focus:border-transparent text-lg"
              />
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="bg-macon-orange hover:bg-macon-orange-dark text-white font-semibold px-8 py-4 text-lg rounded-xl"
              >
                {status === 'loading' ? 'Sending...' : 'Get the Guide'}
              </Button>
            </form>
          )}

          <p className="text-sm text-neutral-500 mt-4">No spam. Unsubscribe anytime.</p>
        </div>
      </Container>
    </section>
  );
}
