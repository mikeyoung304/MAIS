import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy - HANDLED',
  description: 'Privacy Policy for HANDLED - how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>

        <div className="prose prose-invert prose-neutral max-w-none">
          <p className="text-text-muted text-lg mb-8">Last updated: December 30, 2025</p>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              1. Information We Collect
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Account information (name, email, password)</li>
              <li>Business information (business name, services offered)</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Communications you send to us or through our platform</li>
              <li>Booking and transaction data</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Communicate with you about products, services, and events</li>
              <li>Monitor and analyze trends, usage, and activities</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              3. Information Sharing
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Service providers who assist in our operations (payment processing, hosting)</li>
              <li>Your clients, when you use our booking and communication features</li>
              <li>Legal authorities when required by law</li>
              <li>Other parties with your explicit consent</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              4. Data Security
            </h2>
            <p className="text-text-muted leading-relaxed">
              We implement appropriate technical and organizational measures to protect your
              personal information. This includes encryption of data in transit and at rest, regular
              security assessments, and access controls. However, no method of transmission over the
              Internet is 100% secure.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              5. Data Retention
            </h2>
            <p className="text-text-muted leading-relaxed">
              We retain your personal information for as long as your account is active or as needed
              to provide you services. We will retain and use your information as necessary to
              comply with legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              6. Your Rights
            </h2>
            <p className="text-text-muted leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-text-muted space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify inaccurate personal data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              7. Cookies and Tracking
            </h2>
            <p className="text-text-muted leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our Service and
              hold certain information. Cookies are files with a small amount of data which may
              include an anonymous unique identifier. You can instruct your browser to refuse all
              cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              8. Third-Party Services
            </h2>
            <p className="text-text-muted leading-relaxed">
              Our Service may contain links to third-party websites and services. We are not
              responsible for the privacy practices of these third parties. We encourage you to read
              the privacy policies of any third-party services you access.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              9. Changes to This Policy
            </h2>
            <p className="text-text-muted leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">
              10. Contact Us
            </h2>
            <p className="text-text-muted leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:mike@gethandled.ai" className="text-sage hover:underline">
                mike@gethandled.ai
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
            <Link href="/terms" className="hover:text-text-primary transition-colors">
              Terms of Service
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
