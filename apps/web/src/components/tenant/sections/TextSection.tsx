import Image from 'next/image';
import type { TextSection as TextSectionType, TenantPublicDto } from '@macon/contracts';

interface TextSectionProps extends TextSectionType {
  tenant: TenantPublicDto;
}

/**
 * Text section component for content blocks with optional image
 *
 * Features:
 * - Headline and content text
 * - Optional image with configurable position (left/right)
 * - Markdown-like paragraph support (split on double newlines)
 */
export function TextSection({
  headline,
  content,
  imageUrl,
  imagePosition = 'left',
  tenant,
}: TextSectionProps) {
  const showImage = Boolean(imageUrl);

  return (
    <section className="bg-surface-alt py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div
          className={`grid gap-12 md:grid-cols-2 md:items-center ${
            imagePosition === 'right' ? 'md:[&>*:first-child]:order-2' : ''
          }`}
        >
          {/* Image */}
          {showImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src={imageUrl!}
                alt={headline || `About ${tenant.name}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ) : (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-sage/20 to-sage/5">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-serif text-6xl text-sage/30">
                  {tenant.name.charAt(0)}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            {headline && (
              <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
                {headline}
              </h2>
            )}
            <div className={headline ? 'mt-6 space-y-4' : 'space-y-4'}>
              {content.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-lg text-text-muted leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
