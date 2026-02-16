import { redirectSlugSubPage } from '@/lib/tenant-redirect';

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirectSlugSubPage(slug, 'about');
}
