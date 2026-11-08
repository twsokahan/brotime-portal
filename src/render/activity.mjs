import { followsStory, readAloudParts } from '../lib/live.mjs';
import { cardPageUrl, surveyUrl } from '../lib/share.mjs';
import { renderBooks } from './book-guide.mjs';
import { escapeHtml, jsonForScript } from './html.mjs';
import { qrSvg } from './qr.mjs';
import { renderVenues } from './venues.mjs';

const DEFAULT_FLOW_TITLE = '60 分鐘這樣過';
const DEFAULT_EXTRA_TITLE = '想多留 30 分鐘（選配）';
const DEFAULT_THUMB_COUNT = 3;
const DEFAULT_FIRST_TIME_TITLE = '第一次主持記得';
const DEFAULT_PRINT_FILES_LEAD = '想印實體卡的話：';
const HOME_LINK_TEXT = '← 看其他兄弟時光';
const ICHIBAN_LINK = '<p class="ichiban-link"><a href="ichiban/">電子一番賞（不用刮刮卡也能抽）</a></p>';
const guideLink = (guide) =>
  `<p class="guide-link"><a href="guide/">新手小抄：${escapeHtml(guide.title)}</a></p><p class="hint">可以先傳給第一次來的朋友。</p>`;

const list = (items, renderItem) => items.map(renderItem).join('');

function renderAvailability(availability) {
  if (!availability) return '';
  const { label, note } = availability;
  return `\n<p class="availability">只限 ${escapeHtml(label)}${note ? `：${escapeHtml(note)}` : ''}</p>`;
}

function renderHead(activity) {
  const { people, duration, place } = activity.facts;
  return `<header class="activity-head">
<h1>${escapeHtml(activity.name)}</h1>
<p class="tagline">${escapeHtml(activity.tagline)}</p>
<ul class="facts"><li>${escapeHtml(people)}</li><li class="duration">${escapeHtml(duration)}</li><li>${escapeHtml(place)}</li></ul>${renderAvailability(activity.availability)}
</header>`;
}

const renderTodoGroup = (when, rows) => `<h4>${escapeHtml(when)}</h4><ul>${rows}</ul>`;

function renderTodoRow({ task, detail }) {
  if (!detail) return `<li><span>${escapeHtml(task)}</span></li>`;
  return `<li><details><summary>${escapeHtml(task)}</summary><p>${escapeHtml(detail)}</p></details></li>`;
}

function renderReportTodo(reportUrl) {
  if (!reportUrl) return '';
  return renderTodoGroup(
    '結束後一週內',
    `<li><span><a href="${escapeHtml(reportUrl)}">區負責人填線上回報表</a></span></li>`,
  );
}

function renderTodo(activity, site) {
  const groups = [...Map.groupBy(activity.todo, (row) => row.when)].map(([when, rows]) =>
    renderTodoGroup(when, list(rows, renderTodoRow)),
  );
  const reportUrl = activity.noLiveMode ? null : surveyLink(activity, site, 'report');
  return groups.join('') + renderReportTodo(reportUrl);
}

function renderPrepare(activity, site) {
  return `<section class="prepare">
<h2>你要做的</h2>
${activity.ichiban ? `${ICHIBAN_LINK}\n` : ''}${activity.guide ? `${guideLink(activity.guide)}\n` : ''}<div class="box todo">${renderTodo(activity, site)}</div>
</section>`;
}

function thumbCards(set, step) {
  if (step.cardIds) return set.cards.filter((card) => step.cardIds.includes(card.id));
  if (set.thumbs) return set.thumbs.map((cardId) => set.cards.find((card) => card.id === cardId));
  if (set.kind === 'story') return set.cards;
  return set.cards.slice(0, DEFAULT_THUMB_COUNT);
}

const deckLabel = (set) => (set.kind !== 'topic' || set.label.includes('話題卡') ? set.label : `話題卡：${set.label}`);

function deckThumbs(activity, step, set, rel) {
  return thumbCards(set, step)
    .map((card) => {
      const img = `<img src="${rel}cards/${escapeHtml(activity.id)}/${escapeHtml(card.id)}-thumb.webp" alt="${escapeHtml(card.title)}" loading="lazy">`;
      if (set.kind !== 'story') return img;
      return `<a class="story-thumb" href="cards/${escapeHtml(card.id)}/">${img}</a>`;
    })
    .join('');
}

