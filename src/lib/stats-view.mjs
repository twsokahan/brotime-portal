export const STATS_PATH = 'stats/';
export const SESSION_PATH = 'stats/session/';

export const ANSWER_ROWS = [
  { key: 'listened', label: '今天有沒有人認真聽你說話？', choices: ['有', '普通', '沒有'] },
  { key: 'closer', label: '今天有沒有跟至少一個人變得更熟？', choices: ['有', '普通', '沒有'] },
  { key: 'different', label: '跟印象中的創價班比起來？', choices: ['很不一樣', '有點不一樣', '差不多'] },
  { key: 'again', label: '下次還會想再來嗎？', choices: ['會', '看時間', '不會'] },
];

const CARD_LABELS = { listened: '有人認真聽他說話', closer: '跟人變熟了', again: '下次還想來' };
export const CARD_ROWS = ANSWER_ROWS.filter(({ key }) => key in CARD_LABELS).map(({ key, choices }) => ({ key, label: CARD_LABELS[key], choices }));

export const EMPTY_TEXT = '還沒有問卷回覆。主持人用當天模式帶完一場，最後一步請大家掃問卷 QR，填完的那一場就會出現在這裡。';

export const SAMPLE_SESSION = Object.freeze({
  id: 'sample',
  date: '2026-11-14',
  district: '',
  activity: '男人的廚房',
  responses: 5,
  answers: {
    listened: { 有: 4, 普通: 1 },
    closer: { 有: 3, 普通: 2 },
    different: { 很不一樣: 2, 有點不一樣: 2, 差不多: 1 },
    again: { 會: 4, 看時間: 1 },
  },
  next: [],
});

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function dateNumbers(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { month, day, weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
}

export function dayParts(isoDate) {
  const { month, day, weekday } = dateNumbers(isoDate);
  return { day: `${month}/${day}`, weekday: `週${weekday}` };
}

export const reviewTitle = (scope) => (scope.level === 'all' ? '全台的回顧' : `${scope.label}的回顧`);

export const summaryLine = (sessions) =>
  `共 ${sessions.length} 場、${sessions.reduce((total, session) => total + session.responses, 0)} 份參加者問卷`;

export const districtsWithSessions = (sessions, districts) =>
  districts.filter((district) => sessions.some((session) => session.district === district));

export const personDots = (counts, choices) =>
  counts ? choices.flatMap((choice, index) => Array(counts[choice] ?? 0).fill(index)) : [];

export const wantsHeading = (level) => (level === 'circle' ? '你們圈的人想約' : '你們區的人想約');

export const wantsCaption = ({ sessions, responses }) => `根據最近 ${sessions} 場、共 ${responses} 份問卷`;

export const choiceCounts = (counts, choices) => choices.map((choice) => ({ choice, count: counts[choice] ?? 0 }));

const indexEntry = (name, index) => (Object.prototype.hasOwnProperty.call(index, name) ? index[name] : null);

export function activityHref(name, index, rel) {
  const entry = indexEntry(name, index);
  return entry ? `${rel}a/${entry.id}/` : null;
}

export function activityCover(name, index, rel) {
  const cover = indexEntry(name, index)?.cover;
  return cover ? `${rel}${cover}` : null;
}
