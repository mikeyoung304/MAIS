import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { Mail, Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Contact Page - Discovery Call Booking
 *
 * Simple contact page for booking discovery calls.
 * Links to Calendly or similar in production.
 */
export function Contact() {
  return (
    <main className="min-h-screen bg-surface">
      <Container className="py-24">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sage hover:text-sage-hover mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          {/* Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-text-primary mb-6">
            Book a Discovery Call
          </h1>

          <p className="text-xl text-text-muted mb-12">
            20 minutes to see if a done-for-you AI storefront makes sense for your business. No
            pitch, just answers.
          </p>

          {/* Contact options */}
          <div className="space-y-4">
            <a
              href="https://calendly.com/maconai/discovery"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-6 bg-surface-alt rounded-xl hover:bg-sage-light/10 transition-colors group"
            >
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center group-hover:bg-sage-light/30 transition-colors">
                <Calendar className="w-6 h-6 text-sage" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-text-primary text-lg">Schedule a call</h2>
                <p className="text-text-muted">Pick a time that works for you</p>
              </div>
              <Button className="bg-sage hover:bg-sage-hover text-white">Book Now</Button>
            </a>

            <a
              href="mailto:hello@maconaisolutions.com"
              className="flex items-center gap-4 p-6 bg-surface-alt rounded-xl hover:bg-sage-light/10 transition-colors group"
            >
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center group-hover:bg-sage-light/30 transition-colors">
                <Mail className="w-6 h-6 text-sage" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-text-primary text-lg">Send an email</h2>
                <p className="text-text-muted">hello@maconaisolutions.com</p>
              </div>
            </a>
          </div>

          {/* What to expect */}
          <div className="mt-16 p-8 bg-surface-alt rounded-2xl">
            <h3 className="font-serif text-xl font-bold text-text-primary mb-4">
              What to expect on the call
            </h3>
            <ul className="space-y-3 text-text-muted">
              <li className="flex items-start gap-3">
                <span className="text-sage font-bold">1.</span>
                We'll learn about your business and current booking process
              </li>
              <li className="flex items-start gap-3">
                <span className="text-sage font-bold">2.</span>
                We'll share how a 3-tier storefront could work for your services
              </li>
              <li className="flex items-start gap-3">
                <span className="text-sage font-bold">3.</span>
                If there's a fit, we'll discuss next steps
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </main>
  );
}
