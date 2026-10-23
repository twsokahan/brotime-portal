import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathLength, pointAlong } from '../src/lib/geo.mjs';

const path = [
  [25, 121],
  [25, 121.004],
];

test('a path is as long as the sum of its pieces', () => {
  const half = [
    [25, 121],
    [25, 121.002],
  ];
  assert.ok(Math.abs(pathLength(path) - 2 * pathLength(half)) < 1e-6);
  assert.ok(pathLength(path) > 400 && pathLength(path) < 410);
});

test('a point halfway along the path sits in the middle', () => {
  const [lat, lon] = pointAlong(path, pathLength(path) / 2);
  assert.ok(Math.abs(lat - 25) < 1e-9 && Math.abs(lon - 121.002) < 1e-9);
});

test('a point outside the path stays at its ends', () => {
  assert.deepEqual(pointAlong(path, -5), [25, 121]);
  assert.deepEqual(pointAlong(path, 99999), [25, 121.004]);
});
