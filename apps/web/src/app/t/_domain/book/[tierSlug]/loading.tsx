import { BookingPageSkeleton } from '@/components/tenant/LoadingSkeletons';

/**
 * Loading state for the custom domain booking page
 * Displayed while fetching package data
 */
export default function DomainBookingLoading() {
  return <BookingPageSkeleton />;
}
