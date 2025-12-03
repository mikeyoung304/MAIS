import { useState, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputEnhanced } from "@/components/ui/input-enhanced";
import { Stepper, type Step } from "@/components/ui/Stepper";
import { ServiceSelector } from "./ServiceSelector";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { baseUrl } from "@/lib/api";
import { toast } from "sonner";
import { toUtcMidnight } from "@macon/shared";
import { User, Mail, Phone, ArrowLeft } from "lucide-react";
import type { ServiceDto } from "@macon/contracts";
import "react-day-picker/style.css";

interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export function AppointmentBookingFlow() {
  // State management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedService, setSelectedService] = useState<ServiceDto | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define steps
  const steps: Step[] = useMemo(() => {
    const stepList = [
      { label: "Service", status: "upcoming" as const },
      { label: "Date", status: "upcoming" as const },
      { label: "Time", status: "upcoming" as const },
      { label: "Details", status: "upcoming" as const },
      { label: "Confirm", status: "upcoming" as const },
    ];

    return stepList.map((step, index) => ({
      ...step,
      status:
        index < currentStepIndex
          ? ("complete" as const)
          : index === currentStepIndex
          ? ("current" as const)
          : ("upcoming" as const),
    }));
  }, [currentStepIndex]);

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStepIndex < 4) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Step 1: Service Selection
  const handleServiceSelect = (service: ServiceDto) => {
    setSelectedService(service);
  };

  const canProceedFromStep1 = selectedService !== null;

  // Step 2: Date Selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date || null);
    setSelectedSlot(null); // Reset time slot when date changes
  };

  const canProceedFromStep2 = selectedDate !== null;

  // Step 3: Time Selection
  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const canProceedFromStep3 = selectedSlot !== null;

  // Step 4: Customer Details
  const updateCustomerDetails = (field: keyof CustomerDetails, value: string) => {
    setCustomerDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const canProceedFromStep4 =
    customerDetails.name.trim() !== "" &&
    customerDetails.email.trim() !== "" &&
    customerDetails.phone.trim() !== "";

  // Step 5: Submit to Checkout
  const handleCheckout = async () => {
    if (!selectedService || !selectedSlot) {
      toast.error("Please complete all steps before checkout");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${baseUrl}/v1/public/appointments/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Key": localStorage.getItem("tenantKey") || "",
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          startTime: selectedSlot.startTime.toISOString(),
          clientName: customerDetails.name.trim(),
          clientEmail: customerDetails.email.trim(),
          clientPhone: customerDetails.phone.trim(),
          notes: customerDetails.notes.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      toast.error("Unable to create checkout session", {
        description: "Please try again or contact support.",
      });
      setIsSubmitting(false);
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStepIndex) {
      case 0:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Select a Service</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceSelector
                selectedServiceId={selectedService?.id}
                onSelect={handleServiceSelect}
              />
            </CardContent>
          </Card>
        );

      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Choose a Date</CardTitle>
            </CardHeader>
            <CardContent>
              <DayPicker
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleDateSelect}
                disabled={{ before: new Date() }}
                className="border border-neutral-300 rounded-lg p-4 bg-neutral-50"
              />
            </CardContent>
          </Card>
        );

      case 2:
        if (!selectedService || !selectedDate) {
          return null;
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Select a Time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSlotPicker
                serviceId={selectedService.id}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot || undefined}
                onSelect={handleSlotSelect}
              />
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Your Information</CardTitle>
              <p className="text-neutral-500 text-base mt-1">
                We'll use this to send your confirmation
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <InputEnhanced
                  id="name"
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => updateCustomerDetails("name", e.target.value)}
                  placeholder="John Doe"
                  label="Full Name"
                  floatingLabel
                  leftIcon={<User className="w-5 h-5" />}
                  clearable
                  onClear={() => updateCustomerDetails("name", "")}
                  required
                />
                <InputEnhanced
                  id="email"
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => updateCustomerDetails("email", e.target.value)}
                  placeholder="john.doe@example.com"
                  label="Email Address"
                  floatingLabel
                  leftIcon={<Mail className="w-5 h-5" />}
                  clearable
                  onClear={() => updateCustomerDetails("email", "")}
                  required
                />
                <InputEnhanced
                  id="phone"
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => updateCustomerDetails("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  label="Phone Number"
                  floatingLabel
                  leftIcon={<Phone className="w-5 h-5" />}
                  clearable
                  onClear={() => updateCustomerDetails("phone", "")}
                  required
                />
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-semibold text-neutral-800 mb-2"
                  >
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={customerDetails.notes}
                    onChange={(e) => updateCustomerDetails("notes", e.target.value)}
                    placeholder="Any special requests or information..."
                    className="w-full h-24 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-base text-neutral-900 placeholder:text-neutral-500 focus:border-macon-orange focus:outline-none focus:ring-4 focus:ring-macon-orange/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        if (!selectedService || !selectedDate || !selectedSlot) {
          return null;
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Review & Confirm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border-b border-neutral-200 pb-4">
                  <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                    Service
                  </h3>
                  <p className="text-lg font-semibold text-neutral-900">
                    {selectedService.name}
                  </p>
                  {selectedService.description && (
                    <p className="text-neutral-600">{selectedService.description}</p>
                  )}
                </div>

                <div className="border-b border-neutral-200 pb-4">
                  <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                    Date & Time
                  </h3>
                  <p className="text-lg font-semibold text-neutral-900">
                    {toUtcMidnight(selectedDate)} at{" "}
                    {selectedSlot.startTime.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                  <p className="text-sm text-neutral-600">
                    Duration: {selectedService.durationMinutes} minutes
                  </p>
                </div>

                <div className="border-b border-neutral-200 pb-4">
                  <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                    Your Information
                  </h3>
                  <p className="text-neutral-900">{customerDetails.name}</p>
                  <p className="text-neutral-600">{customerDetails.email}</p>
                  <p className="text-neutral-600">{customerDetails.phone}</p>
                  {customerDetails.notes && (
                    <p className="text-neutral-600 mt-2 text-sm italic">
                      "{customerDetails.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg text-neutral-600">Total:</span>
                    <span className="text-3xl font-heading font-semibold text-macon-navy">
                      ${(selectedService.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Determine if can proceed from current step
  const canProceed = () => {
    switch (currentStepIndex) {
      case 0:
        return canProceedFromStep1;
      case 1:
        return canProceedFromStep2;
      case 2:
        return canProceedFromStep3;
      case 3:
        return canProceedFromStep4;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Progress Stepper */}
      <Stepper steps={steps} currentStep={currentStepIndex} />

      {/* Step Content */}
      <div className="min-h-[400px]">{renderStepContent()}</div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStepIndex < 4 ? (
          <Button
            onClick={goToNextStep}
            disabled={!canProceed() || isSubmitting}
            size="lg"
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleCheckout}
            disabled={!canProceed() || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Creating checkout session..."
            size="lg"
            className="min-w-[200px]"
          >
            Proceed to Checkout
          </Button>
        )}
      </div>
    </div>
  );
}
