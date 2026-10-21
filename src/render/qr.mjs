import { createRequire } from 'node:module';

const qrcode = createRequire(import.meta.url)('../../vendor/qrcode.js');

export function qrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
