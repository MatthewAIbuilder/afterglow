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
    ];
    for (const p of pure) {
      const f = all.find((x) => x.path === p);
      expect(f).toBeDefined();
      const bad = imports(f!.text).filter((i) => i === 'react' || i.startsWith('react-native') || i.includes('async-storage') || i.startsWith('expo'));
      expect({ file: p, imports: bad }).toEqual({ file: p, imports: [] });
    }
  });
});
