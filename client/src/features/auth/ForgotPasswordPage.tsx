import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputEnhanced } from "@/components/ui/input-enhanced";
import { Logo } from "@/components/brand/Logo";
import { ErrorSummary, type FormError } from "@/components/ui/ErrorSummary";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useForm } from "@/hooks/useForm";
import { api } from "@/lib/api";

/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 * Works for both Platform Admins and Tenant Admins.
 */
export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);

  const { values, handleChange } = useForm({
    email: "",
  });

  /**
   * Validate form before submission
   */
  const validateForm = (): FormError[] => {
    const errors: FormError[] = [];

    if (!values.email) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.push({ field: "email", message: "Please enter a valid email address" });
    }

    return errors;
  };

  /**
   * Submit password reset request
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.forgotPassword({
        body: { email: values.email },
      });

      if (response.status !== 200) {
        throw new Error("Failed to send reset email");
      }

      // Success - show confirmation
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative">
        <Link
          to="/login"
          className="absolute top-8 left-8 inline-flex items-center gap-2 text-macon-navy hover:text-macon-navy-dark transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-lg font-medium">Back to Login</span>
        </Link>

        <div className="max-w-md w-full">
          <div className="flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </div>

          <Card colorScheme="navy" className="mx-auto">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-white/70 mb-6">
                If an account exists for <strong className="text-white">{values.email}</strong>,
                you will receive a password reset link shortly.
              </p>
              <p className="text-white/50 text-sm mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setIsSubmitted(false)}
                  variant="outline"
                  className="w-full border-white/30 text-white hover:bg-white/10"
                >
                  Try Another Email
                </Button>
                <Link to="/login">
                  <Button className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <Link
        to="/login"
        className="absolute top-8 left-8 inline-flex items-center gap-2 text-macon-navy hover:text-macon-navy-dark transition-colors group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-lg font-medium">Back to Login</span>
      </Link>

      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          <Logo size="lg" linkTo="/" />
        </div>

        <Card colorScheme="navy" className="mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-white text-3xl">Forgot Password</CardTitle>
            <p className="text-center text-white/70 text-sm mt-2">
              Enter your email to receive a reset link
            </p>
          </CardHeader>
          <CardContent>
            {/* Validation Errors */}
            <ErrorSummary
              errors={validationErrors}
              onDismiss={() => setValidationErrors([])}
            />

            {/* Server Error */}
            {error && (
              <div role="alert" className="mb-6 p-4 bg-red-900/50 border border-red-400 text-red-100 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <InputEnhanced
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => handleChange("email", e.target.value)}
                label="Email"
                floatingLabel
                leftIcon={<Mail className="w-5 h-5 text-white/60" />}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
                required
                disabled={isLoading}
                autoComplete="email"
              />

              <Button
                type="submit"
                className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white text-xl h-14"
                isLoading={isLoading}
                loadingText="Sending..."
              >
                Send Reset Link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/70 text-sm">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-white font-semibold underline hover:text-macon-orange transition-colors"
                >
                  Log in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
