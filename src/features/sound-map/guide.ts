import { SOUND_LABEL, SOUND_TAGS, type SoundTag } from '../../data/models';
import { t } from '../../i18n';

/**
 * A guide to each sound, for the My Sound overview: what it feels like, what
 * to listen for, how it differs from the sounds next to it, and which sounds
 * are its neighbours. Plain words for someone new to festival music. Pure.
 */
export type SoundGuide = {
  /** One line on what it feels like. */
  feel: string;
  /** Three things to listen for. */
  listenFor: [string, string, string];
  /** How it differs from its nearest neighbour. */
  vs: string;
  /** Sounds close to it, closest first. */
  near: SoundTag[];
};

export const SOUND_GUIDE: Record<SoundTag, SoundGuide> = {
  'melodic-bass': {
    feel: t('Big emotional melodies over heavy bass. Euphoric and cinematic, made for singing along.'),
    listenFor: [t('Soaring synths and vocals'), t('Long build-ups into warm, heavy drops'), t('Piano and strings next to the bass')],
    vs: t('Softer and more emotional than dubstep: the drop lifts you up instead of hitting you.'),
    near: ['dubstep', 'pop', 'house'],
  },
  dubstep: {
    feel: t('Heavy, half-time bass music. Wobbles, growls and drops that hit hard.'),
    listenFor: [t('A slow, half-time beat around 140 BPM'), t('Growling, talking basses'), t('The drop is the main event')],
    vs: t('Heavier than melodic bass, and wilder and more varied than riddim.'),
    near: ['riddim', 'melodic-bass', 'trap'],
  },
  riddim: {
    feel: t('Dubstep stripped to its bones: one punchy bass pattern, repeated until the crowd locks in.'),
    listenFor: [t('The same bass phrase over and over'), t('Lots of space between hits'), t('Headbanging, not singing')],
    vs: t('More minimal and repetitive than dubstep: groove over chaos.'),
    near: ['dubstep', 'trap'],
  },
  trap: {
    feel: t('Hip-hop drums with festival energy: rolling hi-hats, booming 808s and hard drops.'),
    listenFor: [t('Fast rolling hi-hats'), t('Deep 808 bass you feel in your chest'), t('Rap vocal chops and horns')],
    vs: t('Closer to hip-hop than dubstep: bounce instead of wobble.'),
    near: ['hip-hop', 'dubstep', 'riddim'],
  },
  techno: {
    feel: t('Driving, hypnotic and dark. Made for long nights and losing yourself in the beat.'),
    listenFor: [t('A steady kick on every beat, around 125 to 140 BPM'), t('Few vocals, lots of texture'), t('Tension that builds over minutes')],
    vs: t('Darker and more relentless than house: less melody, more drive.'),
    near: ['house'],
  },
  house: {
    feel: t('Warm, groovy and feel-good. Four-to-the-floor made for dancing with your friends.'),
    listenFor: [t('A kick on every beat, around 120 to 128 BPM'), t('Funky bass lines and claps'), t('Vocal hooks and piano stabs')],
    vs: t('Brighter and more soulful than techno: groove instead of drops.'),
    near: ['techno', 'pop', 'melodic-bass'],
  },
  pop: {
    feel: t('Hooks first: big choruses and catchy vocals, often with a dance beat under them.'),
    listenFor: [t('A chorus you know by the second time'), t('Polished vocals up front'), t('Short, tight songs')],
    vs: t('Led by the song, where most festival electronic music is led by the drop.'),
    near: ['house', 'melodic-bass', 'indie'],
  },
  indie: {
    feel: t('Bands and songwriters with their own sound, from dreamy to scrappy.'),
    listenFor: [t('Live instruments and real drums'), t('Distinctive voices'), t('Moods over drops')],
    vs: t('Rawer and more personal than pop, and softer than rock.'),
    near: ['rock', 'pop'],
  },
  rock: {
    feel: t('Loud guitars, live drums and big riffs, played as loud as the speakers allow.'),
    listenFor: [t('Distorted guitar riffs'), t('A drummer driving the band'), t('Shout-along choruses')],
    vs: t('Heavier and louder than indie: played, not programmed.'),
    near: ['indie'],
  },
  'hip-hop': {
    feel: t('Beats and rhymes: rap over sampled or programmed drums, with the vocalist in charge.'),
    listenFor: [t('The rapper leads'), t('Swinging, head-nodding drums'), t('Samples and deep bass lines')],
    vs: t('Song and lyrics first, where trap at a festival is drop first.'),
    near: ['trap', 'pop'],
  },
};

