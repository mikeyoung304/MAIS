/**
 * Router with lazy loading for code splitting
 * Role-based routing for PLATFORM_ADMIN and TENANT_ADMIN
 */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppShell } from "./app/AppShell";
import { Loading } from "./ui/Loading";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import type { UserRole } from "./contexts/AuthContext";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));
const Package = lazy(() => import("./pages/Package").then(m => ({ default: m.Package })));
const PackageCatalog = lazy(() => import("./pages/PackageCatalog").then(m => ({ default: m.PackageCatalog })));
const SegmentLanding = lazy(() => import("./pages/SegmentLanding").then(m => ({ default: m.SegmentLanding })));
const Success = lazy(() => import("./pages/success").then(m => ({ default: m.Success })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const SignupPage = lazy(() => import("./features/auth/SignupPage").then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import("./features/auth/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));
const Contact = lazy(() => import("./pages/Contact").then(m => ({ default: m.Contact })));
const PlatformAdminDashboard = lazy(() => import("./pages/admin/PlatformAdminDashboard").then(m => ({ default: m.PlatformAdminDashboard })));
const TenantAdminDashboard = lazy(() => import("./pages/tenant/TenantAdminDashboard").then(m => ({ default: m.TenantAdminDashboard })));
const SegmentsManager = lazy(() =>
  import("./features/admin/segments").then((m) => ({ default: m.SegmentsManager }))
);
const TenantForm = lazy(() =>
  import("./features/admin/tenants/TenantForm").then((m) => ({ default: m.TenantForm }))
);

// Storefront tier pages
const StorefrontHome = lazy(() => import("./pages/StorefrontHome").then(m => ({ default: m.StorefrontHome })));
const SegmentTiers = lazy(() => import("./pages/SegmentTiers").then(m => ({ default: m.SegmentTiers })));
const RootTiers = lazy(() => import("./pages/RootTiers").then(m => ({ default: m.RootTiers })));
const SegmentTierDetail = lazy(() => import("./pages/TierDetailPage").then(m => ({ default: m.SegmentTierDetail })));
const RootTierDetail = lazy(() => import("./pages/TierDetailPage").then(m => ({ default: m.RootTierDetail })));

// Scheduling pages (public booking + tenant admin)
const AppointmentBookingPage = lazy(() => import("./pages/AppointmentBooking").then(m => ({ default: m.AppointmentBookingPage })));
const TenantSchedulingServicesPage = lazy(() => import("./pages/tenant/TenantSchedulingServices").then(m => ({ default: m.TenantSchedulingServicesPage })));
const TenantSchedulingAvailabilityPage = lazy(() => import("./pages/tenant/TenantSchedulingAvailability").then(m => ({ default: m.TenantSchedulingAvailabilityPage })));
const TenantSchedulingAppointmentsPage = lazy(() => import("./pages/tenant/TenantSchedulingAppointments").then(m => ({ default: m.TenantSchedulingAppointmentsPage })));

// Visual editor page
const TenantVisualEditorPage = lazy(() => import("./pages/tenant/TenantVisualEditor").then(m => ({ default: m.TenantVisualEditorPage })));

// Public booking management (customer self-service)
const ManageBookingPage = lazy(() => import("./pages/booking-management").then(m => ({ default: m.ManageBookingPage })));

// Tenant storefront layout (white-label customer-facing routes)
const TenantStorefrontLayout = lazy(() => import("./app/TenantStorefrontLayout").then(m => ({ default: m.TenantStorefrontLayout })));

// Wrapper with Suspense
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading label="Loading page" />}>{children}</Suspense>
);

// Protected route wrapper with Suspense
const ProtectedSuspenseWrapper = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}) => (
  <Suspense fallback={<Loading label="Loading page" />}>
    <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
  </Suspense>
);

