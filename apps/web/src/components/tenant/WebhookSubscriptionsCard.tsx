'use client';

/**
 * WebhookSubscriptionsCard
 *
 * Card component for managing webhook subscriptions within
 * the tenant settings Integrations section.
 *
 * Features:
 * - List existing webhooks with URL, events, active state
 * - Create new webhook with URL + event multi-select
 * - Toggle active/inactive via switch
 * - Delete with confirmation dialog
 * - Secret shown once on creation with copy-to-clipboard
 *
 * Backend routes: GET/POST /v1/tenant-admin/webhooks,
 * PATCH/DELETE /v1/tenant-admin/webhooks/:id
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/Skeleton';
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
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { logger } from '@/lib/logger';

/** Webhook subscription from the API */
interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
}

/** Available event types that tenants can subscribe to */
const AVAILABLE_EVENTS = [
  { value: 'appointment.created', label: 'Booking Created' },
  { value: 'appointment.canceled', label: 'Booking Canceled' },
  { value: 'appointment.rescheduled', label: 'Booking Rescheduled' },
] as const;

export function WebhookSubscriptionsCard() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Secret display after creation
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WebhookSubscription | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/tenant-admin/webhooks', {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to load webhooks (${res.status})`
        );
      }

      const data: WebhookSubscription[] = await res.json();
      setSubscriptions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load webhooks';
      logger.error('WebhookSubscriptionsCard: fetchSubscriptions failed', { error: message });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCreate = async () => {
    if (!newUrl || newEvents.length === 0) {
      setCreateError('URL and at least one event are required.');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const res = await fetch('/api/tenant-admin/webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error || `Failed to create webhook (${res.status})`
        );
      }

      const created: WebhookSubscription = await res.json();
      setSubscriptions((prev) => [...prev, created]);

      // Show the secret one time
      if (created.secret) {
        setRevealedSecret({ id: created.id, secret: created.secret });
      }

      // Reset form
      setNewUrl('');
      setNewEvents([]);
      setShowCreate(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create webhook';
      logger.error('WebhookSubscriptionsCard: handleCreate failed', { error: message });
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (sub: WebhookSubscription) => {
    try {
      setTogglingId(sub.id);
      const res = await fetch(`/api/tenant-admin/webhooks/${sub.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sub.active }),
      });

      if (!res.ok) {
        throw new Error('Failed to update webhook');
      }

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, active: !s.active } : s))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle webhook';
      logger.error('WebhookSubscriptionsCard: handleToggle failed', { error: message });
      setError(message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/tenant-admin/webhooks/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete webhook');
      }

      setSubscriptions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete webhook';
      logger.error('WebhookSubscriptionsCard: handleDelete failed', { error: message });
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card colorScheme="dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-sage" />
            Webhooks
          </CardTitle>
          <CardDescription>Send events to external services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton width="100%" height={60} className="bg-neutral-700" />
          <Skeleton width="100%" height={60} className="bg-neutral-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card colorScheme="dark">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-sage" />
                Webhooks
              </CardTitle>
              <CardDescription>Send booking events to external services like Zapier</CardDescription>
            </div>
            {subscriptions.length > 0 && (
              <Badge variant="secondary">{subscriptions.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-950/50 p-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-400">{error}</p>
                <Button
                  variant="ghost-light"
                  size="sm"
                  onClick={() => { setError(null); fetchSubscriptions(); }}
                  className="mt-2 text-red-400 hover:text-red-300"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Secret reveal banner (shown once after creation) */}
          {revealedSecret && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-300">
                Webhook secret — copy it now, it won&apos;t be shown again
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-neutral-900 px-3 py-2 text-xs font-mono text-text-primary break-all">
                  {revealedSecret.secret}
                </code>
                <Button
                  variant="outline-light"
                  size="icon"
                  onClick={() => handleCopySecret(revealedSecret.secret)}
                >
                  {copiedSecret ? (
                    <CheckCircle className="h-4 w-4 text-sage" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost-light"
                size="sm"
                onClick={() => setRevealedSecret(null)}
                className="text-amber-400 hover:text-amber-300"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Subscription list */}
          {subscriptions.length === 0 && !showCreate && (
            <div className="text-center py-6">
              <Webhook className="mx-auto h-8 w-8 text-text-muted mb-3" />
              <p className="text-sm text-text-muted mb-4">
                No webhooks yet. Add one to connect external tools.
              </p>
              <Button variant="sage" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          )}

          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between rounded-lg border border-neutral-700 bg-surface p-4"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <ExternalLink className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  <p className="text-sm font-medium text-text-primary truncate">{sub.url}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sub.events.map((event) => (
                    <Badge key={event} variant="outline" className="text-[10px]">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Switch
                  checked={sub.active}
                  onCheckedChange={() => handleToggle(sub)}
                  disabled={togglingId === sub.id}
                />
                <Button
                  variant="ghost-light"
                  size="icon"
                  onClick={() => setDeleteTarget(sub)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Create form */}
          {showCreate && (
            <div className="rounded-lg border border-neutral-700 bg-surface p-4 space-y-4">
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input
                  placeholder="https://hooks.zapier.com/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="bg-neutral-900 border-neutral-700 text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <button
                      key={event.value}
                      type="button"
                      onClick={() => toggleEvent(event.value)}
                      className={`
                        rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                        ${
                          newEvents.includes(event.value)
                            ? 'bg-sage text-white'
                            : 'bg-neutral-800 text-text-muted hover:bg-neutral-700 hover:text-text-primary'
                        }
                      `}
                    >
                      {event.label}
                    </button>
                  ))}
                </div>
              </div>
              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="sage"
                  size="sm"
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Webhook'
                  )}
                </Button>
                <Button
                  variant="ghost-light"
                  size="sm"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError(null);
                    setNewUrl('');
                    setNewEvents([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Add button (when list has items) */}
          {subscriptions.length > 0 && !showCreate && (
            <Button variant="outline-light" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Events will no longer be sent to{' '}
              <span className="font-mono text-xs">{deleteTarget?.url}</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
