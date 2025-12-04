import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/brand/Logo';
import { ArrowLeft } from 'lucide-react';
import { SignupForm } from './SignupForm';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Tenant Signup Page
 *
 * Allows new businesses to sign up for the MAIS platform.
 * Creates a new tenant account with admin access.
 *
 * Features:
 * - Self-service registration
 * - Client-side validation
 * - Automatic login after signup
 * - Redirect to tenant dashboard
 */
export function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

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
            <CardTitle className="text-center text-white text-3xl">Sign Up</CardTitle>
            <p className="text-center text-white/70 text-sm mt-2">Create your business account</p>
          </CardHeader>
          <CardContent>
            <SignupForm />

            {/* Link to login */}
            <div className="mt-6 text-center">
              <p className="text-white/70 text-sm">
                Already have an account?{' '}
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
