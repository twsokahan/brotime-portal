import { KIDS, PLACE, RAIN, SLOTS, INTERESTS } from './labels.mjs';
import { GRADES, MAX_PER_GRADE, MAX_TICKETS, countsProblem } from './ichiban.mjs';

const STATUSES = ['preparing', 'review', 'ready'];
const PUBLISHED_STATUSES = ['review', 'ready'];
const EDITIONS = ['metro', 'rural'];
const TEMPLATES = ['A', 'B', 'C', 'D', 'E'];
const CARD_SET_KINDS = ['story', 'topic', 'other'];
const ROUTE_STOPS = ['start', 'stop1', 'end'];
const ROUTE_LEGS = [0, 1];
const READ_ALOUD_KEYS = ['label', 'text', 'source'];
const STEP_TOOLS = ['ichiban'];
const ICHIBAN_COUNT_PROBLEMS = {
  'bad-count': `每一賞要是 0–${MAX_PER_GRADE} 的整數`,
  empty: '加起來至少要有 1 張',
  'too-many': `加起來不能超過 ${MAX_TICKETS} 張`,
};
const ACTIVITY_ID = /^[a-z0-9-]+$/;
const CARD_ID = /^[A-Za-z0-9-]+$/;
const HTTPS_URL = /^https:\/\/[^\s/]+\S*$/;
const FORM_ENTRY = /^entry\.\d+$/;
const MAX_ORDER = 16;
const MAX_SAY_CHARS = 45;
const MAX_TODO_TASK_CHARS = 20;
const MAX_THUMBS = 3;
const CITY_WALK_ID = 'city-walk';
const UNNAMED = '(沒有 id)';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isActivityId = (value) => typeof value === 'string' && ACTIVITY_ID.test(value);
const isCardId = (value) => typeof value === 'string' && CARD_ID.test(value);
const charCount = (text) => [...text].length;
const ownerOf = (activity) => (isText(activity?.id) ? activity.id : UNNAMED);
const isPublished = (activity) => PUBLISHED_STATUSES.includes(activity?.status);
const cardIdsOf = (set) => new Set(Array.isArray(set?.cards) ? set.cards.map((card) => card?.id) : []);

function createChecker(owner) {
  const errors = [];
  const fail = (path, problem) => {
    errors.push(`${owner}: ${path} ${problem}`);
  };
  const present = (value, path) => {
    if (value === undefined) fail(path, '必填');
    return value !== undefined;
  };
  const passes = (ok, path, problem) => {
    if (!ok) fail(path, problem);
    return ok;
  };
  return {
    errors,
    fail,
    text: (value, path) => present(value, path) && passes(isText(value), path, '要是有內容的文字'),
    object: (value, path) => present(value, path) && passes(isObject(value), path, '要是物件'),
    oneOf: (value, allowed, path) =>
      present(value, path) && passes(allowed.includes(value), path, `要是 ${allowed.join('、')} 其中之一`),
    list: (value, path, min = 0) =>
      present(value, path) &&
      passes(Array.isArray(value), path, '要是陣列') &&
      passes(value.length >= min, path, `至少要有 ${min} 項`),
  };
}

function checkTextList(check, value, path, min = 0) {
  if (check.list(value, path, min)) value.forEach((item, i) => check.text(item, `${path}[${i}]`));
}

function checkChoiceList(check, value, allowed, path) {
  if (check.list(value, path, 1)) value.forEach((item, i) => check.oneOf(item, allowed, `${path}[${i}]`));
}

function checkTextFields(check, value, path, keys) {
  if (check.object(value, path)) keys.forEach((key) => check.text(value[key], `${path}.${key}`));
}

function checkRows(check, rows, path, keys, min = 0) {
  if (check.list(rows, path, min)) rows.forEach((row, i) => checkTextFields(check, row, `${path}[${i}]`, keys));
}

