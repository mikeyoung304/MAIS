'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  { key: 'testimonials', label: 'Testimonials', description: 'Client reviews', icon: MessageSquare },
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
          <p className="mt-2 text-text-muted">
            Control which pages appear on your website
          </p>
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
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="sage"
          className="gap-2"
        >
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
                <p className="font-medium text-text-primary">Home</p>
                <p className="text-sm text-text-muted">Your main landing page</p>
              </div>
            </div>
            <span className="text-sm font-medium text-sage">Always On</span>
          </div>

          {/* Other Pages */}
          {PAGE_CONFIGS.map((page) => {
            const Icon = page.icon;
            const enabled = isPageEnabled(page.key);

            return (
              <div
                key={page.key}
                className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  enabled
                    ? 'border-neutral-100 bg-white'
                    : 'border-neutral-100 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                      enabled ? 'bg-sage/10' : 'bg-neutral-200'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 transition-colors ${
                        enabled ? 'text-sage' : 'text-neutral-400'
                      }`}
                    />
                  </div>
                  <div>
                    <p
                      className={`font-medium transition-colors ${
                        enabled ? 'text-text-primary' : 'text-text-muted'
                      }`}
                    >
                      {page.label}
                    </p>
                    <p className="text-sm text-text-muted">{page.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
    </div>
  );
}
