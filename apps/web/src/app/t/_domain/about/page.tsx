import { redirectDomainSubPage } from '@/lib/tenant-redirect';

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  redirectDomainSubPage(domain, 'about');
}
