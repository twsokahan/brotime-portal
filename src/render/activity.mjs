import { cardPageUrl, surveyUrl } from '../lib/share.mjs';
import { escapeHtml, jsonForScript } from './html.mjs';
import { qrSvg } from './qr.mjs';

const DEFAULT_FLOW_TITLE = '60 分鐘這樣過';
const DEFAULT_THUMB_COUNT = 3;
const HOME_LINK_TEXT = '← 看其他兄弟時光';

const list = (items, renderItem) => items.map(renderItem).join('');

function renderHead(activity) {
  const { people, duration, place } = activity.facts;
  return `<header class="activity-head">
<h1>${escapeHtml(activity.name)}</h1>
<p class="tagline">${escapeHtml(activity.tagline)}</p>
<ul class="facts">${list([people, duration, place], (fact) => `<li>${escapeHtml(fact)}</li>`)}</ul>
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
    '活動後一週內',
    `<li><span><a href="${escapeHtml(reportUrl)}">區負責人填寫線上回報表</a></span></li>`,
  );
}

function renderTodo(activity, site) {
  const groups = [...Map.groupBy(activity.todo, (row) => row.when)].map(([when, rows]) =>
    renderTodoGroup(when, list(rows, renderTodoRow)),
  );
  return groups.join('') + renderReportTodo(surveyLink(activity, site, 'report'));
}

function renderPrepare(activity, site) {
  const provided = list(
    activity.provided,
    ({ item, qty }) => `<li><span>${escapeHtml(item)}</span><em>${escapeHtml(qty)}</em></li>`,
  );
  return `<section class="prepare">
<h2>要準備</h2>
<div class="box"><h3>企劃室提供</h3><ul>${provided}</ul></div>
<div class="box todo"><h3>你要做的</h3>${renderTodo(activity, site)}</div>
<div class="box"><h3>問卷 <span class="badge">線上</span></h3><p>線上填，活動最後掃 QR code，不用印。</p></div>
</section>`;
}

function thumbCards(set, step) {
  if (step.cardIds) return set.cards.filter((card) => step.cardIds.includes(card.id));
  if (set.thumbs) return set.thumbs.map((cardId) => set.cards.find((card) => card.id === cardId));
  return set.cards.slice(0, DEFAULT_THUMB_COUNT);
}

function renderThumbs(activity, step, rel) {
  const thumbs = (step.cards ?? []).flatMap((key) => {
    const set = activity.cardSets[key];
    return thumbCards(set, step).map((card) => {
      const img = `<img src="${rel}cards/${escapeHtml(activity.id)}/${escapeHtml(card.id)}-thumb.webp" alt="${escapeHtml(card.title)}" loading="lazy">`;
      return set.kind === 'story' ? `<a href="cards/${escapeHtml(card.id)}/">${img}</a>` : img;
    });
  });
  return thumbs.length ? `<div class="thumbs">${thumbs.join('')}</div>` : '';
}

function renderFlow(activity, rel) {
  const steps = list(
    activity.steps,
    (step) => `<li class="step">
<span class="time">${escapeHtml(step.time)}</span>
<h3>${escapeHtml(step.title)}</h3>
<p class="say">說：${escapeHtml(step.say)}</p>${renderThumbs(activity, step, rel)}
</li>`,
  );
  return `<section class="flow">
<h2>${escapeHtml(activity.flowTitle ?? DEFAULT_FLOW_TITLE)}</h2>
<ol class="timeline">${steps}</ol>
</section>`;
}

function renderStart() {
  return `<div class="start">
<button id="start-live" type="button">開始活動 ▶</button>
<p class="hint">要去沒訊號的地方，出發前在有訊號處先按『開始活動』。</p>
</div>`;
}

function renderRain(activity) {
  if (activity.tags.rain === 'ok') return '';
  return `<p class="rain">下雨怎麼辦：${escapeHtml(activity.rainNote)}</p>`;
}

function renderPrintFiles(activity, rel) {
  if (!activity.printFiles?.length) return '';
  const links = list(
    activity.printFiles,
    ({ label, file }) => `<li><a href="${rel}${escapeHtml(file)}">${escapeHtml(label)}（PDF）</a></li>`,
  );
  return `<p>想印實體卡的話：</p><ul>${links}</ul>`;
}

function renderMore(activity, rel) {
  const textItems = (items) => list(items, (text) => `<li>${escapeHtml(text)}</li>`);
  return `<section class="more">
<details><summary>第一次主持記得 ${activity.firstTime.length} 件事</summary><ol>${textItems(activity.firstTime)}</ol></details>
<details><summary>想多留 30 分鐘（選配）</summary><ul>${textItems(activity.extra30)}</ul></details>
<details><summary>完整企劃案</summary><p><a href="${rel}${escapeHtml(activity.planFile)}">下載企劃案（PDF）</a></p>${renderPrintFiles(activity, rel)}</details>
</section>`;
}

function renderLiveData(activity, site) {
  const { extra30, firstTime, ...liveActivity } = activity;
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
  const reportLink = report ? `<p><a href="${escapeHtml(report)}">一週內填活動回報表</a></p>` : '';
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

export function renderActivityMain({ activity, site, rel }) {
  return [
    `<p class="home-link"><a href="${rel}">${HOME_LINK_TEXT}</a></p>`,
    renderHead(activity),
    renderPrepare(activity, site),
    renderFlow(activity, rel),
    renderStart(),
    renderRain(activity),
    renderMore(activity, rel),
    renderLiveData(activity, site),
    renderSurveyTemplates(activity, site),
    renderStoryCardQrTemplates(activity, site),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderPreparingMain({ activity, rel }) {
  return `<h1>${escapeHtml(activity.name)}</h1>
<p class="tagline">${escapeHtml(activity.tagline)}</p>
<p>這個活動還在準備中，做好後會放在這裡。</p>
<p><a href="${rel}">${HOME_LINK_TEXT}</a></p>`;
}
