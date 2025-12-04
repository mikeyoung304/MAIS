/**
 * Error Case & Validation Test Script for Package Photo Upload
 * Tests authentication, validation, authorization, and edge cases
 */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001';

interface TestResult {
  test: string;
  expectedStatus: number;
  actualStatus: number;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

interface TestReport {
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  results: TestResult[];
  securityIssues: string[];
  validationGaps: string[];
  summary: string;
}

// Test data
let validToken: string;
let validTenantId: string;
let validPackageId: string;
let anotherTenantToken: string;
let anotherTenantId: string;
let anotherTenantPackageId: string;

const results: TestResult[] = [];
const securityIssues: string[] = [];
const validationGaps: string[] = [];

/**
 * Helper to create test image buffers
 */
function createTestImage(sizeBytes: number): Buffer {
  // Create a minimal PNG header + data
  const header = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
  ]);
  const remaining = sizeBytes - header.length;
  return Buffer.concat([header, Buffer.alloc(remaining, 0xff)]);
}

/**
 * Helper to create invalid file (non-image)
 */
function createTextFile(content: string): Buffer {
  return Buffer.from(content);
}

/**
 * Helper to record test result
 */
function recordTest(
  test: string,
  expectedStatus: number,
  actualStatus: number,
  details: string,
  error?: string
): void {
  const status = actualStatus === expectedStatus ? 'PASS' : 'FAIL';
  results.push({ test, expectedStatus, actualStatus, status, details, error });

  console.log(`${status === 'PASS' ? '✅' : '❌'} ${test}`);
  console.log(`   Expected: ${expectedStatus}, Got: ${actualStatus} - ${details}`);
  if (error) console.log(`   Error: ${error}`);
  console.log('');
}

/**
 * Setup test environment - create tenants and packages
 */
async function setup(): Promise<void> {
  console.log('🔧 Setting up test environment...\n');

  try {
    // Login as first tenant
    const login1 = await axios.post(`${API_BASE}/v1/auth/tenant/login`, {
      email: 'sunrise@example.com',
      password: 'StrongPass123!',
    });
    validToken = login1.data.accessToken;
    validTenantId = login1.data.tenantId;

    // Get or create a package for first tenant
    const packages1 = await axios.get(`${API_BASE}/v1/tenant-admin/packages`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    if (packages1.data.length > 0) {
      validPackageId = packages1.data[0].id;
    } else {
      // Create a package
      const newPkg1 = await axios.post(
        `${API_BASE}/v1/tenant-admin/packages`,
        {
          slug: 'test-pkg-upload',
          title: 'Test Package for Upload',
          description: 'Test package for photo upload testing',
          priceCents: 50000,
        },
        { headers: { Authorization: `Bearer ${validToken}` } }
      );
      validPackageId = newPkg1.data.id;
    }

    // Login as second tenant
    const login2 = await axios.post(`${API_BASE}/v1/auth/tenant/login`, {
      email: 'golden@example.com',
      password: 'StrongPass123!',
    });
    anotherTenantToken = login2.data.accessToken;
    anotherTenantId = login2.data.tenantId;

    // Get or create a package for second tenant
    const packages2 = await axios.get(`${API_BASE}/v1/tenant-admin/packages`, {
      headers: { Authorization: `Bearer ${anotherTenantToken}` },
    });

    if (packages2.data.length > 0) {
      anotherTenantPackageId = packages2.data[0].id;
    } else {
      const newPkg2 = await axios.post(
        `${API_BASE}/v1/tenant-admin/packages`,
        {
          slug: 'test-pkg-other-tenant',
          title: 'Test Package for Other Tenant',
          description: 'Test package for authorization testing',
          priceCents: 60000,
        },
        { headers: { Authorization: `Bearer ${anotherTenantToken}` } }
      );
      anotherTenantPackageId = newPkg2.data.id;
    }

    console.log('✅ Test environment ready');
    console.log(`   Tenant 1: ${validTenantId}, Package: ${validPackageId}`);
    console.log(`   Tenant 2: ${anotherTenantId}, Package: ${anotherTenantPackageId}\n`);
  } catch (error: any) {
    console.error('❌ Setup failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 1: Upload without auth token
 */
async function test1_NoAuth(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'test.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: form.getHeaders(),
    });

    recordTest(
      'Upload without auth token',
      401,
      200,
      'SECURITY ISSUE: Request succeeded without authentication'
    );
    securityIssues.push('Photo upload allowed without authentication');
  } catch (error: any) {
    const status = error.response?.status || 0;
    recordTest(
      'Upload without auth token',
      401,
      status,
      status === 401 ? 'Correctly rejected unauthorized request' : error.message
    );
  }
}

/**
 * Test 2: Upload with invalid token
 */
async function test2_InvalidToken(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'test.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: 'Bearer invalid_token_12345',
      },
    });

    recordTest(
      'Upload with invalid token',
      401,
      200,
      'SECURITY ISSUE: Request succeeded with invalid token'
    );
    securityIssues.push('Photo upload allowed with invalid token');
  } catch (error: any) {
    const status = error.response?.status || 0;
    recordTest(
      'Upload with invalid token',
      401,
      status,
      status === 401 ? 'Correctly rejected invalid token' : error.message
    );
  }
}

