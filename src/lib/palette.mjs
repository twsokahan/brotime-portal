export const PALETTE = Object.freeze({
  paper: '#f7f0e3',
  box: '#fff8ec',
  ink: '#3a2e24',
  muted: '#7a6a58',
  line: '#e2d5bf',
  steps: Object.freeze([
    Object.freeze({ dot: '#c98a2b', text: '#79531a' }),
    Object.freeze({ dot: '#5f8a3a', text: '#44632a' }),
    Object.freeze({ dot: '#b4503a', text: '#944230' }),
    Object.freeze({ dot: '#3f6f9a', text: '#365e83' }),
    Object.freeze({ dot: '#7a4f7d', text: '#764c79' }),
  ]),
});

const HEX_COLOUR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function linearChannel(byte) {
  const srgb = byte / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const match = HEX_COLOUR.exec(hex);
  if (!match) throw new Error(`Expected a #rrggbb colour, got ${JSON.stringify(hex)}`);
  const [r, g, b] = match.slice(1).map((pair) => linearChannel(parseInt(pair, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA, hexB) {
  const [lighter, darker] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function paletteCss() {
  const { paper, box, ink, muted, line, steps } = PALETTE;
  const declarations = [
    `--paper:${paper}`,
    `--box:${box}`,
    `--ink:${ink}`,
    `--muted:${muted}`,
    `--line:${line}`,
    ...steps.flatMap(({ dot, text }, i) => [`--step${i + 1}:${dot}`, `--step${i + 1}-text:${text}`]),
  ];
  return `:root{${declarations.join(';')}}`;
}
