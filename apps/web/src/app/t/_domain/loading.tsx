import { HomePageSkeleton } from '@/components/tenant/LoadingSkeletons';

/**
 * Loading skeleton for custom domain tenant pages
 *
 * Displayed while the page data is being fetched.
 * Uses shared skeleton component for consistency.
 */
export default function DomainPageLoading() {
  return <HomePageSkeleton />;
}