function checkShortText(check, value, path, maxChars) {
  if (check.text(value, path) && charCount(value) > maxChars) {
    check.fail(path, `超過 ${maxChars} 字（${charCount(value)} 字）`);
  }
}

function checkTodo(check, todo) {
  if (!check.list(todo, 'todo', 1)) return;
  todo.forEach((row, i) => {
    const path = `todo[${i}]`;
    if (!check.object(row, path)) return;
    check.text(row.when, `${path}.when`);
    checkShortText(check, row.task, `${path}.task`, MAX_TODO_TASK_CHARS);
    if (row.detail !== undefined) check.text(row.detail, `${path}.detail`);
  });
}

function checkSurvey(check, survey, path) {
  if (survey === null || survey === undefined || !check.object(survey, path)) return;
  if (check.text(survey.url, `${path}.url`) && !HTTPS_URL.test(survey.url)) {
    check.fail(`${path}.url`, '要是 https:// 開頭的網址');
  }
  if (check.text(survey.activityEntry, `${path}.activityEntry`) && !FORM_ENTRY.test(survey.activityEntry)) {
    check.fail(`${path}.activityEntry`, '要像 entry.123 這樣');
  }
}

function checkSurveys(check, surveys) {
  if (!check.object(surveys, 'surveys')) return;
  checkSurvey(check, surveys.participant, 'surveys.participant');
  checkSurvey(check, surveys.staff, 'surveys.staff');
  checkSurvey(check, surveys.report, 'surveys.report');
}

function checkIdentity(check, activity) {
  if (check.text(activity.id, 'id') && !isActivityId(activity.id)) {
    check.fail('id', '只能用小寫英文、數字和 -');
  }
  check.text(activity.name, 'name');
  check.text(activity.tagline, 'tagline');
  check.oneOf(activity.status, STATUSES, 'status');
  check.oneOf(activity.edition, EDITIONS, 'edition');
  checkChoiceList(check, activity.templates, TEMPLATES, 'templates');
  const { order } = activity;
  if (!(Number.isInteger(order) && order >= 1 && order <= MAX_ORDER)) {
    check.fail('order', `要是 1–${MAX_ORDER} 的整數`);
  }
}

function checkTags(check, tags) {
  if (!check.object(tags, 'tags')) return;
  check.oneOf(tags.kids, Object.keys(KIDS), 'tags.kids');
  check.oneOf(tags.place, Object.keys(PLACE), 'tags.place');
  check.oneOf(tags.rain, Object.keys(RAIN), 'tags.rain');
  checkChoiceList(check, tags.slots, Object.keys(SLOTS), 'tags.slots');
  checkChoiceList(check, tags.interests, Object.keys(INTERESTS), 'tags.interests');
}

function checkRainNote(check, activity) {
  const rain = activity.tags?.rain;
  if (activity.rainNote !== undefined) check.text(activity.rainNote, 'rainNote');
  else if (rain !== undefined && rain !== 'ok') check.fail('rainNote', `必填（tags.rain 是 ${rain}）`);
}

function checkCard(check, card, path, { isStory, needsQuestionsOrNote }, firstPathOfCardId) {
  if (!check.object(card, path)) return;
  if (check.text(card.id, `${path}.id`)) {
    if (!isCardId(card.id)) check.fail(`${path}.id`, '只能用英文、數字和 -');
    else if (!firstPathOfCardId.has(card.id)) firstPathOfCardId.set(card.id, path);
    else check.fail(`${path}.id`, `${card.id} 跟 ${firstPathOfCardId.get(card.id)} 重複`);
  }
  check.text(card.title, `${path}.title`);
  if (card.group !== undefined) check.text(card.group, `${path}.group`);
  if (isStory || card.text !== undefined) check.text(card.text, `${path}.text`);
  if (isStory || card.source !== undefined) check.text(card.source, `${path}.source`);
  if (card.note !== undefined) checkTextFields(check, card.note, `${path}.note`, ['label', 'text']);
  if (card.reveal !== undefined) checkTextFields(check, card.reveal, `${path}.reveal`, ['lead', 'text', 'source']);
  const needsQuestions = needsQuestionsOrNote && card.note === undefined;
  if (needsQuestions || card.questions !== undefined) checkTextList(check, card.questions, `${path}.questions`, 1);
}

