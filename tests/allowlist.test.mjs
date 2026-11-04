import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalEmail,
  extractEmails,
  mergeAllowlist,
  NONE_SCOPE,
  parseCadres,
  parseRoster,
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
const CADRE_HEADERS = { title: '職務', emails: ['E-mail(1)', 'E-mail(2)'] };
const CADRES = [
  ['ㄑ', '職務', '', '姓名', '聯絡電話', '電子信箱', '', 'Remark'],
  ['', '', '', '', '', 'E-mail(1)', 'E-mail(2)', ''],
  ['總合', '男子部長', '', '甲', '', 'hq@gmail.com', '', ''],
  ['', '副男子部長', '', '乙', '', 'hq.deputy@gmail.com', '', ''],
  ['花東圈', '圈男', '', '丙', '', 'TWO@gmail.com', 'two.alt@gmail.com', ''],
  ['', '花蓮', '區總合', '丁', '', 'one@gmail.com', '', ''],
  ['', '', '區男', '戊', '', 'one.deputy@gmail.com', '', ''],
  ['北一圈', '圈總合長     ', '', '己', '', 'north@gmail.com', '', ''],
  ['', '北東', '區男', '庚', '', 'four@gmail.com', '', ''],
  ['', '', '副區\t', '辛', '', 'four.deputy@gmail.com', '', ''],
  ['火星圈', '圈男', '', '壬', '', 'five@gmail.com', '', ''],
  ['', '火星', '區男', '癸', '', 'six@gmail.com', '', ''],
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

test('cadres carry the circle and district down, read the district from the title column, and count both email columns', () => {
  const circles = { ...CIRCLES, 北一圈: ['汐止區', '內湖區', '台北東區'] };
  const entries = parseCadres(CADRES, circles, CADRE_HEADERS);
  assert.equal(levelOf(entries, 'hq@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'hq.deputy@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'two@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'two.alt@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'one@gmail.com').label, '花蓮區');
  assert.equal(levelOf(entries, 'one.deputy@gmail.com').label, '花蓮區');
  assert.equal(levelOf(entries, 'north@gmail.com').label, '北一圈');
  assert.equal(levelOf(entries, 'four@gmail.com').label, '台北東區');
  assert.equal(levelOf(entries, 'four.deputy@gmail.com').label, '台北東區');
  assert.equal(levelOf(entries, 'five@gmail.com').level, 'none');
  assert.equal(entries.length, 11);
  assert.deepEqual(unresolvedPlaces(CADRES, circles, CADRE_HEADERS), ['火星圈｜', '火星圈｜火星']);
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

test('people who can see no district are left off the merged list', () => {
  const district = (name) => ({ level: 'district', label: name, districts: [name] });
  const merged = mergeAllowlist([
    [{ email: 'nobody@gmail.com', scope: NONE_SCOPE }, { email: 'both@gmail.com', scope: NONE_SCOPE }],
    [{ email: 'hualien@gmail.com', scope: district('花蓮區') }, { email: 'both@gmail.com', scope: district('台東區') }],
  ]);
  assert.deepEqual(Object.keys(merged).sort(), ['both@gmail.com', 'hualien@gmail.com']);
  assert.deepEqual(merged['both@gmail.com'], district('台東區'));
});

test('Gmail addresses match whatever dots or +tag the list used, other domains stay as written', () => {
  assert.equal(canonicalEmail('hua.lien+brotime@gmail.com'), 'hualien@gmail.com');
  assert.equal(canonicalEmail('a.b@g.ntu.edu.tw'), 'a.b@g.ntu.edu.tw');
  const merged = mergeAllowlist([[{ email: 'hua.lien@gmail.com', scope: { level: 'district', label: '花蓮區', districts: ['花蓮區'] } }]]);
  assert.equal(merged['hualien@gmail.com'].label, '花蓮區');
});
