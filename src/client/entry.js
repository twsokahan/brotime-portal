import { countMatches, emptyFilters, matchesFilters, wallOrder } from './lib/filter.mjs';
import { INTERESTS, PLACE, SLOTS } from './lib/labels.mjs';
import { recommend } from './lib/recommend.mjs';

const FULL_PICKS = 3;
const SLOT_NOTES = { 'weekend-day': '週休二日', 'early-morning': '上班前或下田前', flexible: '排休、輪班' };

const withNote = (label, note) => (note ? `${label}（${note}）` : label);

const QUESTIONS = [
  {
    key: 'kids',
    title: '這次會有人帶小孩嗎？',
    options: [
      ['yes', '會'],
      ['no', '不會'],
      ['unsure', '還不確定'],
    ],
  },
  {
    key: 'slot',
    title: '區裡的夥伴，什麼時候比較有空？',
    options: Object.entries(SLOTS).map(([value, label]) => [value, withNote(label, SLOT_NOTES[value])]),
  },
  {
    key: 'place',
    title: '想在室內還是戶外？',
    hint: '戶外遇雨可能延期',
    options: [
      ['indoor', PLACE.indoor],
      ['outdoor', PLACE.outdoor],
      ['either', '都可以'],
    ],
  },
  {
    key: 'interest',
    title: '大家有共同興趣嗎？',
    options: [...Object.entries(INTERESTS), ['none', '沒特別']],
  },
];

const activities = JSON.parse(document.getElementById('activities-data').textContent);
const activityById = new Map(activities.map((activity) => [activity.id, activity]));

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

const button = (textContent, onclick, className = '') => el('button', { type: 'button', textContent, onclick, className });

const chips = [...document.querySelectorAll('[data-filter]')];
const wall = document.querySelector('.wall');
const cardById = new Map([...document.querySelectorAll('.wall .act')].map((card) => [card.dataset.id, card]));
const matchCount = document.getElementById('match-count');
const filterPanel = document.getElementById('filters');
const toggleFiltersButton = document.getElementById('toggle-filters');
const filterSummary = toggleFiltersButton.querySelector('.filter-summary');

function pressedFilters() {
  const filters = emptyFilters();
  for (const chip of chips) {
    if (chip.getAttribute('aria-pressed') !== 'true') continue;
    const { filter, value } = chip.dataset;
    if (Array.isArray(filters[filter])) filters[filter].push(value);
    else filters[filter] = true;
  }
  return filters;
}

function arrangeWall(filters) {
  for (const id of wallOrder(activities, filters)) {
    const card = cardById.get(id);
    if (!card) continue;
    card.classList.toggle('is-dim', !matchesFilters(activityById.get(id), filters));
    wall.append(card);
  }
}

function applyFilters() {
  const filters = pressedFilters();
  arrangeWall(filters);
  const count = countMatches(activities, filters);
  matchCount.textContent = count ? `符合的有 ${count} 種` : '沒有符合的，少選一個條件看看。';
  const pressedCount = chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true').length;
  filterSummary.textContent = pressedCount ? `篩選・${pressedCount}` : '篩選';
}

for (const chip of chips) {
  chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    applyFilters();
  });
}

toggleFiltersButton.addEventListener('click', () => {
  const expanded = toggleFiltersButton.getAttribute('aria-expanded') !== 'true';
  toggleFiltersButton.setAttribute('aria-expanded', String(expanded));
  filterPanel.hidden = !expanded;
});

const openQuizButton = document.getElementById('open-quiz');
const page = document.querySelector('main');
const quizBody = el('div', { className: 'quiz-body' });
const quiz = el('div', { id: 'quiz', hidden: true }, [quizBody]);
quiz.setAttribute('role', 'dialog');
quiz.setAttribute('aria-modal', 'true');
quiz.setAttribute('aria-labelledby', 'quiz-title');
document.body.append(quiz);

let answers = {};

const screenTitle = (text) => el('h2', { id: 'quiz-title', tabIndex: -1, textContent: text });

function showScreen(children) {
  quizBody.replaceChildren(button('關閉', closeQuiz, 'quiz-close'), ...children.filter(Boolean));
  quiz.scrollTop = 0;
  document.getElementById('quiz-title').focus();
}

function askQuestion(index) {
  const { key, title, hint, options } = QUESTIONS[index];
  const choose = (value) => {
    answers = { ...answers, [key]: value };
    if (index + 1 < QUESTIONS.length) askQuestion(index + 1);
    else showResult();
  };
  showScreen([
    screenTitle(title),
    hint && el('p', { className: 'hint', textContent: hint }),
    el('div', { className: 'quiz-options' }, options.map(([value, label]) => button(label, () => choose(value)))),
    index > 0 && button('上一題', () => askQuestion(index - 1)),
  ]);
}

function pickItem({ id, name, reasons }) {
  const link = el('a', { href: `a/${id}/` }, [
    el('h3', { textContent: name }),
    reasons.length > 0 && el('p', { className: 'why', textContent: reasons.join('・') }),
  ]);
  return el('li', { className: 'pick' }, [link]);
}

function showResult() {
  const { picks, note } = recommend(activities, answers);
  const title = picks.length < FULL_PICKS ? `符合的 ${picks.length} 種` : `最適合你們區的 ${FULL_PICKS} 種`;
  showScreen([
    screenTitle(title),
    picks.length > 0 && el('ol', { className: 'picks' }, picks.map(pickItem)),
    note && el('p', { className: 'quiz-note', textContent: note }),
    note && button('重新回答', startQuiz),
    button('看全部 16 種 →', closeQuiz, 'see-all'),
  ]);
}

function startQuiz() {
  answers = {};
  askQuestion(0);
}

function openQuiz() {
  quiz.hidden = false;
  page.inert = true;
  startQuiz();
}

function closeQuiz() {
  quiz.hidden = true;
  page.inert = false;
  openQuizButton.focus();
}

openQuizButton.addEventListener('click', openQuiz);
quiz.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeQuiz();
});
