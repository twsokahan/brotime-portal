import { DISTRICTS } from './districts.mjs';

export const RECENT_SESSIONS = 3;
export const TOP_WANTS = 3;
// A reply sent up to this many days after a session's first reply still belongs to that session.
const SAME_SESSION_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

// A column belongs to a key when its question title contains the fragment, so small rewordings keep working.
// The "留在心裡" question is deliberately absent: it never leaves the response sheet.
export const PARTICIPANT_COLUMNS = {
  timestamp: '時間戳記',
  activity: '今天參加的活動',
  district: '你所在的區',
  listened: '認真聽你說話',
  closer: '變得更熟',
  different: '創價班活動比起來',
  again: '會想再來嗎',
  next: '下一次，你想參加哪一種',
};
const ANSWER_KEYS = ['listened', 'closer', 'different', 'again'];
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const participantColumns = (header) =>
  Object.fromEntries(
    Object.entries(PARTICIPANT_COLUMNS).map(([key, fragment]) => [key, header.findIndex((cell) => String(cell).includes(fragment))]),
  );

export function isParticipantHeader(header) {
  const columns = participantColumns(header);
  return columns.activity >= 0 && columns.district >= 0;
}

export const taipeiDate = (ms) => new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);

const timeOf = (value) => (value instanceof Date ? value.getTime() : Number(value));
const answerAt = (row, column) => (column >= 0 ? String(row[column] ?? '').trim() : '');

export function parseResponses(rows) {
  const [header = [], ...body] = rows;
  const columns = participantColumns(header);
  return body.flatMap((row) => {
    const time = timeOf(row[columns.timestamp]);
    const activity = answerAt(row, columns.activity);
    const district = answerAt(row, columns.district);
    if (!Number.isFinite(time) || !activity || !DISTRICTS.includes(district)) return [];
    return [{
      date: taipeiDate(time),
      activity,
      district,
      listened: answerAt(row, columns.listened),
      closer: answerAt(row, columns.closer),
      different: answerAt(row, columns.different),
      again: answerAt(row, columns.again),
      next: answerAt(row, columns.next).split(', ').map((name) => name.trim()).filter(Boolean),
    }];
  });
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const newestFirst = (a, b) =>
  compareText(b.date, a.date) || DISTRICTS.indexOf(a.district) - DISTRICTS.indexOf(b.district) || compareText(a.activity, b.activity);

const daysBetween = (fromIsoDate, toIsoDate) => (Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / DAY_MS;

export function groupSessions(responses) {
  const latestByPlace = new Map();
  const sessions = [];
  for (const response of [...responses].sort((a, b) => compareText(a.date, b.date))) {
    const place = `${response.district}|${response.activity}`;
    let session = latestByPlace.get(place);
    if (!session || daysBetween(session.date, response.date) > SAME_SESSION_DAYS) {
      session = { id: `${response.date}|${place}`, date: response.date, district: response.district, activity: response.activity, responses: [] };
      latestByPlace.set(place, session);
      sessions.push(session);
    }
    session.responses.push(response);
  }
  return sessions.sort(newestFirst);
}

function ranked(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || compareText(a.name, b.name));
}

function countChoices(responses, key) {
  const counts = {};
  for (const response of responses) {
    if (response[key]) counts[response[key]] = (counts[response[key]] ?? 0) + 1;
  }
  return counts;
}

export function sessionStats({ id, date, district, activity, responses }) {
  return {
    id,
    date,
    district,
    activity,
    responses: responses.length,
    answers: Object.fromEntries(ANSWER_KEYS.map((key) => [key, countChoices(responses, key)])),
    next: ranked(responses.flatMap((response) => response.next)),
  };
}

// sessions must be newest first, as groupSessions returns them.
export function districtWants(sessions, districts) {
  const recent = districts.flatMap((district) => sessions.filter((session) => session.district === district).slice(0, RECENT_SESSIONS));
  if (!recent.length) return null;
  const responses = recent.flatMap((session) => session.responses);
  return { sessions: recent.length, responses: responses.length, top: ranked(responses.flatMap((response) => response.next)).slice(0, TOP_WANTS) };
}

export function statsFor(scope, sessions) {
  const visible = sessions.filter((session) => scope.districts.includes(session.district));
  const wants = scope.level === 'district' || scope.level === 'circle' ? districtWants(sessions, scope.districts) : null;
  return { wants, sessions: visible.map(sessionStats) };
}