function renderThumbs(activity, step, rel) {
  const decks = (step.cards ?? [])
    .map((key) => activity.cardSets[key])
    .filter((set) => !followsStory(set))
    .map((set) => ({ set, thumbs: deckThumbs(activity, step, set, rel) }))
    .filter((deck) => deck.thumbs);
  if (!decks.length) return '';
  const mixesStoryWithOtherDecks = decks.length > 1 && decks.some((deck) => deck.set.kind === 'story');
  if (!mixesStoryWithOtherDecks) return `<div class="thumbs">${decks.map((deck) => deck.thumbs).join('')}</div>`;
  return decks
    .map(({ set, thumbs }) => `<p class="thumb-label">${escapeHtml(deckLabel(set))}</p>\n<div class="thumbs">${thumbs}</div>`)
    .join('\n');
}

const renderSay = (say) => (say ? `\n<p class="say">說：${escapeHtml(say)}</p>` : '');

function renderPoints(points) {
  if (!points) return '';
  return `\n<ul class="step-points">${list(points, (point) => `<li>${escapeHtml(point)}</li>`)}</ul>`;
}

function renderReadAloud(readAloud) {
  if (!readAloud) return '';
  const { label, paragraphs, source } = readAloudParts(readAloud);
  const sourceLine = source ? `<p class="source">出處：${escapeHtml(source)}</p>` : '';
  return `\n<section class="read-aloud"><h3>${escapeHtml(label)}</h3>${list(paragraphs, (paragraph) => `<p>${escapeHtml(paragraph)}</p>`)}${sourceLine}</section>`;
}

const renderSpelledOutStep = (step) =>
  `${renderSay(step.say)}\n<p class="step-do">${escapeHtml(step.do)}</p>${renderPoints(step.points)}`;

function renderFlow(activity, rel) {
  const renderBody = activity.noLiveMode ? renderSpelledOutStep : (step) => renderSay(step.say);
  const renderClosing = activity.noLiveMode ? (step) => renderReadAloud(step.readAloud) : () => '';
  const steps = list(
    activity.steps,
    (step) => `<li class="step">
<span class="time">${escapeHtml(step.time)}</span>
<h3>${escapeHtml(step.title)}</h3>${renderBody(step)}${renderThumbs(activity, step, rel)}${renderClosing(step)}
</li>`,
  );
  const note = activity.flowNote ? `\n<p class="flow-note">${escapeHtml(activity.flowNote)}</p>` : '';
  return `<section class="flow">
<h2>${escapeHtml(activity.flowTitle ?? DEFAULT_FLOW_TITLE)}</h2>${note}
<ol class="timeline">${steps}</ol>
</section>`;
}

function renderStart() {
  return `<div class="start">
<button id="start-live" type="button">開始 ▶</button>
</div>`;
}

function renderRain(activity) {
  if (activity.tags.rain === 'ok') return '';
  return `<p class="rain">下雨怎麼辦：${escapeHtml(activity.rainNote)}</p>`;
}

function renderFeaturedFile(activity, rel) {
  if (!activity.featuredFile) return '';
  const { label, file, note } = activity.featuredFile;
  return `<p class="featured-file"><a href="${rel}${escapeHtml(file)}">${escapeHtml(label)}（PDF）</a><span>${escapeHtml(note)}</span></p>`;
}

function renderPrintFiles(activity, rel) {
  if (!activity.printFiles?.length) return '';
  const links = list(
    activity.printFiles,
    ({ label, file }) => `<li><a href="${rel}${escapeHtml(file)}">${escapeHtml(label)}（PDF）</a></li>`,
  );
  return `<p>${escapeHtml(activity.printFilesLead ?? DEFAULT_PRINT_FILES_LEAD)}</p><ul>${links}</ul>`;
}

function renderExtra(item, rel) {
  if (typeof item === 'string') return `<li>${escapeHtml(item)}</li>`;
  const routeUrl = `${rel}a/city-walk/?d=${encodeURIComponent(item.cityWalkRoute)}`;
  return `<li>${escapeHtml(item.text)} <a href="${escapeHtml(routeUrl)}">看路線</a></li>`;
}

