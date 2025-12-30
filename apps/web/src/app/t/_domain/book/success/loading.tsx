import { BookingSuccessPageSkeleton } from '@/components/tenant/LoadingSkeletons';

/**
 * Loading state for the custom domain booking success page
 * Displayed while fetching booking confirmation data
 */
export default function DomainSuccessLoading() {
  return <BookingSuccessPageSkeleton />;
}
