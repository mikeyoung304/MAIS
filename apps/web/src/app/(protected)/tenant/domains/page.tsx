'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  RefreshCw,
  Trash2,
  Star,
  AlertCircle,
} from 'lucide-react';

interface DomainInfo {
  id: string;
  domain: string;
  verified: boolean;
  isPrimary: boolean;
  verificationToken: string;
  verifiedAt: string | null;
  createdAt: string;
  verificationInstructions?: {
    recordType: string;
    recordName: string;
    recordValue: string;
    description: string;
  };
}

interface VerificationResult {
  verified: boolean;
  txtRecords: string[];
  expectedToken: string;
  error?: string;
}

/**
 * Custom Domains Management Page
 *
 * Allows tenants to add, verify, and manage custom domains
 * for their storefront.
 */
export default function DomainsPage() {
  const { backendToken: token } = useAuth();
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchDomains = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/v1/tenant-admin/domains`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch domains');
      }

      const data = await res.json();
      setDomains(data);
    } catch (err) {
      logger.error('Error fetching domains', err instanceof Error ? err : { error: err });
      setError('Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newDomain.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/tenant-admin/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      setDomains((prev) => [...prev, data]);
      setNewDomain('');
    } catch (err: any) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    if (!token) return;

    setVerifying(domainId);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/v1/tenant-admin/domains/${domainId}/verify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result: VerificationResult = await res.json();

      if (!res.ok) {
        throw new Error('Verification check failed');
      }

      if (result.verified) {
        // Refresh domains to get updated status
        await fetchDomains();
      } else {
        setError(
          result.error ||
            'Verification failed. Make sure the TXT record is properly configured.'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(null);
    }
  };

  const handleSetPrimary = async (domainId: string) => {
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE}/v1/tenant-admin/domains/${domainId}/primary`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set primary domain');
      }

      await fetchDomains();
    } catch (err: any) {
      setError(err.message || 'Failed to set primary domain');
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!token) return;

    if (
      !confirm(
        'Are you sure you want to remove this domain? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/v1/tenant-admin/domains/${domainId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to remove domain');
      }

      setDomains((prev) => prev.filter((d) => d.id !== domainId));
    } catch (err: any) {
      setError(err.message || 'Failed to remove domain');
    }
  };

  const handleCopyToken = (domain: DomainInfo) => {
    const recordValue = `mais-verify=${domain.verificationToken}`;
    navigator.clipboard.writeText(recordValue);
    setCopiedToken(domain.id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">
          Custom Domains
        </h1>
        <p className="mt-2 text-text-muted">
          Connect your own domain to your storefront
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Add Domain Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-sage" />
            Add Custom Domain
          </CardTitle>
          <CardDescription>
            Enter your domain without &quot;http://&quot; or &quot;https://&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="domain" className="sr-only">
                Domain
              </Label>
              <Input
                id="domain"
                type="text"
                placeholder="www.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={adding}
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={adding || !newDomain.trim()}>
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Domain
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Domains List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-sage" />
            Your Domains
          </CardTitle>
          <CardDescription>
            {domains.length === 0
              ? 'No custom domains configured yet'
              : `${domains.length} domain${domains.length === 1 ? '' : 's'} configured`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Globe className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">Add your first custom domain above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="rounded-lg border border-neutral-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-text-primary truncate">
                          {domain.domain}
                        </span>
                        {domain.isPrimary && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            <Star className="mr-1 h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                        {domain.verified ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 flex-shrink-0"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300 flex-shrink-0"
                          >
                            Pending Verification
                          </Badge>
                        )}
                      </div>

                      {/* Verification Instructions (for unverified domains) */}
                      {!domain.verified && (
                        <div className="mt-4 rounded-lg bg-neutral-50 p-4">
                          <p className="text-sm font-medium text-text-primary mb-2">
                            DNS Configuration Required
                          </p>
                          <p className="text-sm text-text-muted mb-3">
                            Add this TXT record to your DNS settings:
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between rounded bg-white border border-neutral-200 p-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-text-muted">
                                  Record Name
                                </p>
                                <p className="font-mono text-sm truncate">
                                  _mais-verify.{domain.domain}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between rounded bg-white border border-neutral-200 p-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-text-muted">
                                  Record Value
                                </p>
                                <p className="font-mono text-sm truncate">
                                  mais-verify={domain.verificationToken}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyToken(domain)}
                                className="flex-shrink-0 ml-2"
                              >
                                {copiedToken === domain.id ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!domain.verified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(domain.id)}
                          disabled={verifying === domain.id}
                        >
                          {verifying === domain.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Verify
                        </Button>
                      )}
                      {domain.verified && !domain.isPrimary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetPrimary(domain.id)}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Set Primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(domain.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How Custom Domains Work</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="space-y-3 text-text-muted">
            <li>
              <strong className="text-text-primary">Add your domain</strong> -
              Enter the domain you want to use (e.g., www.yoursite.com)
            </li>
            <li>
              <strong className="text-text-primary">Add DNS TXT record</strong>{' '}
              - Log into your domain registrar (GoDaddy, Namecheap, etc.) and
              add the TXT record shown above
            </li>
            <li>
              <strong className="text-text-primary">
                Wait for DNS propagation
              </strong>{' '}
              - DNS changes can take up to 48 hours, but usually complete within
              a few minutes
            </li>
            <li>
              <strong className="text-text-primary">Verify your domain</strong>{' '}
              - Click &quot;Verify&quot; to confirm your domain ownership
            </li>
            <li>
              <strong className="text-text-primary">
                Configure CNAME record
              </strong>{' '}
              - After verification, add a CNAME record pointing to our servers
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
