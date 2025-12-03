import { Calendar, DollarSign, Package, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface DashboardMetricsProps {
  totalBookings: number;
  totalRevenue: number;
  packagesCount: number;
  blackoutsCount: number;
}

/**
 * DashboardMetrics Component
 *
 * Displays key metrics cards for the admin dashboard
 */
export function DashboardMetrics({
  totalBookings,
  totalRevenue,
  packagesCount,
  blackoutsCount,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-700 rounded">
            <Calendar className="w-5 h-5 text-white/60" />
          </div>
          <div className="text-base text-white/90">Total Bookings</div>
        </div>
        <div className="text-4xl font-bold text-white">{totalBookings}</div>
      </Card>

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-700 rounded">
            <DollarSign className="w-5 h-5 text-white/60" />
          </div>
          <div className="text-base text-white/90">Total Revenue</div>
        </div>
        <div className="text-4xl font-bold text-white/60">
          {formatCurrency(totalRevenue)}
        </div>
      </Card>

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-700 rounded">
            <Package className="w-5 h-5 text-white/60" />
          </div>
          <div className="text-base text-white/90">Total Packages</div>
        </div>
        <div className="text-4xl font-bold text-white">{packagesCount}</div>
      </Card>

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-700 rounded">
            <XCircle className="w-5 h-5 text-white/60" />
          </div>
          <div className="text-base text-white/90">Blackout Dates</div>
        </div>
        <div className="text-4xl font-bold text-white/60">{blackoutsCount}</div>
      </Card>
    </div>
  );
}