function checkThumbs(check, set, path) {
  if (!check.list(set.thumbs, `${path}.thumbs`)) return;
  if (set.thumbs.length > MAX_THUMBS) check.fail(`${path}.thumbs`, `最多 ${MAX_THUMBS} 個`);
  const ids = cardIdsOf(set);
  set.thumbs.forEach((cardId, i) => {
    if (!ids.has(cardId)) check.fail(`${path}.thumbs[${i}]`, `${cardId} 不在這組卡裡`);
  });
}

function checkCardSets(check, cardSets, published) {
  if (!check.object(cardSets, 'cardSets')) return;
  const firstPathOfCardId = new Map();
  for (const [key, set] of Object.entries(cardSets)) {
    const path = `cardSets.${key}`;
    if (!check.object(set, path)) continue;
    check.oneOf(set.kind, CARD_SET_KINDS, `${path}.kind`);
    check.text(set.label, `${path}.label`);
    if (check.list(set.cards, `${path}.cards`, 1)) {
      const isStory = set.kind === 'story';
      const rules = { isStory, needsQuestionsOrNote: isStory && published };
      set.cards.forEach((card, i) => checkCard(check, card, `${path}.cards[${i}]`, rules, firstPathOfCardId));
    }
    if (set.thumbs !== undefined) checkThumbs(check, set, path);
  }
}

function checkStepCards(check, step, path, cardSets) {
  if (step.cards !== undefined && check.list(step.cards, `${path}.cards`, 1)) {
    step.cards.forEach((key, i) => {
      if (!Object.hasOwn(cardSets, key)) check.fail(`${path}.cards[${i}]`, `${key} 不在 cardSets 裡`);
    });
  }
  if (step.cardIds === undefined) return;
  if (!Array.isArray(step.cards)) {
    check.fail(`${path}.cardIds`, '要跟 cards 一起用');
    return;
  }
  if (!check.list(step.cardIds, `${path}.cardIds`, 1)) return;
  const available = new Set(step.cards.flatMap((key) => [...cardIdsOf(cardSets[key])]));
  step.cardIds.forEach((cardId, i) => {
    if (!available.has(cardId)) check.fail(`${path}.cardIds[${i}]`, `${cardId} 不在這一步的卡片組裡`);
  });
}

const usesStoryCards = (step, cardSets) =>
  Array.isArray(step?.cards) && step.cards.some((key) => cardSets[key]?.kind === 'story');

function checkShowStoryQuestions(check, step, path, earlierSteps, cardSets) {
  if (step.showStoryQuestions === undefined) return;
  if (step.showStoryQuestions !== true) check.fail(`${path}.showStoryQuestions`, '只能是 true');
  else if (!earlierSteps.some((earlier) => usesStoryCards(earlier, cardSets))) {
    check.fail(`${path}.showStoryQuestions`, '前面要有一步用到故事卡');
  }
}

function checkReadAloud(check, readAloud, path) {
  if (typeof readAloud === 'string') {
    check.text(readAloud, path);
    return;
  }
  if (!isObject(readAloud)) {
    check.fail(path, '要是文字，或有 text 的物件');
    return;
  }
  Object.keys(readAloud)
    .filter((key) => !READ_ALOUD_KEYS.includes(key))
    .forEach((key) => check.fail(`${path}.${key}`, `只能有 ${READ_ALOUD_KEYS.join('、')}`));
  if (readAloud.label !== undefined) check.text(readAloud.label, `${path}.label`);
  check.text(readAloud.text, `${path}.text`);
  if (readAloud.source !== undefined) check.text(readAloud.source, `${path}.source`);
}