export const router = createBrowserRouter([
  // Tenant storefront routes (white-label, public, URL-based tenant resolution)
  // e.g., /t/little-bit-farm, /t/little-bit-farm/s/wellness, /t/little-bit-farm/book
  {
    path: "t/:tenantSlug",
    element: <SuspenseWrapper><TenantStorefrontLayout /></SuspenseWrapper>,
    children: [
      { index: true, element: <SuspenseWrapper><StorefrontHome /></SuspenseWrapper> },
      { path: "s/:slug", element: <SuspenseWrapper><SegmentTiers /></SuspenseWrapper> },
      { path: "s/:slug/:tier", element: <SuspenseWrapper><SegmentTierDetail /></SuspenseWrapper> },
      { path: "tiers", element: <SuspenseWrapper><RootTiers /></SuspenseWrapper> },
      { path: "tiers/:tier", element: <SuspenseWrapper><RootTierDetail /></SuspenseWrapper> },
      { path: "book", element: <SuspenseWrapper><AppointmentBookingPage /></SuspenseWrapper> },
    ],
  },
  // Public routes with AppShell (header + footer)
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <SuspenseWrapper><Home /></SuspenseWrapper>,
      },
      // New storefront tier routes
      {
        path: "storefront",
        element: <SuspenseWrapper><StorefrontHome /></SuspenseWrapper>,
      },
      {
        path: "s/:slug",
        element: <SuspenseWrapper><SegmentTiers /></SuspenseWrapper>,
      },
      {
        path: "s/:slug/:tier",
        element: <SuspenseWrapper><SegmentTierDetail /></SuspenseWrapper>,
      },
      {
        path: "tiers",
        element: <SuspenseWrapper><RootTiers /></SuspenseWrapper>,
      },
      {
        path: "tiers/:tier",
        element: <SuspenseWrapper><RootTierDetail /></SuspenseWrapper>,
      },
      // Legacy catalog routes
      {
        path: "packages",
        element: <SuspenseWrapper><PackageCatalog /></SuspenseWrapper>,
      },
      {
        path: "segments/:slug",
        element: <SuspenseWrapper><SegmentLanding /></SuspenseWrapper>,
      },
      {
        path: "package/:slug",
        element: <SuspenseWrapper><Package /></SuspenseWrapper>,
      },
      {
        path: "success",
        element: <SuspenseWrapper><Success /></SuspenseWrapper>,
      },
      {
        path: "login",
        element: <SuspenseWrapper><Login /></SuspenseWrapper>,
      },
      {
        path: "signup",
        element: <SuspenseWrapper><SignupPage /></SuspenseWrapper>,
      },
      {
        path: "forgot-password",
        element: <SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>,
      },
      {
        path: "reset-password",
        element: <SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>,
      },
      {
        path: "contact",
        element: <SuspenseWrapper><Contact /></SuspenseWrapper>,
      },
      // Public appointment booking route
      {
        path: "book",
        element: <SuspenseWrapper><AppointmentBookingPage /></SuspenseWrapper>,
      },
      // Legacy routes - redirect to unified login
      {
        path: "admin/login",
        element: <Navigate to="/login" replace />,
      },
      {
        path: "tenant/login",
        element: <Navigate to="/login" replace />,
      },
    ],
  },
  // Admin routes WITHOUT AppShell (use AdminLayout only)
  {
    path: "admin/dashboard",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
        <PlatformAdminDashboard />
      </ProtectedSuspenseWrapper>
    ),
  },
  {
    path: "admin/segments",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
        <SegmentsManager />
      </ProtectedSuspenseWrapper>
    ),
  },
  {
    path: "admin/tenants/new",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
        <TenantForm />
      </ProtectedSuspenseWrapper>
    ),
  },
  {
    path: "admin/tenants/:id",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
        <TenantForm />
      </ProtectedSuspenseWrapper>
    ),
  },
  // Legacy admin route - redirect to new dashboard
  {
    path: "admin",
    element: <Navigate to="/admin/dashboard" replace />,
  },
  // Tenant admin routes WITHOUT AppShell
  {
    path: "tenant/dashboard",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
        <TenantAdminDashboard />
      </ProtectedSuspenseWrapper>
    ),
  },
  // Tenant admin scheduling routes
  {
    path: "tenant/scheduling/services",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
        <TenantSchedulingServicesPage />
      </ProtectedSuspenseWrapper>
    ),
  },
  {
    path: "tenant/scheduling/availability",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
        <TenantSchedulingAvailabilityPage />
      </ProtectedSuspenseWrapper>
    ),
  },
  {
    path: "tenant/scheduling/appointments",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
        <TenantSchedulingAppointmentsPage />
      </ProtectedSuspenseWrapper>
    ),
  },
  // Visual editor route
  {
    path: "tenant/editor",
    element: (
      <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
        <TenantVisualEditorPage />
      </ProtectedSuspenseWrapper>
    ),
  },
  // Public booking management (customer self-service via JWT token)
  {
    path: "bookings/manage",
    element: <SuspenseWrapper><ManageBookingPage /></SuspenseWrapper>,
  },
]);
