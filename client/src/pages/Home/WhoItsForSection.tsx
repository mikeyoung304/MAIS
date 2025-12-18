import { Container } from '@/ui/Container';

export function WhoItsForSection() {
  return (
    <section
      id="who-its-for"
      aria-labelledby="who-its-for-heading"
      className="py-24 md:py-32 bg-white"
    >
      <Container>
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-6">
            <h2
              id="who-its-for-heading"
              className="font-serif text-4xl sm:text-5xl font-bold text-text-primary leading-tight"
            >
              Who Mais is for
            </h2>
            <p className="text-lg md:text-xl text-text-muted leading-relaxed">
              Mais is built for solo creative service businesses — photographers, private chefs,
              designers, consultants, and other professionals who sell their time and expertise.
              <br />
              <br />
              You don&apos;t need more tools. You need a system that turns interest into booked, paid
              work.
            </p>
          </div>

          <div className="space-y-5">
            <h3 className="text-2xl font-semibold text-text-primary">Who this is not for</h3>
            <ul className="text-left inline-block text-lg text-text-muted space-y-3">
              <li>DIY website builders who enjoy tinkering</li>
              <li>Product-based e-commerce stores</li>
              <li>Businesses looking for the cheapest software option</li>
            </ul>
          </div>

          <p className="text-lg md:text-xl text-text-primary font-medium">
            If you want clarity, boundaries, and leverage — you&apos;re in the right place.
          </p>
        </div>
      </Container>
    </section>
  );
}
