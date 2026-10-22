import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoTearAt,
  centredShift,
  clipHalfPlane,
  finishAt,
  foldSegment,
  keepFlapInView,
  limitPull,
  peelLayout,
  peeledFraction,
} from '../src/lib/peel.mjs';

const SIZE = Object.freeze({ length: 236, height: 98 });
const TAB = Object.freeze([0, SIZE.height / 2]);
const OPEN = Object.freeze([2 * SIZE.length, SIZE.height / 2]);
const STRIP = Object.freeze({ left: 0, top: 0, right: SIZE.length, bottom: SIZE.height });
const LIMITS = Object.freeze({ maxAngle: Math.PI / 3, maxLength: 2 * SIZE.length + 40 });
const SQUARE = Object.freeze([
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]);

const degrees = (radians) => (radians * 180) / Math.PI;
const angleOf = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const distance = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

function area(polygon) {
  const twice = polygon.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = polygon[(i + 1) % polygon.length];
    return sum + x * nextY - nextX * y;
  }, 0);
  return Math.abs(twice) / 2;
}

function assertNear(actual, expected, message, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function assertPointNear(actual, expected, message, tolerance = 1e-9) {
  assertNear(actual[0], expected[0], `${message} x`, tolerance);
  assertNear(actual[1], expected[1], `${message} y`, tolerance);
}

function placeOnStrip({ left, origin, rotation }, [u, y]) {
  const pivot = [origin[0] + left, origin[1]];
  const [dx, dy] = [u + left - pivot[0], y - pivot[1]];
  return [
    pivot[0] + dx * Math.cos(rotation) - dy * Math.sin(rotation),
    pivot[1] + dx * Math.sin(rotation) + dy * Math.cos(rotation),
  ];
}

const backFacePointOf = ([x, y]) => [SIZE.length - x, y];

function* samplePulls() {
  for (let angle = -90; angle <= 90; angle += 5) {
    for (const length of [3, 10, 40, 90, 160, 240, 320, 420, 600]) {
      const radians = (angle * Math.PI) / 180;
      yield [TAB[0] + length * Math.cos(radians), TAB[1] + length * Math.sin(radians)];
    }
  }
  yield [1, -140];
  yield [1, SIZE.height + 80];
  yield [0.01, -2000];
}

test('limitPull leaves a pull inside the limits alone', () => {
  assert.deepEqual(limitPull(TAB, [120, 20], LIMITS), [120, 20]);
});

test('limitPull clamps a steep pull to 60 degrees from horizontal, keeping its length', () => {
  for (const target of [
    [5, -200],
    [5, 300],
    [0.001, -140],
  ]) {
    const limited = limitPull(TAB, target, LIMITS);
    assertNear(Math.abs(degrees(angleOf(TAB, limited))), 60, `angle for ${target}`, 1e-6);
    assertNear(distance(TAB, limited), distance(TAB, target), `length for ${target}`, 1e-6);
    assert.equal(Math.sign(limited[1] - TAB[1]), Math.sign(target[1] - TAB[1]));
  }
});

test('limitPull gives no peel for a leftward pull or a pull straight up or down', () => {
  for (const target of [
    [-80, TAB[1]],
    [-10, -60],
    [TAB[0], -120],
    [TAB[0], 200],
  ]) {
    assert.deepEqual(limitPull(TAB, target, LIMITS), [...TAB], `target ${target}`);
  }
});

test('limitPull caps the pull length', () => {
  const limited = limitPull(TAB, [2000, TAB[1]], LIMITS);
  assertPointNear(limited, [LIMITS.maxLength, TAB[1]], 'capped point');
});

test('limitPull returns a new point instead of the tab point itself', () => {
  assert.notEqual(limitPull(TAB, [-5, 0], LIMITS), TAB);
});

test('clipHalfPlane keeps the side the normal points to, or the other side', () => {
  const right = clipHalfPlane(SQUARE, [4, 0], [1, 0], true);
  const left = clipHalfPlane(SQUARE, [4, 0], [1, 0], false);
  assert.equal(area(right), 60);
  assert.equal(area(left), 40);
  assert.ok(right.every(([x]) => x >= 4));
  assert.ok(left.every(([x]) => x <= 4));
});

test('clipHalfPlane returns the whole polygon or nothing when the line misses it', () => {
  assert.deepEqual(clipHalfPlane(SQUARE, [-5, 0], [1, 0], true), SQUARE);
  assert.deepEqual(clipHalfPlane(SQUARE, [-5, 0], [1, 0], false), []);
});

test('clipHalfPlane cuts a corner along a diagonal line', () => {
  const corner = clipHalfPlane(SQUARE, [5, 0], [1, 1], false);
  assert.equal(area(corner), 12.5);
});

test('foldSegment returns the part of the fold line inside the rectangle', () => {
  assert.deepEqual(foldSegment([50, 49], [0, 1], STRIP), [
    [50, 0],
    [50, 98],
  ]);
  const diagonal = foldSegment([118, 49], [-Math.SQRT1_2, Math.SQRT1_2], STRIP);
  assertPointNear(diagonal[0], [167, 0], 'diagonal start');
  assertPointNear(diagonal[1], [69, 98], 'diagonal end');
});

test('foldSegment returns null when the fold line misses the rectangle or barely touches it', () => {
  assert.equal(foldSegment([300, 49], [0, 1], STRIP), null);
  assert.equal(foldSegment([50, 200], [1, 0], STRIP), null);
  assert.equal(foldSegment([-0.2, -0.2], [Math.SQRT1_2, -Math.SQRT1_2], STRIP), null);
  assert.equal(foldSegment([0, 0], [Math.SQRT1_2, -Math.SQRT1_2], STRIP), null);
});

test('the fold line across the paper stays inside the strip for every pull, steep and vertical ones included', () => {
  const diagonal = Math.hypot(SIZE.length, SIZE.height);
  for (const target of samplePulls()) {
    const q = limitPull(TAB, target, LIMITS);
    if (distance(TAB, q) < 2) continue;
    const angle = angleOf(TAB, q);
    const mid = [(TAB[0] + q[0]) / 2, (TAB[1] + q[1]) / 2];
    const chord = foldSegment(mid, [-Math.sin(angle), Math.cos(angle)], STRIP);
    if (!chord) continue;
    for (const [x, y] of chord) {
      assert.ok(x >= STRIP.left - 1e-6 && x <= STRIP.right + 1e-6, `x ${x} for ${target}`);
      assert.ok(y >= STRIP.top - 1e-6 && y <= STRIP.bottom + 1e-6, `y ${y} for ${target}`);
    }
    assert.ok(distance(...chord) <= diagonal + 1e-6, `length ${distance(...chord)} for ${target}`);
  }
});

test('the fold shading is anchored mid-way along the fold where it crosses the paper, on both faces', () => {
  let anchored = 0;
  for (const target of samplePulls()) {
    const q = limitPull(TAB, target, LIMITS);
    const { back, fold } = peelLayout(TAB, q, SIZE);
    if (!fold) continue;
    anchored += 1;
    const [x, y] = fold.front;
    assert.ok(x >= 0 && x <= SIZE.length && y >= 0 && y <= SIZE.height, `anchor ${fold.front} for ${target}`);
    assertNear(distance(fold.front, TAB), distance(fold.front, q), `anchor on the fold for ${target}`, 1e-6);
    assertNear(fold.angle, angleOf(TAB, q), `angle for ${target}`);
    const along = [-Math.sin(fold.angle), Math.cos(fold.angle)];
    const [start, end] = foldSegment(fold.front, along, STRIP);
    assertNear(distance(start, fold.front), distance(end, fold.front), `centred for ${target}`, 1e-6);
    assert.ok(distance(start, fold.front) < 110, `half chord ${distance(start, fold.front)} for ${target}`);
    assertPointNear(placeOnStrip(back, fold.back), fold.front, `back anchor for ${target}`, 1e-6);
  }
  assert.ok(anchored > 200, `only ${anchored} pulls shaded`);
});

test('a long steep pull still shades the fold where it crosses the paper', () => {
  const q = limitPull(TAB, [1, -140], LIMITS);
  const mid = [(TAB[0] + q[0]) / 2, (TAB[1] + q[1]) / 2];
  const { fold } = peelLayout(TAB, q, SIZE);
  assert.ok(fold);
  assert.ok(distance(fold.front, mid) > 100, 'the anchor is far from the A–Q midpoint');
});

test('peeledFraction is 0 for nothing, 1 for the whole strip and counts only what lies on the strip', () => {
  const rectangle = (left, top, right, bottom) => [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  assert.equal(peeledFraction([], STRIP), 0);
  assertNear(peeledFraction(rectangle(0, 0, 236, 98), STRIP), 1, 'the strip itself');
  assertNear(peeledFraction(rectangle(-30, -12, 276, 110), STRIP), 1, 'more than the strip');
  assertNear(peeledFraction(rectangle(-30, -12, 118, 110), STRIP), 0.5, 'the left half and beyond');
});

test('peeledFraction clips to the strip instead of squashing the corners onto it', () => {
  const steepFlap = [
    [-30, -12],
    [-25, -12],
    [100, 110],
    [-30, 110],
  ];
  const fraction = peeledFraction(steepFlap, STRIP);
  const exact = clipHalfPlane(clipHalfPlane(steepFlap, [0, 0], [0, 1], true), [0, 98], [0, -1], true);
  assertNear(fraction, area(clipHalfPlane(exact, [0, 0], [1, 0], true)) / (236 * 98), 'clipped share');
  assert.ok(fraction < (100 * 98) / 2 / (236 * 98));
});

test('at rest nothing is peeled and the whole strip front shows', () => {
  const rest = peelLayout(TAB, TAB, SIZE);
  assert.equal(rest.peeled, 0);
  assert.equal(rest.back, null);
  assert.equal(rest.fold, null);
  assertNear(peeledFraction(rest.front, STRIP), 1, 'front share');
});

test('a tiny pull still counts as rest', () => {
  assert.equal(peelLayout(TAB, [1.5, TAB[1]], SIZE).back, null);
});

test('when fully open the whole strip is peeled and its back lies flat to the right', () => {
  const open = peelLayout(TAB, OPEN, SIZE);
  assertNear(open.peeled, 1, 'peeled share');
  assertNear(peeledFraction(open.front, STRIP), 0, 'front share');
  assertNear(open.back.rotation, 0, 'rotation');
  assertNear(open.back.left, SIZE.length, 'back left');
  assertPointNear(open.fold.front, [SIZE.length, SIZE.height / 2], 'front anchor at the hinge');
  assertPointNear(open.fold.back, [0, SIZE.height / 2], 'back anchor at the hinge');
});

test('a straight pull peels the share of the strip left of the fold', () => {
  const quarter = peelLayout(TAB, [SIZE.length / 2, TAB[1]], SIZE);
  assertNear(quarter.peeled, 0.25, 'peeled share');
  assertNear(peeledFraction(quarter.front, STRIP), 0.75, 'front share');
});

test('front and flap together always cover the strip once', () => {
  for (const target of samplePulls()) {
    const layout = peelLayout(TAB, limitPull(TAB, target, LIMITS), SIZE);
    assertNear(layout.peeled + peeledFraction(layout.front, STRIP), 1, `cover for ${target}`, 1e-9);
  }
});

test('the reflection carries the tab point A onto the pulled point Q', () => {
  for (const target of samplePulls()) {
    const q = limitPull(TAB, target, LIMITS);
    const { back } = peelLayout(TAB, q, SIZE);
    if (!back) continue;
    assertPointNear(placeOnStrip(back, backFacePointOf(TAB)), q, `tab for ${target}`, 1e-6);
  }
});

test('the reflection keeps points on the fold where they are and the flap ends up on Q’s side', () => {
  const q = [150, -20];
  const { back } = peelLayout(TAB, q, SIZE);
  const mid = [(TAB[0] + q[0]) / 2, (TAB[1] + q[1]) / 2];
  assertPointNear(placeOnStrip(back, backFacePointOf(mid)), mid, 'fold midpoint');
  const pull = [q[0] - TAB[0], q[1] - TAB[1]];
  for (const corner of back.clip) {
    const [x, y] = placeOnStrip(back, corner);
    assert.ok((x - mid[0]) * pull[0] + (y - mid[1]) * pull[1] >= -1e-6, `corner ${corner}`);
  }
});

test('the automatic tear runs from the tab to fully open along an arc lifted at the middle', () => {
  assertPointNear(autoTearAt(0, SIZE), TAB, 'start');
  assertPointNear(autoTearAt(1, SIZE), OPEN, 'end');
  assertPointNear(autoTearAt(0.5, SIZE), [SIZE.length, TAB[1] - 70], 'middle');
});

test('finishing a released peel runs from where it was let go to fully open', () => {
  const start = [300, -30];
  assertPointNear(finishAt(start, 0, SIZE), start, 'start');
  assertPointNear(finishAt(start, 1, SIZE), OPEN, 'end');
  assertPointNear(finishAt(start, 0.5, SIZE), [386, (-30 + 49) / 2 - 79 * 0.4], 'middle lifted');
  assertPointNear(finishAt([300, 80], 0.5, SIZE), [386, (80 + 49) / 2 - 30 * 0.4], 'least lift');
});

function paintedFlapCorners(back) {
  const edges = [
    [[0, 0], [1, 0]],
    [[SIZE.length, 0], [-1, 0]],
    [[0, -4], [0, 1]],
    [[0, SIZE.height + 4], [0, -1]],
  ];
  const onPaper = edges.reduce((polygon, [point, normal]) => clipHalfPlane(polygon, point, normal, true), back.clip);
  return onPaper.map((corner) => placeOnStrip(back, corner));
}

test('reach is the rightmost point of the flap, its pull tab included', () => {
  for (const target of samplePulls()) {
    const q = limitPull(TAB, target, LIMITS);
    const { back, reach } = peelLayout(TAB, q, SIZE);
    if (!back) continue;
    const rightmost = Math.max(q[0] + 21, ...paintedFlapCorners(back).map(([x]) => x));
    assertNear(reach, rightmost, `reach for ${target}`, 1e-6);
  }
});

test('a straight pull reaches as far as the pull tab past Q', () => {
  assertNear(peelLayout(TAB, [200, TAB[1]], SIZE).reach, 221, 'reach');
});

test('an angled pull swings the flap corner well past Q', () => {
  const q = limitPull(TAB, [284, -140], LIMITS);
  assert.ok(peelLayout(TAB, q, SIZE).reach > q[0] + 40);
});

test('the ticket only slides left when the flap and its shadow would leave the view', () => {
  const view = { stripLeft: 40, viewRight: 374 };
  assert.equal(keepFlapInView(300, view), 0);
  assert.equal(keepFlapInView(312, view), 0);
  assert.equal(keepFlapInView(400, view), 374 - 22 - (40 + 400));
  assert.equal(keepFlapInView(493, { stripLeft: 40, viewRight: 304 / 0.96 }), 304 / 0.96 - 22 - (40 + 493));
});

test('the open strip is centred on the stage', () => {
  const shift = centredShift({ stripLeft: 40, length: 236, stageWidth: 358 });
  assert.equal(40 + 236 + shift, (358 - 236) / 2);
});
