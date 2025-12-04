import { Edit, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ServicesListProps } from './types';

export function ServicesList({
  services,
  onEdit,
  onDelete,
  onToggleActive,
  isLoading = false,
}: ServicesListProps) {
  const formatPrice = (priceCents: number): string => {
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/20 hover:bg-macon-navy-700">
            <TableHead className="text-white/90 text-lg">Name</TableHead>
            <TableHead className="text-white/90 text-lg">Slug</TableHead>
            <TableHead className="text-white/90 text-lg">Duration</TableHead>
            <TableHead className="text-white/90 text-lg">Buffer</TableHead>
            <TableHead className="text-white/90 text-lg">Price</TableHead>
            <TableHead className="text-white/90 text-lg">Status</TableHead>
            <TableHead className="text-white/90 text-lg">Sort Order</TableHead>
            <TableHead className="text-white/90 text-lg">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/60" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && services.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-white/90">
                No services found. Create your first service to get started.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            services.map((service) => (
              <TableRow key={service.id} className="border-white/20 hover:bg-macon-navy-700">
                <TableCell className="font-medium text-white text-base">{service.name}</TableCell>
                <TableCell className="text-white/70 text-base font-mono">{service.slug}</TableCell>
                <TableCell className="text-white/70 text-base">
                  {formatDuration(service.durationMinutes)}
                </TableCell>
                <TableCell className="text-white/70 text-base">
                  {formatDuration(service.bufferMinutes)}
                </TableCell>
                <TableCell className="text-white/70 text-base">
                  {formatPrice(service.priceCents)}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onToggleActive(service)}
                    className="cursor-pointer"
                    aria-label={`Toggle service status (currently ${service.active ? 'active' : 'inactive'})`}
                  >
                    {service.active ? (
                      <Badge className="gap-1.5 bg-green-900 text-green-100 border-green-700 hover:bg-green-800">
                        <CheckCircle className="h-3 w-3" aria-hidden="true" />
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 bg-macon-navy-700 text-white/70 border-white/20 hover:bg-macon-navy-600"
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        Inactive
                      </Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-white/70 text-base">{service.sortOrder}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => onEdit(service)}
                      className="border-white/20 text-white/70 hover:bg-macon-navy-700"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="default"
                      onClick={() => onDelete(service)}
                      className="text-destructive hover:bg-macon-navy-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
