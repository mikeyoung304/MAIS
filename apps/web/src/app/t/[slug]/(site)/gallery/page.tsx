import { redirectSlugSubPage } from '@/lib/tenant-redirect';

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirectSlugSubPage(slug, 'gallery');
}
