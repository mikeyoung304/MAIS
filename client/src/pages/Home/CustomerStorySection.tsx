import { Container } from '@/ui/Container';
import { Quote } from 'lucide-react';

/**
 * CustomerStorySection - Stories That Stick "Customer Story" Pattern
 *
 * One powerful transformation story beats ten weak testimonials.
 * Follows: Challenge → Solution → Transformation arc.
 */
export function CustomerStorySection() {
  return (
    <section
      id="customer-story"
      aria-labelledby="customer-story-heading"
      className="py-24 sm:py-32 bg-macon-navy"
    >
      <Container>
        <div className="max-w-4xl mx-auto text-center">
          <Quote className="w-12 h-12 text-macon-orange/40 mx-auto mb-8" />

          <blockquote className="text-2xl sm:text-3xl md:text-4xl text-white font-light leading-relaxed mb-8">
            "I was working 70-hour weeks and still falling behind. Now I work 40, make more money,
            and actually went on vacation for the first time in three years."
          </blockquote>

          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-macon-orange flex items-center justify-center text-white font-bold text-lg">
              CM
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Casey M.</p>
              <p className="text-white/60 text-sm">Salon Owner, Atlanta</p>
            </div>
          </div>

          {/* The transformation metric */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex flex-wrap justify-center gap-12">
              <div>
                <p className="text-4xl font-bold text-macon-orange">30%</p>
                <p className="text-white/60 text-sm">Revenue increase</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-macon-orange">15</p>
                <p className="text-white/60 text-sm">Hours saved per week</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-macon-orange">90</p>
                <p className="text-white/60 text-sm">Days to results</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
