'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, CheckCircle, Palette } from 'lucide-react';

interface BrandingForm {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  logoUrl: string;
}

const DEFAULT_BRANDING: BrandingForm = {
  primaryColor: '#6B7C5E',
  secondaryColor: '#F5F3EE',
  accentColor: '#E07941',
  backgroundColor: '#FFFFFF',
  fontFamily: 'Inter',
  logoUrl: '',
};

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
];

/**
 * Tenant Branding Page
 *
 * Allows tenant admins to customize their brand colors and fonts.
 */
export default function TenantBrandingPage() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<BrandingForm>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBranding() {
      if (!isAuthenticated) return;

      try {
        const response = await fetch('/api/tenant-admin/branding');

        if (response.ok) {
          const data = await response.json();
          setForm({
            primaryColor: data.primaryColor || DEFAULT_BRANDING.primaryColor,
            secondaryColor: data.secondaryColor || DEFAULT_BRANDING.secondaryColor,
            accentColor: data.accentColor || DEFAULT_BRANDING.accentColor,
            backgroundColor: data.backgroundColor || DEFAULT_BRANDING.backgroundColor,
            fontFamily: data.fontFamily || DEFAULT_BRANDING.fontFamily,
            logoUrl: data.logoUrl || '',
          });
        }
      } catch (err) {
        // Use defaults if fetch fails
      } finally {
        setIsLoading(false);
      }
    }

    fetchBranding();
  }, [isAuthenticated]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/tenant-admin/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setSuccessMessage('Branding settings saved successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Failed to save branding settings');
      }
    } catch (err) {
      setError('Failed to save branding settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof BrandingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Branding</h1>
          <p className="mt-2 text-text-muted">Customize your brand appearance</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Branding</h1>
        <p className="mt-2 text-text-muted">Customize colors and fonts for your booking widget</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Card className="border-sage/20 bg-sage/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-sage" />
            <p className="text-sage">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-sage" />
              Brand Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Colors */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="h-11 w-16 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={form.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#6B7C5E"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => updateField('secondaryColor', e.target.value)}
                      className="h-11 w-16 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={form.secondaryColor}
                      onChange={(e) => updateField('secondaryColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#F5F3EE"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="h-11 w-16 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={form.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#E07941"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={form.backgroundColor}
                      onChange={(e) => updateField('backgroundColor', e.target.value)}
                      className="h-11 w-16 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={form.backgroundColor}
                      onChange={(e) => updateField('backgroundColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>

              {/* Font */}
              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <select
                  id="fontFamily"
                  value={form.fontFamily}
                  onChange={(e) => updateField('fontFamily', e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => updateField('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-text-muted">
                  Enter the URL of your logo image. Recommended size: 200x50px
                </p>
              </div>

              <Button
                type="submit"
                variant="sage"
                className="w-full rounded-full"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Branding'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-6 transition-all duration-300"
              style={{ backgroundColor: form.backgroundColor }}
            >
              {/* Preview Header */}
              <div className="mb-6 flex items-center justify-between">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="h-8 max-w-[150px] object-contain"
                  />
                ) : (
                  <div
                    className="text-xl font-bold"
                    style={{ color: form.primaryColor, fontFamily: form.fontFamily }}
                  >
                    Your Logo
                  </div>
                )}
                <div
                  className="rounded-full px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Book Now
                </div>
              </div>

              {/* Preview Content */}
              <div className="rounded-lg p-4" style={{ backgroundColor: form.secondaryColor }}>
                <h3
                  className="mb-2 text-lg font-semibold"
                  style={{ color: form.primaryColor, fontFamily: form.fontFamily }}
                >
                  Sample Package
                </h3>
                <p className="mb-4 text-sm" style={{ fontFamily: form.fontFamily }}>
                  This is how your content will appear with your brand settings.
                </p>
                <div
                  className="inline-block rounded-full px-3 py-1 text-sm font-medium text-white"
                  style={{ backgroundColor: form.accentColor }}
                >
                  Featured
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
