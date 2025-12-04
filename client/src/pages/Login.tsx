import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Logo } from '@/components/brand/Logo';
import { ErrorSummary, type FormError } from '@/components/ui/ErrorSummary';
import { Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

/**
 * Unified Login Page
 * Handles authentication for both Platform Admins and Tenant Admins
 * Routes users to the appropriate dashboard based on their role
 */
export function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, role } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);

  // Initialize form with empty values
  const { values, handleChange } = useForm({
    email: '',
    password: '',
  });

  /**
   * Redirect if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && role) {
      if (role === 'PLATFORM_ADMIN') {
        navigate('/admin/dashboard');
      } else if (role === 'TENANT_ADMIN') {
        navigate('/tenant/dashboard');
      }
    }
  }, [isAuthenticated, role, navigate]);

  /**
   * Validate form before submission
   */
  const validateForm = (): FormError[] => {
    const errors: FormError[] = [];

    if (!values.email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    if (!values.password) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (values.password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
    }

    return errors;
  };

  /**
   * Attempt login
   * Tries admin login first, then falls back to tenant login
   * Routes user based on successful authentication type
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
      // Try platform admin login first
      try {
        await login(values.email, values.password, 'PLATFORM_ADMIN');
        navigate('/admin/dashboard');
        return;
      } catch (adminError) {
        // Admin login failed, try tenant login
        try {
          await login(values.email, values.password, 'TENANT_ADMIN');
          navigate('/tenant/dashboard');
          return;
        } catch (tenantError) {
          // Both logins failed
          logger.error('Login failed for both admin and tenant', {
            error: { adminError, tenantError },
            component: 'Login',
          });
          setError('Invalid credentials. Please check your email and password.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <Link
        to="/"
        className="absolute top-8 left-8 inline-flex items-center gap-2 text-macon-navy hover:text-macon-navy-dark transition-colors group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-lg font-medium">Back to Home</span>
      </Link>
      <div className="max-w-md w-full">
        {/* Logo centered above card */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" linkTo="/" />
        </div>

        <Card colorScheme="navy" className="mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-white text-3xl">Login</CardTitle>
            <p className="text-center text-white/70 text-sm mt-2">Platform Admin or Tenant Admin</p>
          </CardHeader>
          <CardContent>
            {/* Validation Errors */}
            <ErrorSummary errors={validationErrors} onDismiss={() => setValidationErrors([])} />

            {/* Server Error */}
            {error && (
              <div
                role="alert"
                className="mb-6 p-4 bg-red-900/50 border border-red-400 text-red-100 rounded"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-lg mb-3">{error}</p>
                    <div className="space-y-2 pt-3 border-t border-red-400/30">
                      <p className="text-sm text-red-200 font-medium">Need help?</p>
                      <div className="flex flex-col gap-2">
                        <a
                          href="mailto:support@maconai.com"
                          className="text-sm text-red-100 underline hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          Contact support
                        </a>
                        <Link
                          to="/"
                          className="text-sm text-red-100 underline hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          Back to homepage
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
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
              <InputEnhanced
                id="password"
                type="password"
                value={values.password}
                onChange={(e) => handleChange('password', e.target.value)}
                label="Password"
                floatingLabel
                leftIcon={<Lock className="w-5 h-5 text-white/60" />}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-white/60 focus:ring-white/30"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-white/70 text-sm hover:text-white transition-colors underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full bg-macon-orange hover:bg-macon-orange-dark text-white text-xl h-14"
                isLoading={isLoading}
                loadingText="Logging in..."
              >
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
