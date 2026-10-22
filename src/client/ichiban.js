import { autoTearAt, centredShift, finishAt, keepFlapInView, limitPull, peelLayout } from './lib/peel.mjs';
import {
  GRADES,
  MAX_PER_GRADE,
  countsProblem,
  cryptoRandomInt,
  isStale,
  parseSaved,
  remainingByGrade,
  settingsFrom,
  startRound,
  tearSeat,
  ticketTotal,
  ticketsLeft,
} from './lib/ichiban.mjs';

const RESTART_CONFIRM_MS = 4000;
const REVEAL_AT_PEELED_SHARE = 0.03;
const OPEN_AT_PEELED_SHARE = 0.5;
const MAX_PULL_ANGLE = Math.PI / 3;
const PULL_PAST_OPEN = 40;
const DRAG_REACH = Object.freeze({ up: 140, down: 80 });
const SPRING_BACK_MS = 240;
const FINISH_MS = 320;
const AUTO_TEAR_MS = 650;
const MAX_LEFT_FADE = 64;
const TEAR_VIBRATION_MS = 30;
const PLANE = '✈\uFE0E';
const PROBLEM_TEXT = {
  'bad-count': '份數要填 0～99',
  empty: '至少要 1 張',
  'too-many': '最多 100 張',
};

const data = JSON.parse(document.getElementById('ichiban-data').textContent);
const app = document.getElementById('ichiban-app');
const saved = savedRoundStore(`ichiban:${data.activityId}`);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let round = null;
let hasRendered = false;

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function savedRoundStore(key) {
  const storage = browserStorage();
  return {
    read() {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // Without storage the round lives only as long as this page view.
      }
    },
    remove() {
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing to clear when storage is unavailable.
      }
    },
  };
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

const button = (textContent, onclick, className = '') => el('button', { type: 'button', textContent, onclick, className });

