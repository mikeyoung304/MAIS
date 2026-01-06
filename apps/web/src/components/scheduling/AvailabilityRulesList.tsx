'use client';

import { useState } from 'react';
import { Trash2, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatTime } from '@/lib/format';
import { DAYS_OF_WEEK } from '@/lib/constants';

/**
 * DTO Types
 */
interface AvailabilityRuleDto {
  id: string;
  tenantId: string;
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface AvailabilityRulesListProps {
  rules: AvailabilityRuleDto[];
  services: ServiceDto[];
  onRuleDeleted: () => void;
}

/**
 * Day-specific color schemes for visual distinction
 */
const DAY_COLORS: Record<number, string> = {
  0: 'bg-purple-100 border-purple-300 text-purple-800', // Sunday
  1: 'bg-blue-100 border-blue-300 text-blue-800', // Monday
  2: 'bg-green-100 border-green-300 text-green-800', // Tuesday
  3: 'bg-yellow-100 border-yellow-300 text-yellow-800', // Wednesday
  4: 'bg-orange-100 border-orange-300 text-orange-800', // Thursday
  5: 'bg-red-100 border-red-300 text-red-800', // Friday
  6: 'bg-indigo-100 border-indigo-300 text-indigo-800', // Saturday
};

/**
 * AvailabilityRulesList Component
 *
 * Displays availability rules grouped by day of week in a visual weekly schedule.
 */
export function AvailabilityRulesList({
  rules,
  services,
  onRuleDeleted,
}: AvailabilityRulesListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AvailabilityRuleDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create a map of service IDs to service names
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  // Group rules by day of week
  const rulesByDay = DAYS_OF_WEEK.map((day, dayIndex) => {
    const dayRules = rules
      .filter((rule) => rule.dayOfWeek === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return { day, dayIndex, rules: dayRules };
  });

  const handleDeleteClick = (rule: AvailabilityRuleDto) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tenant-admin/availability-rules/${ruleToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        onRuleDeleted();
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRuleToDelete(null);
  };

  if (rules.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-sage" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rulesByDay.map(({ day, dayIndex, rules: dayRules }) => (
              <div key={dayIndex} className="space-y-2">
                {/* Day Header */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{day}</h3>
                  <Badge variant="outline" className={DAY_COLORS[dayIndex]}>
                    {dayRules.length}
                  </Badge>
                </div>

                {/* Rules for this day */}
                <div className="space-y-2">
                  {dayRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-center text-sm text-text-muted">
                      No availability
                    </div>
                  ) : (
                    dayRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="group rounded-xl border border-neutral-100 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {/* Time Range */}
                            <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                              <Clock className="h-3.5 w-3.5 text-sage" />
                              {formatTime(rule.startTime)} - {formatTime(rule.endTime)}
                            </div>

                            {/* Service Name */}
                            <div className="mt-1 text-xs text-text-muted">
                              {rule.serviceId
                                ? serviceMap.get(rule.serviceId) || 'Unknown Service'
                                : 'All Services'}
                            </div>

                            {/* Effective Dates */}
                            {rule.effectiveTo && (
                              <div className="mt-1 text-xs text-text-muted">
                                Until {new Date(rule.effectiveTo).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {/* Delete Button */}
                          <Button
                            onClick={() => handleDeleteClick(rule)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete rule for ${day} ${formatTime(rule.startTime)} - ${formatTime(rule.endTime)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Availability Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {ruleToDelete && (
                <>
                  Are you sure you want to delete the availability rule for{' '}
                  <strong className="text-text-primary">
                    {DAYS_OF_WEEK[ruleToDelete.dayOfWeek]}
                  </strong>{' '}
                  from{' '}
                  <strong className="text-text-primary">
                    {formatTime(ruleToDelete.startTime)} - {formatTime(ruleToDelete.endTime)}
                  </strong>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">This action cannot be undone</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
              <li>This time slot will no longer be available for bookings</li>
              <li>Existing appointments during this time will not be affected</li>
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Rule'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
