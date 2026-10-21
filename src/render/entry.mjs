import { countMatches, emptyFilters } from '../lib/filter.mjs';
import { INTERESTS, RAIN, SLOTS } from '../lib/labels.mjs';
import { escapeHtml, jsonForScript } from './html.mjs';

const list = (items, renderItem) => items.map(renderItem).join('');

const chip = (filter, value, label) =>
  `<button data-filter="${filter}" data-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(label)}</button>`;

const filterGroup = (label, chips) => `<div class="filter-group"><p class="filter-label">${label}</p>${chips}</div>`;

function renderHead() {
  return `<header class="entry-head">
<h1>下個月辦什麼？</h1>
<p class="lead">兄弟時光 16 個活動，回答 4 題幫你挑，或往下自己逛。</p>
<button id="open-quiz">幫我挑</button>
</header>`;
}

function renderFilters() {
  return `<section class="filters">
${filterGroup('帶小孩', chip('kids', 'true', '會帶小孩'))}
${filterGroup('地點', chip('indoor', 'true', '室內') + chip('outdoor', 'true', '戶外') + chip('rainOk', 'true', '☂ 下雨也能辦'))}
${filterGroup('大家什麼時候有空', list(Object.entries(SLOTS), ([value, label]) => chip('slots', value, label)))}
${filterGroup('共同興趣', list(Object.entries(INTERESTS), ([value, label]) => chip('interests', value, label)))}
</section>`;
}

function renderMatchCount(activities) {
  return `<p id="match-count">符合的有 ${countMatches(activities, emptyFilters())} 個</p>`;
}

function renderTags(activity, isPreparing) {
  const interests = activity.tags?.interests ?? [];
  const tags = [
    interests.length ? `<span class="tag">${escapeHtml(interests.map((key) => INTERESTS[key]).join('・'))}</span>` : '',
    isPreparing ? '' : `<span class="tag rain">${escapeHtml(RAIN[activity.tags.rain])}</span>`,
  ].join('');
  return tags ? `<p class="tags">${tags}</p>` : '';
}

function renderCard(activity, rel) {
  const isPreparing = activity.status === 'preparing';
  const id = escapeHtml(activity.id);
  const body = [
    isPreparing ? '<span class="badge">準備中</span>' : '',
    `<h2>${escapeHtml(activity.name)}</h2>`,
    `<p class="tagline">${escapeHtml(activity.tagline)}</p>`,
    renderTags(activity, isPreparing),
  ].filter(Boolean);
  return `<a class="${isPreparing ? 'act is-preparing' : 'act'}" data-id="${id}" href="${rel}a/${id}/">
${body.join('\n')}
</a>`;
}

function renderWall(activities, rel) {
  return `<section class="wall">
${activities.map((activity) => renderCard(activity, rel)).join('\n')}
</section>`;
}

function renderData(activities) {
  const data = activities.map(({ id, name, status, order, tags }) => ({ id, name, status, order, tags: tags ?? null }));
  return `<script type="application/json" id="activities-data">${jsonForScript(data)}</script>`;
}

export function renderEntryMain({ activities, rel }) {
  const ordered = activities.toSorted((a, b) => a.order - b.order);
  return [renderHead(), renderFilters(), renderMatchCount(ordered), renderWall(ordered, rel), renderData(ordered)].join('\n');
}
