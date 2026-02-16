import { redirectDomainSubPage } from '@/lib/tenant-redirect';

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  redirectDomainSubPage(domain, 'services');
}