function checkStepTool(check, tool, path, hasIchiban) {
  if (tool === undefined || !check.oneOf(tool, STEP_TOOLS, path)) return;
  if (!hasIchiban) check.fail(path, '要先有 ichiban 設定');
}

function checkStep(check, step, path, { cardSets, hasIchiban, earlierSteps }) {
  if (!check.object(step, path)) return;
  check.text(step.time, `${path}.time`);
  if (step.minutes !== null && !(Number.isInteger(step.minutes) && step.minutes > 0)) {
    check.fail(`${path}.minutes`, '要是正整數，不計時填 null');
  }
  check.text(step.title, `${path}.title`);
  check.text(step.do, `${path}.do`);
  checkShortText(check, step.say, `${path}.say`, MAX_SAY_CHARS);
  checkStepCards(check, step, path, cardSets);
  if (step.readAloud !== undefined) checkReadAloud(check, step.readAloud, `${path}.readAloud`);
  if (step.routeStop !== undefined) check.oneOf(step.routeStop, ROUTE_STOPS, `${path}.routeStop`);
  if (step.routeLeg !== undefined) check.oneOf(step.routeLeg, ROUTE_LEGS, `${path}.routeLeg`);
  checkShowStoryQuestions(check, step, path, earlierSteps, cardSets);
  checkStepTool(check, step.tool, `${path}.tool`, hasIchiban);
}

function checkSteps(check, steps, { cardSets, hasIchiban }) {
  if (!check.list(steps, 'steps', 1)) return;
  const context = { cardSets: isObject(cardSets) ? cardSets : {}, hasIchiban };
  steps.forEach((step, i) => checkStep(check, step, `steps[${i}]`, { ...context, earlierSteps: steps.slice(0, i) }));
}

function checkIchiban(check, ichiban) {
  if (!check.object(ichiban, 'ichiban') || !check.object(ichiban.grades, 'ichiban.grades')) return;
  const { grades } = ichiban;
  const hasExactlyGrades =
    Object.keys(grades).length === GRADES.length && GRADES.every((grade) => Object.hasOwn(grades, grade));
  if (!hasExactlyGrades) {
    check.fail('ichiban.grades', `要剛好是 ${GRADES.join('、')} 這 ${GRADES.length} 個等級`);
    return;
  }
  const problem = countsProblem(grades);
  if (problem !== null) check.fail('ichiban.grades', ICHIBAN_COUNT_PROBLEMS[problem]);
}

function checkPlanFile(check, planFile, id) {
  const expected = `files/${id}-plan.pdf`;
  if (check.text(planFile, 'planFile') && isActivityId(id) && planFile !== expected) {
    check.fail('planFile', `要是 ${expected}`);
  }
}

function cardImageFiles(activityId, cardId, isStory) {
  const base = `cards/${activityId}/${cardId}`;
  const files = [`${base}.webp`, `${base}-thumb.webp`];
  return isStory ? [...files, `${base}-og.jpg`] : files;
}

function checkCardImages(check, activity, fileExists) {
  if (!isActivityId(activity.id) || !isObject(activity.cardSets)) return;
  for (const [key, set] of Object.entries(activity.cardSets)) {
    if (!isObject(set) || !Array.isArray(set.cards)) continue;
    set.cards.forEach((card, i) => {
      if (!isCardId(card?.id)) return;
      for (const file of cardImageFiles(activity.id, card.id, set.kind === 'story')) {
        if (!fileExists(file)) check.fail(`cardSets.${key}.cards[${i}]`, `找不到圖檔 ${file}`);
      }
    });
  }
}

function checkPdfFiles(check, activity, fileExists) {
  const checkExists = (file, path) => {
    if (isText(file) && !fileExists(file)) check.fail(path, `找不到檔案 ${file}`);
  };
  checkExists(activity.planFile, 'planFile');
  if (!Array.isArray(activity.printFiles)) return;
  activity.printFiles.forEach((row, i) => checkExists(row?.file, `printFiles[${i}].file`));
}

