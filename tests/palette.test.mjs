import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, PALETTE, paletteCss } from '../src/lib/palette.mjs';

const MIN_TEXT_CONTRAST = 4.5;

function assertReadable(foreground, background, label) {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= MIN_TEXT_CONTRAST,
    `${label}: ${foreground} on ${background} is ${ratio.toFixed(2)}, needs ${MIN_TEXT_CONTRAST}`,
  );
}

test('contrastRatio of black on white is 21', () => {
  const ratio = contrastRatio('#000000', '#ffffff');
  assert.ok(ratio > 20.9 && ratio < 21.1, `got ${ratio}`);
});

test('ink is readable on paper', () => {
  assertReadable(PALETTE.ink, PALETTE.paper, 'ink');
});

test('muted is readable on paper and box', () => {
  assertReadable(PALETTE.muted, PALETTE.paper, 'muted');
  assertReadable(PALETTE.muted, PALETTE.box, 'muted');
});

test('there are exactly 5 step colours', () => {
  assert.equal(PALETTE.steps.length, 5);
});

test('each step text colour is readable on paper and box, and white text is readable on it', () => {
  PALETTE.steps.forEach((step, i) => {
    const label = `step ${i + 1} text`;
    assertReadable(step.text, PALETTE.paper, label);
    assertReadable(step.text, PALETTE.box, label);
    assertReadable('#ffffff', step.text, `white on ${label}`);
  });
});

test('the book colours are readable on every shade of the sky-blue background', () => {
  const { skyTop, skyMiddle, skyBottom, accent, ink, muted } = PALETTE.book;
  for (const sky of [skyTop, skyMiddle, skyBottom]) {
    assertReadable(accent, sky, 'book accent');
    assertReadable(ink, sky, 'book ink');
    assertReadable(muted, sky, 'book muted');
  }
});

test('paletteCss exposes the palette as CSS custom properties', () => {
  const css = paletteCss();
  assert.ok(css.includes('--paper:'), css);
  assert.ok(css.includes('--step3-text:'), css);
  assert.ok(css.includes('--book-accent:'), css);
});
