/** The QR encoder's core (pure JavaScript), imported directly so no canvas or file code comes along. */
declare module 'qrcode/lib/core/qrcode' {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' },
  ): { modules: { size: number; data: Uint8Array | boolean[] } };
}
