import { FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Mail, Lock } from 'lucide-react';
import { useForm } from '@/hooks/useForm';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

export function Login({ onLogin, error, isLoading }: LoginProps) {
  // Auto-fill for local development/demo
  const { values, handleChange } = useForm({
    email: 'admin@example.com',
    password: 'TestPassword123!',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(values.email, values.password);
  };

  return (
    <Card className="max-w-md mx-auto bg-macon-navy-800 border-white/20">
      <CardHeader>
        <CardTitle className="text-center text-white text-3xl">Admin Login</CardTitle>
      </CardHeader>
      <CardContent>
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
