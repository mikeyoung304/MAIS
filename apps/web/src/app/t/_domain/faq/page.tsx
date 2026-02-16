import { redirectDomainSubPage } from '@/lib/tenant-redirect';

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  redirectDomainSubPage(domain, 'faq');
}
