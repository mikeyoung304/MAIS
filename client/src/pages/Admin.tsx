import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../ui/Container';
import { Dashboard } from '../features/admin/Dashboard';
import { FeatureErrorBoundary } from '../components/errors';

export function Admin() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check for admin token, redirect to login if not present
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Show nothing while checking token (or show a loading spinner)
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return null;
  }

  return (
    <FeatureErrorBoundary featureName="Admin Dashboard">
      <Container className="py-12">
        <Dashboard />
      </Container>
    </FeatureErrorBoundary>
  );
}
