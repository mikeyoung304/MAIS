import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTenantByDomain, TenantNotFoundError } from '@/lib/tenant';
import { Button } from '@/components/ui/button';

interface AboutPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  if (!domain) {
    return { title: 'About', robots: { index: false, follow: false } };
  }

  try {
    const tenant = await getTenantByDomain(domain);
    const aboutContent = tenant.branding?.landingPage?.about?.content || '';
    const description = aboutContent.slice(0, 160) || `Learn more about ${tenant.name}`;

    return {
      title: `About | ${tenant.name}`,
      description,
      openGraph: {
        title: `About | ${tenant.name}`,
        description,
        images: tenant.branding?.landingPage?.about?.imageUrl
          ? [{ url: tenant.branding.landingPage.about.imageUrl }]
          : [],
      },
    };
  } catch {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;

  if (!domain) {
    notFound();
  }

  try {
    const tenant = await getTenantByDomain(domain);
    const about = tenant.branding?.landingPage?.about;

    const headline = about?.headline || `About ${tenant.name}`;
    const content = about?.content || `Welcome to ${tenant.name}. We're passionate about delivering exceptional service.`;
    const imageUrl = about?.imageUrl;
    const imagePosition = about?.imagePosition || 'left';

    // For custom domains, use relative paths (no /t/[slug] prefix)
    const basePath = '';

    return (
      <div id="main-content">
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className={`grid gap-12 md:grid-cols-2 md:items-center ${
              imagePosition === 'right' ? 'md:[&>*:first-child]:order-2' : ''
            }`}>
              {imageUrl ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                  <Image src={imageUrl} alt={`About ${tenant.name}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
                </div>
              ) : (
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-sage/20 to-sage/5">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-6xl text-sage/30">{tenant.name.charAt(0)}</span>
                  </div>
                </div>
              )}
              <div>
                <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">{headline}</h1>
                <div className="mt-6 space-y-4">
                  {content.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-lg text-text-muted leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-sage py-32 md:py-40">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">Ready to work together?</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">Let&apos;s create something beautiful together.</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild variant="outline" size="xl" className="border-white bg-white text-sage hover:bg-white/90">
                <a href={`${basePath}/#packages`}>View Packages</a>
              </Button>
              <Button asChild variant="outline" size="xl" className="border-white/50 bg-transparent text-white hover:bg-white/10">
                <Link href={`${basePath}/contact?domain=${domain}`}>Get in Touch</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
