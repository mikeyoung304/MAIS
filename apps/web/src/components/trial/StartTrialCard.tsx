'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rocket, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface StartTrialCardProps {
  onTrialStarted?: () => void;
}

/**
 * StartTrialCard Component
 *
 * Shows when tenant has created at least one package but hasn't started their trial.
 * Clicking "Start Free Trial" begins the 14-day trial period.
 */
export function StartTrialCard({ onTrialStarted }: StartTrialCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/trial/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start trial');
      }

      logger.info('Trial started successfully');
      onTrialStarted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start trial';
      logger.error('Failed to start trial', { error: message });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2 border-sage/30 bg-sage/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-sage" />
          Ready to go live?
        </CardTitle>
        <CardDescription>
          You&apos;ve set up your first package. Start your 14-day free trial to unlock all
          features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="sage" className="w-full" onClick={handleStartTrial} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting trial...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Start 14-Day Free Trial
            </>
          )}
        </Button>
        <p className="text-center text-xs text-text-muted">
          No credit card required. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
