import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { toUtcMidnight } from '@macon/shared';
import { usePackage } from './hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Mail, Users } from 'lucide-react';
import { DatePicker } from '../booking/DatePicker';
import { AddOnList } from '../booking/AddOnList';
import { TotalBox } from '../booking/TotalBox';
import { ProgressSteps } from '@/components/ui/progress-steps';
import { useBookingTotal } from '../booking/hooks';
import { api } from '../../lib/api';
import { formatCurrency } from '@/lib/utils';
import type { LastCheckout } from '../../lib/types';

export function PackagePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: pkg, isLoading, error } = usePackage(slug || '');

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [coupleName, setCoupleName] = useState('');
  const [email, setEmail] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const packageData = pkg;
  const total = useBookingTotal(
    packageData?.priceCents || 0,
    packageData?.addOns || [],
    selectedAddOns
  );

  // Progress steps for booking flow
  const bookingSteps = useMemo(
    () => [
      { label: 'Package', description: 'Choose your package' },
      { label: 'Date', description: 'Select appointment date' },
      { label: 'Extras', description: 'Add-ons & details' },
      { label: 'Checkout', description: 'Complete booking' },
    ],
    []
  );

  // Determine current step based on completion
  const currentStep = useMemo(() => {
    if (!packageData) return 0;
    if (!selectedDate) return 1;
    if (!coupleName.trim() || !email.trim()) return 2;
    return 3;
  }, [packageData, selectedDate, coupleName, email]);

  // Get selected add-on objects for TotalBox
  const selectedAddOnObjects = useMemo(() => {
    if (!packageData?.addOns) return [];
    return packageData.addOns.filter((addOn) => selectedAddOns.has(addOn.id));
  }, [packageData, selectedAddOns]);

  if (isLoading) {
    return <div className="text-center py-12 text-neutral-700 text-xl">Loading package...</div>;
  }

  if (error || !packageData) {
    return <div className="text-center py-12 text-neutral-900 text-xl">Package not found</div>;
  }

  const handleCheckout = async () => {
    if (!selectedDate || !packageData || !coupleName.trim() || !email.trim()) return;

    setIsCheckingOut(true);
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
        // Persist checkout data to localStorage
        const checkoutData: LastCheckout = {
          packageId: packageData.id,
          eventDate,
          email: email.trim(),
          coupleName: coupleName.trim(),
          addOnIds: Array.from(selectedAddOns),
        };
        localStorage.setItem('lastCheckout', JSON.stringify(checkoutData));

        // Redirect to Stripe checkout
        window.location.href = response.body.checkoutUrl;
      } else {
        setIsCheckingOut(false);
        toast.error('Failed to create checkout session', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (error) {
      setIsCheckingOut(false);
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
    <div className="space-y-8">
      {/* Progress Steps */}
      <ProgressSteps steps={bookingSteps} currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="overflow-hidden bg-white border-neutral-200 shadow-elevation-1">
            {packageData.photoUrl && (
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={packageData.photoUrl}
                  alt={packageData.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <CardContent className="p-8">
              <h1 className="font-heading text-5xl font-bold mb-4 text-neutral-900">
                {packageData.title}
              </h1>
              <p className="text-neutral-700 mb-6 leading-relaxed text-xl">
                {packageData.description}
              </p>
              <div className="flex items-center gap-2 pt-4 border-t border-neutral-200">
                <span className="text-lg text-neutral-600">Base Price:</span>
                <span className="text-4xl font-heading font-semibold text-macon-navy">
                  {formatCurrency(packageData.priceCents)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200 shadow-elevation-1">
            <CardHeader>
              <CardTitle className="text-neutral-900 text-3xl">Select Date</CardTitle>
            </CardHeader>
            <CardContent>
              <DatePicker selected={selectedDate} onSelect={setSelectedDate} />
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200 shadow-elevation-1">
            <CardHeader>
              <CardTitle className="text-neutral-900 text-3xl">Your Details</CardTitle>
              <p className="text-neutral-500 text-base mt-1">We'll send your confirmation here</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <InputEnhanced
                  id="coupleName"
                  type="text"
                  value={coupleName}
                  onChange={(e) => setCoupleName(e.target.value)}
                  placeholder="e.g., Sarah & Alex"
                  label="Your Names"
                  floatingLabel
                  leftIcon={<Users className="w-5 h-5" />}
                  clearable
                  onClear={() => setCoupleName('')}
                  required
                  disabled={isCheckingOut}
                />
                <InputEnhanced
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  label="Email Address"
                  floatingLabel
                  leftIcon={<Mail className="w-5 h-5" />}
                  clearable
                  onClear={() => setEmail('')}
                  required
                  disabled={isCheckingOut}
                />
              </div>
            </CardContent>
          </Card>

          {packageData.addOns && packageData.addOns.length > 0 && (
            <Card className="bg-white border-neutral-200 shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-neutral-900 text-3xl">Add-Ons</CardTitle>
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
          <div className="space-y-4">
            <TotalBox
              total={total}
              packagePrice={packageData?.priceCents}
              packageName={packageData?.title}
              selectedAddOns={selectedAddOnObjects}
            />
            <Button
              onClick={handleCheckout}
              disabled={!selectedDate || !coupleName.trim() || !email.trim()}
              isLoading={isCheckingOut}
              loadingText="Preparing your secure checkout..."
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
