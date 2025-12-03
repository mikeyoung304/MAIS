/**
 * LandingPage Orchestrator Component
 *
 * Renders all enabled landing page sections in order.
 * Sections are configurable via tenant admin dashboard.
 * Falls back to segment selector if no sections are enabled.
 */

import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Container } from '@/ui/Container';
import { Loading } from '@/ui/Loading';
import { FeatureErrorBoundary } from '@/components/errors';
import { useSegments } from '@/features/catalog/hooks';
import { SegmentCard, ChoiceGrid } from '@/features/storefront';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { TenantPublicDto, SegmentDto } from '@macon/contracts';
import { HeroSection } from './sections/HeroSection';
import { SocialProofBar } from './sections/SocialProofBar';
import { AboutSection } from './sections/AboutSection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { AccommodationSection } from './sections/AccommodationSection';
import { GallerySection } from './sections/GallerySection';
import { FaqSection } from './sections/FaqSection';
import { FinalCtaSection } from './sections/FinalCtaSection';

/**
 * Helper function to remove undefined/null values from objects
 * for clean Schema.org JSON-LD output
 */
function cleanSchemaObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key as keyof T] = value;
    }
    return acc;
  }, {} as Partial<T>);
}

/**
 * LocalBusiness Schema.org structured data
 * Helps search engines understand the business entity
 */
function BusinessSchema({ tenant }: { tenant: TenantPublicDto }) {
  const landingPage = tenant.branding?.landingPage;

  const schema = cleanSchemaObject({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: tenant.name,
    url: `https://app.maconaisolutions.com/t/${tenant.slug}`,
    logo: tenant.branding?.logoUrl,
    description: landingPage?.about?.description || landingPage?.hero?.subheadline,
  });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * FAQPage Schema.org structured data
 * Enables FAQ rich results in search
 */
function FaqSchema({ tenant }: { tenant: TenantPublicDto }) {
  const faqs = tenant.branding?.landingPage?.faq?.faqs;

  if (!faqs || faqs.length === 0) {
    return null;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Review Schema.org structured data (embedded in LocalBusiness)
 * Enables review rich results and star ratings in search
 */
function ReviewSchema({ tenant }: { tenant: TenantPublicDto }) {
  const testimonials = tenant.branding?.landingPage?.testimonials?.testimonials;

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  const schema = cleanSchemaObject({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: tenant.name,
    review: testimonials.map((t) =>
      cleanSchemaObject({
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: t.name,
        },
        reviewBody: t.quote,
        reviewRating: t.rating ? {
          '@type': 'Rating',
          ratingValue: t.rating,
        } : undefined,
      })
    ),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: testimonials.length,
    },
  });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * ImageGallery Schema.org structured data
 * Enables image gallery rich results
 */
function GallerySchema({ tenant }: { tenant: TenantPublicDto }) {
  const images = tenant.branding?.landingPage?.gallery?.images;

  if (!images || images.length === 0) {
    return null;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: tenant.branding?.landingPage?.gallery?.heading || `${tenant.name} Gallery`,
    image: images.map((img) => ({
      '@type': 'ImageObject',
      url: img.imageUrl,
      caption: img.caption || undefined,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface LandingPageProps {
  tenant: TenantPublicDto;
}

function SegmentSelectorSection() {
  const { data: segments, isLoading, error } = useSegments();

  if (isLoading) {
    return <Loading label="Loading experiences..." />;
  }

  if (error) {
    return (
      <Container className="py-12">
        <div className="text-center py-16 bg-neutral-50 rounded-xl border border-neutral-200">
          <AlertTriangle className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">
            Unable to load experiences
          </h3>
          <p className="text-neutral-600">
            Please refresh the page to try again.
          </p>
        </div>
      </Container>
    );
  }

  // 0 segments: redirect to root tiers
  if (!segments || segments.length === 0) {
    return <Navigate to="tiers" replace />;
  }

  // 1 segment: auto-skip to that segment's tiers
  if (segments.length === 1) {
    return <Navigate to={`s/${segments[0].slug}`} />;
  }

  // 2+ segments: show segment selector
  return (
    <section id="experiences" className="py-16 bg-white">
      <Container>
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">
            What brings you here today?
          </h2>
          <p className="text-lg md:text-xl text-neutral-600 max-w-3xl mx-auto">
            Choose the experience that best fits your needs
          </p>
        </div>

        <ChoiceGrid itemCount={segments.length}>
          {segments.map((segment: SegmentDto) => (
            <SegmentCard key={segment.id} segment={segment} />
          ))}
        </ChoiceGrid>

        <div className="mt-8 text-center">
          <p className="text-neutral-500">
            Not sure which to choose? Pick the one that sounds closest to your needs.
          </p>
        </div>
      </Container>
    </section>
  );
}

function LandingPageContent({ tenant }: LandingPageProps) {
  const landingPage = tenant.branding?.landingPage;
  const sections = landingPage?.sections;
  const hero = landingPage?.hero;
  const about = landingPage?.about;

  // Construct SEO metadata from landing page content
  const pageTitle = hero?.headline
    ? `${tenant.name} - ${hero.headline}`
    : tenant.name;

  const pageDescription =
    hero?.subheadline ||
    about?.description?.slice(0, 160) ||
    `Welcome to ${tenant.name}`;

  const pageImage =
    hero?.backgroundImageUrl ||
    tenant.branding?.logoUrl ||
    undefined;

  // Set page metadata for SEO and social sharing
  usePageMeta({
    title: pageTitle,
    description: pageDescription,
    image: pageImage,
  });

  // If no landing page config or no sections enabled, show just the segment selector
  const hasAnySectionEnabled = sections && Object.values(sections).some((v) => v === true);

  if (!hasAnySectionEnabled) {
    return <SegmentSelectorSection />;
  }

  return (
    <>
      {/* Schema.org Structured Data for SEO */}
      <BusinessSchema tenant={tenant} />
      <FaqSchema tenant={tenant} />
      <ReviewSchema tenant={tenant} />
      <GallerySchema tenant={tenant} />

      <div className="landing-page">
        {/* Hero Section */}
        {sections?.hero && landingPage?.hero && (
          <HeroSection config={landingPage.hero} />
        )}

      {/* Social Proof Bar */}
      {sections?.socialProofBar && landingPage?.socialProofBar && (
        <SocialProofBar config={landingPage.socialProofBar} />
      )}

      {/* Segment Selector */}
      {sections?.segmentSelector && <SegmentSelectorSection />}

      {/* About Section */}
      {sections?.about && landingPage?.about && (
        <AboutSection config={landingPage.about} />
      )}

      {/* Testimonials Section */}
      {sections?.testimonials && landingPage?.testimonials && (
        <TestimonialsSection config={landingPage.testimonials} />
      )}

      {/* Accommodation Section */}
      {sections?.accommodation && landingPage?.accommodation && (
        <AccommodationSection config={landingPage.accommodation} />
      )}

      {/* Gallery Section */}
      {sections?.gallery && landingPage?.gallery && (
        <GallerySection config={landingPage.gallery} />
      )}

      {/* FAQ Section */}
      {sections?.faq && landingPage?.faq && (
        <FaqSection config={landingPage.faq} />
      )}

      {/* Final CTA Section */}
      {sections?.finalCta && landingPage?.finalCta && (
        <FinalCtaSection config={landingPage.finalCta} />
      )}
      </div>
    </>
  );
}

export function LandingPage({ tenant }: LandingPageProps) {
  return (
    <FeatureErrorBoundary featureName="Landing Page">
      <LandingPageContent tenant={tenant} />
    </FeatureErrorBoundary>
  );
}
