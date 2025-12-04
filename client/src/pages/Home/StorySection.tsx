import { Container } from '@/ui/Container';

/**
 * StorySection - Stories That Stick "Founder + Purpose" Pattern
 *
 * Combines origin story with purpose to create emotional connection.
 * Uses the "Normal → Explosion → New Normal" narrative arc.
 */
export function StorySection() {
  return (
    <section id="story" aria-labelledby="story-heading" className="py-24 sm:py-32 bg-neutral-50">
      <Container>
        <div className="max-w-3xl mx-auto">
          {/* The Story */}
          <div className="prose prose-lg prose-neutral mx-auto">
            <h2
              id="story-heading"
              className="font-heading text-3xl sm:text-4xl font-bold text-macon-navy mb-8 text-center"
            >
              We built this because we lived it.
            </h2>

            <div className="space-y-6 text-neutral-600 text-lg leading-relaxed">
              <p>
                <span className="text-macon-navy font-semibold">Three years ago</span>, we watched a
                friend close her photography studio. Not because she wasn't talented—she was booked
                solid. But between answering emails at midnight, chasing invoices, and trying to
                figure out Instagram, she had nothing left for the work she loved.
              </p>

              <p>She didn't need another app. She needed a partner.</p>

              <p>
                <span className="text-macon-navy font-semibold">That's what we became.</span> We
                handle the scheduling, the follow-ups, the website, the marketing—everything that
                isn't your craft. You pay us a small percentage of what we help you earn. If you
                don't grow, we don't get paid.
              </p>

              <p className="text-macon-navy font-medium text-xl border-l-4 border-macon-orange pl-6 my-8">
                Our interests are aligned. Your success is our business model.
              </p>

              <p>
                Today, we partner with 50+ business owners across Georgia. Photographers,
                consultants, coaches, event planners—anyone who's great at what they do but drowning
                in everything else.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