function decorative(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function labelled(input, label) {
  input.setAttribute('aria-label', label);
  return input;
}

const gradeClass = (grade) => `grade-${grade}`;
const seatNumber = (seatIndex) => String(seatIndex + 1).padStart(2, '0');
const seatLabel = (seatIndex) => `座位 ${seatNumber(seatIndex)}`;

function show(children, heading) {
  app.replaceChildren(...children.filter(Boolean));
  if (!hasRendered) {
    hasRendered = true;
    return;
  }
  window.scrollTo(0, 0);
  heading.focus({ preventScroll: true });
}

function routeLine(className) {
  return decorative(
    el('span', { className }, [
      el('span', { textContent: '冬' }),
      el('span', { className: 'route-plane', textContent: PLANE }),
      el('span', { className: 'route-to', textContent: '春' }),
    ]),
  );
}

function parseCount(text) {
  const digits = text.trim().replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

const isCount = (count) => Number.isInteger(count) && count >= 0 && count <= MAX_PER_GRADE;

function showSetup(settings) {
  const rows = GRADES.map((grade) => {
    const count = labelled(el('input', { value: String(settings.counts[grade]), autocomplete: 'off' }), `${grade}賞份數`);
    count.setAttribute('inputmode', 'numeric');
    const prize = labelled(el('input', { value: settings.prizes[grade], placeholder: '獎品（可不填）' }), `${grade}賞獎品`);
    const chip = decorative(el('span', { className: `grade-chip ${gradeClass(grade)}`, textContent: grade }));
    return { grade, count, prize, cells: [chip, count, prize] };
  });
  const lastPrize = labelled(el('input', { value: settings.lastPrize, placeholder: '獎品（可不填）' }), '最後賞獎品');
  const total = el('b');
  const problem = el('p', { className: 'setup-problem' });
  problem.setAttribute('role', 'status');
  const start = el('button', { type: 'submit', textContent: '開始抽', className: 'ichiban-primary' });

  const typedCounts = () => Object.fromEntries(rows.map(({ grade, count }) => [grade, parseCount(count.value)]));

  function refresh() {
    const counts = typedCounts();
    const issue = countsProblem(counts);
    for (const { grade, count } of rows) count.setAttribute('aria-invalid', String(!isCount(counts[grade])));
    const countable = Object.fromEntries(GRADES.map((grade) => [grade, isCount(counts[grade]) ? counts[grade] : 0]));
    total.textContent = String(ticketTotal(countable));
    problem.textContent = issue ? PROBLEM_TEXT[issue] : '';
    start.disabled = issue !== null;
  }

  function begin(event) {
    event.preventDefault();
    const counts = typedCounts();
    if (countsProblem(counts) !== null) return;
    const prizes = Object.fromEntries(rows.map(({ grade, prize }) => [grade, prize.value]));
    round = startRound({ counts, prizes, lastPrize: lastPrize.value }, cryptoRandomInt, Date.now());
    saved.write(round);
    showPick();
  }

  const heading = el('h1', { tabIndex: -1, textContent: '新春一番賞' });
  const form = el('form', { className: 'ichiban-setup', noValidate: true }, [
    el('div', { className: 'setup-grid' }, [
      ...['等級', '份數', '獎品'].map((text) => decorative(el('span', { className: 'setup-label', textContent: text }))),
      ...rows.flatMap(({ cells }) => cells),
      decorative(el('span', { className: 'grade-chip grade-last', textContent: '最後賞' })),
      lastPrize,
    ]),
    el('p', { className: 'setup-note', textContent: '最後賞不算張數：抽到最後一張的人，再多拿一份。' }),
    el('p', { className: 'setup-total' }, ['共 ', total, ' 張']),
    start,
    problem,
    el('p', { className: 'setup-note', textContent: '人數多就把數字加大，例如 20 人：A1、B3、C6、D10。' }),
  ]);
  form.addEventListener('input', refresh);
  form.addEventListener('submit', begin);
  refresh();

  show(
    [
      el('header', { className: 'ichiban-head' }, [
        el('div', {}, [el('small', { textContent: '主持人設定 · DEPARTURES' }), heading]),
        routeLine('ichiban-head-route'),
      ]),
      form,
    ],
    heading,
  );
}

function restartButton() {
  let armed = null;
  const restart = button('重新開始', () => (armed ? restartRound() : arm()), 'ichiban-restart');

  function arm() {
    armed = new AbortController();
    restart.textContent = '確定重來？';
    restart.classList.add('is-armed');
    const disarmElsewhere = (event) => {
      if (!restart.contains(event.target)) disarm();
    };
    const listening = { capture: true, signal: armed.signal };
    document.addEventListener('pointerdown', disarmElsewhere, listening);
    document.addEventListener('keydown', disarmElsewhere, listening);
    restart.addEventListener('blur', disarm, { signal: armed.signal });
    const timer = setTimeout(disarm, RESTART_CONFIRM_MS);
    armed.signal.addEventListener('abort', () => clearTimeout(timer));
  }

  function disarm() {
    armed?.abort();
    armed = null;
    restart.textContent = '重新開始';
    restart.classList.remove('is-armed');
  }

  function restartRound() {
    disarm();
    const settings = settingsFrom(round, data.defaults);
    round = null;
    saved.remove();
    showSetup(settings);
  }

  return restart;
}

function ticketFace(seatIndex, side) {
  return [el('span', { className: 'ticket-main' }, [routeLine('ticket-route'), el('b', { textContent: seatLabel(seatIndex) })]), side];
}

function untornTicket(seatIndex) {
  return el(
    'button',
    { type: 'button', className: 'ticket', onclick: () => showTear(seatIndex) },
    ticketFace(seatIndex, decorative(el('span', { className: 'ticket-stub', textContent: 'SEAT' }))),
  );
}

function tornTicket(seatIndex, grade) {
  return el(
    'div',
    { className: `ticket torn ${gradeClass(grade)}` },
    ticketFace(seatIndex, el('span', { className: 'ticket-grade', textContent: `${grade}賞` })),
  );
}

function prizeBoard() {
  const remaining = remainingByGrade(round);
  return el(
    'dl',
    { className: 'ichiban-board' },
    GRADES.filter((grade) => round.counts[grade] > 0).map((grade) =>
      el('div', { className: `board-cell ${gradeClass(grade)}${remaining[grade] === 0 ? ' is-out' : ''}` }, [
        el('dt', { textContent: `${grade}賞` }),
        el('dd', { textContent: String(remaining[grade]) }),
      ]),
    ),
  );
}

function showPick() {
  const left = ticketsLeft(round);
  const heading = el('h1', { tabIndex: -1, textContent: left > 0 ? '選一張，按下去' : '全部抽完了' });
  const restart = restartButton();
  const tickets = el(
    'ol',
    { className: 'ticket-grid' },
    round.seats.map((_, seatIndex) =>
      el('li', {}, [round.torn[seatIndex] ? tornTicket(seatIndex, round.seats[seatIndex]) : untornTicket(seatIndex)]),
    ),
  );
  show(
    [
      prizeBoard(),
      el('div', { className: 'pick-head' }, [heading, left > 0 && el('span', { className: 'pick-left', textContent: `剩 ${left} 張` })]),
      left === 0 && restart,
      tickets,
      left > 0 && el('div', { className: 'pick-restart' }, [restart]),
    ],
    heading,
  );
}

function peelTicket(seatIndex) {
  const lift = el('div', { className: 'peel-lift' });
  const front = el('div', { className: 'peel-front peel-teeth' }, [
    el('p', { className: 'peel-band' }, [el('b', { textContent: '新春一番賞' }), el('small', { textContent: 'BOARDING PASS' })]),
    routeLine('peel-route'),
    el('p', { className: 'peel-seat' }, [el('span', { textContent: 'SEAT' }), seatLabel(seatIndex)]),
    el('span', { className: 'peel-tab', textContent: '拉' }),
    el('div', { className: 'peel-shade' }, [lift]),
  ]);
  const bend = el('div', { className: 'peel-bend' });
  const back = el('div', { className: 'peel-back peel-teeth' }, [
    el('span', { className: 'peel-tab' }),
    el('div', { className: 'peel-shade' }, [bend]),
  ]);
  const strip = el('div', { className: 'peel-strip' }, [front, el('div', { className: 'peel-cast' }, [back])]);
  const ticket = el('div', { className: 'peel-ticket' }, [
    el('div', { className: 'peel-card' }),
    el('div', { className: 'peel-slot peel-teeth' }, [el('span', { className: 'peel-tab' })]),
    strip,
  ]);
  const fade = el('div', { className: 'peel-fade' }, [ticket]);
  const stage = decorative(el('div', { className: 'peel-stage' }, [fade]));
  return { stage, fade, ticket, strip, front, back, lift, bend };
}

const cssPolygon = (points) =>
  points.length ? `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` : 'inset(100%)';

function peelToOpen({ stage, fade, ticket, strip, front, back, lift, bend }, { onReveal, onOpen }) {
  let size = null;
  let scale = 1;
  let room = null;
  let tab = null;
  let q = null;
  let drag = null;
  let frame = 0;
  let opening = false;

  function measure() {
    size = { length: strip.offsetWidth, height: strip.offsetHeight };
    scale = Math.min(1, stage.offsetWidth / ticket.offsetWidth);
    room = {
      stripLeft: strip.offsetLeft,
      stageWidth: stage.offsetWidth / scale,
      viewRight: (fade.offsetWidth - ticket.offsetLeft) / scale,
    };
    tab = [0, size.height / 2];
    q ??= tab;
  }

  function fadeLeftEdge(width) {
    const mask = width > 0 ? `linear-gradient(90deg, transparent 0, #000 ${Math.min(MAX_LEFT_FADE, width)}px)` : 'none';
    fade.style.maskImage = mask;
    fade.style.webkitMaskImage = mask;
  }

  function slide(shift, fadeWidth = -shift * scale) {
    ticket.style.transform = `translateX(${shift * scale}px) scale(${scale})`;
    fadeLeftEdge(fadeWidth);
  }

  function shade(band, point, rotation) {
    band.style.left = `${point[0]}px`;
    band.style.top = `${point[1]}px`;
    band.style.transform = `rotate(${rotation}rad)`;
  }

  function render(target) {
    q = limitPull(tab, target, { maxAngle: MAX_PULL_ANGLE, maxLength: 2 * size.length + PULL_PAST_OPEN });
    const layout = peelLayout(tab, q, size);
    front.style.clipPath = cssPolygon(layout.front);
    back.style.visibility = layout.back ? 'visible' : 'hidden';
    if (layout.back) {
      back.style.left = `${layout.back.left}px`;
      back.style.clipPath = cssPolygon(layout.back.clip);
      back.style.transformOrigin = `${layout.back.origin[0]}px ${layout.back.origin[1]}px`;
      back.style.transform = `rotate(${layout.back.rotation}rad)`;
    }
    lift.style.display = layout.fold ? 'block' : 'none';
    bend.style.display = lift.style.display;
    if (layout.fold) {
      shade(lift, layout.fold.front, layout.fold.angle);
      shade(bend, layout.fold.back, -layout.fold.angle);
    }
    slide(layout.back ? keepFlapInView(layout.reach, room) : 0);
    return layout.peeled;
  }

  function animate(pointAt, ms, then) {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) {
      render(pointAt(1));
      then?.();
      return;
    }
    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / ms);
      render(pointAt(1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
      else then?.();
    };
    frame = requestAnimationFrame(step);
  }

  function open() {
    stage.classList.add('is-open');
    const centred = centredShift({ ...room, length: size.length });
    const openStripLeft = ticket.offsetLeft + (room.stripLeft + size.length + centred) * scale;
    slide(centred, openStripLeft);
    onOpen();
  }

  function springBack() {
    const [fromX, fromY] = q;
    const [toX, toY] = tab;
    animate((progress) => [fromX + (toX - fromX) * progress, fromY + (toY - fromY) * progress], SPRING_BACK_MS);
  }

  function finish() {
    opening = true;
    const from = q;
    animate((progress) => finishAt(from, progress, size), FINISH_MS, open);
  }

  strip.addEventListener('pointerdown', (event) => {
    if (opening || drag || !event.isPrimary || event.button !== 0) return;
    try {
      strip.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    cancelAnimationFrame(frame);
    measure();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, from: q, peeled: 0 };
  });

  strip.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag?.pointerId) return;
    const x = Math.min(2 * size.length + PULL_PAST_OPEN, drag.from[0] + (event.clientX - drag.x) / scale);
    const y = drag.from[1] + (event.clientY - drag.y) / scale;
    drag.peeled = render([x, Math.min(size.height + DRAG_REACH.down, Math.max(-DRAG_REACH.up, y))]);
    if (drag.peeled > REVEAL_AT_PEELED_SHARE) onReveal();
  });

  const release = (event) => {
    if (event.pointerId !== drag?.pointerId) return;
    const pulledOpen = event.type === 'pointerup' && drag.peeled > OPEN_AT_PEELED_SHARE;
    drag = null;
    if (pulledOpen) finish();
    else springBack();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) strip.addEventListener(type, release);

  measure();
  render(tab);

  return function tearOpen() {
    if (opening) return;
    opening = true;
    drag = null;
    measure();
    onReveal();
    animate((progress) => autoTearAt(progress, size), AUTO_TEAR_MS, open);
  };
}

