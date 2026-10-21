import { districtLabel, routeSteps } from './lib/city-walk.mjs';
import {
  clearSession,
  drawCard,
  groupsOf,
  imageUrlsFor,
  loadSession,
  preflightItems,
  preload,
  progressText,
  saveSession,
  timerText,
} from './lib/live.mjs';
import { cardPageUrl, shareFallbacks } from './lib/share.mjs';

const REL = '../../';
const DISTRICT_KEY = 'brotime:district';
const STEP_COLOURS = 5;

const activity = JSON.parse(document.getElementById('activity-data').textContent);
const site = { baseUrl: activity.baseUrl };
const routesData = document.getElementById('routes-data');
const routes = routesData ? JSON.parse(routesData.textContent) : null;
const storage = browserStorage();

const page = document.querySelector('main');
const startButton = document.getElementById('start-live');
const startLabel = startButton.textContent;

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

const button = (textContent, onclick, className = '') => el('button', { type: 'button', textContent, onclick, className });

const externalLink = (textContent, href, className = '') =>
  el('a', { textContent, href, className, target: '_blank', rel: 'noopener' });

const cloneTemplate = (id) => document.getElementById(id).content.cloneNode(true);

function stepCardSets(step) {
  return (step.cards ?? []).map((key) => {
    const set = activity.cardSets[key];
    const cards = step.cardIds ? set.cards.filter((card) => step.cardIds.includes(card.id)) : set.cards;
    return { ...set, key, cards };
  });
}

function cardImage(card, className, file = card.id) {
  const img = el('img', { alt: card.title, className });
  img.addEventListener('error', () => img.replaceWith(el('div', { className: `${className} card-missing`, textContent: card.title })), {
    once: true,
  });
  img.src = `${REL}cards/${activity.id}/${file}.webp`;
  return img;
}

let district = null;
const routeFor = (name) => routes?.find((route) => route.district === name) ?? null;
const liveStepsFor = (name) => (routes ? routeSteps(activity.steps, routeFor(name)) : activity.steps);

function savedDistrict() {
  const fromUrl = new URLSearchParams(location.search).get('d');
  if (routeFor(fromUrl)) return fromUrl;
  try {
    const remembered = storage.getItem(DISTRICT_KEY);
    return routeFor(remembered) ? remembered : null;
  } catch {
    return null;
  }
}

function districtOptions() {
  const circles = new Map();
  for (const route of routes) circles.set(route.circle, [...(circles.get(route.circle) ?? []), route.district]);
  return [...circles].map(([circle, districts]) =>
    el(
      'optgroup',
      { label: circle },
      districts.map((name) => el('option', { value: name, textContent: districtLabel(name) })),
    ),
  );
}

function routeSummary(route) {
  const walkMinutes = route.legMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const facts = [
    ['集合點', route.meetingPoint],
    ['停車', route.parking],
    ['全長', `${(route.totalM / 1000).toFixed(1)} 公里，走路約 ${walkMinutes} 分鐘`],
    ['停留點一', route.stop1.place],
    ['終點', route.end.place],
    ['廁所', route.toilets],
    ['雨天備案', route.rainPlan],
    ['選配', route.optional],
  ];
  return [
    el('h3', { textContent: route.title }),
    el(
      'dl',
      { className: 'route-facts' },
      facts.flatMap(([label, value]) => [el('dt', { textContent: label }), el('dd', { textContent: value })]),
    ),
    externalLink('整條路線在 Google 地圖開啟', route.googleRouteUrl, 'button-link'),
  ];
}

const storyThumb = (card) =>
  el('a', { href: `cards/${card.id}/` }, [
    el('img', { src: `${REL}cards/${activity.id}/${card.id}-thumb.webp`, alt: card.title, loading: 'lazy' }),
  ]);

function showStopStoryThumbs(steps) {
  const items = document.querySelectorAll('.timeline > .step');
  steps.forEach((step, i) => {
    if (step.routeStop !== 'stop1') return;
    items[i].querySelector('.thumbs')?.remove();
    const cards = stepCardSets(step).flatMap((set) => set.cards);
    if (cards.length) items[i].append(el('div', { className: 'thumbs' }, cards.map(storyThumb)));
  });
}

