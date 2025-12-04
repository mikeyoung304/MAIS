import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantFormData, TenantFormErrors } from './types';

interface BasicInfoFieldsProps {
  formData: TenantFormData;
  errors: TenantFormErrors;
  isSubmitting: boolean;
  onChange: (updates: Partial<TenantFormData>) => void;
  onGenerateSlug: () => void;
}

export function BasicInfoFields({
  formData,
  errors,
  isSubmitting,
  onChange,
  onGenerateSlug,
}: BasicInfoFieldsProps) {
  return (
    <>
      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-white/90">
          Business Name *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={onGenerateSlug}
          className="bg-macon-navy-900 border-white/20 text-white"
          placeholder="e.g., Acme Consulting"
          disabled={isSubmitting}
        />
        {errors.name && <p className="text-red-400 text-sm">{errors.name}</p>}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug" className="text-white/90">
          URL Slug *
        </Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
          className="bg-macon-navy-900 border-white/20 text-white"
          placeholder="e.g., acme-consulting"
          disabled={isSubmitting}
        />
        <p className="text-white/60 text-sm">This will be used in URLs and API keys</p>
        {errors.slug && <p className="text-red-400 text-sm">{errors.slug}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/90">
          Admin Email *
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="bg-macon-navy-900 border-white/20 text-white"
          placeholder="admin@acmeconsulting.com"
          disabled={isSubmitting}
        />
        {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-white/90">
          Phone Number
        </Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className="bg-macon-navy-900 border-white/20 text-white"
          placeholder="(555) 123-4567"
          disabled={isSubmitting}
        />
      </div>
    </>
  );
}
