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
const TEAR_AT_SHARE_OF_STUB = 0.4;
const MAX_PULL_SHARE_OF_STUB = 0.9;
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

function boardingPass(seatIndex) {
  const stubBox = el('span', { className: 'stub-box', textContent: seatNumber(seatIndex) });
  const stub = el('div', { className: 'pass-stub is-hinting' }, [el('span', { className: 'stub-head', textContent: 'SEAT' }), stubBox]);
  const meta = [
    ['航班 FLIGHT', '2027'],
    ['日期 DATE', '新春'],
    ['登機門 GATE', '唱題會'],
  ];
  const main = el('div', { className: 'pass-main' }, [
    el('p', { className: 'pass-head' }, [el('b', { textContent: '新春一番賞' }), el('small', { textContent: 'BOARDING PASS' })]),
    el('div', { className: 'pass-route' }, [
      el('span', {}, [el('small', { textContent: '出發 FROM' }), el('b', { textContent: '冬' })]),
      el('span', { className: 'route-plane', textContent: PLANE }),
      el('span', {}, [el('small', { textContent: '目的地 TO' }), el('b', { className: 'route-to', textContent: '春' })]),
    ]),
    el(
      'dl',
      { className: 'pass-meta' },
      meta.map(([label, value]) => el('div', {}, [el('dt', { textContent: label }), el('dd', { textContent: value })])),
    ),
  ]);
  return { pass: decorative(el('div', { className: 'pass' }, [main, stub])), stub, stubBox };
}

function dragToTear(stub, tear) {
  let drag = null;
  const tearAt = () => stub.offsetHeight * TEAR_AT_SHARE_OF_STUB;

  stub.addEventListener('pointerdown', (event) => {
    if (drag || !event.isPrimary || event.button !== 0 || stub.classList.contains('is-torn')) return;
    drag = { pointerId: event.pointerId, startY: event.clientY, pull: 0 };
    stub.setPointerCapture(event.pointerId);
    stub.classList.remove('is-hinting');
    stub.classList.add('is-dragging');
  });

  stub.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag?.pointerId) return;
    drag.pull = Math.min(Math.max(event.clientY - drag.startY, 0), stub.offsetHeight * MAX_PULL_SHARE_OF_STUB);
    const progress = Math.min(drag.pull / tearAt(), 1);
    stub.style.transform = `translate(${progress * 3}px, ${drag.pull}px) rotate(${progress * 4}deg)`;
    stub.classList.toggle('is-ready', progress === 1);
  });

  const release = (event) => {
    if (event.pointerId !== drag?.pointerId) return;
    const pulledFarEnough = event.type === 'pointerup' && drag.pull >= tearAt();
    drag = null;
    stub.classList.remove('is-dragging', 'is-ready');
    stub.style.transform = '';
    if (pulledFarEnough) tear();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stub.addEventListener(type, release);
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
  const { pass, stub, stubBox } = boardingPass(seatIndex);
  const heading = el('h1', { tabIndex: -1, textContent: seatLabel(seatIndex) });
  const back = button('換一張', showPick, 'tear-back');
  const hint = el('p', { className: 'tear-hint', textContent: '手指按住右邊的存根，沿著虛線往下拉' });
  const tearButton = button('撕開', tear, 'tear-button');
  const after = el('div', { className: 'tear-after' });
  after.setAttribute('aria-live', 'polite');
  const next = button('交給下一位 →', showPick, 'ichiban-primary');

  function tear() {
    const torn = tearSeat(round, seatIndex, Date.now());
    if (!torn) return;
    round = torn.round;
    saved.write(round);
    navigator.vibrate?.(TEAR_VIBRATION_MS);
    stub.classList.remove('is-hinting');
    stub.classList.add('is-torn', gradeClass(torn.grade));
    stubBox.replaceChildren(torn.grade, el('small', { textContent: '賞' }));
    for (const node of [back, hint, tearButton]) node.remove();
    after.replaceChildren(...resultView(torn.grade, torn.isLast).filter(Boolean), next);
    next.focus({ preventScroll: true });
    after.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  dragToTear(stub, tear);
  show(
    [el('div', { className: 'tear-head' }, [heading, back]), el('div', { className: 'tear-stage' }, [pass]), hint, tearButton, after],
    heading,
  );
}

const savedRound = parseSaved(saved.read());
if (savedRound && !isStale(savedRound, Date.now())) {
  round = savedRound;
  showPick();
} else {
  showSetup(settingsFrom(savedRound, data.defaults));
}
