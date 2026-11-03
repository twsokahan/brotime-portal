export const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export function checkTokenInfo(info, clientId, nowMs) {
  if (!info || info.aud !== clientId) return null;
  if (info.email_verified !== true && info.email_verified !== 'true') return null;
  if (!(Number(info.exp) * 1000 > nowMs)) return null;
  if (!GOOGLE_ISSUERS.includes(info.iss)) return null;
  return typeof info.email === 'string' && info.email ? info.email.toLowerCase() : null;
}

// Token: <encoded email>.<issued at ms>.<signature>. The encoded email keeps its dots, so it is read from the right.
export function makeSession(email, nowMs, sign) {
  const payload = `${encodeURIComponent(email)}.${nowMs}`;
  return `${payload}.${sign(payload)}`;
}

export function readSession(token, nowMs, sign) {
  const text = String(token ?? '');
  const signatureAt = text.lastIndexOf('.');
  const issuedAtStart = text.lastIndexOf('.', signatureAt - 1);
  if (issuedAtStart <= 0) return null;
  const payload = text.slice(0, signatureAt);
  if (text.slice(signatureAt + 1) !== sign(payload)) return null;
  const age = nowMs - Number(text.slice(issuedAtStart + 1, signatureAt));
  if (!(age >= 0 && age < SESSION_MAX_AGE_MS)) return null;
  try {
    return decodeURIComponent(text.slice(0, issuedAtStart));
  } catch {
    return null;
  }
}
