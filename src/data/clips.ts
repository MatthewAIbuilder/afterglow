import type { Clip } from './types';

const F = 'solstice-26';

/**
 * Feed. Order is interleaved so the feed never plays one sound twice in a row.
 *
 * Clips with a source play a section of an official upload in YouTube's own
 * player. Only add videos from the artist's, festival's, label's or event's
 * official channel, and only if the video allows embedding. Clips without a
 * source show the drawn stage.
 *
 * All sources below were checked on 2026-09-28: public, on the listed
 * official channel, right artist at the start time, and playing embedded in
 * the app. Check any new source the same way before adding it.
 */
export const CLIPS: Clip[] = [
  {
    id: 'c1',
    artistId: 'illenium',
    festivalId: F,
    title: 'Live at Lost Lands 2025',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'JssDaUK0_GQ', start: 1500, end: 1545, channel: 'Lost Lands' },
  },
  {
    id: 'c2',
    artistId: 'subtronics',
    festivalId: F,
    title: 'Live at EDC Las Vegas 2026',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: '-A-XIBMDgj0', start: 1320, end: 1365, channel: 'Insomniac' },
  },
  {
    id: 'c3',
    artistId: 'sara-landry',
    festivalId: F,
    title: 'Boiler Room x Teletech 2023',
    durationSec: 45,
    bpm: 145,
    source: { provider: 'youtube', videoId: 'EIQlDpgAY5Y', start: 1800, end: 1845, channel: 'Boiler Room' },
  },
  {
    id: 'c4',
    artistId: 'levity',
    festivalId: F,
    title: 'Live at Lost Lands 2024',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'lqqCNpZzYM4', start: 1380, end: 1425, channel: 'Lost Lands' },
  },
  {
    id: 'c5',
    artistId: 'john-summit',
    festivalId: F,
    title: 'Tomorrowland 2026, Mainstage',
    durationSec: 45,
    bpm: 126,
    source: { provider: 'youtube', videoId: 'ADCiMBYOyHw', start: 1260, end: 1305, channel: 'Tomorrowland' },
  },
  {
    id: 'c6',
    artistId: 'excision',
    festivalId: F,
    title: 'Two-hour set, Lost Lands 2025',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'b29GV8RODIc', start: 2400, end: 2445, channel: 'Lost Lands' },
  },
  {
    id: 'c7',
    artistId: 'tape-b',
    festivalId: F,
    title: 'Live at Lost Lands 2025',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'x-fYL7jm7eg', start: 1200, end: 1245, channel: 'Lost Lands' },
  },
  {
    id: 'c8',
    artistId: 'illenium',
    festivalId: F,
    title: 'Live at Red Rocks 2025',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'M49c9LhxWWM', start: 2700, end: 2745, channel: 'ILLENIUM' },
  },
  { id: 'c9', artistId: 'levity', festivalId: F, title: 'Closing minutes', durationSec: 21, bpm: 150 },
  {
    id: 'c10',
    artistId: 'sara-landry',
    festivalId: F,
    title: 'Awakenings Festival 2025',
    durationSec: 45,
    bpm: 145,
    source: { provider: 'youtube', videoId: 'b-PupDxC-ik', start: 1500, end: 1545, channel: 'Awakenings' },
  },
  { id: 'c11', artistId: 'subtronics', festivalId: F, title: 'Back to back', durationSec: 19, bpm: 150 },
  { id: 'c12', artistId: 'john-summit', festivalId: F, title: 'Singalong', durationSec: 23, bpm: 126 },
  { id: 'c13', artistId: 'tape-b', festivalId: F, title: 'Last track', durationSec: 17, bpm: 150 },
  {
    id: 'c14',
    artistId: 'excision',
    festivalId: F,
    title: 'Two-hour set, Lost Lands 2026',
    durationSec: 45,
    bpm: 150,
    source: { provider: 'youtube', videoId: 'K54gC7k-Ugo', start: 3000, end: 3045, channel: 'Lost Lands' },
  },
];
