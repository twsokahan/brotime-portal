import { countMatches, emptyFilters, wallOrder } from '../lib/filter.mjs';
import { INTERESTS, SLOTS } from '../lib/labels.mjs';
import { escapeHtml, jsonForScript } from './html.mjs';

const list = (items, renderItem) => items.map(renderItem).join('');

const chip = (filter, value, label) =>
  `<button data-filter="${filter}" data-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(label)}</button>`;

const filterGroup = (label, chips) => `<div class="filter-group"><p class="filter-label">${label}</p>${chips}</div>`;

function renderHead() {
  return `<header class="entry-head">
<h1>下個月，<span>約兄弟做什麼？</span></h1>
<p class="lead">16 種過兄弟時光的方式，回答 4 題幫你挑，或往下自己逛。</p>
<div class="entry-actions">
<button id="open-quiz" type="button"><span><span aria-hidden="true">✦ </span>幫我挑</span> <small>4 題，30 秒</small></button>
<button id="toggle-filters" type="button" aria-expanded="false" aria-controls="filters"><span class="filter-summary">篩選</span> <span class="caret" aria-hidden="true">▾</span></button>
</div>
</header>`;
}

function renderFilters(matchCount) {
  return `<section id="filters" class="filters" hidden>
${filterGroup('帶小孩', chip('kids', 'true', '會帶小孩'))}
${filterGroup('地點', chip('indoor', 'true', '室內') + chip('outdoor', 'true', '戶外') + chip('rainOk', 'true', '☂ 不怕下雨'))}
${filterGroup('大家什麼時候有空', list(Object.entries(SLOTS), ([value, label]) => chip('slots', value, label)))}
${filterGroup('共同興趣', list(Object.entries(INTERESTS), ([value, label]) => chip('interests', value, label)))}
<p id="match-count">符合的有 ${matchCount} 種</p>
</section>`;
}

function coverCardId(activity) {
  const sets = Object.values(activity.cardSets ?? {});
  const set = sets.find((cardSet) => cardSet.kind === 'story') ?? sets[0];
  return set?.thumbs?.[0] ?? set?.cards[0]?.id;
}

function renderCover(activity, rel) {
  const cardId = coverCardId(activity);
  if (!cardId) return '';
  return `<img src="${rel}cards/${escapeHtml(activity.id)}/${escapeHtml(cardId)}-thumb.webp" alt="" loading="lazy">`;
}

function renderCard(activity, rel) {
  const id = escapeHtml(activity.id);
  const interests = activity.tags.interests.map((key) => INTERESTS[key]).join('・');
  return `<a class="act" data-id="${id}" href="${rel}a/${id}/">
${renderCover(activity, rel)}
<h2>${escapeHtml(activity.name)}</h2>
<p class="interests">${escapeHtml(interests)}</p>
</a>`;
}

function renderWall(ready, rel) {
  if (!ready.length) return '<p class="wall-empty">每一種都還在準備，做好就會出現在這裡。</p>';
  return `<section class="wall">
${ready.map((activity) => renderCard(activity, rel)).join('\n')}
</section>`;
}

function renderPreparing(preparing, rel) {
  if (!preparing.length) return '';
  const items = preparing.map(({ id, name }) => `<li><a href="${rel}a/${escapeHtml(id)}/">${escapeHtml(name)}</a></li>`);
  return `<section class="preparing">
<h2>準備中</h2>
<ul>${items.join('')}</ul>
</section>`;
}

function renderData(activities) {
  const data = activities.map(({ id, name, status, order, tags }) => ({ id, name, status, order, tags: tags ?? null }));
  return `<script type="application/json" id="activities-data">${jsonForScript(data)}</script>`;
}

export function renderEntryMain({ activities, rel }) {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const ordered = wallOrder(activities, emptyFilters()).map((id) => byId.get(id));
  const ready = ordered.filter((activity) => activity.status === 'ready');
  const preparing = ordered.filter((activity) => activity.status !== 'ready');
  return [
    renderHead(),
    renderFilters(countMatches(activities, emptyFilters())),
    renderWall(ready, rel),
    renderPreparing(preparing, rel),
    renderData(ordered),
  ]
    .filter(Boolean)
    .join('\n');
}
