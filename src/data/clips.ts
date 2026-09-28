import type { Clip } from './types';

const F = 'solstice-26';

/** Mock feed. Order is interleaved so the feed never plays one sound twice in a row. */
export const CLIPS: Clip[] = [
  { id: 'c1', artistId: 'illenium', festivalId: F, title: 'Opening moments', durationSec: 24, bpm: 150 },
  { id: 'c2', artistId: 'subtronics', festivalId: F, title: 'Peak-time drop', durationSec: 18, bpm: 150 },
  { id: 'c3', artistId: 'sara-landry', festivalId: F, title: 'Deep in the set', durationSec: 30, bpm: 145 },
  { id: 'c4', artistId: 'levity', festivalId: F, title: 'The first drop', durationSec: 20, bpm: 150 },
  { id: 'c5', artistId: 'john-summit', festivalId: F, title: 'Sunset run', durationSec: 26, bpm: 126 },
  { id: 'c6', artistId: 'excision', festivalId: F, title: 'Headline finale', durationSec: 22, bpm: 150 },
  { id: 'c7', artistId: 'tape-b', festivalId: F, title: 'Crowd favourite', durationSec: 16, bpm: 150 },
  { id: 'c8', artistId: 'illenium', festivalId: F, title: 'Encore', durationSec: 28, bpm: 150 },
  { id: 'c9', artistId: 'levity', festivalId: F, title: 'Closing minutes', durationSec: 21, bpm: 150 },
  { id: 'c10', artistId: 'sara-landry', festivalId: F, title: 'Lights down', durationSec: 25, bpm: 145 },
  { id: 'c11', artistId: 'subtronics', festivalId: F, title: 'Back to back', durationSec: 19, bpm: 150 },
  { id: 'c12', artistId: 'john-summit', festivalId: F, title: 'Singalong', durationSec: 23, bpm: 126 },
  { id: 'c13', artistId: 'tape-b', festivalId: F, title: 'Last track', durationSec: 17, bpm: 150 },
  { id: 'c14', artistId: 'excision', festivalId: F, title: 'Opening wall of bass', durationSec: 20, bpm: 150 },
];
