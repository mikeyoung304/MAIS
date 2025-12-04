import { Container } from '../ui/Container';
import { PackagePage } from '../features/catalog/PackagePage';
import { FeatureErrorBoundary } from '../components/errors';

export function Package() {
  return (
    <FeatureErrorBoundary featureName="Package Details">
      <Container className="py-16">
        <PackagePage />
      </Container>
    </FeatureErrorBoundary>
  );
}
