'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Plus,
} from 'lucide-react';
import type { LandingPageConfig, Section, PageName } from '@macon/contracts';
import { DEFAULT_PAGES_CONFIG, PAGE_NAMES } from '@macon/contracts';
import { SectionEditorDialog } from '@/components/tenant/editors/SectionEditorDialog';
import { SectionCard } from '@/components/tenant/editors/SectionCard';
import { AddSectionDialog } from '@/components/tenant/editors/AddSectionDialog';

/**
 * Page metadata for display
 */
const PAGE_METADATA: Record<PageName, { label: string; description: string }> = {
  home: { label: 'Home', description: 'Your main landing page' },
  about: { label: 'About', description: 'Tell your story' },
  services: { label: 'Services', description: 'Display your packages' },
  gallery: { label: 'Gallery', description: 'Showcase your work' },
  testimonials: { label: 'Testimonials', description: 'Client reviews' },
  faq: { label: 'FAQ', description: 'Answer common questions' },
  contact: { label: 'Contact', description: 'How clients reach you' },
};

/**
 * Page Editor - Edit sections for a specific page type
 *
 * Features:
 * - View/edit sections for the page
 * - Add new sections
 * - Remove sections
 * - Edit section content inline
 */
export default function PageEditorPage() {
  const params = useParams();
  const _router = useRouter();
  const { slug } = useAuth();
  const pageType = params.pageType as PageName;

  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [editingSection, setEditingSection] = useState<{ index: number; section: Section } | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Validate page type
  const isValidPageType = PAGE_NAMES.includes(pageType);
  const pageMetadata = isValidPageType ? PAGE_METADATA[pageType] : null;

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

  // Get sections for current page
  const sections = config?.pages?.[pageType]?.sections ?? [];

  // Save configuration
  const handleSave = async (newConfig: LandingPageConfig) => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/tenant/landing-page', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save configuration');
      }

      setConfig(newConfig);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Add section
  const handleAddSection = (section: Section) => {
    if (!config?.pages) return;

    const newConfig: LandingPageConfig = {
      ...config,
      pages: {
        ...config.pages,
        [pageType]: {
          ...config.pages[pageType],
          sections: [...sections, section],
        },
      },
    };

    handleSave(newConfig);
    setIsAddDialogOpen(false);
  };

  // Update section
  const handleUpdateSection = (index: number, section: Section) => {
    if (!config?.pages) return;

    const newSections = [...sections];
    newSections[index] = section;

    const newConfig: LandingPageConfig = {
      ...config,
      pages: {
        ...config.pages,
        [pageType]: {
          ...config.pages[pageType],
          sections: newSections,
        },
      },
    };

    handleSave(newConfig);
    setEditingSection(null);
  };

  // Remove section
  const handleRemoveSection = (index: number) => {
    if (!config?.pages) return;

    const newSections = sections.filter((_, i) => i !== index);

    const newConfig: LandingPageConfig = {
      ...config,
      pages: {
        ...config.pages,
        [pageType]: {
          ...config.pages[pageType],
          sections: newSections,
        },
      },
    };

    handleSave(newConfig);
  };

  // Get preview path
  const getPreviewPath = (): string => {
    if (!slug) return '';
    if (pageType === 'home') return `/t/${slug}`;
    return `/t/${slug}/${pageType}`;
  };

  // Invalid page type
  if (!isValidPageType) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Invalid Page Type</h2>
        <p className="mt-2 text-text-muted">The page type &quot;{pageType}&quot; is not valid.</p>
        <Link href="/tenant/pages" className="mt-4">
          <Button variant="outline">Back to Pages</Button>
        </Link>
      </div>
    );
  }

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
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Error Loading Page</h2>
        <p className="mt-2 text-text-muted">{error}</p>
        <Link href="/tenant/pages" className="mt-4">
          <Button variant="outline">Back to Pages</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/tenant/pages"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pages
          </Link>
          <h1 className="font-serif text-3xl font-bold text-text-primary">
            Edit {pageMetadata?.label} Page
          </h1>
          <p className="mt-1 text-text-muted">{pageMetadata?.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {slug && (
            <a
              href={getPreviewPath()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-text-muted transition-colors hover:bg-neutral-50 hover:text-sage"
            >
              <Eye className="h-4 w-4" />
              Preview
            </a>
          )}
          <div className="flex items-center gap-2 text-sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-sage" />}
            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-sage">
                <CheckCircle className="h-4 w-4" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-4 w-4" />
                Error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sections List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sections</CardTitle>
              <CardDescription>
                {sections.length === 0
                  ? 'No sections yet. Add one to get started.'
                  : `${sections.length} section${sections.length === 1 ? '' : 's'} on this page`}
              </CardDescription>
            </div>
            <Button
              variant="sage"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/10">
                <Plus className="h-6 w-6 text-sage" />
              </div>
              <h3 className="mt-4 font-medium text-text-primary">No sections yet</h3>
              <p className="mt-1 text-sm text-text-muted">
                Add sections to build your page content
              </p>
              <Button
                variant="sage"
                size="sm"
                onClick={() => setIsAddDialogOpen(true)}
                className="mt-4 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add First Section
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section, index) => (
                <SectionCard
                  key={`${section.type}-${index}`}
                  section={section}
                  index={index}
                  onEdit={() => setEditingSection({ index, section })}
                  onRemove={() => handleRemoveSection(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddSection}
        pageType={pageType}
      />

      {/* Edit Section Dialog */}
      {editingSection && (
        <SectionEditorDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingSection(null);
          }}
          section={editingSection.section}
          onSave={(section) => handleUpdateSection(editingSection.index, section)}
        />
      )}
    </div>
  );
}
