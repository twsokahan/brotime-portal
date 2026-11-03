export const SIGNIN_STORAGE_KEY = 'brotime.signin';

// Also serialized into each page's <head>, so it must not use anything outside its own body.
export function parseSigninRecord(raw) {
  try {
    const record = JSON.parse(raw);
    const hasText = (value) => typeof value === 'string' && value.length > 0;
    return record && typeof record === 'object' && hasText(record.email) && hasText(record.session) ? record : null;
  } catch {
    return null;
  }
}

export const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
export const SIGN_OUT_ERRORS = ['bad-session', 'not-listed'];

export const needsRecheck = (record, nowMs) =>
  !Number.isFinite(record.checkedAt) || nowMs - record.checkedAt >= RECHECK_AFTER_MS;

// Only a clear answer from the server signs a phone out; no signal or a server hiccup keeps it in.
export function recheckOutcome(response) {
  if (!response) return 'keep';
  if (response.ok) return response.listed ? 'update' : 'sign-out';
  return SIGN_OUT_ERRORS.includes(response.error) ? 'sign-out' : 'keep';
}

export const recordFrom = (response, session, nowMs) => ({ email: response.email, session, scope: response.scope, checkedAt: nowMs });

export const isInLine = (userAgent) => /\bLine\//i.test(userAgent);
