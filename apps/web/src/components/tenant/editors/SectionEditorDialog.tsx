'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type {
  Section,
  HeroSection,
  TextSection,
  GallerySection,
  TestimonialsSection,
  FAQSection,
  ContactSection,
  CTASection,
} from '@macon/contracts';

interface SectionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section;
  onSave: (section: Section) => void;
}

/**
 * Textarea component for longer text input
 */
function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`flex min-h-[100px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

/**
 * Select component for dropdowns
 */
function Select({
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// ============================================================================
// Section-specific editors
// ============================================================================

function HeroEditor({
  section,
  onChange,
}: {
  section: HeroSection;
  onChange: (section: HeroSection) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline *</Label>
        <Input
          id="headline"
          value={section.headline}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="Welcome to Our Studio"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="subheadline">Subheadline</Label>
        <Input
          id="subheadline"
          value={section.subheadline || ''}
          onChange={(e) => onChange({ ...section, subheadline: e.target.value })}
          placeholder="Professional services tailored to your needs"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="ctaText">Button Text</Label>
        <Input
          id="ctaText"
          value={section.ctaText || 'View Packages'}
          onChange={(e) => onChange({ ...section, ctaText: e.target.value })}
          placeholder="View Packages"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="backgroundImageUrl">Background Image URL</Label>
        <Input
          id="backgroundImageUrl"
          type="url"
          value={section.backgroundImageUrl || ''}
          onChange={(e) =>
            onChange({ ...section, backgroundImageUrl: e.target.value || undefined })
          }
          placeholder="https://example.com/image.jpg"
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

function TextEditor({
  section,
  onChange,
}: {
  section: TextSection;
  onChange: (section: TextSection) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={section.headline || ''}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="About Us"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={section.content}
          onChange={(e) => onChange({ ...section, content: e.target.value })}
          placeholder="Write your content here. Use blank lines for paragraphs."
          className="mt-1.5 min-h-[150px]"
        />
      </div>
      <div>
        <Label htmlFor="imageUrl">Image URL</Label>
        <Input
          id="imageUrl"
          type="url"
          value={section.imageUrl || ''}
          onChange={(e) => onChange({ ...section, imageUrl: e.target.value || undefined })}
          placeholder="https://example.com/image.jpg"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="imagePosition">Image Position</Label>
        <Select
          id="imagePosition"
          value={section.imagePosition || 'left'}
          onChange={(e) =>
            onChange({ ...section, imagePosition: e.target.value as 'left' | 'right' })
          }
          className="mt-1.5"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </Select>
      </div>
    </div>
  );
}

function GalleryEditor({
  section,
  onChange,
}: {
  section: GallerySection;
  onChange: (section: GallerySection) => void;
}) {
  const images = section.images || [];

  const addImage = () => {
    onChange({
      ...section,
      images: [...images, { url: '', alt: '' }],
    });
  };

  const updateImage = (index: number, url: string, alt: string) => {
    const newImages = [...images];
    newImages[index] = { url, alt };
    onChange({ ...section, images: newImages });
  };

  const removeImage = (index: number) => {
    onChange({
      ...section,
      images: images.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={section.headline || 'Our Work'}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="Our Work"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="instagramHandle">Instagram Handle</Label>
        <Input
          id="instagramHandle"
          value={section.instagramHandle || ''}
          onChange={(e) => onChange({ ...section, instagramHandle: e.target.value || undefined })}
          placeholder="@yourstudio"
          className="mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Images</Label>
          <Button type="button" variant="outline" size="sm" onClick={addImage} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Image
          </Button>
        </div>
        <div className="mt-2 space-y-3">
          {images.length === 0 ? (
            <p className="text-sm text-text-muted">
              No images yet. Click &quot;Add Image&quot; to add one.
            </p>
          ) : (
            images.map((img, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={img.url}
                  onChange={(e) => updateImage(index, e.target.value, img.alt)}
                  placeholder="Image URL"
                  className="flex-1"
                />
                <Input
                  value={img.alt}
                  onChange={(e) => updateImage(index, img.url, e.target.value)}
                  placeholder="Alt text"
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImage(index)}
                  className="h-10 w-10 shrink-0 p-0 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TestimonialsEditor({
  section,
  onChange,
}: {
  section: TestimonialsSection;
  onChange: (section: TestimonialsSection) => void;
}) {
  const items = section.items || [];

  const addItem = () => {
    onChange({
      ...section,
      items: [...items, { quote: '', authorName: '', authorRole: '', rating: 5 }],
    });
  };

  const updateItem = (index: number, updates: Partial<TestimonialsSection['items'][0]>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ ...section, items: newItems });
  };

  const removeItem = (index: number) => {
    onChange({
      ...section,
      items: items.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={section.headline || 'What Clients Say'}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="What Clients Say"
          className="mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Testimonials</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Testimonial
          </Button>
        </div>
        <div className="mt-2 space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">
              No testimonials yet. Click &quot;Add Testimonial&quot; to add one.
            </p>
          ) : (
            items.map((item, index) => (
              <div key={index} className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-text-muted">#{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={item.quote}
                  onChange={(e) => updateItem(index, { quote: e.target.value })}
                  placeholder="Customer quote..."
                  className="min-h-[80px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={item.authorName}
                    onChange={(e) => updateItem(index, { authorName: e.target.value })}
                    placeholder="Author name"
                  />
                  <Input
                    value={item.authorRole || ''}
                    onChange={(e) => updateItem(index, { authorRole: e.target.value })}
                    placeholder="Role (optional)"
                  />
                </div>
                <div>
                  <Label className="text-xs">Rating</Label>
                  <Select
                    value={item.rating?.toString() || '5'}
                    onChange={(e) => updateItem(index, { rating: parseInt(e.target.value) })}
                    className="mt-1"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {r} star{r !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FAQEditor({
  section,
  onChange,
}: {
  section: FAQSection;
  onChange: (section: FAQSection) => void;
}) {
  const items = section.items || [];

  const addItem = () => {
    onChange({
      ...section,
      items: [...items, { question: '', answer: '' }],
    });
  };

  const updateItem = (index: number, question: string, answer: string) => {
    const newItems = [...items];
    newItems[index] = { question, answer };
    onChange({ ...section, items: newItems });
  };

  const removeItem = (index: number) => {
    onChange({
      ...section,
      items: items.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={section.headline || 'FAQ'}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="Frequently Asked Questions"
          className="mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Questions</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
        <div className="mt-2 space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-text-muted">
              No questions yet. Click &quot;Add Question&quot; to add one.
            </p>
          ) : (
            items.map((item, index) => (
              <div key={index} className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-text-muted">Q{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => updateItem(index, e.target.value, item.answer)}
                  placeholder="Question"
                />
                <Textarea
                  value={item.answer}
                  onChange={(e) => updateItem(index, item.question, e.target.value)}
                  placeholder="Answer"
                  className="min-h-[80px]"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ContactEditor({
  section,
  onChange,
}: {
  section: ContactSection;
  onChange: (section: ContactSection) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={section.headline || 'Get in Touch'}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="Get in Touch"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={section.email || ''}
          onChange={(e) => onChange({ ...section, email: e.target.value || undefined })}
          placeholder="hello@example.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={section.phone || ''}
          onChange={(e) => onChange({ ...section, phone: e.target.value || undefined })}
          placeholder="+1 (555) 123-4567"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={section.address || ''}
          onChange={(e) => onChange({ ...section, address: e.target.value || undefined })}
          placeholder="123 Main St, City, State 12345"
          className="mt-1.5 min-h-[80px]"
        />
      </div>
      <div>
        <Label htmlFor="hours">Business Hours</Label>
        <Textarea
          id="hours"
          value={section.hours || ''}
          onChange={(e) => onChange({ ...section, hours: e.target.value || undefined })}
          placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed"
          className="mt-1.5 min-h-[80px]"
        />
      </div>
    </div>
  );
}

function CTAEditor({
  section,
  onChange,
}: {
  section: CTASection;
  onChange: (section: CTASection) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="headline">Headline *</Label>
        <Input
          id="headline"
          value={section.headline}
          onChange={(e) => onChange({ ...section, headline: e.target.value })}
          placeholder="Ready to Get Started?"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="subheadline">Subheadline</Label>
        <Input
          id="subheadline"
          value={section.subheadline || ''}
          onChange={(e) => onChange({ ...section, subheadline: e.target.value || undefined })}
          placeholder="Take the next step today"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="ctaText">Button Text</Label>
        <Input
          id="ctaText"
          value={section.ctaText || 'Get Started'}
          onChange={(e) => onChange({ ...section, ctaText: e.target.value })}
          placeholder="Get Started"
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main SectionEditorDialog
// ============================================================================

const SECTION_TYPE_LABELS: Record<Section['type'], string> = {
  hero: 'Hero Section',
  text: 'Text Section',
  about: 'About Section',
  gallery: 'Gallery Section',
  testimonials: 'Testimonials Section',
  faq: 'FAQ Section',
  contact: 'Contact Section',
  cta: 'Call to Action Section',
  services: 'Services Section',
  features: 'Features Section',
  pricing: 'Pricing Section',
  custom: 'Custom Section',
};

/**
 * SectionEditorDialog - Edit a section's content
 *
 * Renders the appropriate editor based on section type
 */
export function SectionEditorDialog({
  open,
  onOpenChange,
  section,
  onSave,
}: SectionEditorDialogProps) {
  const [editedSection, setEditedSection] = useState<Section>(section);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    onSave(editedSection);
    setSaving(false);
  };

  const renderEditor = () => {
    switch (editedSection.type) {
      case 'hero':
        return <HeroEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'text':
        return <TextEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'gallery':
        return <GalleryEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'testimonials':
        return <TestimonialsEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'faq':
        return <FAQEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'contact':
        return <ContactEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'cta':
        return <CTAEditor section={editedSection} onChange={(s) => setEditedSection(s)} />;
      case 'features':
        return (
          <p className="text-text-muted italic">Features editor coming soon. Edit via seed data.</p>
        );
      case 'pricing':
        return (
          <p className="text-text-muted italic">Pricing editor coming soon. Edit via seed data.</p>
        );
      default:
        return <p>Unknown section type</p>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="xl">
        <DialogHeader>
          <DialogTitle>Edit {SECTION_TYPE_LABELS[section.type]}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto py-4">{renderEditor()}</div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="sage" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