function setUpDistrictPicker() {
  const select = el('select', { id: 'district' }, [
    el('option', { value: '', textContent: '先選你們區', disabled: true, defaultSelected: true }),
    ...districtOptions(),
  ]);
  select.setAttribute('aria-label', '選區');
  const summary = el('div', { className: 'route-summary box', hidden: true });
  document.querySelector('.flow').before(el('section', { className: 'district' }, [select, summary]));

  const choose = (name) => {
    const route = routeFor(name);
    district = name;
    select.value = name;
    const url = new URL(location.href);
    url.searchParams.set('d', name);
    history.replaceState(history.state, '', url);
    try {
      storage.setItem(DISTRICT_KEY, name);
    } catch {
      // Without storage the district is still kept in the address bar.
    }
    summary.replaceChildren(...routeSummary(route));
    summary.hidden = false;
    showStopStoryThumbs(routeSteps(activity.steps, route));
    startButton.disabled = false;
    startButton.textContent = startLabel;
  };

  select.addEventListener('change', () => choose(select.value));
  startButton.disabled = true;
  startButton.textContent = '先選區，再開始';
  const initial = savedDistrict();
  if (initial) choose(initial);
  return choose;
}

const liveBody = el('div', { className: 'live-body' });
const liveLayer = el('div', { id: 'live', hidden: true }, [liveBody]);
liveLayer.setAttribute('role', 'dialog');
liveLayer.setAttribute('aria-modal', 'true');
liveLayer.setAttribute('aria-labelledby', 'live-title');
document.body.append(liveLayer);

const live = { steps: [], index: 0, startedAtMs: 0, district: null };
const topicPicks = new Map();
const storyPicks = new Map();
const preloadedImages = [];
let drawnIds = [];
let timerId = 0;
let resumePrompt = null;

const screenTitle = (text) => el('h2', { id: 'live-title', tabIndex: -1, textContent: text });

function showScreen(children) {
  liveBody.replaceChildren(...children.filter(Boolean));
  liveLayer.scrollTop = 0;
  document.getElementById('live-title').focus();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
    preloadedImages.push(img);
  });
}

function updateTimer() {
  const timer = liveBody.querySelector('.live-timer');
  if (!timer) return;
  const { text, overtime } = timerText(live.steps[live.index], live.startedAtMs, Date.now());
  timer.textContent = text;
  timer.classList.toggle('is-over', overtime);
}

function startTimer() {
  stopTimer();
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerId);
}

let wakeLock = null;
let screenShouldStayOn = false;

async function keepScreenOn() {
  screenShouldStayOn = true;
  if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (screenShouldStayOn) wakeLock = lock;
    else lock.release().catch(() => {});
  } catch {
    // Refused (for example in battery saver): the screen may dim, live mode still works.
  }
}

function letScreenSleep() {
  screenShouldStayOn = false;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelecting(text);
  }
}

function copyBySelecting(text) {
  const field = el('textarea', { value: text, readOnly: true, className: 'copy-field' });
  liveLayer.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

function fallbackShareButtons(title, url) {
  const { lineUrl, copyText } = shareFallbacks(title, url);
  const copyButton = button('複製連結', async () => {
    if (await copyToClipboard(copyText)) copyButton.textContent = '已複製';
    else copyButton.replaceWith(el('p', { className: 'copy-text', textContent: copyText }));
  });
  return [externalLink('分享到 LINE', lineUrl, 'button-link'), copyButton];
}

function shareControls(title, url) {
  const holder = el('div', { className: 'share-buttons' });
  const showFallbacks = () => holder.replaceChildren(...fallbackShareButtons(title, url));
  if (typeof navigator.share !== 'function') {
    showFallbacks();
    return holder;
  }
  holder.append(
    button('分享故事卡', async () => {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        if (error.name !== 'AbortError') showFallbacks();
      }
    }),
  );
  return holder;
}

const storyText = (card) =>
  el('section', { className: 'story-text' }, [
    el('h3', { textContent: '故事全文' }),
    el('p', { className: 'hint', textContent: '沒有訊號的話，主持人直接念給大家聽。' }),
    ...card.text.split('\n\n').map((paragraph) => el('p', { textContent: paragraph })),
    el('p', { className: 'source', textContent: `出處：${card.source}` }),
  ]);

function storyCardView(card) {
  const qr = document.getElementById(`qr-card-${card.id}`);
  return el('div', { className: 'story-live' }, [
    cardImage(card, 'live-card-image'),
    el('div', { className: 'story-share' }, [
      shareControls(card.title, cardPageUrl(site, activity.id, card.id)),
      qr && el('figure', { className: 'live-qr' }, [el('figcaption', { textContent: '新朋友掃這裡' }), qr.content.cloneNode(true)]),
    ]),
    storyText(card),
  ]);
}

