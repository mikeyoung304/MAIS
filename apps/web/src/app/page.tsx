import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-32 md:py-40">
      <div className="mx-auto max-w-4xl px-6 text-center">
        {/* Hero Section */}
        <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl md:text-6xl">
          Grow your business.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted md:text-xl">
          Partner with Macon AI Solutions for AI consulting, seamless booking, professional
          websites, and marketing automation.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button variant="sage" size="xl">
            Get Started
          </Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>

        {/* Trust Signal */}
        <p className="mt-16 text-sm text-text-muted">
          Trusted by entrepreneurs and small business owners across the country.
        </p>
      </div>

      {/* Build Status */}
      <div className="mt-24 rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary">Next.js Migration Status</h2>
        <ul className="mt-4 space-y-2 text-left text-sm text-text-muted">
          <li className="flex items-center gap-2">
            <span className="text-success-500">&#10003;</span> Next.js 14 app created
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success-500">&#10003;</span> Tailwind CSS configured with design
            tokens
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success-500">&#10003;</span> Button component ported
          </li>
          <li className="flex items-center gap-2">
            <span className="text-warning-500">&#9675;</span> ts-rest SSR client (in progress)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-warning-500">&#9675;</span> NextAuth.js integration (pending)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-warning-500">&#9675;</span> Tenant site pages (pending)
          </li>
        </ul>
      </div>
    </div>
  );
}
