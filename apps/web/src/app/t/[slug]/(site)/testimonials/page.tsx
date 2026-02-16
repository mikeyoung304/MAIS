import { redirectSlugSubPage } from '@/lib/tenant-redirect';

export default async function TestimonialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirectSlugSubPage(slug, 'testimonials');
}