export function validateActivity(activity, { fileExists } = {}) {
  const check = createChecker(ownerOf(activity));
  if (!check.object(activity, 'activity')) return check.errors;
  checkIdentity(check, activity);

  const published = isPublished(activity);
  const shouldCheck = (key) => published || activity[key] !== undefined;

  if (shouldCheck('tags')) checkTags(check, activity.tags);
  checkRainNote(check, activity);
  if (shouldCheck('facts')) checkTextFields(check, activity.facts, 'facts', ['people', 'duration', 'place']);
  if (shouldCheck('provided')) checkRows(check, activity.provided, 'provided', ['item', 'qty'], 1);
  if (shouldCheck('todo')) checkTodo(check, activity.todo);
  if (shouldCheck('cardSets')) checkCardSets(check, activity.cardSets, published);
  if (shouldCheck('steps')) {
    checkSteps(check, activity.steps, { cardSets: activity.cardSets, hasIchiban: activity.ichiban !== undefined });
  }
  if (shouldCheck('firstTime')) checkTextList(check, activity.firstTime, 'firstTime', 1);
  if (shouldCheck('extra30')) checkTextList(check, activity.extra30, 'extra30');
  if (shouldCheck('planFile')) checkPlanFile(check, activity.planFile, activity.id);
  if (shouldCheck('preflight')) checkTextList(check, activity.preflight, 'preflight', 1);
  if (activity.printFiles !== undefined) checkRows(check, activity.printFiles, 'printFiles', ['label', 'file']);
  if (activity.flowTitle !== undefined) check.text(activity.flowTitle, 'flowTitle');
  if (activity.surveys !== undefined) checkSurveys(check, activity.surveys);
  if (activity.ichiban !== undefined) checkIchiban(check, activity.ichiban);
  if (published && fileExists) {
    checkCardImages(check, activity, fileExists);
    checkPdfFiles(check, activity, fileExists);
  }

  return check.errors;
}

export function validateSite(site) {
  const check = createChecker('site');
  if (!check.object(site, 'site')) return check.errors;
  check.text(site.title, 'title');
  if (check.text(site.baseUrl, 'baseUrl') && !(HTTPS_URL.test(site.baseUrl) && site.baseUrl.endsWith('/'))) {
    check.fail('baseUrl', '要是 https:// 開頭、/ 結尾');
  }
  checkSurveys(check, site.surveys);
  return check.errors;
}

function duplicateErrors(activities, key) {
  const firstOwnerOf = new Map();
  const errors = [];
  for (const activity of activities) {
    const value = activity?.[key];
    if (value === undefined) continue;
    const owner = ownerOf(activity);
    if (firstOwnerOf.has(value)) errors.push(`${owner}: ${key} ${value} 跟 ${firstOwnerOf.get(value)} 重複`);
    else firstOwnerOf.set(value, owner);
  }
  return errors;
}

function routeErrors(activities, routes) {
  const cityWalk = activities.find((activity) => activity?.id === CITY_WALK_ID);
  if (!routes || !isPublished(cityWalk)) return [];
  const storyCardIds = cardIdsOf(cityWalk.cardSets?.story);
  return routes.flatMap((route, i) => {
    const path = `routes[${route?.district ?? i}].stop1.storyCard`;
    const storyCard = route?.stop1?.storyCard;
    if (storyCard === null || storyCard === undefined) return [`${CITY_WALK_ID}: ${path} 沒有填`];
    if (!storyCardIds.has(storyCard)) return [`${CITY_WALK_ID}: ${path} ${storyCard} 不在 cardSets.story 裡`];
    return [];
  });
}

export function validateAll({ activities, site, routes }, opts = {}) {
  return [
    ...validateSite(site),
    ...activities.flatMap((activity) => validateActivity(activity, opts)),
    ...duplicateErrors(activities, 'id'),
    ...duplicateErrors(activities, 'order'),
    ...routeErrors(activities, routes),
  ];
}
