/**
 * LandingPageEditor - Main visual editor for tenant landing pages
 *
 * Features:
 * - Sidebar with section toggles (active/available sections)
 * - Live preview area showing enabled sections
 * - Floating action bar with publish/discard buttons
 * - Draft indicator and saving status
 * - Inline WYSIWYG editing for all section content
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useLandingPageEditor, SectionType } from './hooks/useLandingPageEditor';
import { EditorSidebar } from './components/EditorSidebar';
import { EditorToolbar } from './components/EditorToolbar';
import { SECTION_DEFAULTS } from './demo-data/section-defaults';
import {
  EditableHeroSection,
  EditableSocialProofBar,
  EditableAboutSection,
  EditableTestimonialsSection,
  EditableAccommodationSection,
  EditableGallerySection,
  EditableFaqSection,
  EditableFinalCtaSection,
} from './sections';

// Section order for preview rendering
const SECTION_ORDER: SectionType[] = [
  'hero',
  'socialProofBar',
  'segmentSelector',
  'about',
  'testimonials',
  'accommodation',
  'gallery',
  'faq',
  'finalCta',
];

// Section display names
const SECTION_NAMES: Record<SectionType, string> = {
  hero: 'Hero',
  socialProofBar: 'Social Proof',
  segmentSelector: 'Segment Selector',
  about: 'About',
  testimonials: 'Testimonials',
  accommodation: 'Accommodation',
  gallery: 'Gallery',
  faq: 'FAQ',
  finalCta: 'Final CTA',
};

export function LandingPageEditor() {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const {
    draftConfig,
    publishedConfig,
    loading,
    error,
    hasChanges,
    isSaving,
    isPublishing,
    loadConfig,
    toggleSection,
    updateSectionContent,
    publishChanges,
    discardChanges,
  } = useLandingPageEditor();

  const handleDiscardClick = useCallback(() => {
    if (!hasChanges) return;
    setShowDiscardDialog(true);
  }, [hasChanges]);

  const handleConfirmDiscard = useCallback(async () => {
    setShowDiscardDialog(false);
    await discardChanges();
  }, [discardChanges]);

  // Handle section toggle with default content initialization
  const handleToggleSection = useCallback(
    (section: SectionType, enabled: boolean) => {
      toggleSection(section, enabled);

      // When enabling a section, initialize with default content if none exists
      if (enabled) {
        const config = draftConfig ?? publishedConfig;
        const sectionKey = section as keyof typeof SECTION_DEFAULTS;
        if (!config?.[sectionKey] && SECTION_DEFAULTS[sectionKey]) {
          updateSectionContent(section, SECTION_DEFAULTS[sectionKey] as never);
        }
      }
    },
    [toggleSection, updateSectionContent, draftConfig, publishedConfig]
  );

  // Get active vs available sections
  const config = draftConfig ?? publishedConfig;
  const activeSections = SECTION_ORDER.filter((s) => config?.sections?.[s]);
  const availableSections = SECTION_ORDER.filter(
    (s) => !config?.sections?.[s] && s !== 'segmentSelector'
  );

  // Memoized section update handlers for stable references
  // IMPORTANT: All hooks must be called unconditionally before any early returns
  const sectionUpdateHandlers = useMemo(
    () => ({
      hero: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('hero', updates),
      socialProofBar: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('socialProofBar', updates),
      about: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('about', updates),
      testimonials: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('testimonials', updates),
      accommodation: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('accommodation', updates),
      gallery: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('gallery', updates),
      faq: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('faq', updates),
      finalCta: (updates: Parameters<typeof updateSectionContent>[1]) =>
        updateSectionContent('finalCta', updates),
    }),
    [updateSectionContent]
  );

  // Render section component based on type
  const renderSection = useCallback(
    (section: SectionType) => {
      const sectionConfig = config?.[section as keyof typeof config];
      const disabled = isPublishing;

      switch (section) {
        case 'hero':
          return (
            <EditableHeroSection
              config={sectionConfig ?? SECTION_DEFAULTS.hero}
              onUpdate={sectionUpdateHandlers.hero}
              disabled={disabled}
            />
          );
        case 'socialProofBar':
          return (
            <EditableSocialProofBar
              config={sectionConfig ?? SECTION_DEFAULTS.socialProofBar}
              onUpdate={sectionUpdateHandlers.socialProofBar}
              disabled={disabled}
            />
          );
        case 'about':
          return (
            <EditableAboutSection
              config={sectionConfig ?? SECTION_DEFAULTS.about}
              onUpdate={sectionUpdateHandlers.about}
              disabled={disabled}
            />
          );
        case 'testimonials':
          return (
            <EditableTestimonialsSection
              config={sectionConfig ?? SECTION_DEFAULTS.testimonials}
              onUpdate={sectionUpdateHandlers.testimonials}
              disabled={disabled}
            />
          );
        case 'accommodation':
          return (
            <EditableAccommodationSection
              config={sectionConfig ?? SECTION_DEFAULTS.accommodation}
              onUpdate={sectionUpdateHandlers.accommodation}
              disabled={disabled}
            />
          );
        case 'gallery':
          return (
            <EditableGallerySection
              config={sectionConfig ?? SECTION_DEFAULTS.gallery}
              onUpdate={sectionUpdateHandlers.gallery}
              disabled={disabled}
            />
          );
        case 'faq':
          return (
            <EditableFaqSection
              config={sectionConfig ?? SECTION_DEFAULTS.faq}
              onUpdate={sectionUpdateHandlers.faq}
              disabled={disabled}
            />
          );
        case 'finalCta':
          return (
            <EditableFinalCtaSection
              config={sectionConfig ?? SECTION_DEFAULTS.finalCta}
              onUpdate={sectionUpdateHandlers.finalCta}
              disabled={disabled}
            />
          );
        case 'segmentSelector':
          // Segment selector is always shown but not editable here
          return (
            <Card className="bg-sage/5 border-sage/20">
              <CardContent className="p-8 text-center">
                <p className="text-sage font-medium">Segment Selector</p>
                <p className="text-sm text-sage/70 mt-1">
                  This section automatically displays your service segments
                </p>
              </CardContent>
            </Card>
          );
        default:
          return null;
      }
    },
    [config, isPublishing, sectionUpdateHandlers]
  );

  // Loading state - AFTER all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state - AFTER all hooks are called
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface p-8">
        <Card className="border-destructive bg-destructive/5 max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Failed to load landing page</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadConfig} className="ml-auto">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar */}
      <EditorSidebar
        activeSections={activeSections}
        availableSections={availableSections}
        sectionNames={SECTION_NAMES}
        onToggleSection={handleToggleSection}
        hasChanges={hasChanges}
        disabled={isPublishing}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-background border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/tenant/dashboard">
              <Button variant="ghost" size="icon" title="Back to Dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Landing Page Editor</h1>
              <p className="text-sm text-muted-foreground">
                Customize your storefront landing page
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadConfig}
            disabled={loading || isPublishing}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </header>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto">
          {/* Info message when no sections enabled */}
          {activeSections.length === 0 && (
            <div className="p-6">
              <Card className="border-dashed border-2 bg-muted/20 max-w-4xl mx-auto">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No sections enabled yet. Add sections from the sidebar to customize your
                    landing page.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Render enabled sections in order */}
          {SECTION_ORDER.map((section) => {
            const isEnabled = config?.sections?.[section];
            if (!isEnabled) return null;

            return (
              <div key={section} className="relative group">
                {/* Section label overlay */}
                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 bg-background/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border">
                    <span className="text-xs font-medium text-muted-foreground">
                      {SECTION_NAMES[section]}
                    </span>
                    {section !== 'segmentSelector' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleToggleSection(section, false)}
                        disabled={isPublishing}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {renderSection(section)}
              </div>
            );
          })}

          {/* Bottom padding for floating toolbar */}
          <div className="h-24" />
        </div>

        {/* Floating action bar */}
        <EditorToolbar
          hasChanges={hasChanges}
          isSaving={isSaving}
          isPublishing={isPublishing}
          onPublish={publishChanges}
          onDiscard={handleDiscardClick}
        />
      </div>

      {/* Discard confirmation dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard all changes? This will revert your landing page to
              the last published state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
