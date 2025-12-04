import { FormEvent, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { ErrorSummary, type FormError } from '@/components/ui/ErrorSummary';
import { Mail, Lock } from 'lucide-react';
import { useForm } from '@/hooks/useForm';

interface TenantLoginProps {
  onLogin: (email: string, password: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

export function TenantLogin({ onLogin, error, isLoading }: TenantLoginProps) {
  const { values, handleChange } = useForm({
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState<FormError[]>([]);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    onLogin(values.email, values.password);
  };

  return (
    <Card className="max-w-md mx-auto bg-macon-navy-800 border-white/20">
      <CardHeader>
        <CardTitle className="text-center text-white text-3xl">Tenant Login</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Validation Errors */}
        <ErrorSummary errors={validationErrors} onDismiss={() => setValidationErrors([])} />

        {/* Server Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-3 bg-macon-navy-700 border border-white/20 text-white/90 rounded text-lg"
          >
            {error}
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
            leftIcon={<Mail className="w-5 h-5" />}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            required
            disabled={isLoading}
          />
          <InputEnhanced
            id="password"
            type="password"
            value={values.password}
            onChange={(e) => handleChange('password', e.target.value)}
            label="Password"
            floatingLabel
            leftIcon={<Lock className="w-5 h-5" />}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            required
            disabled={isLoading}
          />
          <Button
            type="submit"
            className="w-full bg-macon-navy hover:bg-macon-navy-dark text-xl h-14"
            isLoading={isLoading}
            loadingText="Logging in..."
          >
            Login
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
