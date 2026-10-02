import { create } from 'qrcode/lib/core/qrcode';
import type { QrGrid } from './qr';

/**
 * A QR code's squares for some text, at the highest error correction, so a
 * face in the middle and rounded dots still scan.
 */
export function qrMatrix(text: string): QrGrid {
  const { size, data } = create(text, { errorCorrectionLevel: 'H' }).modules;
  return { size, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && !!data[y * size + x] };
}
