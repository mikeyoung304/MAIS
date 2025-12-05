/**
 * RemindersCard Component
 *
 * Shows pending booking reminders for tenant dashboard.
 * Reminders are processed lazily when tenant loads dashboard.
 *
 * Design: Matches landing page aesthetic with sage accents
 */

import {
  Bell,
  Loader2,
  AlertCircle,
  Calendar,
  Mail,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ANIMATION_TRANSITION } from '@/lib/animation-constants';
import { useRemindersManager } from './hooks/useRemindersManager';

export function RemindersCard() {
  const manager = useRemindersManager();

  if (manager.loading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" aria-hidden="true" />
        <p className="text-text-muted mt-3">Loading reminders...</p>
      </div>
    );
  }

  // No pending reminders
  if (!manager.status || manager.status.pendingCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">Booking Reminders</h2>
            <p className="text-text-muted text-sm mt-1">
              Automated reminders sent before events
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={manager.fetchStatus}
            disabled={manager.loading}
            className="text-text-muted hover:text-sage"
            aria-label="Refresh reminders"
          >
            <RefreshCw className={`w-4 h-4 ${manager.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>

        <EmptyState
          icon={Bell}
          title="No pending reminders"
          description="Reminder emails are automatically sent 7 days before each booking. All reminders are up to date."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">Booking Reminders</h2>
          <p className="text-text-muted text-sm mt-1">
            {manager.status.pendingCount} pending reminder{manager.status.pendingCount !== 1 ? 's' : ''} to send
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={manager.status.pendingCount > 0 ? 'Pending' : 'Up to date'}
            variant={manager.status.pendingCount > 0 ? 'warning' : 'success'}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={manager.fetchStatus}
            disabled={manager.loading}
            className="text-text-muted hover:text-sage"
            aria-label="Refresh reminders"
          >
            <RefreshCw className={`w-4 h-4 ${manager.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {manager.error && (
        <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3">
          <AlertCircle
            className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="text-sm text-danger-700">{manager.error}</span>
        </div>
      )}

      {manager.processResult && (
        <div className="p-4 bg-sage/10 border border-sage/20 rounded-xl flex items-start gap-3">
          <CheckCircle2
            className="w-5 h-5 text-sage flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="text-sm text-text-primary">
            Processed {manager.processResult.processed} reminder{manager.processResult.processed !== 1 ? 's' : ''}
            {manager.processResult.failed > 0 && ` (${manager.processResult.failed} failed)`}
          </span>
        </div>
      )}

      {/* Upcoming Reminders Preview */}
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6 space-y-4">
        <h3 className="font-medium text-text-primary">Upcoming Reminders</h3>

        <div className="divide-y divide-sage-light/10">
          {manager.status.upcomingReminders.map((reminder) => (
            <div
              key={reminder.bookingId}
              className="py-4 first:pt-0 last:pb-0 flex items-center justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium text-text-primary">{reminder.coupleName}</p>
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    Event: {manager.formatDate(reminder.eventDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                    Reminder due: {manager.formatDate(reminder.reminderDueDate)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-medium ${
                    reminder.daysUntilEvent <= 7
                      ? 'text-warning-600'
                      : 'text-text-muted'
                  }`}
                >
                  {reminder.daysUntilEvent} days until event
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Process Reminders Button */}
      <div className="flex justify-end">
        <Button
          onClick={manager.handleProcessReminders}
          disabled={manager.processing || manager.status.pendingCount === 0}
          className={`bg-sage hover:bg-sage-hover text-white rounded-full px-6 h-11 shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER}`}
        >
          {manager.processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Sending Reminders...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" aria-hidden="true" />
              Send Pending Reminders ({manager.status.pendingCount})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
