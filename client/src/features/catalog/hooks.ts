import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await api.getPackages();
      if (response.status !== 200) {
        throw new Error('Failed to fetch packages');
      }
      return response.body;
    },
  });
}

export function usePackage(slug: string) {
  return useQuery({
    queryKey: ['package', slug],
    queryFn: async () => {
      const response = await api.getPackageBySlug({ params: { slug } });
      if (response.status !== 200) {
        throw new Error('Failed to fetch package');
      }
      return response.body;
    },
    enabled: !!slug,
  });
}

/**
 * Fetch all active segments for the current tenant
 * Used by Home page to show segment selector cards
 */
export function useSegments() {
  return useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const response = await api.getSegments();
      if (response.status !== 200) {
        throw new Error('Failed to fetch segments');
      }
      return response.body;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - segments change rarely
  });
}

/**
 * Fetch a segment by slug with its packages and add-ons
 * Used by SegmentLanding page
 */
export function useSegmentWithPackages(slug: string) {
  return useQuery({
    queryKey: ['segment', slug, 'packages'],
    queryFn: async () => {
      const response = await api.getSegmentWithPackages({ params: { slug } });
      if (response.status !== 200) {
        throw new Error('Failed to fetch segment');
      }
      return response.body;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
