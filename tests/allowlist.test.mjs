import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmails,
  mergeAllowlist,
  NONE_SCOPE,
  parseCadres,
  parseRoster,
  parseSupplement,
  SUPPLEMENT_HEADERS,
  unresolvedPlaces,
} from '../apps-script/allowlist.mjs';

const ROSTER = [
  [],
  ['圈別', '區別', '職務', '姓名', '連絡電話', '電子信箱'],
  [],
  ['創價班\n企劃組', '創價班總合長', '', '甲', '', 'Plan.Lead@Gmail.com'],
  ['', '創價班企劃長', '', '乙', '', '事務長信箱  plan2@gmail.com'],
  ['花東圈', '圈負責人', '', '丙', '', 'circle＠gmail.com'],
  ['', '花蓮區', '區負責人', '丁', '', 'hualien@gmail.com.tw'],
  ['', '台東區', '區負責人', '戊', '', ''],
  ['板城圈', '圈負責人', '', '己', '', 'bancheng@gmail.com（主）'],
  ['', '板橋區', '區負責人', '庚', '', 'banqiao@yahoo.com.tw'],
];
const CIRCLES = { 花東圈: ['花蓮區', '台東區'], 板城圈: ['板橋區'] };
const CADRE_HEADERS = { circle: '圈', district: '區', emails: ['E-mail(1)', 'E-mail(2)'] };
const CADRES = [
  ['男子部幹部名單'],
  ['姓名', '職務', '圈', '區', 'E-mail(1)', 'E-mail(2)', '備註'],
  ['甲', '區長', '花東', '花蓮', 'one@gmail.com', '', ''],
  ['乙', '圈長', '花東', '', 'TWO@gmail.com', 'two.alt@gmail.com', ''],
  ['丙', '部長', '總部', '', 'hq@gmail.com', '', ''],
  ['丁', '區長', '北一', '北東', 'four@gmail.com', '', ''],
  ['戊', '區長', '火星圈', '火星', 'five@gmail.com', '', ''],
];
const levelOf = (entries, email) => entries.find((entry) => entry.email === email)?.scope;

test('emails come out of cells with notes, full-width ＠, capitals and the gmail.com.tw typo', () => {
  assert.deepEqual(extractEmails('事務長信箱  A.B@Gmail.com'), ['a.b@gmail.com']);
  assert.deepEqual(extractEmails('x＠gmail.com（主）'), ['x@gmail.com']);
  assert.deepEqual(extractEmails('y@gmail.com.tw'), ['y@gmail.com']);
  assert.deepEqual(extractEmails('a@g.ntu.edu.tw / b@gs.ncku.edu.tw'), ['a@g.ntu.edu.tw', 'b@gs.ncku.edu.tw']);
  assert.deepEqual(extractEmails(''), []);
});

test('the roster carries each circle down to its districts', () => {
  assert.deepEqual(parseRoster(ROSTER).circles, CIRCLES);
});

test('roster rows get the planning team, circle and district scopes', () => {
  const { entries } = parseRoster(ROSTER);
  assert.equal(levelOf(entries, 'plan.lead@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'plan2@gmail.com').level, 'all');
  assert.deepEqual(levelOf(entries, 'circle@gmail.com'), { level: 'circle', label: '花東圈', districts: ['花蓮區', '台東區'] });
  assert.deepEqual(levelOf(entries, 'hualien@gmail.com'), { level: 'district', label: '花蓮區', districts: ['花蓮區'] });
  assert.equal(levelOf(entries, 'bancheng@gmail.com').label, '板城圈');
  assert.equal(levelOf(entries, 'banqiao@yahoo.com.tw').label, '板橋區');
  assert.equal(entries.length, 6);
});

test('cadres resolve short circle names, abbreviations and headquarters, and count both email columns', () => {
  const circles = { ...CIRCLES, 北一圈: ['汐止區', '內湖區', '台北東區'] };
  const entries = parseCadres(CADRES, circles, CADRE_HEADERS);
  assert.equal(levelOf(entries, 'one@gmail.com').label, '花蓮區');
  assert.equal(levelOf(entries, 'two@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'two.alt@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'hq@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'four@gmail.com').label, '台北東區');
  assert.equal(levelOf(entries, 'five@gmail.com').level, 'none');
  assert.deepEqual(unresolvedPlaces(CADRES, circles, CADRE_HEADERS), ['火星圈｜火星']);
});

test('the supplement skips rows without an email or a known district', () => {
  const rows = [
    SUPPLEMENT_HEADERS,
    ['new@gmail.com', '小明', '花蓮區', 'hualien@gmail.com', '2027-01-15'],
    ['', '', '花蓮區', '', ''],
    ['x@gmail.com', '', '火星區', '', ''],
  ];
  assert.deepEqual(parseSupplement(rows), [
    { email: 'new@gmail.com', name: '小明', district: '花蓮區', addedBy: 'hualien@gmail.com', addedOn: '2027-01-15' },
  ]);
});

test('merging keeps the widest scope and joins districts at the same level', () => {
  const district = (name) => ({ level: 'district', label: name, districts: [name] });
  const merged = mergeAllowlist([
    [{ email: 'a@gmail.com', scope: district('花蓮區') }, { email: 'b@gmail.com', scope: district('花蓮區') }],
    [{ email: 'a@gmail.com', scope: NONE_SCOPE }, { email: 'b@gmail.com', scope: district('台東區') }],
  ]);
  assert.deepEqual(merged['a@gmail.com'], district('花蓮區'));
  assert.deepEqual(merged['b@gmail.com'], { level: 'district', label: '花蓮區、台東區', districts: ['花蓮區', '台東區'] });
});
