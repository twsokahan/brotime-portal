export const STATS_PATH = 'stats/';
export const SESSION_PATH = 'stats/session/';
export const HOSTS_PATH = 'hosts/';

export const ANSWER_ROWS = [
  { key: 'listened', label: '今天有沒有人認真聽你說話？', choices: ['有', '普通', '沒有'] },
  { key: 'closer', label: '今天有沒有跟至少一個人變得更熟？', choices: ['有', '普通', '沒有'] },
  { key: 'different', label: '跟印象中的創價班比起來？', choices: ['很不一樣', '有點不一樣', '差不多'] },
  { key: 'again', label: '下次還會想再來嗎？', choices: ['會', '看時間', '不會'] },
];

export const NOT_ENOUGH_TEXT = '回覆還不夠（少於 3 份），先不列出來，免得認出是誰填的。';
export const WANTS_NOT_ENOUGH_TEXT = '問卷回覆還不夠，再多幾場就看得到。';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function shortDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${month}/${day}（${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}）`;
}

export const wantsHeading = (level) => (level === 'circle' ? '你們圈的人想約' : '你們區的人想約');

export const wantsCaption = ({ sessions, responses }) => `根據最近 ${sessions} 場、共 ${responses} 份問卷`;

export const choiceCounts = (counts, choices) => choices.map((choice) => ({ choice, count: counts[choice] ?? 0 }));

export function activityHref(name, idsByName, rel) {
  const id = Object.prototype.hasOwnProperty.call(idsByName, name) ? idsByName[name] : null;
  return id ? `${rel}a/${id}/` : null;
}
