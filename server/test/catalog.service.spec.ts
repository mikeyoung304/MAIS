/**
 * Unit tests for CatalogService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogService } from '../src/services/catalog.service';
import { NotFoundError, ValidationError } from '../src/lib/errors';
import {
  FakeCatalogRepository,
  FakeSegmentRepository,
  FakeTenantOnboardingService,
  buildPackage,
  buildAddOn,
  buildSegment,
} from './helpers/fakes';

describe('CatalogService', () => {
  let service: CatalogService;
  let catalogRepo: FakeCatalogRepository;

  beforeEach(() => {
    catalogRepo = new FakeCatalogRepository();
    service = new CatalogService(catalogRepo);
  });

  describe('getAllPackages', () => {
    it('returns all packages with their add-ons', async () => {
      // Arrange
      const pkg = buildPackage({ id: 'pkg_1', slug: 'basic' });
      const addOn = buildAddOn({ id: 'addon_1', packageId: 'pkg_1' });
      catalogRepo.addPackage(pkg);
      catalogRepo.addAddOn(addOn);

      // Act
      const result = await service.getAllPackages('test-tenant');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pkg_1');
      expect(result[0].addOns).toHaveLength(1);
      expect(result[0].addOns[0].id).toBe('addon_1');
    });
  });

  describe('getPackageBySlug', () => {
    it('returns package with add-ons when found', async () => {
      // Arrange
      const pkg = buildPackage({ id: 'pkg_1', slug: 'basic' });
      const addOn = buildAddOn({ id: 'addon_1', packageId: 'pkg_1' });
      catalogRepo.addPackage(pkg);
      catalogRepo.addAddOn(addOn);

      // Act
      const result = await service.getPackageBySlug('test-tenant', 'basic');

      // Assert
      expect(result.id).toBe('pkg_1');
      expect(result.slug).toBe('basic');
      expect(result.addOns).toHaveLength(1);
    });

    it('throws NotFoundError when package not found', async () => {
      // Act & Assert
      await expect(service.getPackageBySlug('test-tenant', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
      await expect(service.getPackageBySlug('test-tenant', 'nonexistent')).rejects.toThrow(
        'Package with slug "nonexistent" not found'
      );
    });
  });

  describe('createPackage', () => {
    it('creates a new package successfully', async () => {
      // Arrange
      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
      };

      // Act
      const result = await service.createPackage('test-tenant', data);

      // Assert
      expect(result.slug).toBe('new-package');
      expect(result.title).toBe('New Package');
      expect(result.priceCents).toBe(100000);
      expect(result.id).toBeDefined();
    });

    it('throws ValidationError when slug is empty', async () => {
      // Arrange
      const data = {
        slug: '',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
      };

      // Act & Assert
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(ValidationError);
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(
        'Package: Missing required fields: slug'
      );
    });

    it('throws ValidationError when price is negative', async () => {
      // Arrange
      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: -100,
      };

      // Act & Assert
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(ValidationError);
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(
        'priceCents must be non-negative'
      );
    });

    it('throws ValidationError when slug already exists', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ slug: 'existing' }));
      const data = {
        slug: 'existing',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
      };

      // Act & Assert
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(ValidationError);
      await expect(service.createPackage('test-tenant', data)).rejects.toThrow(
        'Package with slug "existing" already exists'
      );
    });
  });

  describe('createPackage with segment validation', () => {
    let segmentRepo: FakeSegmentRepository;
    let onboardingService: FakeTenantOnboardingService;
    let serviceWithSegments: CatalogService;

    beforeEach(() => {
      segmentRepo = new FakeSegmentRepository();
      onboardingService = new FakeTenantOnboardingService();
      // Pass segment repo and onboarding service to enable segment validation
      serviceWithSegments = new CatalogService(
        catalogRepo,
        undefined, // cache
        undefined, // auditService
        segmentRepo as any, // segmentRepo
        onboardingService as any // tenantOnboardingService
      );
    });

    it('auto-assigns to existing General segment when segmentId not provided', async () => {
      // Arrange: Add a General segment for the tenant
      const generalSegment = buildSegment({
        id: 'seg_general_123',
        tenantId: 'test-tenant',
        slug: 'general',
        name: 'General',
      });
      segmentRepo.addSegment(generalSegment);

      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
        // Note: no segmentId provided
      };

      // Act
      const result = await serviceWithSegments.createPackage('test-tenant', data);

      // Assert: Package was created (we can't check segmentId directly from result,
      // but we can verify onboarding service was NOT called since segment exists)
      expect(result.slug).toBe('new-package');
      expect(onboardingService.createDefaultDataCalls).toHaveLength(0);
    });

    it('creates default segment when General does not exist and segmentId not provided', async () => {
      // Arrange: No segments exist for the tenant
      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
        // Note: no segmentId provided
      };

      // Act
      const result = await serviceWithSegments.createPackage('test-tenant', data);

      // Assert: Package was created and onboarding service was called to create default segment
      expect(result.slug).toBe('new-package');
      expect(onboardingService.createDefaultDataCalls).toHaveLength(1);
      expect(onboardingService.createDefaultDataCalls[0].tenantId).toBe('test-tenant');
    });

    it('validates provided segmentId belongs to tenant', async () => {
      // Arrange: Add a segment for a DIFFERENT tenant
      const otherTenantSegment = buildSegment({
        id: 'seg_other_123',
        tenantId: 'other-tenant', // Different tenant!
        slug: 'general',
        name: 'General',
      });
      segmentRepo.addSegment(otherTenantSegment);

      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
        segmentId: 'seg_other_123', // ID exists but belongs to different tenant
      };

      // Act & Assert: Should throw ValidationError for invalid segment
      await expect(serviceWithSegments.createPackage('test-tenant', data)).rejects.toThrow(
        ValidationError
      );
      await expect(serviceWithSegments.createPackage('test-tenant', data)).rejects.toThrow(
        'Segment not found or access denied'
      );
    });

    it('throws ValidationError when segmentId does not exist', async () => {
      // Arrange: No segments exist
      const data = {
        slug: 'new-package',
        title: 'New Package',
        description: 'A brand new package',
        priceCents: 100000,
        segmentId: 'seg_nonexistent', // ID does not exist
      };

      // Act & Assert: Should throw ValidationError
      await expect(serviceWithSegments.createPackage('test-tenant', data)).rejects.toThrow(
        ValidationError
      );
      await expect(serviceWithSegments.createPackage('test-tenant', data)).rejects.toThrow(
        'Segment not found or access denied'
      );
    });

    it('accepts valid segmentId that belongs to tenant', async () => {
      // Arrange: Add a segment for the tenant
      const segment = buildSegment({
        id: 'seg_wellness_123',
        tenantId: 'test-tenant',
        slug: 'wellness',
        name: 'Wellness Retreats',
      });
      segmentRepo.addSegment(segment);

      const data = {
        slug: 'wellness-package',
        title: 'Wellness Package',
        description: 'A wellness package',
        priceCents: 250000,
        segmentId: 'seg_wellness_123', // Valid segment ID for this tenant
      };

      // Act
      const result = await serviceWithSegments.createPackage('test-tenant', data);

      // Assert: Package was created successfully
      expect(result.slug).toBe('wellness-package');
      expect(result.title).toBe('Wellness Package');
      // Onboarding service was NOT called since segmentId was provided
      expect(onboardingService.createDefaultDataCalls).toHaveLength(0);
    });

    it('isolates segments by tenant - same segmentId works for correct tenant only', async () => {
      // Arrange: Add segments with same ID pattern for different tenants
      const tenantASegment = buildSegment({
        id: 'seg_shared_123',
        tenantId: 'tenant-A',
        slug: 'general',
        name: 'General A',
      });
      const tenantBSegment = buildSegment({
        id: 'seg_shared_456',
        tenantId: 'tenant-B',
        slug: 'general',
        name: 'General B',
      });
      segmentRepo.addSegment(tenantASegment);
      segmentRepo.addSegment(tenantBSegment);

      // Try to use tenant-A's segment from tenant-B
      const data = {
        slug: 'cross-tenant-attempt',
        title: 'Cross Tenant Attempt',
        description: 'Should fail',
        priceCents: 100000,
        segmentId: 'seg_shared_123', // Tenant-A's segment
      };

      // Act & Assert: Should fail for tenant-B
      await expect(serviceWithSegments.createPackage('tenant-B', data)).rejects.toThrow(
        ValidationError
      );
      await expect(serviceWithSegments.createPackage('tenant-B', data)).rejects.toThrow(
        'Segment not found or access denied'
      );
    });
  });

  describe('updatePackage', () => {
    it('updates a package successfully', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1', slug: 'old-slug', title: 'Old Title' }));

      // Act
      const result = await service.updatePackage('test-tenant', 'pkg_1', {
        title: 'New Title',
        priceCents: 150000,
      });

      // Assert
      expect(result.id).toBe('pkg_1');
      expect(result.title).toBe('New Title');
      expect(result.priceCents).toBe(150000);
      expect(result.slug).toBe('old-slug'); // Unchanged
    });

    it('throws NotFoundError when package does not exist', async () => {
      // Act & Assert
      await expect(
        service.updatePackage('test-tenant', 'nonexistent', { title: 'New Title' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.updatePackage('test-tenant', 'nonexistent', { title: 'New Title' })
      ).rejects.toThrow('Package with id "nonexistent" not found');
    });

    it('throws ValidationError when new price is negative', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));

      // Act & Assert
      await expect(
        service.updatePackage('test-tenant', 'pkg_1', { priceCents: -100 })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.updatePackage('test-tenant', 'pkg_1', { priceCents: -100 })
      ).rejects.toThrow('priceCents must be non-negative');
    });

    it('throws ValidationError when new slug already exists', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1', slug: 'old-slug' }));
      catalogRepo.addPackage(buildPackage({ id: 'pkg_2', slug: 'existing-slug' }));

      // Act & Assert
      await expect(
        service.updatePackage('test-tenant', 'pkg_1', { slug: 'existing-slug' })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.updatePackage('test-tenant', 'pkg_1', { slug: 'existing-slug' })
      ).rejects.toThrow('Package with slug "existing-slug" already exists');
    });

    it('allows updating slug to the same value', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1', slug: 'my-slug' }));

      // Act
      const result = await service.updatePackage('test-tenant', 'pkg_1', {
        slug: 'my-slug',
        title: 'Updated',
      });

      // Assert
      expect(result.slug).toBe('my-slug');
      expect(result.title).toBe('Updated');
    });
  });

  describe('deletePackage', () => {
    it('deletes a package successfully', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));

      // Act
      await service.deletePackage('test-tenant', 'pkg_1');

      // Assert
      const packages = await catalogRepo.getAllPackages();
      expect(packages).toHaveLength(0);
    });

    it('throws NotFoundError when package does not exist', async () => {
      // Act & Assert
      await expect(service.deletePackage('test-tenant', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
      await expect(service.deletePackage('test-tenant', 'nonexistent')).rejects.toThrow(
        'Package with id "nonexistent" not found'
      );
    });
  });

  describe('createAddOn', () => {
    it('creates a new add-on successfully', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      const data = {
        packageId: 'pkg_1',
        title: 'New Add-On',
        priceCents: 50000,
      };

      // Act
      const result = await service.createAddOn('test-tenant', data);

      // Assert
      expect(result.packageId).toBe('pkg_1');
      expect(result.title).toBe('New Add-On');
      expect(result.priceCents).toBe(50000);
      expect(result.id).toBeDefined();
    });

    it('throws ValidationError when packageId is empty', async () => {
      // Arrange
      const data = {
        packageId: '',
        title: 'New Add-On',
        priceCents: 50000,
      };

      // Act & Assert
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(ValidationError);
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(
        'AddOn: Missing required fields: packageId'
      );
    });

    it('throws ValidationError when price is negative', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      const data = {
        packageId: 'pkg_1',
        title: 'New Add-On',
        priceCents: -100,
      };

      // Act & Assert
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(ValidationError);
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(
        'priceCents must be non-negative'
      );
    });

    it('throws NotFoundError when package does not exist', async () => {
      // Arrange
      const data = {
        packageId: 'nonexistent',
        title: 'New Add-On',
        priceCents: 50000,
      };

      // Act & Assert
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(NotFoundError);
      await expect(service.createAddOn('test-tenant', data)).rejects.toThrow(
        'Package with id "nonexistent" not found'
      );
    });
  });

  describe('updateAddOn', () => {
    it('updates an add-on successfully', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      catalogRepo.addAddOn(buildAddOn({ id: 'addon_1', packageId: 'pkg_1', title: 'Old Title' }));

      // Act
      const result = await service.updateAddOn('test-tenant', 'addon_1', {
        title: 'New Title',
        priceCents: 60000,
      });

      // Assert
      expect(result.id).toBe('addon_1');
      expect(result.title).toBe('New Title');
      expect(result.priceCents).toBe(60000);
    });

    it('throws ValidationError when new price is negative', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      catalogRepo.addAddOn(buildAddOn({ id: 'addon_1', packageId: 'pkg_1' }));

      // Act & Assert
      await expect(
        service.updateAddOn('test-tenant', 'addon_1', { priceCents: -100 })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.updateAddOn('test-tenant', 'addon_1', { priceCents: -100 })
      ).rejects.toThrow('priceCents must be non-negative');
    });

    it('throws NotFoundError when moving to nonexistent package', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      catalogRepo.addAddOn(buildAddOn({ id: 'addon_1', packageId: 'pkg_1' }));

      // Act & Assert
      await expect(
        service.updateAddOn('test-tenant', 'addon_1', { packageId: 'nonexistent' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.updateAddOn('test-tenant', 'addon_1', { packageId: 'nonexistent' })
      ).rejects.toThrow('Package with id "nonexistent" not found');
    });
  });

  describe('deleteAddOn', () => {
    it('deletes an add-on successfully', async () => {
      // Arrange
      catalogRepo.addPackage(buildPackage({ id: 'pkg_1' }));
      catalogRepo.addAddOn(buildAddOn({ id: 'addon_1', packageId: 'pkg_1' }));

      // Act
      await service.deleteAddOn('test-tenant', 'addon_1');

      // Assert
      const addOns = await catalogRepo.getAddOnsByPackageId('pkg_1');
      expect(addOns).toHaveLength(0);
    });
  });
});
