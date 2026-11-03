import { HOSTS_PATH, STATS_PATH } from '../lib/stats-view.mjs';
import { jsonForScript } from './html.mjs';

export function renderStatsMain({ rel }) {
  return `<header class="stats-head"><h1>每一場的回顧</h1><p class="lead">參加者問卷的結果，一場一頁。</p></header>
<label class="stats-district" hidden>哪一區 <select></select></label>
<p class="stats-status">讀取中…</p>
<ul class="stats-list"></ul>
<p class="hosts-link"><a href="${rel}${HOSTS_PATH}">加一位主持人 →</a></p>
<p class="home-link"><a href="${rel}">← 回到推薦</a></p>`;
}

export function renderSessionMain({ rel }) {
  return `<p class="stats-status">讀取中…</p>
<article class="session" hidden></article>
<p class="home-link"><a href="${rel}${STATS_PATH}">← 回到每一場的回顧</a></p>`;
}

export const activityIdsScript = (activities) =>
  `<script type="application/json" id="activity-ids">${jsonForScript(Object.fromEntries(activities.map(({ name, id }) => [name, id])))}</script>`;

export function renderHostsMain({ rel }) {
  return `<header class="stats-head"><h1>加一位主持人</h1>
<p class="lead">不是幹部、但會帶兄弟時光的人，貼上他的 Gmail 就加好了。加進來的人可以登入、用當天模式，看不到問卷結果。</p></header>
<label class="stats-district" hidden>哪一區 <select></select></label>
<form class="host-form">
<label>Gmail <input type="email" name="email" required autocomplete="off" inputmode="email"></label>
<label>名字（選填）<input type="text" name="name" autocomplete="off"></label>
<button type="submit">加進名單</button>
<p class="host-result" role="status"></p>
</form>
<section class="host-list"><h2></h2><ul></ul></section>
<p class="home-link"><a href="${rel}${STATS_PATH}">← 回到每一場的回顧</a></p>`;
}
