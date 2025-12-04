import { useMemo } from 'react';
import { Download, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { BookingDto } from '@macon/contracts';

interface BookingListProps {
  bookings: BookingDto[];
  isLoading: boolean;
  onExportCSV: () => void;
}

export function BookingList({ bookings, isLoading, onExportCSV }: BookingListProps) {
  const hasBookings = useMemo(() => bookings.length > 0, [bookings.length]);

  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Bookings</h2>
        <Button
          onClick={onExportCSV}
          variant="outline"
          size="lg"
          disabled={!hasBookings}
          className="border-white/20 text-white/90 hover:bg-macon-navy-700 hover:text-white text-base"
        >
          <Download className="w-5 h-5 mr-2" />
          Export CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/20 hover:bg-macon-navy-700">
            <TableHead className="text-white/90 text-lg">Couple</TableHead>
            <TableHead className="text-white/90 text-lg">Date</TableHead>
            <TableHead className="text-white/90 text-lg">Package</TableHead>
            <TableHead className="text-right text-white/90 text-lg">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-macon-navy-700">
              <TableCell colSpan={4} className="py-4">
                <TableSkeleton rows={5} />
              </TableCell>
            </TableRow>
          ) : !hasBookings ? (
            <TableRow className="hover:bg-macon-navy-700">
              <TableCell colSpan={4} className="py-0">
                <EmptyState
                  icon={Calendar}
                  title="Your calendar is ready for clients"
                  description="Share your booking link to start filling up your schedule."
                  className="py-12"
                />
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => (
              <TableRow key={booking.id} className="border-white/20 hover:bg-macon-navy-700">
                <TableCell className="font-medium text-white text-base">
                  {booking.coupleName}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-white/30 bg-macon-navy-700 text-white/70 text-base"
                  >
                    {booking.eventDate}
                  </Badge>
                </TableCell>
                <TableCell className="text-white/90 text-base">{booking.packageId}</TableCell>
                <TableCell className="text-right font-medium text-white/60 text-xl">
                  {formatCurrency(booking.totalCents)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
