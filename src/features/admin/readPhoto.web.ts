import { inColumns, linesFromWords, type PhotoLine, tidyPhotoText } from './photoText';

/**
 * Reading a timetable photo in the browser: free text recognition
 * (Tesseract.js, loaded from its CDN only when you first read a photo, so it
 * adds nothing to the app). The picture never leaves the browser. Grids are
 * put back together column by column (photoText.ts), then it's text for the
 * set-list reader, shown in the box to check before anything is read.
 */
export const canReadPhotos = true;

const SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

type Box = { x0: number; x1: number; y0: number; y1: number };
type Word = { text: string; bbox: Box };
type Tesseract = {
  createWorker: (
    lang: string,
    oem?: number,
    opts?: { logger?: (m: { status: string; progress: number }) => void },
  ) => Promise<{ recognize: (img: Blob | string) => Promise<{ data: { lines: { bbox: Box; words: Word[] }[] } }>; terminate: () => Promise<unknown> }>;
};

let loading: Promise<Tesseract> | undefined;
function tesseract(): Promise<Tesseract> {
  const w = window as unknown as { Tesseract?: Tesseract };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  loading ??= new Promise<Tesseract>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('Text recognition didn’t load.')));
    s.onerror = () => {
      loading = undefined;
      reject(new Error('Text recognition didn’t load. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** The text on a timetable photo (a File, Blob or image address), ready for the set-list reader. */
export async function readPhotoText(photo: Blob | string, stages: readonly string[], onProgress?: (share: number) => void): Promise<string> {
  const T = await tesseract();
  const worker = await T.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(photo);
    const words: PhotoLine[][] = data.lines.map((l) => l.words.map((w) => ({ text: w.text, ...w.bbox })));
    const width = Math.max(1, ...data.lines.map((l) => l.bbox.x1));
    return tidyPhotoText(inColumns(linesFromWords(words), width), stages);
  } finally {
    void worker.terminate();
  }
}
