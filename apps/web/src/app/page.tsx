export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white py-32 md:py-40">
      <div className="mx-auto max-w-3xl px-6 text-center">
        {/* Brand Name */}
        <p className="text-sm font-medium uppercase tracking-widest text-sage">
          Business Growth Club
        </p>

        {/* Headline */}
        <h1 className="mt-8 font-serif text-5xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-6xl md:text-7xl">
          Macon AI Solutions.
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-8 max-w-xl text-xl font-light leading-relaxed text-text-muted md:text-2xl">
          Your business growth partner. AI consulting, seamless booking, and marketing
          automation—so you can focus on your craft.
        </p>

        {/* Coming Soon Badge */}
        <div className="mt-12">
          <span className="inline-block rounded-full border border-neutral-200 bg-neutral-50 px-6 py-3 text-sm font-medium text-text-muted">
            Launching Soon
          </span>
        </div>

        {/* Trust Signal */}
        <p className="mt-16 text-sm text-text-muted">
          Partnering with entrepreneurs and small business owners through revenue-sharing.
        </p>
      </div>
    </main>
  );
}
