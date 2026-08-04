import { CLIENT_ID, SCOPES } from './config.js';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let pendingResolve = null;
let pendingReject = null;

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google sign-in failed to load. Check your connection and reload.');
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        pendingReject?.(new Error(resp.error));
        return;
      }
      accessToken = resp.access_token;
      tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
      pendingResolve?.(accessToken);
    },
    error_callback: (err) => {
      pendingReject?.(new Error(err?.type || 'auth_error'));
    },
  });
  return tokenClient;
}

// Requests a fresh token. Once the user has granted consent once, GIS
// re-uses that session so this is typically a silent or one-tap prompt.
export function requestToken() {
  const client = ensureTokenClient();
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    client.requestAccessToken();
  });
}

export function getAccessToken() {
  return accessToken;
}

function isTokenValid() {
  return !!accessToken && Date.now() < tokenExpiresAt - 30000;
}

export async function ensureAccessToken() {
  if (isTokenValid()) return accessToken;
  return requestToken();
}

export function isSignedIn() {
  return !!accessToken;
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
}