function resultView(grade, isLast) {
  const prize = round.prizes[grade];
  return [
    el('div', { className: `tear-result ${gradeClass(grade)}` }, [
      el('p', { className: 'result-grade' }, [grade, el('small', { textContent: '賞' })]),
      prize && el('p', { className: 'result-prize', textContent: prize }),
    ]),
    isLast &&
      el('div', { className: 'tear-last grade-last' }, [
        el('p', { className: 'last-title', textContent: '最後賞' }),
        el('p', {}, [el('span', { textContent: '你抽到最後一張！' }), el('span', { textContent: '再多拿一份最後賞' })]),
        round.lastPrize && el('p', { className: 'result-prize', textContent: round.lastPrize }),
      ]),
  ];
}

function showTear(seatIndex) {
  if (round.torn[seatIndex]) return showPick();
  const peel = peelTicket(seatIndex);
  const heading = el('h1', { tabIndex: -1, textContent: seatLabel(seatIndex) });
  const back = button('換一張', showPick, 'tear-back');
  const hint = el('p', { className: 'tear-hint', textContent: '手指按住左邊的「拉」，往右上拉開' });
  const tearButton = button('撕開', () => tearOpen(), 'tear-button');
  const after = el('div', { className: 'tear-after' });
  after.setAttribute('aria-live', 'polite');
  const next = button('交給下一位 →', showPick, 'ichiban-primary');
  let revealed = null;

  function reveal() {
    if (revealed) return;
    const torn = tearSeat(round, seatIndex, Date.now());
    if (!torn) return;
    round = torn.round;
    saved.write(round);
    revealed = torn;
    back.remove();
    const prize = round.prizes[torn.grade];
    peel.strip.classList.add(gradeClass(torn.grade));
    peel.back.prepend(
      ...[
        el('p', { className: 'peel-grade' }, [torn.grade, el('small', { textContent: '賞' })]),
        prize && el('p', { className: 'peel-prize', textContent: prize }),
      ].filter(Boolean),
    );
  }

  function showResult() {
    if (!revealed) return;
    navigator.vibrate?.(TEAR_VIBRATION_MS);
    for (const node of [hint, tearButton]) node.remove();
    after.replaceChildren(...resultView(revealed.grade, revealed.isLast).filter(Boolean), next);
    next.focus({ preventScroll: true });
    after.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  show(
    [el('div', { className: 'tear-head' }, [heading, back]), el('div', { className: 'tear-stage' }, [peel.stage]), hint, tearButton, after],
    heading,
  );
  const tearOpen = peelToOpen(peel, { onReveal: reveal, onOpen: showResult });
}

const savedRound = parseSaved(saved.read());
if (savedRound && !isStale(savedRound, Date.now())) {
  round = savedRound;
  showPick();
} else {
  showSetup(settingsFrom(savedRound, data.defaults));
}
