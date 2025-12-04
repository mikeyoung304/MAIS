import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { BookingDto, PackageDto } from '@macon/contracts';

interface UseBookingConfirmationProps {
  bookingId: string | null;
}

interface UseBookingConfirmationReturn {
  bookingDetails: BookingDto | null;
  packageData: PackageDto | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and manage booking confirmation data
 * Handles both booking details and associated package information
 */
export function useBookingConfirmation({
  bookingId,
}: UseBookingConfirmationProps): UseBookingConfirmationReturn {
  const [bookingDetails, setBookingDetails] = useState<BookingDto | null>(null);
  const [packageData, setPackageData] = useState<PackageDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      return;
    }

    const fetchBooking = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.getBookingById({ params: { id: bookingId } });

        if (response.status === 200) {
          setBookingDetails(response.body);

          // Fetch package data to get names
          const packagesResponse = await api.getPackages();
          if (packagesResponse.status === 200) {
            const pkg = packagesResponse.body.find((p) => p.id === response.body.packageId);
            if (pkg) {
              setPackageData(pkg);
            }
          }
        } else {
          setError('Booking not found');
        }
      } catch (err) {
        logger.error('Error fetching booking', {
          error: err,
          bookingId,
          component: 'useBookingConfirmation',
        });
        setError('Failed to load booking details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  return {
    bookingDetails,
    packageData,
    isLoading,
    error,
  };
}
