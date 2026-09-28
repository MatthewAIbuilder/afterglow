import type { Artist } from './types';

/**
 * Mock lineup.
 *
 * To add a photo, paste a direct image link into imageUrl (it must end up
 * serving the image itself, e.g. https://…/photo.jpg). Only use images you
 * have the rights to. Anything left empty shows a gradient monogram.
 */
export const ARTISTS: Artist[] = [
  { id: 'illenium', name: 'ILLENIUM', imageUrl: undefined, sound: { 'melodic-bass': 1, dubstep: 0.25 } },
  { id: 'subtronics', name: 'SUBTRONICS', imageUrl: undefined, sound: { riddim: 0.9, dubstep: 0.7 } },
  { id: 'levity', name: 'LEVITY', imageUrl: undefined, sound: { dubstep: 0.8, riddim: 0.6 } },
  { id: 'tape-b', name: 'TAPE B', imageUrl: undefined, sound: { trap: 0.7, dubstep: 0.5 } },
  { id: 'excision', name: 'EXCISION', imageUrl: undefined, sound: { dubstep: 1, riddim: 0.3 } },
  { id: 'sara-landry', name: 'SARA LANDRY', imageUrl: undefined, sound: { techno: 1 } },
  { id: 'john-summit', name: 'JOHN SUMMIT', imageUrl: undefined, sound: { house: 1 } },
];

export const artistById = (id: string) => ARTISTS.find((a) => a.id === id);
