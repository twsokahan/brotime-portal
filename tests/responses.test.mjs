import { test } from 'node:test';
import assert from 'node:assert/strict';
import { districtWants, groupSessions, parseResponses, sessionStats, statsFor, taipeiDate } from '../apps-script/responses.mjs';

const HEADER = [
  '時間戳記', '今天參加的活動', '你所在的區', '今天有沒有人認真聽你說話？', '今天有沒有跟至少一個人變得更熟？',
  '這次活動跟你印象中的創價班活動比起來？', '下次類似的活動，你會想再來嗎？', '下一次，你想參加哪一種兄弟時光？',
  '今天有沒有一句話或一個瞬間留在心裡？（選填）',
];
const reply = (iso, activity, district, next = '', answers = ['有', '有', '很不一樣', '會']) =>
  [new Date(iso), activity, district, ...answers, next, '留在心裡的話'];

test('a reply belongs to the Taiwan date it was sent', () => {
  assert.equal(taipeiDate(Date.parse('2027-01-15T15:30:00Z')), '2027-01-15');
  assert.equal(taipeiDate(Date.parse('2027-01-15T16:30:00Z')), '2027-01-16');
});

test('columns are found by title, even reordered or slightly renamed', () => {
  const header = [HEADER[2], HEADER[0], HEADER[1], '今天有沒有人認真聽你說話', ...HEADER.slice(4)];
  const [parsed] = parseResponses([header, ['花蓮區', new Date('2027-01-15T02:00:00Z'), '城市散步', '普通', '有', '差不多', '會', '', '']]);
  assert.equal(parsed.district, '花蓮區');
  assert.equal(parsed.listened, '普通');
});

test('replies without a known district are skipped and a blank next question counts no votes', () => {
  const parsed = parseResponses([
    HEADER,
    reply('2027-01-15T02:00:00Z', '城市散步', ''),
    reply('2027-01-15T02:00:00Z', '城市散步', '火星區'),
    reply('2027-01-15T02:00:00Z', '巷口泡茶會', '花蓮區'),
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].activity, '巷口泡茶會');
  assert.deepEqual(parsed[0].next, []);
});

test('replies group by district, activity and Taiwan date, newest first', () => {
  const sessions = groupSessions(parseResponses([
    HEADER,
    reply('2027-01-08T02:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T03:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T02:00:00Z', '桌遊之夜', '花蓮區'),
  ]));
  assert.deepEqual(sessions.map((session) => session.id), ['2027-01-15|花蓮區|城市散步', '2027-01-15|花蓮區|桌遊之夜', '2027-01-08|花蓮區|城市散步']);
});

test('a session with fewer than 3 replies shows no numbers', () => {
  const [session] = groupSessions(parseResponses([
    HEADER,
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T03:00:00Z', '城市散步', '花蓮區'),
  ]));
  assert.deepEqual(sessionStats(session), {
    id: '2027-01-15|花蓮區|城市散步', date: '2027-01-15', district: '花蓮區', activity: '城市散步', responses: 2, enough: false,
  });
});

test('a session counts each choice and splits the next question on ", "', () => {
  const [session] = groupSessions(parseResponses([
    HEADER,
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區', '城市散步, 桌遊之夜'),
    reply('2027-01-15T02:01:00Z', '城市散步', '花蓮區', '城市散步', ['普通', '有', '差不多', '看時間']),
    reply('2027-01-15T02:02:00Z', '城市散步', '花蓮區', ''),
  ]));
  const stats = sessionStats(session);
  assert.deepEqual(stats.answers.listened, { 有: 2, 普通: 1 });
  assert.deepEqual(stats.next, [{ name: '城市散步', count: 2 }, { name: '桌遊之夜', count: 1 }]);
  assert.ok(!JSON.stringify(stats).includes('留在心裡的話'));
});

test('wants add up the latest 3 sessions of the district and leave the oldest out', () => {
  const rows = [HEADER];
  for (const [day, next] of [['01', '露營星空夜'], ['08', '桌遊之夜'], ['15', '桌遊之夜'], ['22', '城市散步']]) {
    for (const minute of ['00', '01']) rows.push(reply(`2027-01-${day}T02:${minute}:00Z`, '城市散步', '花蓮區', next));
  }
  assert.deepEqual(districtWants(groupSessions(parseResponses(rows)), ['花蓮區']), {
    sessions: 3, responses: 6, enough: true, top: [{ name: '桌遊之夜', count: 4 }, { name: '城市散步', count: 2 }],
  });
});

test('wants are not enough under 3 replies and null without sessions', () => {
  const sessions = groupSessions(parseResponses([HEADER, reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區', '桌遊之夜')]));
  assert.deepEqual(districtWants(sessions, ['花蓮區']), { sessions: 1, responses: 1, enough: false });
  assert.equal(districtWants(sessions, ['台東區']), null);
});

test('stats show a district only its own sessions, give wants to district and circle levels, and nothing to none', () => {
  const sessions = groupSessions(parseResponses([
    HEADER,
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T02:00:00Z', '城市散步', '台東區'),
  ]));
  const district = statsFor({ level: 'district', label: '花蓮區', districts: ['花蓮區'] }, sessions);
  assert.deepEqual(district.sessions.map((session) => session.district), ['花蓮區']);
  assert.notEqual(district.wants, null);
  assert.equal(statsFor({ level: 'all', label: '全部', districts: ['花蓮區', '台東區'] }, sessions).wants, null);
  assert.deepEqual(statsFor({ level: 'none', label: '', districts: [] }, sessions), { wants: null, sessions: [] });
});

test('a row whose time cannot be read or whose activity is blank is skipped instead of breaking the stats', () => {
  const parsed = parseResponses([
    HEADER,
    ['2027/1/15 下午 3:00:00', '城市散步', '花蓮區', '有', '有', '很不一樣', '會', '', ''],
    reply('2027-01-15T02:00:00Z', '', '花蓮區'),
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'),
  ]);
  assert.deepEqual(parsed.map((response) => response.activity), ['城市散步']);
});