function topicDraw(cards, pickKey) {
  if (!cards.length) return null;
  const groups = groupsOf(cards);
  const choices = [null, ...groups];
  const pick = topicPicks.get(pickKey) ?? { group: null, card: null };
  topicPicks.set(pickKey, pick);

  const cardSlot = el('div', { className: 'topic-card' });
  cardSlot.setAttribute('aria-live', 'polite');
  const showCard = () => cardSlot.replaceChildren(cardImage(pick.card, 'live-card-image'));
  const draw = () => {
    const result = drawCard(cards, drawnIds, pick.group);
    drawnIds = result.drawnIds;
    pick.card = result.card;
    showCard();
  };

  const groupButtons = choices.map((group) => {
    const count = group === null ? cards.length : cards.filter((card) => card.group === group).length;
    const option = button(
      group ?? '全部',
      () => {
        pick.group = group;
        markPressed();
        draw();
      },
      'topic-group',
    );
    option.append(' ', el('span', { className: 'topic-group-count', textContent: String(count) }));
    return option;
  });
  function markPressed() {
    groupButtons.forEach((groupButton, i) => groupButton.setAttribute('aria-pressed', String(choices[i] === pick.group)));
  }

  markPressed();
  if (pick.card) showCard();
  else draw();
  return el('div', { className: 'topic-draw' }, [
    groups.length > 0 && topicGroupPicker(groupButtons),
    cardSlot,
    button('換一張', draw, 'live-draw'),
  ]);
}

function topicGroupPicker(groupButtons) {
  const title = '從哪一類抽？';
  const picker = el('div', { className: 'topic-groups' }, groupButtons);
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', title);
  return el('div', {}, [el('h3', { className: 'topic-groups-title', textContent: title }), picker]);
}

function openCardViewer(set, startIndex, opener) {
  const close = () => {
    viewer.remove();
    liveLayer.inert = false;
    opener.focus();
  };
  const closeButton = button('關閉', close, 'viewer-close');
  const strip = el(
    'div',
    { className: 'viewer-strip', tabIndex: 0 },
    set.cards.map((card) => el('div', { className: 'viewer-slide' }, [cardImage(card, 'viewer-image')])),
  );
  const viewer = el('div', { className: 'card-viewer' }, [closeButton, strip]);
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', set.label);
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.body.append(viewer);
  liveLayer.inert = true;
  strip.scrollLeft = strip.clientWidth * startIndex;
  closeButton.focus();
}

function otherCards(set) {
  return el(
    'div',
    { className: 'thumbs live-thumbs' },
    set.cards.map((card, i) => {
      const thumb = button('', () => openCardViewer(set, i, thumb), 'thumb-button');
      thumb.append(cardImage(card, 'live-thumb'));
      return thumb;
    }),
  );
}

function storyTile(card, onclick) {
  const thumb = cardImage(card, 'story-tile-image', `${card.id}-thumb`);
  thumb.alt = '';
  const tile = button('', onclick, 'story-tile');
  tile.append(thumb, el('span', { textContent: card.title }));
  return tile;
}

function storyPicker(cards, pickKey) {
  const cardSlot = el('div', { className: 'live-cards' });
  const tiles = cards.map((card) => storyTile(card, () => choose(card)));
  function choose(card) {
    storyPicks.set(pickKey, card.id);
    tiles.forEach((tile, i) => tile.setAttribute('aria-pressed', String(cards[i] === card)));
    cardSlot.replaceChildren(storyCardView(card));
  }

  choose(cards.find((card) => card.id === storyPicks.get(pickKey)) ?? cards[0]);
  const switcher = el('div', { className: 'story-switch' }, tiles);
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', '選一張故事卡');
  return el('div', {}, [el('h3', { className: 'story-switch-title', textContent: '選一張故事卡' }), switcher, cardSlot]);
}

function cardSetView(set, stepIndex) {
  if (set.kind === 'story' && set.cards.length > 1) return storyPicker(set.cards, `${stepIndex}:${set.key}`);
  if (set.kind === 'story') return el('div', { className: 'live-cards' }, set.cards.map(storyCardView));
  if (set.kind === 'topic') return topicDraw(set.cards, `${stepIndex}:${set.key}`);
  return otherCards(set);
}

function participantSurvey() {
  const surveyUrl = document.getElementById('qr-participant').dataset.url;
  return el('div', { className: 'live-survey' }, [
    el('div', { className: 'live-qr' }, [cloneTemplate('qr-participant')]),
    surveyUrl && externalLink('或點這裡開問卷', surveyUrl),
  ]);
}

const readAloudBlock = (text) =>
  el('section', { className: 'read-aloud' }, [el('h3', { textContent: '念這段：' }), el('p', { textContent: text })]);

