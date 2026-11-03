export const SEASON_TITLE = '這一季主打';

const twoDigits = (number) => String(number).padStart(2, '0');
const utcIsoDate = (date) => `${date.getUTCFullYear()}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCDate())}`;

function yearAndMonth(isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  return { year, month };
}

function firstDayOfMonthBefore(isoDate) {
  const { year, month } = yearAndMonth(isoDate);
  return utcIsoDate(new Date(Date.UTC(year, month - 2, 1)));
}

function lastDayOfMonthBefore(isoDate) {
  const { year, month } = yearAndMonth(isoDate);
  return utcIsoDate(new Date(Date.UTC(year, month - 1, 0)));
}

export function isLastDayOfMonth(isoDate) {
  const { year, month } = yearAndMonth(isoDate);
  return utcIsoDate(new Date(Date.UTC(year, month, 0))) === isoDate;
}

// The entry page asks about next month, so a push shows from the month before it starts until it ends.
export const pushWindow = ({ from, to }) => ({ from: firstDayOfMonthBefore(from), to });

// A season shows while next month falls inside it.
export const seasonWindow = ({ from, to }) => ({ from: firstDayOfMonthBefore(from), to: lastDayOfMonthBefore(to) });

export const isShowing = (window, today) => window.from <= today && today <= window.to;

export const localIsoDate = (date = new Date()) =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

export const taipeiIsoDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(date);
