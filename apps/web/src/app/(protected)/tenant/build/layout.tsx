/**
 * Build Mode Layout - DEPRECATED
 *
 * This layout is kept for backwards compatibility but is no longer used.
 * The build page now redirects to /tenant/dashboard?showPreview=true.
 *
 * @deprecated Build Mode is now integrated into the dashboard via agent-first architecture
 */
export default function BuildModeLayout({ children }: { children: React.ReactNode }) {
  // Children will be the redirect page component, so just render it
  return <>{children}</>;
}