function showStep(index, startedAtMs = Date.now()) {
  live.index = index;
  live.startedAtMs = startedAtMs;
  saveSession(storage, activity.id, { index, startedAtMs, district: live.district }, Date.now());

  const step = live.steps[index];
  const next = live.steps[index + 1];
  const progress = el(
    'div',
    { className: 'live-progress' },
    live.steps.map((_, i) => el('i', { className: i <= index ? 'is-done' : '' })),
  );
  progress.setAttribute('aria-hidden', 'true');
  const view = el('div', { className: 'live-step' }, [
    el('div', { className: 'live-bar' }, [
      el('span', { textContent: progressText(index, live.steps.length) }),
      el('span', { className: 'live-timer' }),
    ]),
    progress,
    el('p', { className: 'live-time', textContent: step.time }),
    screenTitle(step.title),
    el('p', { className: 'live-do', textContent: step.do }),
    el('p', { className: 'live-say', textContent: `說：${step.say}` }),
    step.readAloud && readAloudBlock(step.readAloud),
    ...stepCardSets(step).map((set) => cardSetView(set, index)),
    step.mapsUrl && externalLink(step.mapsLabel, step.mapsUrl, 'button-link live-maps'),
    !next && participantSurvey(),
    el('div', { className: 'live-nav' }, [
      next
        ? button(`下一步：${next.title} →`, () => showStep(index + 1), 'live-next')
        : button('今天到這裡', finishLive, 'live-next'),
      button('上一步', () => (index === 0 ? showPreflight() : showStep(index - 1)), 'live-prev'),
    ]),
  ]);
  const colour = (index % STEP_COLOURS) + 1;
  view.style.setProperty('--dot', `var(--step${colour})`);
  view.style.setProperty('--dot-text', `var(--step${colour}-text)`);
  showScreen([view]);
  startTimer();
}

async function loadThenShowStep(index, startedAtMs) {
  stopTimer();
  showScreen([screenTitle('載入中…')]);
  const urls = imageUrlsFor(activity, live.steps).map((url) => REL + url);
  await preload(urls, loadImage);
  showStep(index, startedAtMs);
}

function showPreflight() {
  stopTimer();
  const items = preflightItems(activity).map((item) =>
    el('li', {}, [el('label', {}, [el('input', { type: 'checkbox' }), el('span', { textContent: item })])]),
  );
  showScreen([
    screenTitle('帶齊了嗎？'),
    el('ul', { className: 'preflight' }, items),
    el('div', { className: 'live-nav' }, [
      button('開始 ▶', () => loadThenShowStep(0), 'live-next'),
      button('回到說明', closeLive, 'live-prev'),
    ]),
  ]);
}

function finishLive() {
  clearSession(storage, activity.id);
  stopTimer();
  letScreenSleep();
  showScreen([
    screenTitle('今天辛苦了！'),
    el('div', { className: 'staff-survey' }, [cloneTemplate('staff-survey'), cloneTemplate('activity-report')]),
    el('div', { className: 'live-nav' }, [button('回到說明', closeLive, 'live-next')]),
  ]);
}

function openLive() {
  resumePrompt?.remove();
  live.district = district;
  live.steps = liveStepsFor(district);
  liveLayer.hidden = false;
  page.inert = true;
  keepScreenOn();
}

function closeLive() {
  stopTimer();
  letScreenSleep();
  liveLayer.hidden = true;
  page.inert = false;
  startButton.focus();
}

function startLive() {
  openLive();
  showPreflight();
}

function offerResume(chooseDistrict) {
  const saved = loadSession(storage, activity.id, Date.now());
  if (!saved || saved.index >= activity.steps.length) return;
  if (routes && !routeFor(saved.district)) return;
  const resume = () => {
    if (routes) chooseDistrict(saved.district);
    openLive();
    loadThenShowStep(saved.index, saved.startedAtMs);
  };
  const restart = () => {
    clearSession(storage, activity.id);
    startLive();
  };
  resumePrompt = el('div', { className: 'resume' }, [
    el('p', { textContent: `上次進行到第 ${saved.index + 1} 步，要接著繼續嗎？` }),
    el('div', { className: 'resume-actions' }, [button('繼續', resume, 'live-next'), button('重新開始', restart)]),
  ]);
  page.prepend(resumePrompt);
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || liveLayer.hidden) return;
  updateTimer();
  if (screenShouldStayOn) keepScreenOn();
});

const chooseDistrict = routes ? setUpDistrictPicker() : null;
offerResume(chooseDistrict);
startButton.addEventListener('click', startLive);
