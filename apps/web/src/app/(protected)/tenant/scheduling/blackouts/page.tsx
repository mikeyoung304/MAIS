'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CalendarX, Plus, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { BlackoutForm } from '@/components/scheduling/BlackoutForm';
import { logger } from '@/lib/logger';

interface Blackout {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

/**
 * Tenant Blackouts Page
 *
 * Allows tenant admins to manage blackout dates when they are unavailable.
 * Customers cannot book during blackout periods.
 */
export default function TenantBlackoutsPage() {
  const { isAuthenticated } = useAuth();
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBlackouts = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/tenant-admin/blackouts');

      if (response.ok) {
        const data = await response.json();
        setBlackouts(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        setError('Failed to load blackout dates');
      }
    } catch (err) {
      logger.error('Failed to fetch blackouts', err instanceof Error ? err : undefined);
      setError('Failed to load blackout dates');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBlackouts();
  }, [fetchBlackouts]);

  const handleCreate = async (data: { startDate: string; endDate: string; reason?: string }) => {
    try {
      const response = await fetch('/api/tenant-admin/blackouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create blackout');
      }

      setIsDialogOpen(false);
      await fetchBlackouts();
    } catch (err) {
      logger.error('Failed to create blackout', err instanceof Error ? err : undefined);
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/tenant-admin/blackouts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete blackout');
      }

      await fetchBlackouts();
    } catch (err) {
      logger.error('Failed to delete blackout', err instanceof Error ? err : undefined);
      setError('Failed to delete blackout');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isDateRange = (startDate: string, endDate: string) => {
    return startDate !== endDate;
  };

  const sortedBlackouts = [...blackouts].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Blackout Dates</h1>
            <p className="mt-2 text-text-muted">Manage dates when you are unavailable</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Blackout Dates</h1>
          <p className="mt-2 text-text-muted">
            {blackouts.length === 0
              ? 'Block out dates when you are unavailable for bookings'
              : `${blackouts.length} blackout date${blackouts.length !== 1 ? 's' : ''} set`}
          </p>
        </div>
        <Button variant="sage" className="rounded-full" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Blackout
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-700"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {blackouts.length === 0 ? (
        <Card className="border-2 border-dashed border-amber-200/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-amber-950/30 p-4">
              <CalendarX className="h-8 w-8 text-amber-400" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No blackout dates</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Block out dates when you are unavailable. Customers will not be able to book during
              these times.
            </p>
            <Button variant="sage" className="rounded-full" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Blackout
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Blackouts List */
        <div className="space-y-3">
          {sortedBlackouts.map((blackout) => (
            <Card
              key={blackout.id}
              className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-amber-950/30 p-3">
                    <CalendarX className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">
                      {formatDate(blackout.startDate)}
                      {isDateRange(blackout.startDate, blackout.endDate) && (
                        <span className="text-text-muted"> - {formatDate(blackout.endDate)}</span>
                      )}
                    </p>
                    {blackout.reason && (
                      <p className="text-sm text-text-muted">{blackout.reason}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(blackout.id)}
                  disabled={deletingId === blackout.id}
                  className="rounded-full text-red-600 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                  aria-label={`Delete blackout for ${formatDate(blackout.startDate)}`}
                >
                  {deletingId === blackout.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Blackout Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent maxWidth="md">
          <DialogHeader>
            <DialogTitle>Add Blackout Date</DialogTitle>
            <DialogDescription>
              Block out dates when you are unavailable for bookings. You can select a single day or
              a date range.
            </DialogDescription>
          </DialogHeader>
          <BlackoutForm onSubmit={handleCreate} onCancel={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