function renderMoreSection({ title, intro, items }) {
  const introLine = intro ? `<p>${escapeHtml(intro)}</p>` : '';
  return `<details><summary>${escapeHtml(title)}</summary>${introLine}<ol>${list(items, (item) => `<li>${escapeHtml(item)}</li>`)}</ol></details>\n`;
}

function renderMore(activity, rel) {
  const textItems = (items) => list(items, (text) => `<li>${escapeHtml(text)}</li>`);
  const extraTitle = activity.extraTitle ?? DEFAULT_EXTRA_TITLE;
  const firstTimeTitle = activity.firstTimeTitle ?? DEFAULT_FIRST_TIME_TITLE;
  const moreSections = list(activity.moreSections ?? [], renderMoreSection);
  const extras = activity.extra30.length
    ? `<details><summary>${escapeHtml(extraTitle)}</summary><ul>${list(activity.extra30, (item) => renderExtra(item, rel))}</ul></details>\n`
    : '';
  return `<section class="more">
<details><summary>${escapeHtml(firstTimeTitle)} ${activity.firstTime.length} 件事</summary><ol class="first-time">${textItems(activity.firstTime)}</ol></details>
${extras}${moreSections}<details><summary>完整企劃案</summary><p><a href="${rel}${escapeHtml(activity.planFile)}">下載企劃案（PDF）</a></p>${renderPrintFiles(activity, rel)}</details>
</section>`;
}

function renderLiveData(activity, site) {
  const { extra30, extraTitle, firstTime, firstTimeTitle, moreSections, printFilesLead, ...liveActivity } = activity;
  return `<script type="application/json" id="activity-data">${jsonForScript({ ...liveActivity, baseUrl: site.baseUrl })}</script>`;
}

function surveyLink(activity, site, kind) {
  const survey = activity.surveys?.[kind] ?? site.surveys[kind];
  return survey ? surveyUrl(survey, activity.name) : null;
}

function renderSurveyTemplates(activity, site) {
  const participant = surveyLink(activity, site, 'participant');
  const staff = surveyLink(activity, site, 'staff');
  const participantTemplate = participant
    ? `<template id="qr-participant" data-url="${escapeHtml(participant)}">${qrSvg(participant)}</template>`
    : '<template id="qr-participant"><p>問卷連結準備中</p></template>';
  const staffTemplate = staff
    ? `<template id="staff-survey"><a href="${escapeHtml(staff)}">填工作人員問卷</a></template>`
    : '<template id="staff-survey"><p>工作人員問卷連結準備中</p></template>';
  const report = surveyLink(activity, site, 'report');
  const reportLink = report ? `<p><a href="${escapeHtml(report)}">一週內填回報表</a></p>` : '';
  return `${participantTemplate}${staffTemplate}<template id="activity-report">${reportLink}</template>`;
}

function renderStoryCardQrTemplates(activity, site) {
  const storyCards = Object.values(activity.cardSets)
    .filter((set) => set.kind === 'story')
    .flatMap((set) => set.cards);
  return list(
    storyCards,
    (card) =>
      `<template id="qr-card-${escapeHtml(card.id)}">${qrSvg(cardPageUrl(site, activity.id, card.id))}</template>`,
  );
}

const renderLiveModeParts = (activity, site) => [
  renderStart(),
  renderLiveData(activity, site),
  renderSurveyTemplates(activity, site),
  renderStoryCardQrTemplates(activity, site),
];

export function renderActivityMain({ activity, site, rel }) {
  return [
    `<p class="home-link"><a href="${rel}">${HOME_LINK_TEXT}</a></p>`,
    renderHead(activity),
    renderFeaturedFile(activity, rel),
    renderBooks(activity),
    renderVenues(activity.venues, rel),
    renderFlow(activity, rel),
    renderRain(activity),
    renderPrepare(activity, site),
    renderMore(activity, rel),
    ...(activity.noLiveMode ? [] : renderLiveModeParts(activity, site)),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderPreparingMain({ activity, rel }) {
  return `<h1>${escapeHtml(activity.name)}</h1>
<p class="tagline">${escapeHtml(activity.tagline)}</p>
<p>這一段還在準備中，做好後會放在這裡。</p>
<p><a href="${rel}">${HOME_LINK_TEXT}</a></p>`;
}
