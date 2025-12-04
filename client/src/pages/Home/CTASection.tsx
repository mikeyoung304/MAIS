import { Link } from 'react-router-dom';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * CTASection - Clean, minimal call-to-action
 *
 * No fluff. Just the invitation and a clear next step.
 */
export function CTASection() {
  return (
    <section id="cta" aria-labelledby="cta-heading" className="py-24 sm:py-32 bg-white">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2
            id="cta-heading"
            className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-macon-navy mb-6"
          >
            Ready to get your life back?
          </h2>

          <p className="text-xl text-neutral-600 mb-10">
            Let's talk about what's keeping you up at night. 15 minutes. No sales pitch. Just
            clarity.
          </p>

          <Button
            asChild
            size="lg"
            className="bg-macon-orange hover:bg-macon-orange-dark text-white font-semibold text-lg px-10 py-7 rounded-full group transition-all duration-300 hover:shadow-lg"
          >
            <Link to="/packages" className="flex items-center gap-2">
              Book your free call
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>

          <p className="mt-6 text-sm text-neutral-400">
            Or email us at{' '}
            <a
              href="mailto:hello@maconai.com"
              className="text-macon-navy hover:text-macon-orange transition-colors"
            >
              hello@maconai.com
            </a>
          </p>
        </div>
      </Container>
    </section>
  );
}
