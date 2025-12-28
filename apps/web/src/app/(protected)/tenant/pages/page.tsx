'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  FileText,
  Home,
  Users,
  Package,
  ImageIcon,
  MessageSquare,
  HelpCircle,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Pencil,
  Layers,
} from 'lucide-react';
import type { LandingPageConfig, PagesConfig } from '@macon/contracts';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

/**
 * Page configuration for the toggle UI
 */
interface PageToggleConfig {
  key: keyof Omit<PagesConfig, 'home'>;
  label: string;
  description: string;
  icon: typeof Home;
}

const PAGE_CONFIGS: PageToggleConfig[] = [
  { key: 'about', label: 'About', description: 'Tell your story', icon: Users },
  { key: 'services', label: 'Services', description: 'Display your packages', icon: Package },
  { key: 'gallery', label: 'Gallery', description: 'Showcase your work', icon: ImageIcon },
  {
    key: 'testimonials',
    label: 'Testimonials',
    description: 'Client reviews',
    icon: MessageSquare,
  },
  { key: 'faq', label: 'FAQ', description: 'Answer common questions', icon: HelpCircle },
  { key: 'contact', label: 'Contact', description: 'How clients reach you', icon: Mail },
];

/**
 * Page Toggles Admin - Manage which pages appear on tenant website
 *
 * Features:
 * - Toggle individual pages on/off
 * - Home page is always enabled
 * - Changes saved via Next.js API route that proxies to backend
 */
export default function TenantPagesPage() {
  const { slug } = useAuth();
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load current config on mount
  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/landing-page');

      if (!response.ok) {
        throw new Error('Failed to load page configuration');
      }

      const data = await response.json();
      // Initialize with default pages config if none exists
      if (!data?.pages) {
        setConfig({ ...data, pages: DEFAULT_PAGES_CONFIG });
      } else {
        setConfig(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handle page toggle
  const handleToggle = (pageKey: keyof Omit<PagesConfig, 'home'>, enabled: boolean) => {
    if (!config?.pages) return;

    setConfig({
      ...config,
      pages: {
        ...config.pages,
        [pageKey]: {
          ...config.pages[pageKey],
          enabled,
        },
      },
    });
    setSaveStatus('idle');
  };

  // Save configuration
  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/tenant/landing-page', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save configuration');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Check if page is enabled
  const isPageEnabled = (pageKey: keyof PagesConfig): boolean => {
    if (pageKey === 'home') return true;
    return config?.pages?.[pageKey]?.enabled !== false;
  };

  // Get section count for a page
  const getSectionCount = (pageKey: keyof PagesConfig): number => {
    return config?.pages?.[pageKey]?.sections?.length ?? 0;
  };

  // Get page path for preview link
  const getPagePath = (pageKey: keyof PagesConfig): string => {
    if (pageKey === 'home') return '';
    return `/${pageKey}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Error Loading Pages</h2>
        <p className="mt-2 text-text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Manage Pages</h1>
          <p className="mt-2 text-text-muted">Control which pages appear on your website</p>
          {slug && (
            <p className="mt-1 text-sm text-sage">
              Preview at:{' '}
              <a
                href={`/t/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                /t/{slug}
              </a>
            </p>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving} variant="sage" className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : null}
          {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {/* Page Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sage" />
            Website Pages
          </CardTitle>
          <CardDescription>
            Toggle pages on or off. Disabled pages will return a 404 error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Home - Always On */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/10">
                <Home className="h-5 w-5 text-sage" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text-primary">Home</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage">
                    <Layers className="h-3 w-3" />
                    {getSectionCount('home')}
                  </span>
                </div>
                <p className="text-sm text-text-muted">Your main landing page</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {slug && (
                <a
                  href={`/t/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-muted transition-colors hover:bg-neutral-50 hover:text-sage"
                  title="Preview page"
                >
                  <Eye className="h-4 w-4" />
                </a>
              )}
              <Link
                href="/tenant/pages/home"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-text-muted transition-colors hover:bg-neutral-50 hover:text-sage"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
              <span className="ml-2 text-sm font-medium text-sage">Always On</span>
            </div>
          </div>

          {/* Other Pages */}
          {PAGE_CONFIGS.map((page) => {
            const Icon = page.icon;
            const enabled = isPageEnabled(page.key);
            const sectionCount = getSectionCount(page.key);

            return (
              <div
                key={page.key}
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  enabled ? 'border-neutral-100 bg-white' : 'border-neutral-100 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      enabled ? 'bg-sage/10' : 'bg-neutral-200'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 transition-colors ${
                        enabled ? 'text-sage' : 'text-neutral-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium transition-colors ${
                          enabled ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {page.label}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          enabled ? 'bg-sage/10 text-sage' : 'bg-neutral-200 text-neutral-500'
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        {sectionCount}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted">{page.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {slug && enabled && (
                    <a
                      href={`/t/${slug}${getPagePath(page.key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-muted transition-colors hover:bg-neutral-50 hover:text-sage"
                      title="Preview page"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}
                  {enabled && (
                    <Link
                      href={`/tenant/pages/${page.key}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-text-muted transition-colors hover:bg-neutral-50 hover:text-sage"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Link>
                  )}
                  <div className="flex items-center gap-2 border-l border-neutral-200 pl-2 sm:gap-3 sm:pl-3">
                    <Label
                      htmlFor={`toggle-${page.key}`}
                      className={`text-sm ${enabled ? 'text-sage' : 'text-text-muted'}`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </Label>
                    <Switch
                      id={`toggle-${page.key}`}
                      checked={enabled}
                      onCheckedChange={(checked) => handleToggle(page.key, checked)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-text-muted">
            <strong>Tip:</strong> Disabled pages will show a 404 error and won&apos;t appear in
            navigation. You can enable them again at any time.
          </p>
        </CardContent>
      </Card>

      {/* Warning when all optional pages are disabled */}
      {PAGE_CONFIGS.every((p) => !isPageEnabled(p.key)) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">All optional pages are disabled</p>
                <p className="mt-1 text-sm text-amber-700">
                  Your website currently only shows the Home page. Enable additional pages to
                  provide more information to your visitors.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
