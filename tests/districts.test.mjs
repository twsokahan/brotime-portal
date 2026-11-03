import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, resolveCircle, resolveDistrict } from '../apps-script/districts.mjs';

test('a district resolves from its full name, without 區, from an abbreviation and from an island short name', () => {
  assert.equal(resolveDistrict('花蓮區'), '花蓮區');
  assert.equal(resolveDistrict(' 花蓮 '), '花蓮區');
  assert.equal(resolveDistrict('北東'), '台北東區');
  assert.equal(resolveDistrict('高北'), '高雄北區');
  assert.equal(resolveDistrict('金門'), '金門（總合本部）');
  assert.equal(resolveDistrict('馬祖（基宜圈）'), '馬祖（基宜圈）');
});

test('role text, blanks and unknown names are not districts', () => {
  for (const text of ['圈負責人', '創價班總合長', '', undefined, '台北區']) assert.equal(resolveDistrict(text), null);
});

test('a circle resolves with or without 圈 and line breaks, only when the roster knows it', () => {
  const circles = { 花東圈: ['花蓮區', '台東區'], 桃園一圈: ['桃園北區', '桃園東區'] };
  assert.equal(resolveCircle('花東', circles), '花東圈');
  assert.equal(resolveCircle('桃園\n一圈', circles), '桃園一圈');
  assert.equal(resolveCircle('桃園圈', circles), null);
});

test('the district list follows the survey forms', () => {
  assert.equal(DISTRICTS.length, 61);
  assert.equal(DISTRICTS[0], '花蓮區');
  assert.equal(DISTRICTS.at(-1), '澎湖（南二圈）');
});
