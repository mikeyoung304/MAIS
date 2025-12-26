import { useState } from 'react';
import { toast } from 'sonner';
import { toUtcMidnight } from '@macon/shared';
import { usePackage } from '../features/catalog/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '../features/booking/DatePicker';
import { AddOnList } from '../features/booking/AddOnList';
import { TotalBox } from '../features/booking/TotalBox';
import { useBookingTotal } from '../features/booking/hooks';
import { api } from '../lib/api';
import { formatCurrency } from '@/lib/utils';

interface Props {
  packageSlug: string;
  onBack: () => void;
  onBookingComplete: (bookingId: string) => void;
}

/**
 * Widget version of PackagePage
 *
 * Differences from main app:
 * - Uses callback instead of router navigation
 * - Notifies parent of booking completion
 * - No router dependency
 */
export function WidgetPackagePage({ packageSlug, onBack, onBookingComplete: _onBookingComplete }: Props) {
  const { data: pkg, isLoading, error } = usePackage(packageSlug);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [coupleName, setCoupleName] = useState('');
  const [email, setEmail] = useState('');

  const packageData = pkg;
  const total = useBookingTotal(
    packageData?.priceCents || 0,
    packageData?.addOns || [],
    selectedAddOns
  );

  if (isLoading) {
    return <div className="text-center py-12 text-white/90 text-xl">Loading package...</div>;
  }

  if (error || !packageData) {
    return <div className="text-center py-12 text-white text-xl">Package not found</div>;
  }

  const handleCheckout = async () => {
    if (!selectedDate || !packageData || !coupleName.trim() || !email.trim()) return;

    try {
      // Format date as YYYY-MM-DD using toUtcMidnight
      const eventDate = toUtcMidnight(selectedDate);

      // Call createCheckout API
      const response = await api.createCheckout({
        body: {
          packageId: packageData.id,
          eventDate,
          email: email.trim(),
          coupleName: coupleName.trim(),
          addOnIds: Array.from(selectedAddOns),
        },
      });

      if (response.status === 200) {
        // Redirect to Stripe checkout
        window.location.href = response.body.checkoutUrl;

        // Note: onBookingComplete will be called after successful payment
        // when user returns from Stripe (handled by parent page)
      } else {
        toast.error('Failed to create checkout session', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Checkout error:', error);
      }
      toast.error('An error occurred during checkout', {
        description: 'Please try again or contact support.',
      });
    }
  };

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(addOnId)) {
        newSet.delete(addOnId);
      } else {
        newSet.add(addOnId);
      }
      return newSet;
    });
  };

  return (
    <div>
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="mb-6 text-white/70 hover:text-white">
        ← Back to Packages
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="overflow-hidden bg-macon-navy-800 border-white/20">
            {packageData.photoUrl && (
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={packageData.photoUrl}
                  alt={packageData.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="p-8">
              <h1 className="font-heading text-5xl font-bold mb-4 text-white">
                {packageData.title}
              </h1>
              <p className="text-white/90 mb-6 leading-relaxed text-xl">
                {packageData.description}
              </p>
              <div className="flex items-center gap-2 pt-4 border-t border-white/20">
                <span className="text-lg text-white/70">Base Price:</span>
                <span className="text-4xl font-heading font-semibold text-white/60">
                  {formatCurrency(packageData.priceCents)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-macon-navy-800 border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-3xl">Select Date</CardTitle>
            </CardHeader>
            <CardContent>
              <DatePicker selected={selectedDate} onSelect={setSelectedDate} />
            </CardContent>
          </Card>

          <Card className="bg-macon-navy-800 border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-3xl">Your Details</CardTitle>
              <p className="text-white/60 text-base mt-1">We'll send your confirmation here</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="coupleName" className="text-white/90 text-lg">
                    Your Names
                  </Label>
                  <Input
                    id="coupleName"
                    type="text"
                    value={coupleName}
                    onChange={(e) => setCoupleName(e.target.value)}
                    placeholder="e.g., Sarah & Alex"
                    required
                    className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 focus:ring-macon-navy-500 text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90 text-lg">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 focus:ring-macon-navy-500 text-lg h-12"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {packageData.addOns && packageData.addOns.length > 0 && (
            <Card className="bg-macon-navy-800 border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-3xl">Add-Ons</CardTitle>
              </CardHeader>
              <CardContent>
                <AddOnList
                  addOns={packageData.addOns}
                  selected={selectedAddOns}
                  onToggle={toggleAddOn}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <TotalBox total={total} />
            <Button
              onClick={handleCheckout}
              disabled={!selectedDate || !coupleName.trim() || !email.trim()}
              className="w-full text-xl h-14"
              size="lg"
              data-testid="checkout"
            >
              {!selectedDate
                ? 'Pick your perfect date above'
                : !coupleName.trim() || !email.trim()
                  ? 'Add your details to continue'
                  : 'Secure Your Date →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
