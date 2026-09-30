/**
 * Google OAuth 2.0 + OIDC client, backed by `arctic`.
 *
 * Why arctic and not NextAuth/Auth.js: this template ships a battle-tested
 * JWT/CSRF/refresh auth system in Express. Auth.js wants to manage its own
 * session cookies, which would create two parallel auth systems. Arctic
 * gives us just the OAuth dance — we keep our existing setAuthCookies
 * flow so signup + email/password + Google all converge on the same session.
 *
 * Boots conditionally: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * GOOGLE_REDIRECT_URI are absent, `tryCreateGoogleProvider()` returns
 * undefined and the OAuth routes 404 silently — same pattern as Bictorys
 * and R2 elsewhere.
 *
 * Required scopes: `openid email profile`. We only need the user's email
 * (for matching to existing accounts) and optional name/avatar; we never
 * request offline_access by default — frontend re-prompts if a refresh
 * token is genuinely needed (rare for sign-in flows).
 */
import { Google } from 'arctic';
import { createLogger } from '../logger';

const logger = createLogger();

export interface GoogleProviderHandle {
  client: Google;
  scopes: readonly string[];
  redirectUri: string;
}

export function tryCreateGoogleProvider(): GoogleProviderHandle | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    logger.warn('oauth: Google env missing — /api/auth/oauth/google/* routes are inert', {
      haveClientId: !!clientId,
      haveClientSecret: !!clientSecret,
      haveRedirectUri: !!redirectUri,
    });
    return undefined;
  }

  return {
    client: new Google(clientId, clientSecret, redirectUri),
    scopes: ['openid', 'email', 'profile'],
    redirectUri,
  };
}

/**
 * Decode the unverified payload of a JWT (Google ID token). For OIDC tokens
 * arctic has already validated the signature against Google's JWKS as part
 * of `validateAuthorizationCode`, so we trust the bytes here.
 *
 * (We don't pull in `jose`'s decode helper to avoid extra deps — this is
 * a pure base64url + JSON.parse on the middle segment.)
 */
export interface GoogleIdTokenClaims {
  /** Google's stable user id. */
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export function decodeIdToken(idToken: string): GoogleIdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  const payload = parts[1]!;
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64url').toString('utf8');
  return JSON.parse(json) as GoogleIdTokenClaims;
}
