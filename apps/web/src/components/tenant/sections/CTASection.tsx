import { Button } from '@/components/ui/button';
import type { CTASection as CTASectionType, TenantPublicDto } from '@macon/contracts';

interface CTASectionProps extends CTASectionType {
  tenant: TenantPublicDto;
  basePath?: string;
}

/**
 * CTA section component for call-to-action blocks
 *
 * Features:
 * - Sage background with white text
 * - Headline and optional subheadline
 * - CTA button linking to packages
 */
export function CTASection({
  headline,
  subheadline,
  ctaText = 'Get Started',
  basePath = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tenant: _tenant,
}: CTASectionProps) {
  return (
    <section className="bg-sage py-32 md:py-40">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">{headline}</h2>
        {subheadline && (
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">{subheadline}</p>
        )}
        <div className="mt-10">
          <Button
            asChild
            variant="outline"
            size="xl"
            className="border-white bg-white text-sage hover:bg-white/90"
          >
            <a href={`${basePath}#packages`}>{ctaText}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
