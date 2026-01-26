import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import {
  getTenantBySlug,
  getProjectById,
  getProjectByIdForTenant,
  getProjectTimeline,
  TenantNotFoundError,
  type ProjectTimelineEvent,
} from '@/lib/tenant';
import { auth, getBackendToken } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import ProjectHubChatWidget from '@/components/chat/ProjectHubChatWidget';

/**
 * Role type for Project Hub view
 * - customer: Accessing via token link (public access)
 * - tenant: Logged in tenant viewing their own project (authenticated)
 */
type ProjectHubRole = 'customer' | 'tenant';

interface ProjectPageProps {
  params: Promise<{
    slug: string;
    projectId: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
}

/**
 * Customer Project View Page (Slug-based)
 *
 * Displays project status, booking details, and provides chat access
 * to the Project Hub agent for customer self-service.
 *
 * Route: /t/[slug]/project/[projectId]?token=xxx
 *
 * Security: Uses JWT access token for authentication.
 * Token is validated server-side and contains:
 * - projectId: Must match URL
 * - tenantId: Must match tenant context
 * - customerId: For customer isolation
 */

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const tenant = await getTenantBySlug(slug);
    return {
      title: `Your Project | ${tenant.name}`,
      description: `View and manage your project with ${tenant.name}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Your Project',
      robots: { index: false, follow: false },
    };
  }
}

export default async function CustomerProjectPage({ params, searchParams }: ProjectPageProps) {
  const { slug, projectId } = await params;
  const { token } = await searchParams;

  // Get tenant first (needed for both auth paths)
  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Role detection priority: token > session
  // This allows tenants to use customer links for support viewing
  let role: ProjectHubRole;
  let project;
  let timeline: ProjectTimelineEvent[] = [];

  if (token) {
    // Token present: Customer view (or tenant using customer link for support)
    role = 'customer';
    project = await getProjectById(tenant.apiKeyPublic, projectId, { token });

    if (!project) {
      // Token invalid, expired, or project not found
      redirect(`/t/${slug}?error=invalid_token`);
    }

    // Fetch timeline with token auth
    timeline = await getProjectTimeline(tenant.apiKeyPublic, projectId, token);
  } else {
    // No token: Check for authenticated tenant session
    const session = await auth();

    if (session?.user?.tenantId === tenant.id) {
      // Tenant is logged in and owns this tenant - use session auth
      role = 'tenant';

      // Get backend token for API call
      const backendToken = await getBackendToken();
      if (!backendToken) {
        // Session exists but token missing - shouldn't happen, redirect to login
        redirect(`/login?callbackUrl=/t/${slug}/project/${projectId}`);
      }

      project = await getProjectByIdForTenant(backendToken, projectId);

      if (!project) {
        // Project not found or not owned by this tenant
        redirect(`/t/${slug}?error=project_not_found`);
      }

      // For tenant view, timeline can also be fetched via the admin endpoint
      // For now, we'll skip timeline for tenant view (they have dashboard access)
      timeline = [];
    } else {
      // No token and no valid session - access denied
      redirect(`/t/${slug}?error=access_required`);
    }
  }

  // Extract branding colors
  const branding = tenant.branding as { primaryColor?: string } | null;
  const primaryColor = branding?.primaryColor || '#8B9E86';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-40"
        style={{ borderBottomColor: `${primaryColor}20` }}
      >
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">{tenant.name}</h1>
              <p className="text-sm text-neutral-500">Project Hub</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={project.project.status} />
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Overview Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-neutral-400" />
                  Project Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500">Event Date</p>
                      <p className="font-medium text-neutral-900">
                        {formatDate(project.booking.eventDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500">Service</p>
                      <p className="font-medium text-neutral-900">{project.booking.serviceName}</p>
                    </div>
                  </div>
                </div>

                {/* Customer greeting */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: `${primaryColor}10` }}>
                  <p className="text-neutral-700">
                    Hi <span className="font-medium">{project.booking.customerName}</span>! We're
                    excited to work with you. Use the chat below to ask questions, request changes,
                    or get help with your booking.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pending Requests Banner */}
            {project.hasPendingRequests && (
              <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">
                        {project.pendingRequests.length} Pending Request
                        {project.pendingRequests.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-amber-700">
                        Your request{project.pendingRequests.length > 1 ? 's are' : ' is'} being
                        reviewed. We'll notify you once processed.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Timeline */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-neutral-400" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length > 0 ? (
                  <div className="space-y-4">
                    {timeline.slice(0, 10).map((event, index) => (
                      <TimelineItem
                        key={event.id}
                        event={event}
                        isLast={index === timeline.length - 1 || index === 9}
                        primaryColor={primaryColor}
                      />
                    ))}
                    {timeline.length > 10 && (
                      <p className="text-sm text-neutral-500 text-center pt-2">
                        + {timeline.length - 10} more events
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-neutral-500">No activity yet</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Updates will appear here as your project progresses
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Chat Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="w-5 h-5" style={{ color: primaryColor }} />
                    Need Help?
                  </CardTitle>
                  <p className="text-sm text-neutral-500 mt-1">
                    Chat with our assistant for quick answers
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <ProjectHubChatWidget
                    projectId={projectId}
                    tenantApiKey={tenant.apiKeyPublic}
                    businessName={tenant.name}
                    customerName={project.booking.customerName}
                    primaryColor={primaryColor}
                    accessToken={token}
                    contextType={role}
                    showContextIndicator={role === 'tenant'}
                    inline
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> =
    {
      ACTIVE: {
        label: 'Active',
        className: 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      },
      COMPLETED: {
        label: 'Completed',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      },
      CANCELLED: {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
      },
      ON_HOLD: {
        label: 'On Hold',
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <Clock className="w-3.5 h-3.5" />,
      },
    };

  const config = statusConfig[status] || {
    label: status,
    className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * Timeline item component
 */
function TimelineItem({
  event,
  isLast,
  primaryColor,
}: {
  event: ProjectTimelineEvent;
  isLast: boolean;
  primaryColor: string;
}) {
  const eventConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    PROJECT_CREATED: {
      label: 'Project created',
      icon: <FileText className="w-4 h-4" />,
    },
    REQUEST_SUBMITTED: {
      label: 'Request submitted',
      icon: <MessageCircle className="w-4 h-4" />,
    },
    REQUEST_APPROVED: {
      label: 'Request approved',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    REQUEST_DENIED: {
      label: 'Request declined',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    MESSAGE_SENT: {
      label: 'Message sent',
      icon: <MessageCircle className="w-4 h-4" />,
    },
    STATUS_CHANGED: {
      label: 'Status updated',
      icon: <ChevronRight className="w-4 h-4" />,
    },
  };

  const config = eventConfig[event.type] || {
    label: event.type.replace(/_/g, ' ').toLowerCase(),
    icon: <ChevronRight className="w-4 h-4" />,
  };

  const payload = event.payload as { type?: string; message?: string; reason?: string };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
        >
          {config.icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-neutral-200 my-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="font-medium text-neutral-900">{config.label}</p>
        {payload.type && (
          <p className="text-sm text-neutral-600">Type: {payload.type.replace(/_/g, ' ')}</p>
        )}
        {payload.message && <p className="text-sm text-neutral-600 mt-1">{payload.message}</p>}
        {payload.reason && (
          <p className="text-sm text-neutral-600 mt-1">Reason: {payload.reason}</p>
        )}
        <p className="text-xs text-neutral-400 mt-1">
          {new Date(event.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
