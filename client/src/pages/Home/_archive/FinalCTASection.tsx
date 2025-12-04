import { Link } from 'react-router-dom';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * FinalCTASection - Final Call to Action
 *
 * Clean, focused CTA section with earth tone styling.
 * Links to contact/discovery call form.
 */
export function FinalCTASection() {
  return (
    <section id="final-cta" aria-labelledby="final-cta-heading" className="py-24 sm:py-32 bg-sage">
      <Container>
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h2
            id="final-cta-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Ready for a storefront that sells while you serve?
          </h2>

          {/* Body */}
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
            If you're a service business owner who's serious about growth but done with duct-taped
            systems, MaconAI can help.
          </p>

          {/* CTA Button */}
          <Button
            asChild
            size="lg"
            className="bg-white text-sage hover:bg-white/90 font-semibold text-lg px-10 py-6 rounded-full group transition-all duration-300"
          >
            <Link to="/contact" className="flex items-center gap-2">
              Book a Discovery Call
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
