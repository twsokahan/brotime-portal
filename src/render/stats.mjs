import { STATS_PATH } from '../lib/stats-view.mjs';
import { coverThumbPath } from './entry.mjs';
import { jsonForScript } from './html.mjs';

const ACCOUNT_FOOT = '<footer class="account-foot" hidden></footer>';

export function renderStatsMain({ rel }) {
  return `<header class="stats-head"><h1>每一場的回顧</h1><p class="lead">參加者問卷的結果，一場一張卡。</p></header>
<label class="stats-district" hidden>哪一區 <select></select></label>
<p class="stats-status">讀取中…</p>
<section class="review-wants" hidden></section>
<div class="review-cards"></div>
<section class="review-empty" hidden></section>
<p class="home-link"><a href="${rel}">← 回到推薦</a></p>
${ACCOUNT_FOOT}`;
}

export function renderSessionMain({ rel }) {
  return `<p class="stats-status">讀取中…</p>
<article class="session" hidden></article>
<p class="home-link"><a href="${rel}${STATS_PATH}">← 回到每一場的回顧</a></p>
${ACCOUNT_FOOT}`;
}

export const activityIndexScript = (activities) =>
  `<script type="application/json" id="activity-index">${jsonForScript(
    Object.fromEntries(activities.map((activity) => [activity.name, { id: activity.id, cover: coverThumbPath(activity) }])),
  )}</script>`;
