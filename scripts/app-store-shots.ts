/**
 * App Store screenshots from the website build (`npm run shots`):
 *
 *   npm run build:web
 *   npx --yes tsx@4 scripts/app-store-shots.ts [dist] [--festival <id>] [--out <folder>]
 *
 * Builds nothing itself. Serves the web export folder on this computer, opens
 * it in Chromium (or Edge or Chrome) at iPhone 6.9-inch and 6.5-inch sizes,
 * three pixels to a point, with saved state already in the browser so the
 * screens look lived in: going to the soonest real festival with a proper
 * lineup, a few artists from its lineup loved and starred, two clips liked,
 * a little water and a check-in in Look after yourself. Only real catalogue
 * data is used (never the demo festivals, never made-up people). Each capture
 * is put on a branded frame with a short headline and saved as a PNG in
 * docs/app-store/screenshots/ ("6.9-01-discover.png"), checked to be exactly
 * the size App Store Connect asks for.
 *
 * The website is a stand-in for real phone captures: Apple accepts any
 * screenshots of the app, and these can be replaced later with captures from
 * the development build.
 *
 * The catalogue: the export's catalogue.json when it has festivals or clips
 * (a build made by the website workflow), otherwise the live one at
 * CATALOG_URL, otherwise just the built-in data. Artist photos and clips
 * only show when the computer can reach Deezer and YouTube.
 *
 * Real phone screenshots: put PNGs named after a shot id (my-sound.png, festival-map.png) in
 * docs/app-store/photos (or --photos <folder>); they replace that shot's website capture, and
 * photo-only shots (the festival map) are made only when one is there.
 *
 * Browser: CHROMIUM_PATH if set, else /opt/pw-browsers/chromium if it exists,
 * else Microsoft Edge on Windows, else Google Chrome.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { chromium, type Browser, type LaunchOptions } from 'playwright-core';
import { CATALOG_URL } from '../src/config/data';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { buildCatalog } from '../src/data/merge';
import { MOCK_SNAPSHOT } from '../src/data/mock';
import {
  chooseArtists,
  chooseFestival,
  cssSize,
  DEVICES,
  frameHtml,
  pngSize,
  SCALE,
  seedStorage,
  shotFile,
  shotList,
} from '../src/features/appStore/shots';
import { WHATS_NEW } from '../src/features/whatsNew/whatsNew';

const SETTLE_MS = 6000;
const FETCH_TIMEOUT_MS = 8000;
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

function args() {
  const list = process.argv.slice(2);
  const flag = (name: string) => {
    const i = list.indexOf(name);
    if (i < 0) return undefined;
    const value = list[i + 1];
    list.splice(i, 2);
    return value;
  };
  const festival = flag('--festival');
  const out = flag('--out');
  const photos = flag('--photos');
  return { dist: resolve(list[0] ?? 'dist'), photos: resolve(photos ?? 'docs/app-store/photos'), festival, out: resolve(out ?? 'docs/app-store/screenshots') };
}

/** The catalogue file the screenshots use, as text, and where it came from. */
async function catalogueText(dist: string): Promise<{ text?: string; from: string }> {
  const local = join(dist, 'catalogue.json');
  if (existsSync(local)) {
    const text = readFileSync(local, 'utf8');
    const file = JSON.parse(text);
    if (file.festivals?.length || file.clips?.length) return { text, from: local };
  }
  try {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.ok) return { text: await res.text(), from: CATALOG_URL };
  } catch {
    // Offline: the built-in catalogue only.
  }
  return { from: 'the built-in catalogue only' };
}

/** The export folder on localhost; any path that isn't a file gets the app's page. */
function serve(dist: string): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(dist, path);
    if (!file.startsWith(dist + sep) || !existsSync(file) || statSync(file).isDirectory()) {
      file = existsSync(`${file}.html`) && file.startsWith(dist + sep) ? `${file}.html` : join(dist, 'index.html');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => done({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() })),
  );
}

