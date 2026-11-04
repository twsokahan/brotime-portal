import { callApi } from './signin.js';

const FRESH_MS = 10 * 60 * 1000;
const cacheKey = (email) => `brotime.stats:${email}`;

export async function loadStats(email) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey(email)));
    if (cached && Date.now() - cached.savedAt < FRESH_MS) return cached.stats;
  } catch {}
  const response = await callApi('stats');
  if (!response?.ok) return null;
  const stats = { wants: response.wants, sessions: response.sessions };
  try {
    sessionStorage.setItem(cacheKey(email), JSON.stringify({ savedAt: Date.now(), stats }));
  } catch {}
  return stats;
}

export function activityIndex() {
  try {
    return JSON.parse(document.getElementById('activity-index').textContent);
  } catch {
    return {};
  }
}

export const OFFLINE_TEXT = '連不上，等一下再試一次。';
