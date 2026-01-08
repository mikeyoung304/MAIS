import { BookingSuccessPageSkeleton } from '@/components/tenant/LoadingSkeletons';

/**
 * Loading state for the tenant booking success page
 * Displayed while fetching booking confirmation data
 */
export default function TenantSuccessLoading() {
  return <BookingSuccessPageSkeleton />;
}
