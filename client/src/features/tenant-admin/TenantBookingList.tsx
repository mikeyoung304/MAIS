import { useMemo, useState } from "react";
import { Download, Loader2, Filter, Calendar, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { BookingDto } from "@macon/contracts";

/**
 * Sanitizes a CSV field to prevent CSV injection attacks.
 * Dangerous characters that could be interpreted as formulas by Excel/Google Sheets
 * are prefixed with a single quote to prevent execution.
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */
const sanitizeCsvField = (field: string | null | undefined): string => {
  if (!field) return "";

  // Convert to string if needed
  const str = String(field);

  // Characters that can trigger formula execution in spreadsheets
  const dangerousChars = ["=", "+", "-", "@", "\t", "\r", "\n"];

  // If field starts with dangerous character, prefix with single quote
  if (dangerousChars.some((char) => str.startsWith(char))) {
    return `'${str}`;
  }

  // Escape quotes by doubling them and wrap in quotes if contains comma or quote
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Maps BookingDto status to display-friendly lowercase status
 */
const getDisplayStatus = (status: BookingDto["status"]): string => {
  switch (status) {
    case "PAID":
      return "confirmed";
    case "REFUNDED":
      return "refunded";
    case "CANCELED":
      return "cancelled";
    default:
      return "confirmed";
  }
};

interface TenantBookingListProps {
  bookings: BookingDto[];
  isLoading: boolean;
}

/**
 * TenantBookingList Component
 *
 * Displays bookings in an elegant card-based layout
 * Design: Matches landing page aesthetic with sage accents
 */
export function TenantBookingList({ bookings, isLoading }: TenantBookingListProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const hasBookings = useMemo(() => bookings.length > 0, [bookings.length]);
  const hasActiveFilters = dateFrom || dateTo || statusFilter !== "all";

  // Filter bookings by date range and status
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const eventDate = new Date(booking.eventDate);
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;

      // Date range filter
      if (from && eventDate < from) return false;
      if (to && eventDate > to) return false;

      // Status filter - map BookingDto status to display status for comparison
      if (statusFilter !== "all") {
        const displayStatus = getDisplayStatus(booking.status);
        if (displayStatus !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, dateFrom, dateTo, statusFilter]);

  const exportToCSV = () => {
    if (filteredBookings.length === 0) return;

    const headers = ["Couple", "Email", "Event Date", "Package", "Status", "Total"];
    const rows = filteredBookings.map((b) => [
      sanitizeCsvField(b.coupleName),
      sanitizeCsvField(b.email),
      sanitizeCsvField(b.eventDate),
      sanitizeCsvField(b.packageId),
      sanitizeCsvField(getDisplayStatus(b.status)),
      sanitizeCsvField(`$${(b.totalCents / 100).toFixed(2)}`),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
  };

  if (isLoading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" />
        <p className="text-text-muted mt-3">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">Your Bookings</h2>
          <p className="text-text-muted text-sm mt-1">
            {hasBookings
              ? `${filteredBookings.length}${filteredBookings.length !== bookings.length ? ` of ${bookings.length}` : ""} booking${filteredBookings.length !== 1 ? "s" : ""}`
              : "No bookings yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="ghost"
            size="sm"
            className={`text-text-muted hover:text-sage hover:bg-sage/10 ${hasActiveFilters ? "bg-sage/10 text-sage" : ""}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1.5 w-2 h-2 bg-sage rounded-full" />
            )}
          </Button>
          {hasBookings && (
            <Button
              onClick={exportToCSV}
              variant="ghost"
              size="sm"
              disabled={filteredBookings.length === 0}
              className="text-text-muted hover:text-sage hover:bg-sage/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-text-primary text-sm font-medium">
                From Date
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border-sage-light/30 text-text-primary focus:border-sage focus:ring-sage/20 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo" className="text-text-primary text-sm font-medium">
                To Date
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border-sage-light/30 text-text-primary focus:border-sage focus:ring-sage/20 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-text-primary text-sm font-medium">
                Status
              </Label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-sage-light/30 text-text-primary rounded-xl focus:border-sage focus:ring-sage/20 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-sage-light/10">
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="text-text-muted hover:text-sage"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasBookings && (
        <EmptyState
          icon={Calendar}
          title="Your calendar is ready for clients"
          description="Share your booking link to start filling up your schedule. Your bookings will appear here."
        />
      )}

      {/* No Matches State */}
      {hasBookings && filteredBookings.length === 0 && (
        <EmptyState
          icon={Filter}
          title="No matches found"
          description="Try adjusting your filters or date range above."
          action={
            <Button
              onClick={clearFilters}
              variant="ghost"
              className="text-sage hover:bg-sage/10"
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* Bookings List */}
      {filteredBookings.length > 0 && (
        <div className="space-y-3">
          {filteredBookings.map((booking, index) => {
            const status = getDisplayStatus(booking.status);
            const eventDate = new Date(booking.eventDate);
            const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = eventDate.getDate();
            const monthYear = eventDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            return (
              <div
                key={booking.id}
                className="group bg-surface-alt rounded-2xl border border-sage-light/20 hover:border-sage-light/40 p-5 transition-all duration-200 hover:shadow-soft"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <div className="flex items-center gap-5">
                  {/* Date */}
                  <div className="w-16 h-16 bg-sage/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium uppercase text-sage">{dayName}</span>
                    <span className="font-serif text-2xl font-bold text-text-primary">{dayNumber}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-text-primary">{booking.coupleName}</h3>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        {booking.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {monthYear}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <span className="font-serif text-xl font-bold text-sage">
                      {formatCurrency(booking.totalCents)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
