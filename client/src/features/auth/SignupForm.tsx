import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InputEnhanced } from "@/components/ui/input-enhanced";
import { ErrorSummary, type FormError } from "@/components/ui/ErrorSummary";
import { Mail, Lock, Building2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useForm } from "@/hooks/useForm";
import { api } from "@/lib/api";
import { storeToken } from "@/lib/auth";

/**
 * Signup Form Component
 *
 * Handles tenant registration with validation and error handling.
 *
 * Validations:
 * - Business name: 2-100 characters
 * - Email: valid email format
 * - Password: min 8 characters
 * - Confirm password: must match password
 */
export function SignupForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { values, handleChange } = useForm({
    businessName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  /**
   * Validate form before submission
   */
  const validateForm = (): FormError[] => {
    const errors: FormError[] = [];

    // Business name validation
    if (!values.businessName) {
      errors.push({ field: 'businessName', message: 'Business name is required' });
    } else if (values.businessName.length < 2) {
      errors.push({ field: 'businessName', message: 'Business name must be at least 2 characters' });
    } else if (values.businessName.length > 100) {
      errors.push({ field: 'businessName', message: 'Business name must be less than 100 characters' });
    }

    // Email validation
    if (!values.email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    // Password validation
    if (!values.password) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (values.password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    }

    // Confirm password validation
    if (!values.confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Please confirm your password' });
    } else if (values.password !== values.confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
    }

    return errors;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setValidationErrors([]);

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Call signup endpoint
      const result = await api.tenantSignup({
        body: {
          email: values.email,
          password: values.password,
          businessName: values.businessName,
        },
      });

      // Handle different response statuses
      if (result.status === 201) {
        // Success - store token and redirect
        const { token, tenantId, slug, apiKeyPublic, secretKey } = result.body;

        // Store token for tenant admin
        storeToken(token, 'TENANT_ADMIN');

        // Set tenant token in API client
        api.setTenantToken(token);

        // Store API keys temporarily in sessionStorage to show on success page
        sessionStorage.setItem('signup_success', JSON.stringify({
          tenantId,
          slug,
          apiKeyPublic,
          secretKey,
        }));

        // Redirect to tenant dashboard
        navigate("/tenant/dashboard");
      } else if (result.status === 400) {
        // Validation errors from server
        const errorBody = result.body as { errors?: Array<{ field: string; message: string }> };
        if (errorBody.errors && errorBody.errors.length > 0) {
          setValidationErrors(errorBody.errors);
        } else {
          setServerError("Invalid input. Please check your information and try again.");
        }
      } else if (result.status === 409) {
        // Email already exists
        setServerError("An account with this email already exists. Please log in instead.");
      } else if (result.status === 429) {
        // Rate limited
        setServerError("Too many signup attempts. Please try again later.");
      } else {
        // Other errors
        setServerError("An error occurred during signup. Please try again.");
      }
    } catch (error) {
      setServerError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Validation Errors */}
      <ErrorSummary
        errors={validationErrors}
        onDismiss={() => setValidationErrors([])}
      />

      {/* Server Error */}
      {serverError && (
        <div role="alert" className="p-4 bg-red-900/50 border border-red-400 text-red-100 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm">{serverError}</p>
          </div>
        </div>
      )}

      {/* Business Name */}
      <InputEnhanced
        id="businessName"
        type="text"
        value={values.businessName}
        onChange={(e) => handleChange('businessName', e.target.value)}
        label="Business Name"
        floatingLabel
        leftIcon={<Building2 className="w-5 h-5 text-white/60" />}
        className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
        required
        disabled={isLoading}
        autoComplete="organization"
        maxLength={100}
      />

      {/* Email */}
      <InputEnhanced
        id="email"
        type="email"
        value={values.email}
        onChange={(e) => handleChange('email', e.target.value)}
        label="Email"
        floatingLabel
        leftIcon={<Mail className="w-5 h-5 text-white/60" />}
        className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
        required
        disabled={isLoading}
        autoComplete="email"
      />

      {/* Password */}
      <div className="relative">
        <InputEnhanced
          id="password"
          type={showPassword ? "text" : "password"}
          value={values.password}
          onChange={(e) => handleChange('password', e.target.value)}
          label="Password"
          floatingLabel
          leftIcon={<Lock className="w-5 h-5 text-white/60" />}
          className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Confirm Password */}
      <div className="relative">
        <InputEnhanced
          id="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          value={values.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          label="Confirm Password"
          floatingLabel
          leftIcon={<Lock className="w-5 h-5 text-white/60" />}
          className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white text-xl h-14"
        isLoading={isLoading}
        loadingText="Creating account..."
      >
        Create Account
      </Button>
    </form>
  );
}
