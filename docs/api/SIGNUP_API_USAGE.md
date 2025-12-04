# Signup API Usage Guide

## Overview

The signup API endpoint has been successfully added to the frontend API client. This allows users to register new tenant accounts with email, password, and business name.

## Backend Endpoint

- **URL**: `POST /v1/auth/signup`
- **Request Body**:
  ```typescript
  {
    email: string; // Valid email address
    password: string; // Min 8 characters
    businessName: string; // Min 2, max 100 characters
  }
  ```
- **Success Response** (201):
  ```typescript
  {
    token: string; // JWT token for authentication
    tenantId: string; // Unique tenant ID
    slug: string; // URL-friendly tenant identifier
    email: string; // User email
    apiKeyPublic: string; // Public API key (pk_live_*)
    secretKey: string; // Secret key (shown once, never stored in plaintext)
  }
  ```
- **Error Responses**:
  - `400`: Bad request (validation error)
  - `409`: Email already exists
  - `429`: Too many signup attempts (rate limited)
  - `500`: Internal server error

## Frontend Integration

### 1. Using the AuthContext (Recommended)

The signup function is available through the `useAuth` hook:

```typescript
import { useAuth } from '@/contexts/AuthContext';

function SignupForm() {
  const { signup, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await signup(
        'user@example.com',
        'securepassword123',
        'My Business Name'
      );

      // Signup successful! User is now authenticated
      console.log('Tenant created:', result.tenantId);
      console.log('Public API Key:', result.apiKeyPublic);
      console.log('Secret Key (save this!):', result.secretKey);

      // Navigate to dashboard or show success message
      // The AuthContext has already updated the user state
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSignup}>
      {/* Your form fields */}
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={isLoading}>
        Sign Up
      </button>
    </form>
  );
}
```

### 2. Direct API Client Usage

For more control, you can call the API client directly:

```typescript
import { api } from '@/lib/api';

async function signupTenant(email: string, password: string, businessName: string) {
  const result = await api.tenantSignup({
    body: { email, password, businessName },
  });

  if (result.status === 201) {
    // Success!
    const { token, tenantId, slug, email: userEmail, apiKeyPublic, secretKey } = result.body;

    // Store token and update app state
    localStorage.setItem('tenantToken', token);
    api.setTenantToken(token);

    return result.body;
  } else if (result.status === 409) {
    throw new Error('An account with this email already exists');
  } else if (result.status === 429) {
    throw new Error('Too many signup attempts. Please try again later');
  } else {
    throw new Error('Signup failed. Please try again');
  }
}
```

### 3. Using the Service Function

For server-side or non-React contexts:

```typescript
import { signupTenant } from '@/contexts/AuthContext/services';

async function registerNewTenant() {
  try {
    const result = await signupTenant('user@example.com', 'securepassword123', 'My Business Name');

    // User is authenticated, token is stored
    console.log('Signup successful:', result);
    return result;
  } catch (error) {
    console.error('Signup failed:', error.message);
    throw error;
  }
}
```

## Type Definitions

### SignupResponse

```typescript
interface SignupResponse {
  token: string; // JWT token
  tenantId: string; // Unique tenant ID
  slug: string; // URL-friendly identifier
  email: string; // User email
  apiKeyPublic: string; // Public API key
  secretKey: string; // Secret key (one-time display)
}
```

### SignupCredentials

```typescript
interface SignupCredentials {
  email: string;
  password: string;
  businessName: string;
}
```

## Error Handling

The signup function throws user-friendly errors:

```typescript
try {
  await signup(email, password, businessName);
} catch (error) {
  // Error messages:
  // - "An account with this email already exists" (409)
  // - "Too many signup attempts. Please try again later" (429)
  // - "Signup failed. Please try again" (other errors)
  console.error(error.message);
}
```

## Authentication Flow

After successful signup:

1. JWT token is automatically stored in localStorage
2. Token is set in the API client for subsequent requests
3. AuthContext updates with user data (if using `useAuth`)
4. User is redirected to tenant dashboard (handle in your component)

## Security Notes

1. **Secret Key**: The `secretKey` is only shown once and never stored in plaintext. Users should save it securely.
2. **Rate Limiting**: The signup endpoint is rate-limited to prevent abuse (5 attempts per 15 minutes per IP).
3. **Password Requirements**: Minimum 8 characters enforced on both frontend and backend.
4. **Email Validation**: Standard email format validation applied.

## Files Modified

### Frontend Files

1. **`client/src/types/auth.ts`**
   - Added `SignupResponse` interface
   - Added `SignupCredentials` interface
   - Added `signup` method to `AuthContextType`

2. **`client/src/contexts/AuthContext/services.ts`**
   - Added `signupTenant()` function
   - Handles API call, token storage, and error handling

3. **`client/src/contexts/AuthContext/AuthProvider.tsx`**
   - Added `signup` method to context
   - Imports `signupTenant` service
   - Exposes signup through `useAuth` hook

4. **`client/src/contexts/AuthContext/index.tsx`**
   - Exports `SignupResponse` type
   - Exports `SignupCredentials` type

### Backend Files (Already Existed)

- **Contract**: `packages/contracts/src/api.v1.ts` (line 186-198)
- **DTO**: `packages/contracts/src/dto.ts` (line 152-170)
- **Route**: `server/src/routes/auth.routes.ts`

## Testing

Example test case:

```typescript
import { signupTenant } from '@/contexts/AuthContext/services';

describe('Tenant Signup', () => {
  it('should successfully register a new tenant', async () => {
    const result = await signupTenant('test@example.com', 'password123', 'Test Business');

    expect(result.token).toBeDefined();
    expect(result.tenantId).toBeDefined();
    expect(result.slug).toBeDefined();
    expect(result.apiKeyPublic).toMatch(/^pk_live_/);
    expect(result.secretKey).toMatch(/^sk_live_/);
  });

  it('should throw error for existing email', async () => {
    await expect(signupTenant('existing@example.com', 'password123', 'Test')).rejects.toThrow(
      'An account with this email already exists'
    );
  });
});
```

## Next Steps

To use the signup functionality in your app:

1. Create a signup form component
2. Use the `useAuth` hook to access the `signup` function
3. Handle success (redirect to dashboard, show API keys)
4. Handle errors (display user-friendly messages)
5. Implement password strength indicator
6. Add email confirmation flow (optional)

## Example Signup Form

```typescript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function SignupPage() {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [signupResult, setSignupResult] = useState<SignupResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await signup(
        formData.email,
        formData.password,
        formData.businessName
      );

      setSignupResult(result);
      // Show API keys to user, then redirect
      setTimeout(() => navigate('/tenant/dashboard'), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (signupResult) {
    return (
      <div className="signup-success">
        <h2>Account Created Successfully!</h2>
        <p>Save these credentials securely:</p>
        <dl>
          <dt>Tenant ID:</dt>
          <dd>{signupResult.tenantId}</dd>
          <dt>Slug:</dt>
          <dd>{signupResult.slug}</dd>
          <dt>Public API Key:</dt>
          <dd>{signupResult.apiKeyPublic}</dd>
          <dt>Secret Key (save this now!):</dt>
          <dd>{signupResult.secretKey}</dd>
        </dl>
        <p>Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign Up</h1>
      {error && <div className="error">{error}</div>}

      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />

      <input
        type="password"
        placeholder="Password (min 8 characters)"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        minLength={8}
        required
      />

      <input
        type="text"
        placeholder="Business Name"
        value={formData.businessName}
        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
        minLength={2}
        maxLength={100}
        required
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```
