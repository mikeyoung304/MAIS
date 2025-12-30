import { Metadata } from 'next';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Contact - HANDLED',
  description: 'Get in touch with the HANDLED team. We would love to hear from you.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b border-neutral-800">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-sage/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-sage" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Let&apos;s talk
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Have a question about HANDLED? Interested in The Partnership tier? We&apos;d love to
            hear from you.
          </p>
        </div>

        <div className="bg-surface-alt rounded-2xl p-8 md:p-12 border border-neutral-800 text-center">
          <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
            Reach out directly
          </h2>
          <p className="text-text-muted mb-6">
            For partnership inquiries, support questions, or just to say hello.
          </p>
          <Button asChild variant="sage" className="rounded-full px-8 py-5">
            <a href="mailto:hello@gethandled.ai">
              <Mail className="w-4 h-4 mr-2" />
              hello@gethandled.ai
            </a>
          </Button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-text-muted text-sm">
            Looking to get started?{' '}
            <Link href="/signup" className="text-sage hover:underline">
              Create your storefront
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Link href="/" className="font-serif text-xl font-bold text-text-primary">
            HANDLED
          </Link>
          <p className="text-text-muted text-sm mt-2">
            Built for service professionals. Powered quietly.
          </p>
        </div>
      </footer>
    </div>
  );
}
