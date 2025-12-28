'use client';

import { Button } from '@/components/ui/button';
import {
  Pencil,
  Trash2,
  Type,
  Image,
  MessageSquare,
  HelpCircle,
  Mail,
  Zap,
  Star,
  Grid,
  CreditCard,
} from 'lucide-react';
import type { Section } from '@macon/contracts';

interface SectionCardProps {
  section: Section;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * Section type metadata for display
 */
const SECTION_TYPE_META: Record<
  Section['type'],
  { icon: typeof Type; label: string; color: string }
> = {
  hero: { icon: Star, label: 'Hero', color: 'bg-purple-100 text-purple-700' },
  text: { icon: Type, label: 'Text', color: 'bg-blue-100 text-blue-700' },
  gallery: { icon: Image, label: 'Gallery', color: 'bg-pink-100 text-pink-700' },
  testimonials: {
    icon: MessageSquare,
    label: 'Testimonials',
    color: 'bg-amber-100 text-amber-700',
  },
  faq: { icon: HelpCircle, label: 'FAQ', color: 'bg-green-100 text-green-700' },
  contact: { icon: Mail, label: 'Contact', color: 'bg-cyan-100 text-cyan-700' },
  cta: { icon: Zap, label: 'Call to Action', color: 'bg-orange-100 text-orange-700' },
  features: { icon: Grid, label: 'Features', color: 'bg-indigo-100 text-indigo-700' },
  pricing: { icon: CreditCard, label: 'Pricing', color: 'bg-emerald-100 text-emerald-700' },
};

/**
 * Get summary text for a section
 */
function getSectionSummary(section: Section): string {
  switch (section.type) {
    case 'hero':
      return section.headline || 'No headline';
    case 'text':
      return section.headline || section.content?.slice(0, 50) + '...' || 'No content';
    case 'gallery':
      return `${section.images?.length || 0} images`;
    case 'testimonials':
      return `${section.items?.length || 0} testimonials`;
    case 'faq':
      return `${section.items?.length || 0} questions`;
    case 'contact':
      return section.headline || 'Contact information';
    case 'cta':
      return section.headline || 'No headline';
    case 'features':
      return `${section.features?.length || 0} features`;
    case 'pricing':
      return `${section.tiers?.length || 0} pricing tiers`;
  }
}

/**
 * SectionCard - Display a section in the editor list
 *
 * Shows section type, summary, and edit/remove actions
 */
export function SectionCard({ section, index, onEdit, onRemove }: SectionCardProps) {
  const meta = SECTION_TYPE_META[section.type];
  const Icon = meta.icon;
  const summary = getSectionSummary(section);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300">
      {/* Section number */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-text-muted">
        {index + 1}
      </div>

      {/* Section type badge */}
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </div>

      {/* Summary */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-muted">{summary}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 w-8 p-0 text-text-muted hover:text-sage"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit section</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 text-text-muted hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove section</span>
        </Button>
      </div>
    </div>
  );
}
