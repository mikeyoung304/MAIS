import { Container } from '@/ui/Container';

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-heading" className="py-16 md:py-24 bg-white">
      <Container>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2
              id="about-heading"
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-macon-navy via-macon-orange to-macon-teal"
            >
              About HANDLED
            </h2>
          </div>
          <div className="prose prose-xl max-w-none">
            <p className="text-xl text-neutral-700 leading-relaxed mb-6">
              HANDLED believes your business deserves done-for-you tech that just works. We partner
              with service professionals—photographers, coaches, therapists—providing professional
              websites, seamless booking, and payment processing, all through a membership that
              aligns our success with yours.
            </p>
            <p className="text-xl text-neutral-700 leading-relaxed mb-6">
              Our team combines deep tech expertise with hands-on business experience. We understand
              the challenges service professionals face because we've been there— juggling admin
              tasks, chasing bookings, and struggling with tech.
            </p>
            <p className="text-xl text-neutral-700 leading-relaxed">
              That's why we built HANDLED: a membership where we handle your tech so you can focus
              on what you do best. Want to know more?{' '}
              <a href="#team" className="text-macon-orange hover:text-macon-orange-dark underline">
                Learn about our team.
              </a>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
