import { Container } from '@/ui/Container';

export function WhoItsForSection() {
  return (
    <section
      id="who-its-for"
      aria-labelledby="who-its-for-heading"
      className="py-16 md:py-24 bg-white"
    >
      <Container>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="space-y-4">
            <h2
              id="who-its-for-heading"
              className="font-serif text-3xl sm:text-4xl font-semibold text-text-primary leading-tight"
            >
              Designed for independent professionals
            </h2>
            <p className="text-lg text-text-muted leading-relaxed">
              Mais is built for creative service businesses who sell time, taste, and expertise — and
              want fewer tools between interest and booked work.
            </p>
          </div>

          <p className="text-sm text-text-muted/80">
            Not built for DIY site tinkerers or product-based e-commerce.
          </p>
        </div>
      </Container>
    </section>
  );
}
