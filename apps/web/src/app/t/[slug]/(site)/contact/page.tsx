import { redirectSlugSubPage } from '@/lib/tenant-redirect';

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirectSlugSubPage(slug, 'contact');
}