/** Sounds to try next: the neighbours of yours that aren't already yours, closest first. */
export function nextSounds(yours: readonly SoundTag[], n = 2): SoundTag[] {
  const out: SoundTag[] = [];
  for (const tag of yours) for (const near of SOUND_GUIDE[tag].near) if (!yours.includes(near) && !out.includes(near)) out.push(near);
  // Nothing of yours yet: a spread of the main festival sounds.
  const fill = yours.length ? [] : (['melodic-bass', 'house', 'dubstep'] as SoundTag[]);
  return [...out, ...fill].slice(0, n);
}

/** Every sound not already shown, in the usual order. */
export const otherSounds = (shown: readonly SoundTag[]) => SOUND_TAGS.filter((t) => !shown.includes(t));

/** "Close to melodic bass", for a sound to try next. */
export function closeTo(tag: SoundTag, yours: readonly SoundTag[]): string | undefined {
  const from = yours.find((y) => SOUND_GUIDE[y].near.includes(tag));
  return from ? t('Close to {sound}', { sound: SOUND_LABEL[from].toLowerCase() }) : undefined;
}

/** The artists most in a sound (it's their main sound, or a strong part of it), your best matches first. */
export function artistsIn<T extends { id: string; sound?: Partial<Record<SoundTag, number>> }>(tag: SoundTag, artists: readonly T[], taste: Record<string, number>, n = 5): T[] {
  return artists
    .filter((a) => {
      const w = a.sound?.[tag] ?? 0;
      if (w <= 0) return false;
      const top = Math.max(...Object.values(a.sound ?? {}).map((v) => v ?? 0));
      return w >= 0.5 || w >= top;
    })
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0) || (b.sound?.[tag] ?? 0) - (a.sound?.[tag] ?? 0))
    .slice(0, n);
}

export type SoundTip = { id: 'this-or-that' | 'react' | 'pick' | 'connect' | 'explore' | 'festival'; title: string; body: string; action?: string };

/** Three tips for finding your sound, for where you are: just starting, or shaping it further. */
export function soundTips({ shaped, canConnect, hasFestivals }: { shaped: boolean; canConnect: boolean; hasFestivals: boolean }): SoundTip[] {
  const all: Record<SoundTip['id'], SoundTip> = {
    'this-or-that': { id: 'this-or-that', title: t('Play This or that'), body: t('Pick between two artists, ten times over. The quickest way to a real map.'), action: t('Play') },
    react: { id: 'react', title: t('Like and skip in Discover'), body: t('Every like, save and skip teaches Afterglow your sound. Skipping helps too.'), action: t('Open Discover') },
    pick: { id: 'pick', title: t('Pick artists you already love'), body: t('Tap the ones you know and everything else arranges itself around them.'), action: t('Pick artists') },
    connect: { id: 'connect', title: t('Connect your music'), body: t('Start from what you already play. It stays on your phone.'), action: t('Connect') },
    explore: { id: 'explore', title: t('Try a sound next door'), body: t('Watch a few sets from a sound close to yours. Liking a couple widens your map.') },
    festival: { id: 'festival', title: t('See your sound at a festival'), body: t('Open the map and pick a festival: the biggest bubbles are the sets you’ll love most.'), action: t('Open the map') },
  };
  const order: SoundTip['id'][] = shaped ? ['explore', ...(hasFestivals ? (['festival'] as const) : []), 'react', 'pick'] : ['this-or-that', ...(canConnect ? (['connect'] as const) : []), 'react', 'pick'];
  return order.slice(0, 3).map((id) => all[id]);
}
