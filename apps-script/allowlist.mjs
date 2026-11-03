import { DISTRICTS, normalizePlace, resolveCircle, resolveDistrict } from './districts.mjs';

export const NONE_SCOPE = { level: 'none', label: '', districts: [] };
const ALL_SCOPE = { level: 'all', label: '全部', districts: DISTRICTS };
const LEVEL_RANK = { none: 0, district: 1, circle: 2, all: 3 };
const districtScope = (district) => ({ level: 'district', label: district, districts: [district] });
const circleScope = (circle, circles) => ({ level: 'circle', label: circle, districts: circles[circle] });

export const SUPPLEMENT_HEADERS = ['信箱', '名字', '區', '加的人', '加的日期'];

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;

export function extractEmails(cell) {
  const text = String(cell ?? '').replace(/＠/g, '@').toLowerCase();
  return (text.match(EMAIL_PATTERN) ?? []).map((email) => email.replace(/@gmail\.com\.tw$/, '@gmail.com'));
}

const columnOf = (header, name) => header.findIndex((cell) => normalizePlace(cell) === normalizePlace(name));
const findHeaderRow = (rows, names) => rows.findIndex((row) => names.every((name) => columnOf(row, name) >= 0));
const cellText = (row, column) => String(row[column] ?? '').trim();

// The roster writes 圈別 once, on the circle leader's row; the district rows below it belong to that circle.
function rosterRows(rows) {
  const headerIndex = findHeaderRow(rows, ['區別', '電子信箱']);
  if (headerIndex < 0) return [];
  const [circleColumn, districtColumn, emailColumn] = ['圈別', '區別', '電子信箱'].map((name) => columnOf(rows[headerIndex], name));
  let circle = '';
  return rows.slice(headerIndex + 1).map((row) => {
    circle = normalizePlace(row[circleColumn]) || circle;
    return { circle, district: resolveDistrict(row[districtColumn]), emails: extractEmails(row[emailColumn]) };
  });
}

export function parseRoster(rows) {
  const parsed = rosterRows(rows);
  const circles = {};
  for (const { circle, district } of parsed) {
    if (!circle || !district) continue;
    circles[circle] ??= [];
    if (!circles[circle].includes(district)) circles[circle].push(district);
  }
  const scopeOf = ({ circle, district }) => {
    if (circle.includes('企劃組')) return ALL_SCOPE;
    if (district) return districtScope(district);
    if (Object.hasOwn(circles, circle)) return circleScope(circle, circles);
    return NONE_SCOPE;
  };
  const entries = parsed.flatMap((row) => row.emails.map((email) => ({ email, scope: scopeOf(row) })));
  return { entries, circles };
}

function cadreRows(rows, headers) {
  const headerIndex = findHeaderRow(rows, [headers.emails[0]]);
  if (headerIndex < 0) return [];
  const header = rows[headerIndex];
  const circleColumn = columnOf(header, headers.circle);
  const districtColumn = columnOf(header, headers.district);
  const emailColumns = headers.emails.map((name) => columnOf(header, name)).filter((column) => column >= 0);
  return rows.slice(headerIndex + 1).map((row) => ({
    circleText: normalizePlace(row[circleColumn]),
    districtText: normalizePlace(row[districtColumn]),
    emails: emailColumns.flatMap((column) => extractEmails(row[column])),
  }));
}

function cadreScope({ circleText, districtText }, circles) {
  const district = resolveDistrict(districtText);
  if (district) return districtScope(district);
  const circle = resolveCircle(circleText, circles);
  if (circle) return circleScope(circle, circles);
  if (`${circleText}${districtText}`.includes('總部')) return ALL_SCOPE;
  return NONE_SCOPE;
}

export function parseCadres(rows, circles, headers) {
  return cadreRows(rows, headers).flatMap((row) => {
    const scope = cadreScope(row, circles);
    return row.emails.map((email) => ({ email, scope }));
  });
}

export function unresolvedPlaces(rows, circles, headers) {
  const places = cadreRows(rows, headers)
    .filter((row) => (row.circleText || row.districtText) && cadreScope(row, circles).level === 'none')
    .map((row) => `${row.circleText}｜${row.districtText}`);
  return [...new Set(places)].sort();
}

export function parseSupplement(rows) {
  const [header = [], ...body] = rows;
  const [emailColumn, nameColumn, districtColumn, addedByColumn, addedOnColumn] = SUPPLEMENT_HEADERS.map((name) => columnOf(header, name));
  return body.flatMap((row) => {
    const [email] = extractEmails(row[emailColumn]);
    const district = cellText(row, districtColumn);
    if (!email || !DISTRICTS.includes(district)) return [];
    return [{ email, name: cellText(row, nameColumn), district, addedBy: cellText(row, addedByColumn), addedOn: cellText(row, addedOnColumn) }];
  });
}

function widerScope(a, b) {
  if (LEVEL_RANK[a.level] !== LEVEL_RANK[b.level]) return LEVEL_RANK[a.level] > LEVEL_RANK[b.level] ? a : b;
  if (a.level === 'none' || a.level === 'all') return a;
  return {
    level: a.level,
    label: [...new Set([...a.label.split('、'), ...b.label.split('、')])].join('、'),
    districts: [...new Set([...a.districts, ...b.districts])],
  };
}

export function mergeAllowlist(lists) {
  const merged = {};
  for (const { email, scope } of lists.flat()) {
    merged[email] = Object.hasOwn(merged, email) ? widerScope(merged[email], scope) : scope;
  }
  return merged;
}
