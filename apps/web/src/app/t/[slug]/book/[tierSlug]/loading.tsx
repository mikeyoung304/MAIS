import { BookingPageSkeleton } from '@/components/tenant/LoadingSkeletons';

/**
 * Loading state for the booking page
 * Displayed while fetching package data
 */
export default function BookingLoading() {
  return <BookingPageSkeleton />;
}
