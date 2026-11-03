import { SEASON_TITLE, isShowing, pushWindow, seasonWindow } from '../lib/featured.mjs';
import { countMatches, emptyFilters, wallOrder } from '../lib/filter.mjs';
import { INTERESTS, SLOTS } from '../lib/labels.mjs';
import { escapeHtml, jsonForScript } from './html.mjs';

const list = (items, renderItem) => items.map(renderItem).join('');

const chip = (filter, value, label) =>
  `<button data-filter="${filter}" data-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(label)}</button>`;

const filterGroup = (label, chips) => `<div class="filter-group"><p class="filter-label">${label}</p>${chips}</div>`;

const ENTRY_ACTIONS = `<div class="entry-actions">
<button id="open-quiz" type="button"><span><span aria-hidden="true">✦ </span>幫我挑</span> <small>4 題，30 秒</small></button>
<button id="toggle-filters" type="button" aria-expanded="false" aria-controls="filters"><span class="filter-summary">篩選</span> <span class="caret" aria-hidden="true">▾</span></button>
</div>`;

const HEAD = `<header class="entry-head">
<h1>下個月，<span>約兄弟做什麼？</span></h1>
</header>`;

function renderIntro(canPick, count) {
  return `<p class="lead">${count} 種過兄弟時光的方式，回答 4 題幫你挑，或往下自己逛。</p>${canPick ? `\n${ENTRY_ACTIONS}` : ''}`;
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

function renderOnlyDuring(availability) {
  if (!availability) return '';
  return `\n<p class="only-during"><span class="badge">限 ${escapeHtml(availability.label)}</span></p>`;
}

function renderCard(activity, rel, heading = 'h2') {
  const id = escapeHtml(activity.id);
  const interests = activity.tags.interests.map((key) => INTERESTS[key]).join('・');
  return `<a class="act" data-id="${id}" href="${rel}a/${id}/">
${renderCover(activity, rel)}
<${heading}>${escapeHtml(activity.name)}</${heading}>
<p class="interests">${escapeHtml(interests)}</p>${renderOnlyDuring(activity.availability)}
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
  const data = activities.map(({ id, name, status, order, tags, availability }) => ({
    id,
    name,
    status,
    order,
    tags: tags ?? null,
    ...(availability && { availability }),
  }));
  return `<script type="application/json" id="activities-data">${jsonForScript(data)}</script>`;
}

function featuredSections(featured) {
  return [
    ...(featured?.pushes ?? []).map((push) => ({ ...push, kind: 'push', window: pushWindow(push) })),
    ...(featured?.seasons ?? []).map((season) => ({ ...season, kind: 'season', title: SEASON_TITLE, window: seasonWindow(season) })),
  ];
}

function renderFeaturedSection({ kind, title, lead, ids, window }, byId, rel, today) {
  const cards = ids.map((id) => renderCard(byId.get(id), rel, 'h3')).join('\n');
  return `<section class="${kind}" data-show-from="${window.from}" data-show-to="${window.to}"${isShowing(window, today) ? '' : ' hidden'}>
<h2>${escapeHtml(title)}</h2>
<p class="lead">${escapeHtml(lead)}</p>
<div class="featured-grid">
${cards}
</div>
</section>`;
}

function renderFeatured(sections, byId, rel, today) {
  if (!sections.length) return '';
  return `<div class="featured">
${sections.map((section) => renderFeaturedSection(section, byId, rel, today)).join('\n')}
</div>`;
}

function renderEverything(alone, count, parts) {
  return `<details class="everything${alone ? ' is-alone' : ''}" id="all"${alone ? ' open' : ''}>
<summary>都不合適？看全部 ${count} 種<small>可以用「幫我挑」或篩選</small></summary>
${parts.filter(Boolean).join('\n')}
</details>`;
}

export function renderEntryMain({ activities, rel, featured, today }) {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const ordered = wallOrder(activities, emptyFilters()).map((id) => byId.get(id));
  const ready = ordered.filter((activity) => activity.status === 'ready');
  const preparing = ordered.filter((activity) => activity.status !== 'ready');
  const canPick = ready.length > 0;
  const sections = featuredSections(featured);
  const alone = !sections.some(({ window }) => isShowing(window, today));
  return [
    HEAD,
    renderFeatured(sections, byId, rel, today),
    renderEverything(alone, activities.length, [
      renderIntro(canPick, activities.length),
      canPick && renderFilters(countMatches(activities, emptyFilters())),
      renderWall(ready, rel),
      renderPreparing(preparing, rel),
    ]),
    canPick && renderData(ordered),
  ]
    .filter(Boolean)
    .join('\n');
}