/**
 * Test 3: Upload without file
 */
async function test3_NoFile(): Promise<void> {
  try {
    const form = new FormData();
    // Don't append any file

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest('Upload without file', 400, 200, 'Should reject missing file');
    validationGaps.push('Missing file validation not enforced');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload without file',
      400,
      status,
      status === 400 && message.includes('No photo uploaded')
        ? 'Correctly rejected missing file'
        : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 4: Upload file too large (>5MB)
 */
async function test4_FileTooLarge(): Promise<void> {
  try {
    const form = new FormData();
    // Create 6MB file
    form.append('photo', createTestImage(6 * 1024 * 1024), 'large.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest('Upload file >5MB', 413, 200, 'Should reject oversized file');
    validationGaps.push('File size limit (5MB) not enforced');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || error.message || '';
    const isCorrect = status === 413 || (status === 400 && message.includes('size'));
    recordTest(
      'Upload file >5MB',
      413,
      status,
      isCorrect ? 'Correctly rejected oversized file' : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 5: Upload invalid file type
 */
async function test5_InvalidFileType(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTextFile('This is a text file'), 'test.txt');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest('Upload non-image file', 400, 200, 'Should reject non-image file');
    validationGaps.push('File type validation not enforced');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload non-image file',
      400,
      status,
      status === 400 && message.includes('type')
        ? 'Correctly rejected invalid file type'
        : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 6: Upload to non-existent package
 */
async function test6_NonExistentPackage(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'test.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/non-existent-package-id/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest('Upload to non-existent package', 404, 200, 'Should return 404 for missing package');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload to non-existent package',
      404,
      status,
      status === 404 && message.includes('not found')
        ? 'Correctly rejected non-existent package'
        : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 7: Upload 6th photo (exceeds max 5)
 */
async function test7_ExceedMaxPhotos(): Promise<void> {
  try {
    // First, upload 5 photos
    for (let i = 0; i < 5; i++) {
      const form = new FormData();
      form.append('photo', createTestImage(1024), `photo${i}.png`);

      await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${validToken}`,
        },
      });
    }

    // Try to upload 6th photo
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'photo6.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest('Upload 6th photo (exceeds max)', 400, 200, 'Should reject 6th photo');
    validationGaps.push('Maximum 5 photos limit not enforced');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload 6th photo (exceeds max)',
      400,
      status,
      status === 400 && message.includes('Maximum 5')
        ? 'Correctly enforced 5 photo limit'
        : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 8: Delete non-existent photo
 */
async function test8_DeleteNonExistentPhoto(): Promise<void> {
  try {
    await axios.delete(
      `${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos/non-existent-file.png`,
      {
        headers: { Authorization: `Bearer ${validToken}` },
      }
    );

    recordTest('Delete non-existent photo', 404, 200, 'Should return 404 for missing photo');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Delete non-existent photo',
      404,
      status,
      status === 404 && message.includes('not found')
        ? 'Correctly rejected non-existent photo'
        : `Wrong error: ${message}`
    );
  }
}

/**
 * Test 9: Upload to another tenant's package
 */
async function test9_UploadToAnotherTenantPackage(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'test.png');

    // Tenant 1 tries to upload to Tenant 2's package
    await axios.post(
      `${API_BASE}/v1/tenant-admin/packages/${anotherTenantPackageId}/photos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${validToken}`,
        },
      }
    );

    recordTest(
      "Upload to another tenant's package",
      403,
      200,
      'SECURITY ISSUE: Cross-tenant upload allowed'
    );
    securityIssues.push('Cross-tenant photo upload not prevented');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    // Could be 404 (package not visible) or 403 (forbidden)
    const isCorrect = status === 403 || status === 404;
    recordTest(
      "Upload to another tenant's package",
      403,
      status,
      isCorrect ? 'Correctly prevented cross-tenant upload' : `Wrong status: ${status} - ${message}`
    );
  }
}

/**
 * Test 10: Delete another tenant's package photo
 */
async function test10_DeleteAnotherTenantPhoto(): Promise<void> {
  try {
    // First, upload a photo as tenant 2
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'tenant2-photo.png');

    const uploadRes = await axios.post(
      `${API_BASE}/v1/tenant-admin/packages/${anotherTenantPackageId}/photos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${anotherTenantToken}`,
        },
      }
    );

    const filename = uploadRes.data.filename;

    // Tenant 1 tries to delete Tenant 2's photo
    await axios.delete(
      `${API_BASE}/v1/tenant-admin/packages/${anotherTenantPackageId}/photos/${filename}`,
      {
        headers: { Authorization: `Bearer ${validToken}` },
      }
    );

    recordTest(
      "Delete another tenant's photo",
      403,
      200,
      'SECURITY ISSUE: Cross-tenant deletion allowed'
    );
    securityIssues.push('Cross-tenant photo deletion not prevented');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    const isCorrect = status === 403 || status === 404;
    recordTest(
      "Delete another tenant's photo",
      403,
      status,
      isCorrect
        ? 'Correctly prevented cross-tenant deletion'
        : `Wrong status: ${status} - ${message}`
    );
  }
}

/**
 * Test 11: Upload photo with special characters in filename
 */
async function test11_SpecialCharsFilename(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'test file (1) [copy].png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    recordTest(
      'Upload with special chars in filename',
      201,
      201,
      'Correctly handled special characters in filename'
    );
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload with special chars in filename',
      201,
      status,
      status === 201
        ? 'Correctly handled special characters'
        : `Failed to handle special characters: ${message}`
    );
  }
}

/**
 * Test 12: Upload very small image (1 byte)
 */
async function test12_TinyImage(): Promise<void> {
  try {
    const form = new FormData();
    form.append('photo', Buffer.from([0xff]), 'tiny.png');

    await axios.post(`${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${validToken}`,
      },
    });

    // This might succeed or fail depending on validation
    recordTest(
      'Upload 1-byte file',
      400,
      201,
      'Edge case: 1-byte file accepted (may want to add min size validation)'
    );
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Upload 1-byte file',
      400,
      status,
      status === 400 ? 'Correctly rejected tiny file' : `Unexpected error: ${message}`
    );
  }
}

/**
 * Test 13: Delete same photo twice
 */
async function test13_DeletePhotoTwice(): Promise<void> {
  try {
    // Upload a photo
    const form = new FormData();
    form.append('photo', createTestImage(1024), 'delete-twice.png');

    const uploadRes = await axios.post(
      `${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${validToken}`,
        },
      }
    );

    const filename = uploadRes.data.filename;

    // Delete once
    await axios.delete(
      `${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos/${filename}`,
      {
        headers: { Authorization: `Bearer ${validToken}` },
      }
    );

    // Delete again
    await axios.delete(
      `${API_BASE}/v1/tenant-admin/packages/${validPackageId}/photos/${filename}`,
      {
        headers: { Authorization: `Bearer ${validToken}` },
      }
    );

    recordTest('Delete same photo twice', 404, 200, 'Should return 404 on second delete');
  } catch (error: any) {
    const status = error.response?.status || 0;
    const message = error.response?.data?.error || '';
    recordTest(
      'Delete same photo twice',
      404,
      status,
      status === 404 ? 'Correctly handled double deletion' : `Unexpected error: ${message}`
    );
  }
}

/**
 * Generate final report
 */
function generateReport(): TestReport {
  const testsPassed = results.filter((r) => r.status === 'PASS').length;
  const testsFailed = results.filter((r) => r.status === 'FAIL').length;

  return {
    testsRun: results.length,
    testsPassed,
    testsFailed,
    results,
    securityIssues,
    validationGaps,
    summary: `${testsPassed}/${results.length} error cases handled correctly`,
  };
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Error Case & Validation Tests\n');
  console.log('='.repeat(60));
  console.log('');

  try {
    await setup();

    console.log('📋 Running tests...\n');
    console.log('='.repeat(60));
    console.log('');

    // Authentication tests
    console.log('🔐 Authentication Tests:');
    await test1_NoAuth();
    await test2_InvalidToken();
    console.log('');

    // Validation tests
    console.log('✅ Validation Tests:');
    await test3_NoFile();
    await test4_FileTooLarge();
    await test5_InvalidFileType();
    await test6_NonExistentPackage();
    console.log('');

    // Business logic tests
    console.log('💼 Business Logic Tests:');
    await test7_ExceedMaxPhotos();
    await test8_DeleteNonExistentPhoto();
    console.log('');

    // Authorization tests
    console.log('🔒 Authorization Tests:');
    await test9_UploadToAnotherTenantPackage();
    await test10_DeleteAnotherTenantPhoto();
    console.log('');

    // Edge case tests
    console.log('🎯 Edge Case Tests:');
    await test11_SpecialCharsFilename();
    await test12_TinyImage();
    await test13_DeletePhotoTwice();
    console.log('');

    // Generate report
    console.log('='.repeat(60));
    console.log('');
    const report = generateReport();

    console.log('📊 TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Tests Run: ${report.testsRun}`);
    console.log(`Tests Passed: ${report.testsPassed} ✅`);
    console.log(`Tests Failed: ${report.testsFailed} ❌`);
    console.log(`Summary: ${report.summary}`);
    console.log('');

    if (report.securityIssues.length > 0) {
      console.log('🚨 SECURITY ISSUES:');
      report.securityIssues.forEach((issue) => console.log(`   - ${issue}`));
      console.log('');
    }

    if (report.validationGaps.length > 0) {
      console.log('⚠️  VALIDATION GAPS:');
      report.validationGaps.forEach((gap) => console.log(`   - ${gap}`));
      console.log('');
    }

    console.log('📄 Full JSON Report:');
    console.log(JSON.stringify(report, null, 2));
  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
