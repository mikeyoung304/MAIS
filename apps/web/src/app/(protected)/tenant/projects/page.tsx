'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  MessageCircle,
  Inbox,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Project {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  createdAt: string;
  booking: {
    id: string;
    eventDate: string;
    tier: {
      title: string;
    } | null;
    customer: {
      name: string;
      email: string;
    };
  };
}

interface PendingRequest {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  version: number;
  project: {
    id: string;
    booking: {
      eventDate: string;
      customer: {
        name: string;
        email: string;
      };
      tier: {
        title: string;
      } | null;
    };
  };
}

interface TenantBootstrap {
  activeProjectCount: number;
  pendingRequestCount: number;
  recentActivityCount: number;
  greeting: string;
}

// ============================================================================
// Tenant Projects Dashboard
// ============================================================================

/**
 * Tenant Projects Dashboard
 *
 * Displays:
 * - Summary stats (active projects, pending requests)
 * - Pending requests requiring action (with urgency indicators)
 * - Projects table with status and last activity
 */
export default function TenantProjectsPage() {
  const { tenantId, isAuthenticated } = useAuth();
  const [bootstrap, setBootstrap] = useState<TenantBootstrap | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch via tenant-admin proxy (auth handled server-side via session)
      const fetchOptions = { credentials: 'include' as const };

      // Fetch bootstrap data, projects, and pending requests in parallel
      const [bootstrapRes, projectsRes, requestsRes] = await Promise.all([
        fetch('/api/tenant-admin/projects/bootstrap', fetchOptions),
        fetch('/api/tenant-admin/projects', fetchOptions),
        fetch('/api/tenant-admin/projects/requests/pending', fetchOptions),
      ]);

      if (bootstrapRes.ok) {
        const data = await bootstrapRes.json();
        setBootstrap(data);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : data.projects || []);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setPendingRequests(Array.isArray(data) ? data : data.requests || []);
      }
    } catch (err) {
      logger.error(
        'Projects data fetch failed',
        err instanceof Error ? err : { error: String(err) }
      );
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData, tenantId]);

  // Handle request approval with optimistic updates
  const handleApprove = async (requestId: string, version: number) => {
    if (!isAuthenticated) return;
    setActionLoading(requestId);

    // Store previous state for rollback
    const previousRequests = pendingRequests;
    const previousBootstrap = bootstrap;

    // Optimistic update: remove request and decrement count
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    setBootstrap((prev) =>
      prev
        ? {
            ...prev,
            pendingRequestCount: Math.max(0, prev.pendingRequestCount - 1),
          }
        : null
    );

    try {
      const response = await fetch('/api/tenant-admin/projects/requests/approve', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, expectedVersion: version }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve request');
      }

      // Success - UI already updated optimistically
    } catch (err) {
      logger.error('Request approval failed', err instanceof Error ? err : { error: String(err) });
      // Rollback optimistic updates on failure
      setPendingRequests(previousRequests);
      setBootstrap(previousBootstrap);
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle request denial with optimistic updates
  const handleDeny = async (requestId: string, version: number) => {
    if (!isAuthenticated) return;

    const reason = prompt('Please provide a reason for denying this request:');
    if (!reason) {
      return;
    }

    setActionLoading(requestId);

    // Store previous state for rollback
    const previousRequests = pendingRequests;
    const previousBootstrap = bootstrap;

    // Optimistic update: remove request and decrement count
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    setBootstrap((prev) =>
      prev
        ? {
            ...prev,
            pendingRequestCount: Math.max(0, prev.pendingRequestCount - 1),
          }
        : null
    );

    try {
      const response = await fetch('/api/tenant-admin/projects/requests/deny', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, expectedVersion: version, reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deny request');
      }

      // Success - UI already updated optimistically
    } catch (err) {
      logger.error('Request denial failed', err instanceof Error ? err : { error: String(err) });
      // Rollback optimistic updates on failure
      setPendingRequests(previousRequests);
      setBootstrap(previousBootstrap);
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate urgency for pending requests (72h expiry)
  const getUrgency = (expiresAt: string) => {
    const hoursRemaining = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining <= 12) return 'critical';
    if (hoursRemaining <= 24) return 'high';
    if (hoursRemaining <= 48) return 'medium';
    return 'low';
  };

  const urgencyConfig = {
    critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
    high: { label: 'High', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    low: { label: 'Low', className: 'bg-green-100 text-green-700 border-green-200' },
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Projects</h1>
          <p className="mt-2 text-text-muted">
            {bootstrap?.greeting || 'Manage your customer projects and requests.'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-800 bg-red-950/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-300">Error loading data</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card colorScheme="dark" className="transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Active Projects</CardTitle>
            <Users className="h-5 w-5 text-sage" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
              ) : (
                (bootstrap?.activeProjectCount ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card colorScheme="dark" className="transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Pending Requests</CardTitle>
            <Inbox className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
              ) : (
                (bootstrap?.pendingRequestCount ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card colorScheme="dark" className="transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Recent Activity</CardTitle>
            <MessageCircle className="h-5 w-5 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
              ) : (
                (bootstrap?.recentActivityCount ?? 0)
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card colorScheme="dark" className="transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Total Projects</CardTitle>
            <Calendar className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-neutral-700" />
              ) : (
                projects.length
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary mb-4">Pending Requests</h2>
          <div className="space-y-4">
            {pendingRequests.map((request) => {
              const urgency = getUrgency(request.expiresAt);
              const urgencyStyle = urgencyConfig[urgency];
              const isActionLoading = actionLoading === request.id;

              return (
                <Card key={request.id} colorScheme="dark" className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Request Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${urgencyStyle.className}`}
                          >
                            {urgencyStyle.label}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                            {request.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-medium text-text-primary">
                          {request.project.booking.customer.name}
                        </p>
                        <p className="text-sm text-text-muted">
                          {request.project.booking.tier?.title || 'Service'} •{' '}
                          {formatDate(request.project.booking.eventDate)}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Submitted {formatDate(request.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeny(request.id, request.version)}
                          disabled={isActionLoading}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                        <Button
                          variant="sage"
                          size="sm"
                          onClick={() => handleApprove(request.id, request.version)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div>
        <h2 className="font-serif text-xl font-bold text-text-primary mb-4">All Projects</h2>

        {isLoading ? (
          <Card colorScheme="dark">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded bg-neutral-700" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card colorScheme="dark">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-text-muted mb-4" />
              <h3 className="font-semibold text-text-primary mb-2">No projects yet</h3>
              <p className="text-text-muted">
                Projects are created automatically when customers complete bookings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card colorScheme="dark" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Customer
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Service
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Event Date
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Status
                    </th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-neutral-700/50 last:border-0">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-text-primary">
                            {project.booking.customer.name}
                          </p>
                          <p className="text-sm text-text-muted">
                            {project.booking.customer.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {project.booking.tier?.title || 'Service'}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {formatDate(project.booking.eventDate)}
                      </td>
                      <td className="px-6 py-4">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/tenant/projects/${project.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Project status badge component
 */
function ProjectStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> =
    {
      ACTIVE: {
        label: 'Active',
        className: 'bg-green-900/50 text-green-300 border-green-700/50',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      },
      COMPLETED: {
        label: 'Completed',
        className: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      },
      CANCELLED: {
        label: 'Cancelled',
        className: 'bg-red-900/50 text-red-300 border-red-700/50',
        icon: <XCircle className="w-3.5 h-3.5" />,
      },
      ON_HOLD: {
        label: 'On Hold',
        className: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
        icon: <Clock className="w-3.5 h-3.5" />,
      },
    };

  const config = statusConfig[status] || {
    label: status,
    className: 'bg-neutral-900/50 text-neutral-300 border-neutral-700/50',
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
