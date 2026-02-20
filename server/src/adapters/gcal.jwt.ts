/**
 * Google service account JWT helper
 */

import * as crypto from 'node:crypto';

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

/**
 * Creates a JWT for Google service account authentication and exchanges it for an access token.
 * @param serviceAccountJson - The parsed service account JSON
 * @param scopes - The OAuth2 scopes to request
 * @returns The access token
 */
export async function createGServiceAccountJWT(
  serviceAccountJson: ServiceAccountJson,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT payload
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  };

  // Create JWT
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Sign with private key
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccountJson.private_key, 'base64');
  const signatureB64 = base64UrlFromBase64(signature);

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    signal: AbortSignal.timeout(10_000),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => '');
    throw new Error(
      `Failed to exchange JWT for access token: ${tokenResponse.status} ${errorText}`
    );
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

/**
 * Base64 URL-safe encode
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert standard base64 to base64url
 */
function base64UrlFromBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
