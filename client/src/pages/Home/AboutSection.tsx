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
              About Macon AI Solutions
            </h2>
          </div>
          <div className="prose prose-xl max-w-none">
            <p className="text-xl text-neutral-700 leading-relaxed mb-6">
              Macon AI Solutions believes business growth shouldn't require wearing all the hats.
              Our mission is to partner with entrepreneurs and small business owners, providing
              AI-powered consulting, seamless scheduling, professional websites, and marketing
              automation—all through a revenue-sharing model that aligns our success with yours.
            </p>
            <p className="text-xl text-neutral-700 leading-relaxed mb-6">
              Headquartered in Macon, Georgia, our team combines deep AI expertise with hands-on
              business experience. We understand the challenges small business owners face because
              we've been there—juggling admin tasks, chasing leads, and struggling with tech.
            </p>
            <p className="text-xl text-neutral-700 leading-relaxed">
              That's why we built the Macon AI Club: a partnership where we invest in your growth,
              not just sell you software. Want to know more?{' '}
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
