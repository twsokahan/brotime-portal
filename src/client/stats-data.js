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

export function activityIds() {
  try {
    return JSON.parse(document.getElementById('activity-ids').textContent);
  } catch {
    return {};
  }
}

export const NO_STATS_TEXT = '每一場的回顧是給區負責人和幹部看的。';
export const OFFLINE_TEXT = '連不上，等一下再試一次。';
