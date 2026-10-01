import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Keeps the layers apart:
 * - data: models, mock records, the catalogue and its checks (src/data)
 * - recommendation logic: pure modules, free of React (taste, feed, plan, layout, links)
 * - presentation: screens and components, which reach data only through useCatalog
 */
const SRC = join(__dirname, '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}
const all = files(SRC).map((p) => ({ path: relative(SRC, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
const imports = (text: string) => [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1]);

describe('architecture', () => {
  it('only the data layer and the catalogue provider read mock data', () => {
    const allowed = new Set(['state/catalog.tsx', 'state/taste.ts']);
    const offenders = all
      .filter((f) => !f.path.startsWith('data/') && !allowed.has(f.path))
      .filter((f) => imports(f.text).some((i) => /data\/mock/.test(i)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('keeps the data layer free of React and of app features', () => {
    const offenders = all
      .filter((f) => f.path.startsWith('data/'))
      .filter((f) => imports(f.text).some((i) => i === 'react' || i.startsWith('react-native') || /features\/|state\//.test(i)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('keeps recommendation logic pure (no React, no storage)', () => {
    const pure = [
      'features/taste/engine.ts',
      'features/taste/watch.ts',
      'features/taste/similarity.ts',
      'features/taste/ratings.ts',
      'features/festivals/tune.ts',
      'features/festivals/going.ts',
      'features/festivals/shelves.ts',
      'features/festivals/near.ts',
      'features/festivals/compare.ts',
      'features/festivals/playing.ts',
      'features/recap/recap.ts',
      'features/recap/year.ts',
      'features/festivals/search.ts',
      'features/festivals/when.ts',
      'features/recommend/feed.ts',
      'features/recommend/copy.ts',
      'features/plan/plan.ts',
      'features/plan/mustSees.ts',
      'features/plan/share.ts',
      'features/sound-map/layout.ts',
      'features/festivals/links.ts',
      'features/festivals/format.ts',
      'features/discover/playback.ts',
      'features/discover/focus.ts',
      'features/notifications/inbox.ts',
      'features/notifications/reminders.ts',
      'features/plan/route.ts',
      'features/plan/grid.ts',
      'features/plan/lineupPoster.ts',
      'features/festivals/request.ts',
      'features/festivals/days.ts',
      'features/festivals/weekend.ts',
      'features/music/models.ts',
      'features/music/tally.ts',
      'features/music/strength.ts',
      'features/music/genres.ts',
      'features/music/library.ts',
      'features/music/imported.ts',
      'features/music/store.ts',
      'features/music/privacy.ts',
      'features/music/copy.ts',
      'features/music/reach.ts',
      'features/memories/guess.ts',
      'features/memories/organize.ts',
      'features/memories/store.ts',
      'features/memories/models.ts',
      'features/social/models.ts',
      'features/social/publish.ts',
      'features/social/firebase/mapping.ts',
      'features/music/service.ts',
      'features/music/http.ts',
      'features/music/spotify/normalize.ts',
      'features/music/spotify/tokens.ts',
      'features/music/spotify/auth.ts',
      'features/music/spotify/api.ts',
      'features/music/apple/normalize.ts',
      'features/music/apple/api.ts',
      'features/music/apple/musicKit.ts',
    ];
    for (const p of pure) {
      const f = all.find((x) => x.path === p);
      expect(f).toBeDefined();
      const bad = imports(f!.text).filter((i) => i === 'react' || i.startsWith('react-native') || i.includes('async-storage') || i.startsWith('expo'));
      expect({ file: p, imports: bad }).toEqual({ file: p, imports: [] });
    }
  });

  it('keeps each music service inside its adapter', () => {
    // Only the music layer's own wiring knows Spotify or Apple Music exist.
    const offenders = all
      .filter((f) => !f.path.startsWith('features/music/'))
      .filter((f) => imports(f.text).some((i) => /music\/(spotify|apple)\//.test(i)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    // And neither adapter reaches into the other.
    const crossed = all
      .filter((f) => /^features\/music\/(spotify|apple)\//.test(f.path))
      .filter((f) => imports(f.text).some((i) => (f.path.includes('/spotify/') ? /\/apple\//.test(i) : /\/spotify\//.test(i))))
      .map((f) => f.path);
    expect(crossed).toEqual([]);
  });

  it('keeps Firebase inside the social adapter', () => {
    // Only features/social/firebase/ talks to Firebase, and only features/social/services.ts wires it in.
    const firebase = all.filter((f) => imports(f.text).some((i) => i === 'firebase' || i.startsWith('firebase/'))).map((f) => f.path);
    expect(firebase.every((p) => p.startsWith('features/social/firebase/'))).toBe(true);
    const adapter = all
      .filter((f) => f.path !== 'features/social/services.ts' && !f.path.startsWith('features/social/firebase/'))
      .filter((f) => imports(f.text).some((i) => /social\/firebase\//.test(i)))
      .map((f) => f.path);
    expect(adapter).toEqual([]);
  });

  it('keeps music credentials out of normal storage', () => {
    // The secure store is used by the adapters' wiring only; anything that writes AsyncStorage never touches it.
    const secure = all.filter((f) => imports(f.text).some((i) => i === 'expo-secure-store')).map((f) => f.path);
    expect(secure).toEqual(['features/music/secrets.ts']);
    const both = all
      .filter((f) => imports(f.text).some((i) => i.includes('async-storage')))
      .filter((f) => imports(f.text).some((i) => /music\/(secrets|spotify|apple)/.test(i)))
      .map((f) => f.path);
    expect(both).toEqual([]);
  });
});
