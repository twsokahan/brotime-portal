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
