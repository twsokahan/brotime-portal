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

const TITLE = '<h1>下個月，<span>約兄弟做什麼？</span></h1>';

export const ALL_PATH = 'all/';

function renderHead(canPick, count) {
  return `<header class="entry-head">
${TITLE}
<p class="lead">${count} 種過兄弟時光的方式，回答 4 題幫你挑，或往下自己逛。</p>${canPick ? `\n${ENTRY_ACTIONS}` : ''}
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

const DISTRICT_WANTS_BLOCK = '<section class="district-wants" hidden></section>';
const ACCOUNT_FOOT = '<footer class="account-foot" hidden></footer>';

// The wants block goes right above the season, so a district leader can weigh it against the season's picks.
function renderFeatured(sections, byId, rel, today, districtWants) {
  if (!sections.length) return '';
  const rendered = sections.map((section) => renderFeaturedSection(section, byId, rel, today));
  if (districtWants) {
    const firstSeason = sections.findIndex((section) => section.kind === 'season');
    rendered.splice(firstSeason < 0 ? rendered.length : firstSeason, 0, DISTRICT_WANTS_BLOCK);
  }
  return `<div class="featured">
${rendered.join('\n')}
</div>`;
}

export function renderHomeMain({ activities, rel, featured, today, districtWants = false }) {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  return [
    `<header class="entry-head">\n${TITLE}\n</header>`,
    renderFeatured(featuredSections(featured), byId, rel, today, districtWants),
    `<p class="all-link"><a href="${rel}${ALL_PATH}">都不合適？看全部 ${activities.length} 種<small>可以用「幫我挑」或篩選</small></a></p>`,
    districtWants ? ACCOUNT_FOOT : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderEntryMain({ activities, rel }) {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const ordered = wallOrder(activities, emptyFilters()).map((id) => byId.get(id));
  const ready = ordered.filter((activity) => activity.status === 'ready');
  const preparing = ordered.filter((activity) => activity.status !== 'ready');
  const canPick = ready.length > 0;
  return [
    `<p class="home-link"><a href="${rel}">← 回到推薦</a></p>`,
    renderHead(canPick, activities.length),
    canPick && renderFilters(countMatches(activities, emptyFilters())),
    renderWall(ready, rel),
    renderPreparing(preparing, rel),
    canPick && renderData(ordered),
  ]
    .filter(Boolean)
    .join('\n');
}