async function launch(): Promise<Browser> {
  const options: LaunchOptions = { args: [] };
  // Behind an HTTPS proxy (as in cloud sessions), send only https through it so localhost stays direct.
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (proxy) options.args!.push(`--proxy-server=https=${new URL(proxy).host}`);
  const path = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  if (path) return chromium.launch({ ...options, executablePath: path });
  return chromium.launch({ ...options, channel: process.platform === 'win32' ? 'msedge' : 'chrome' });
}

async function main() {
  const { dist, festival: wanted, out, photos } = args();
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`No website build in ${dist}. Run "npm run build:web" first, or pass the export folder.`);
    process.exit(1);
  }
  const hosted = await catalogueText(dist);
  const catalog = hosted.text ? buildCatalog(BUILT_IN.snapshot, parseCatalogFile(hosted.text)).catalog : BUILT_IN.catalog;
  const demo = new Set(MOCK_SNAPSHOT.festivals.map((f) => f.id));
  const festival = chooseFestival(catalog.festivals, demo, new Date(), wanted);
  if (!festival) {
    console.error(wanted ? `No festival "${wanted}" in the catalogue.` : 'No upcoming festival with a lineup in the catalogue.');
    process.exit(1);
  }
  const artists = chooseArtists(festival, catalog.clips, catalog.festivals);
  const seed = seedStorage({ festival, artists, clips: catalog.clips, whatsNewKey: WHATS_NEW.key, now: Date.now() });
  const shots = shotList(festival);
  console.log(`Catalogue: ${hosted.from}. Festival: ${festival.name}. Artists: ${artists.map((id) => catalog.artist(id)?.name ?? id).join(', ')}.`);
  if (!festival.sets?.length) console.log('No set times yet, so no timetable shot.');

  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (/^\d\.\d-\d\d-.+\.png$/.test(f)) rmSync(join(out, f));

  const site = await serve(dist);
  const browser = await launch();
  const written: string[] = [];
  try {
    for (const device of DEVICES) {
      const viewport = cssSize(device);
      const context = await browser.newContext({ viewport, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await context.addInitScript((items: Record<string, string>) => {
        for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
      }, seed);
      // The app asks for the hosted catalogue: give it the same one the shots were chosen from.
      if (hosted.text) {
        const body = hosted.text;
        await context.route(CATALOG_URL, (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
      }
      const page = await context.newPage();
      let number = 0;
      for (const shot of shots) {
        // A real phone screenshot named after the shot (docs/app-store/photos/my-sound.png) replaces the website capture.
        const photo = join(photos, `${shot.id}.png`);
        const real = existsSync(photo);
        if (shot.photoOnly && !real) continue;
        const i = number++;
        let raw: Buffer;
        if (real) raw = readFileSync(photo);
        else {
          await page.goto(site.url + shot.path, { waitUntil: 'load' });
          await page.waitForTimeout(SETTLE_MS);
          if (shot.scrollTo) {
            await page.getByText(shot.scrollTo).first().scrollIntoViewIfNeeded();
            await page.waitForTimeout(800);
          }
          raw = await page.screenshot();
          check(raw, device.width, device.height, `${shot.id} (screen)`);
        }
        const frame = await context.newPage();
        await frame.setContent(frameHtml({ headline: shot.headline, sub: shot.sub, image: `data:image/png;base64,${raw.toString('base64')}`, ...viewport }));
        await frame.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
        const framed = await frame.screenshot();
        await frame.close();
        check(framed, device.width, device.height, shot.id);
        const name = shotFile(device, i, shot);
        writeFileSync(join(out, name), framed);
        written.push(name);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    site.close();
  }
  console.log(`Saved ${written.length} screenshots in ${out}:\n  ${written.join('\n  ')}`);
}

function check(png: Buffer, width: number, height: number, what: string) {
  const size = pngSize(png);
  if (!size || size.width !== width || size.height !== height) {
    throw new Error(`${what}: expected ${width}x${height}, got ${size ? `${size.width}x${size.height}` : 'not a PNG'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
