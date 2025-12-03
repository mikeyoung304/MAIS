import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputEnhanced } from "@/components/ui/input-enhanced";
import { Logo } from "@/components/brand/Logo";
import { ErrorSummary, type FormError } from "@/components/ui/ErrorSummary";
import { Lock, ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useForm } from "@/hooks/useForm";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token from email.
 * Token is passed via URL query parameter: /reset-password?token=xxx
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);

  const { values, handleChange } = useForm({
    password: "",
    confirmPassword: "",
  });

  // Check if token is present
  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  /**
   * Validate form before submission
   */
  const validateForm = (): FormError[] => {
    const errors: FormError[] = [];

    if (!values.password) {
      errors.push({ field: "password", message: "Password is required" });
    } else if (values.password.length < 8) {
      errors.push({ field: "password", message: "Password must be at least 8 characters" });
    } else if (!/[A-Z]/.test(values.password)) {
      errors.push({ field: "password", message: "Password must contain at least one uppercase letter" });
    } else if (!/[a-z]/.test(values.password)) {
      errors.push({ field: "password", message: "Password must contain at least one lowercase letter" });
    } else if (!/[0-9]/.test(values.password)) {
      errors.push({ field: "password", message: "Password must contain at least one number" });
    }

    if (!values.confirmPassword) {
      errors.push({ field: "confirmPassword", message: "Please confirm your password" });
    } else if (values.password !== values.confirmPassword) {
      errors.push({ field: "confirmPassword", message: "Passwords do not match" });
    }

    return errors;
  };

  /**
   * Submit new password
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

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: values.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reset password");
      }

      // Success
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Missing token state
  if (!token) {
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
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Invalid Link</h2>
              <p className="text-white/70 mb-6">
                This password reset link is invalid or has expired.
                Please request a new one.
              </p>
              <Link to="/forgot-password">
                <Button className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white">
                  Request New Link
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative">
        <div className="max-w-md w-full">
          <div className="flex justify-center mb-8">
            <Logo size="lg" linkTo="/" />
          </div>

          <Card colorScheme="navy" className="mx-auto">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
              <p className="text-white/70 mb-6">
                Your password has been successfully reset.
                You can now log in with your new password.
              </p>
              <Link to="/login">
                <Button className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white text-xl h-14">
                  Go to Login
                </Button>
              </Link>
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
            <CardTitle className="text-center text-white text-3xl">Reset Password</CardTitle>
            <p className="text-center text-white/70 text-sm mt-2">
              Enter your new password
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
                  <div className="flex-1">
                    <p>{error}</p>
                    {error.includes("expired") && (
                      <Link
                        to="/forgot-password"
                        className="mt-2 inline-block text-sm underline hover:text-white"
                      >
                        Request a new reset link
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <InputEnhanced
                id="password"
                type="password"
                value={values.password}
                onChange={(e) => handleChange("password", e.target.value)}
                label="New Password"
                floatingLabel
                leftIcon={<Lock className="w-5 h-5 text-white/60" />}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />

              <InputEnhanced
                id="confirmPassword"
                type="password"
                value={values.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                label="Confirm Password"
                floatingLabel
                leftIcon={<Lock className="w-5 h-5 text-white/60" />}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />

              <div className="text-white/50 text-sm">
                <p className="font-medium mb-1">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 8 characters</li>
                  <li>At least one uppercase letter</li>
                  <li>At least one lowercase letter</li>
                  <li>At least one number</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white text-xl h-14"
                isLoading={isLoading}
                loadingText="Resetting..."
              >
                Reset Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
