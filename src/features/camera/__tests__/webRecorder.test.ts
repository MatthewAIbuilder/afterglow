import { describe, expect, it } from '@jest/globals';
import { baseType, cameraAsk, cameraProblem, recordType } from '../webRecorder';

describe('filming in a browser', () => {
  it('records an MP4 with H.264 when the browser can, plain MP4 next, and not at all without MP4', () => {
    expect(recordType(() => true)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    expect(recordType((t) => t === 'video/mp4')).toBe('video/mp4');
    // A browser that only records WebM: its videos couldn't be shared, so it doesn't film.
    expect(recordType((t) => t.startsWith('video/webm'))).toBeUndefined();
    expect(
      recordType(() => {
        throw new Error('no');
      }),
    ).toBeUndefined();
    expect(baseType('video/mp4;codecs=avc1')).toBe('video/mp4');
  });

  it('asks for the back camera (or the front) with sound, and reads why it couldn’t start', () => {
    expect(cameraAsk('back', true)).toMatchObject({ video: { facingMode: { ideal: 'environment' } }, audio: true });
    expect(cameraAsk('front', false)).toMatchObject({ video: { facingMode: { ideal: 'user' } }, audio: false });
    expect(cameraProblem({ name: 'NotAllowedError' })).toBe('denied');
    expect(cameraProblem({ name: 'NotFoundError' })).toBe('unsupported');
    expect(cameraProblem(new Error('x'))).toBe('failed');
  });
});
