/**
 * CalendarConfigCard Component
 *
 * Allows tenants to configure their Google Calendar integration.
 * Supports uploading service account JSON and setting calendar ID.
 *
 * Design: Matches landing page aesthetic with sage accents
 */

import {
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ANIMATION_TRANSITION } from '@/lib/animation-constants';
import { useCalendarConfigManager } from './hooks/useCalendarConfigManager';

export function CalendarConfigCard() {
  const manager = useCalendarConfigManager();

  if (manager.loading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" aria-hidden="true" />
        <p className="text-text-muted mt-3">Loading calendar status...</p>
      </div>
    );
  }

  // Not configured
  if (!manager.status?.configured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">
              Google Calendar Integration
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Sync bookings to your Google Calendar
            </p>
          </div>
        </div>

        <EmptyState
          icon={Calendar}
          title="Connect your Google Calendar"
          description="Automatically add booking events to your calendar. You'll need a Google Cloud service account with Calendar API access."
          action={
            <>
              {manager.error && (
                <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3 mb-4">
                  <AlertCircle
                    className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-danger-700">{manager.error}</span>
                </div>
              )}
              <Button
                onClick={manager.handleOpenConfigDialog}
                className={`bg-sage hover:bg-sage-hover text-white rounded-full px-8 h-12 shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER}`}
              >
                <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
                Configure Calendar
              </Button>
            </>
          }
        />

        {/* Config Dialog */}
        <ConfigDialog manager={manager} />
      </div>
    );
  }

  // Configured - show status
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-text-primary">
            Google Calendar Integration
          </h2>
          <p className="text-text-muted text-sm mt-1">Calendar is connected and ready</p>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-sage" aria-hidden="true" />
          <StatusBadge status="Connected" />
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

      {/* Calendar Info */}
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-sage-light/10">
          <span className="text-text-muted text-sm">Calendar ID</span>
          <code className="text-xs bg-white px-3 py-1.5 rounded-lg font-mono text-text-primary border border-sage-light/20">
            {manager.status.calendarId || 'Unknown'}
          </code>
        </div>

        {/* Test Result */}
        {manager.testResult && (
          <div className="mt-4">
            {manager.testResult.success ? (
              <div className="p-3 bg-sage/10 border border-sage/20 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-sage" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Connection successful</p>
                  {manager.testResult.calendarName && (
                    <p className="text-xs text-text-muted">
                      Calendar: {manager.testResult.calendarName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-danger-50 border border-danger-100 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-danger-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-danger-700">Connection failed</p>
                  {manager.testResult.error && (
                    <p className="text-xs text-danger-600">{manager.testResult.error}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={manager.handleTestConnection}
          disabled={manager.testing}
          variant="outline"
          className="rounded-full h-11"
        >
          {manager.testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Test Connection
            </>
          )}
        </Button>

        <Button
          onClick={manager.handleOpenConfigDialog}
          variant="outline"
          className="rounded-full h-11"
        >
          <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
          Update Config
        </Button>

        <Button
          onClick={manager.handleOpenDeleteDialog}
          variant="ghost"
          className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 rounded-full h-11"
        >
          <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
          Remove
        </Button>
      </div>

      {/* Config Dialog */}
      <ConfigDialog manager={manager} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={manager.showDeleteDialog} onOpenChange={manager.handleCloseDeleteDialog}>
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Remove Calendar Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your Google Calendar configuration? New bookings
              will no longer be added to your calendar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={manager.handleCloseDeleteDialog}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={manager.handleDeleteConfig}
              disabled={manager.deleting}
              className="bg-danger-600 hover:bg-danger-700 text-white rounded-full"
            >
              {manager.deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Removing...
                </>
              ) : (
                'Remove Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Extracted config dialog component for reuse
interface ConfigDialogProps {
  manager: ReturnType<typeof useCalendarConfigManager>;
}

function ConfigDialog({ manager }: ConfigDialogProps) {
  return (
    <Dialog open={manager.showConfigDialog} onOpenChange={manager.handleCloseConfigDialog}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle>Configure Google Calendar</DialogTitle>
          <DialogDescription>
            Upload your Google Cloud service account JSON and enter your calendar ID.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-id">Calendar ID</Label>
              <Input
                id="calendar-id"
                type="text"
                placeholder="your-calendar@group.calendar.google.com"
                value={manager.calendarId}
                onChange={(e) => {
                  manager.setCalendarId(e.target.value);
                  manager.clearCalendarIdError();
                }}
                className={manager.configErrors.calendarId ? 'border-danger-500' : ''}
                aria-invalid={!!manager.configErrors.calendarId}
                aria-describedby={manager.configErrors.calendarId ? 'calendar-id-error' : undefined}
              />
              {manager.configErrors.calendarId && (
                <p id="calendar-id-error" className="text-sm text-danger-600">
                  {manager.configErrors.calendarId}
                </p>
              )}
              <p className="text-xs text-text-muted">
                Find this in Google Calendar settings → Integrate calendar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-account">Service Account JSON</Label>
              <input
                ref={manager.fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={manager.handleFileUpload}
                className="hidden"
                id="service-account-file"
                aria-label="Upload service account JSON file"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manager.fileInputRef.current?.click()}
                  className="rounded-full"
                >
                  <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                  Upload JSON File
                </Button>
                {manager.serviceAccountJson && (
                  <span className="flex items-center text-sm text-sage">
                    <CheckCircle2 className="w-4 h-4 mr-1" aria-hidden="true" />
                    File loaded
                  </span>
                )}
              </div>
              {manager.configErrors.serviceAccountJson && (
                <p className="text-sm text-danger-600">{manager.configErrors.serviceAccountJson}</p>
              )}
              <p className="text-xs text-text-muted">
                Download from Google Cloud Console → IAM & Admin → Service Accounts
              </p>
            </div>

            <div className="p-4 bg-sage/5 border border-sage/20 rounded-xl">
              <h4 className="font-medium text-text-primary text-sm mb-2">Setup Guide</h4>
              <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                <li>Create a service account in Google Cloud Console</li>
                <li>Enable the Google Calendar API</li>
                <li>Download the service account JSON key</li>
                <li>Share your calendar with the service account email</li>
              </ol>
              <a
                href="https://developers.google.com/calendar/api/quickstart/nodejs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sage hover:underline mt-2"
              >
                View full documentation
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={manager.handleCloseConfigDialog}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={manager.handleSaveConfig}
            disabled={manager.saving || !manager.calendarId || !manager.serviceAccountJson}
            className="bg-sage hover:bg-sage-hover text-white rounded-full"
          >
            {manager.saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
