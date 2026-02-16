'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Type, Image, MessageSquare, HelpCircle, Mail, Zap, Star } from 'lucide-react';
import type { Section, PageName } from '@macon/contracts';

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (section: Section) => void;
  pageType: PageName;
}

/**
 * Section type option metadata
 */
interface SectionOption {
  type: Section['type'];
  label: string;
  description: string;
  icon: typeof Type;
  color: string;
  defaultSection: Section;
}

const SECTION_OPTIONS: SectionOption[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Large banner with headline and call-to-action',
    icon: Star,
    color: 'bg-purple-100 text-purple-700 group-hover:bg-purple-200',
    defaultSection: {
      type: 'hero',
      headline: 'Your Headline Here',
      subheadline: 'Add a compelling subheadline',
      ctaText: 'Get Started',
    },
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Content block with optional image',
    icon: Type,
    color: 'bg-blue-100 text-blue-700 group-hover:bg-blue-200',
    defaultSection: {
      type: 'text',
      headline: 'Section Headline',
      content:
        'Add your content here. You can write multiple paragraphs by using blank lines to separate them.',
      imagePosition: 'left',
    },
  },
  {
    type: 'gallery',
    label: 'Gallery',
    description: 'Image showcase grid',
    icon: Image,
    color: 'bg-pink-100 text-pink-700 group-hover:bg-pink-200',
    defaultSection: {
      type: 'gallery',
      headline: 'Our Work',
      images: [],
    },
  },
  {
    type: 'testimonials',
    label: 'Testimonials',
    description: 'Customer reviews and ratings',
    icon: MessageSquare,
    color: 'bg-amber-100 text-amber-700 group-hover:bg-amber-200',
    defaultSection: {
      type: 'testimonials',
      headline: 'What Clients Say',
      items: [],
    },
  },
  {
    type: 'faq',
    label: 'FAQ',
    description: 'Questions and answers',
    icon: HelpCircle,
    color: 'bg-green-100 text-green-700 group-hover:bg-green-200',
    defaultSection: {
      type: 'faq',
      headline: 'Frequently Asked Questions',
      items: [],
    },
  },
  {
    type: 'contact',
    label: 'Contact',
    description: 'Contact information display',
    icon: Mail,
    color: 'bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200',
    defaultSection: {
      type: 'contact',
      headline: 'Get in Touch',
    },
  },
  {
    type: 'cta',
    label: 'Call to Action',
    description: 'Conversion-focused banner',
    icon: Zap,
    color: 'bg-orange-100 text-orange-700 group-hover:bg-orange-200',
    defaultSection: {
      type: 'cta',
      headline: 'Ready to Get Started?',
      subheadline: 'Take the next step today',
      ctaText: 'Contact Us',
    },
  },
];

/**
 * AddSectionDialog - Select a section type to add
 *
 * Displays all available section types with descriptions
 */
export function AddSectionDialog({ open, onOpenChange, onAdd, pageType }: AddSectionDialogProps) {
  const handleSelect = (option: SectionOption) => {
    onAdd(option.defaultSection);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="2xl">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>
            Choose a section type to add to your {pageType} page
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
          {SECTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                onClick={() => handleSelect(option)}
                className="group flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-accent hover:shadow-md"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${option.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{option.label}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
