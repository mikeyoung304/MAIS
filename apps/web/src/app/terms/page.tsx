import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service - HANDLED',
  description: 'Terms of Service for HANDLED - the platform for service professionals.',
};

export default function TermsPage() {
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
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-8">
          Terms of Service
        </h1>

        <div className="prose prose-invert prose-neutral max-w-none">
          <p className="text-text-muted text-lg mb-8">Last updated: December 30, 2025</p>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              1. Agreement to Terms
            </h2>
            <p className="text-text-muted leading-relaxed">
              By accessing or using HANDLED ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              2. Description of Service
            </h2>
            <p className="text-text-muted leading-relaxed">
              HANDLED provides a platform for service professionals to create online storefronts,
              manage bookings, accept payments, and communicate with clients. We offer various
              subscription tiers with different features and capabilities.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              3. User Accounts
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">
              To use certain features of the Service, you must create an account. You are
              responsible for:
            </p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              4. Subscription and Payments
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">
              HANDLED offers subscription-based services. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Pay all applicable fees for your chosen subscription tier</li>
              <li>Automatic renewal of your subscription unless cancelled</li>
              <li>A 14-day free trial period for new accounts</li>
              <li>Cancel anytime with no long-term contracts</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              5. Acceptable Use
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Transmit any harmful code or malware</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              6. Intellectual Property
            </h2>
            <p className="text-text-muted leading-relaxed">
              The Service and its original content, features, and functionality are owned by HANDLED
              and are protected by international copyright, trademark, and other intellectual
              property laws. You retain ownership of any content you create using the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              7. Limitation of Liability
            </h2>
            <p className="text-text-muted leading-relaxed">
              HANDLED shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of or inability to use the Service. Our
              liability is limited to the amount you paid for the Service in the past 12 months.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              8. Changes to Terms
            </h2>
            <p className="text-text-muted leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify you of any
              changes by posting the new Terms of Service on this page and updating the "Last
              updated" date.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              9. Contact Us
            </h2>
            <p className="text-text-muted leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@gethandled.ai" className="text-sage hover:underline">
                legal@gethandled.ai
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-serif text-xl font-bold text-text-primary">
            HANDLED
          </Link>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/contact" className="hover:text-text-primary transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
