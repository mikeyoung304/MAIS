'use client';

import { useAuth, logout } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  User,
  Building2,
  Key,
  AlertTriangle,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';

/**
 * Tenant Settings Page
 *
 * Account settings and API key management.
 */
export default function TenantSettingsPage() {
  const { user, tenantId } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout('/login');
  };

  // Mock API keys for display (in production these would come from the API)
  const apiKeyPublic = tenantId ? `pk_live_${tenantId.slice(0, 8)}...` : 'Not available';

  const handleCopyKey = (key: string, keyType: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Settings</h1>
        <p className="mt-2 text-text-muted">Manage your account and API keys</p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-sage" />
            Account Information
          </CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-neutral-50" />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input value={tenantId || ''} disabled className="bg-neutral-50 font-mono text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-sage" />
            API Keys
          </CardTitle>
          <CardDescription>
            Use these keys to integrate with the MAIS API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Public API Key</Label>
            <div className="flex gap-2">
              <Input
                value={apiKeyPublic}
                disabled
                className="bg-neutral-50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopyKey(apiKeyPublic, 'public')}
                className="flex-shrink-0"
              >
                {copiedKey === 'public' ? (
                  <CheckCircle className="h-4 w-4 text-sage" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              Use this key for client-side integrations. It&apos;s safe to expose publicly.
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Secret Key</p>
                <p className="mt-1 text-sm text-yellow-700">
                  Your secret key is hidden for security. Contact support if you need to regenerate it.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sage" />
            Business Settings
          </CardTitle>
          <CardDescription>Configure your business preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Business settings configuration coming soon. This will include timezone,
            currency preferences, and notification settings.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4">
            <div>
              <p className="font-medium text-text-primary">Sign Out</p>
              <p className="text-sm text-text-muted">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Sign Out
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4">
            <div>
              <p className="font-medium text-text-primary">Delete Account</p>
              <p className="text-sm text-text-muted">
                Permanently delete your account and all data
              </p>
            </div>
            <Button
              variant="outline"
              disabled
              className="border-red-200 text-red-600 opacity-50"
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
