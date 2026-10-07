/**
 * Printable and shareable promo pieces for one show: stickers, a flyer, an
 * Instagram story and post, each with a QR code that opens the artist's page
 * on afterglowmusic.app with "Film the set" showing (`?film=1`).
 *
 *   node scripts/promo-kit.mjs docs/promo/levity-criterion/kit.json
 *
 * kit.json: { "artistId", "artistName", "venue", "city", "day" (e.g. "Fri"),
 * "date" (e.g. "Oct 9"), "out" (folder) }. Needs Chromium (Playwright) and
 * the Inter font. Words only: no artist logos, photos or creatures (a
 * physical piece using those needs the artist's or venue's permission).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QR = require('qrcode');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const kitPath = process.argv[2];
if (!kitPath) {
  console.error('Usage: node scripts/promo-kit.mjs <kit.json>');
  process.exit(1);
}
const kit = JSON.parse(readFileSync(kitPath, 'utf8'));
const out = resolve(root, kit.out);
mkdirSync(out, { recursive: true });

const link = `https://afterglowmusic.app/artist/${kit.artistId}?film=1`;
const shortLink = `afterglowmusic.app/artist/${kit.artistId}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const name = esc(kit.artistName);
const venue = esc(kit.venue);
const when = `${esc(kit.day)} · ${esc(kit.date)}`;

// The brand mark, from docs/brand.
const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'docs/brand/icon.svg')).toString('base64')}`;

/** The QR code as SVG: rounded dots, solid finder eyes, a hole in the middle for the mark (error correction H). */
function qrSvg(text, ink = '#0A0918') {
  const { size, data } = QR.create(text, { errorCorrectionLevel: 'H' }).modules;
  const dark = (x, y) => x >= 0 && y >= 0 && x < size && y < size && !!data[y * size + x];
  const eye = (x, y) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const hole = Math.ceil(size * 0.22) | 1;
  const h0 = (size - hole) / 2;
  const inHole = (x, y) => x >= h0 - 0.5 && x < h0 + hole - 0.5 && y >= h0 - 0.5 && y < h0 + hole - 0.5;
  let dots = '';
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (dark(x, y) && !eye(x, y) && !inHole(x, y)) dots += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.46"/>`;
  const eyeAt = (x, y) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="${ink}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.8"/>`;
  const markSize = hole - 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%"><g fill="${ink}">${dots}${eyeAt(0, 0)}${eyeAt(size - 7, 0)}${eyeAt(0, size - 7)}</g><image href="${icon}" x="${(size - markSize) / 2}" y="${(size - markSize) / 2}" width="${markSize}" height="${markSize}" clip-path="inset(0 round 1.4px)"/></svg>`;
}
const qr = qrSvg(link);

/** A seeded starfield, so every render is the same. */
function stars(w, h, n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let dots = '';
  for (let i = 0; i < n; i++) {
    const r = rnd() < 0.85 ? 0.6 + rnd() * 0.8 : 1.4 + rnd() * 1.2;
    dots += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h * 0.7).toFixed(1)}" r="${r.toFixed(2)}" fill="#F3F0FF" opacity="${(0.15 + rnd() * 0.55).toFixed(2)}"/>`;
  }
  return `<svg class="stars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${dots}</svg>`;
}

/** Soft stage beams fanning up from below: festival light at night. */
function beams(w, h, opacity = 1) {
  const cx = w / 2;
  const base = h * 1.02;
  const fan = [-38, -24, -11, 0, 11, 24, 38];
  const cols = ['#6B3FE0', '#A97CFF', '#FF7AC6', '#C9B6FF', '#FF7AC6', '#A97CFF', '#6B3FE0'];
  const len = h * 1.1;
  const spread = w * 0.035;
  let g = '';
  fan.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const tx = cx + Math.sin(a) * len;
    const ty = base - Math.cos(a) * len;
    const nx = Math.cos(a) * spread;
    const ny = Math.sin(a) * spread;
    g += `<polygon points="${cx},${base} ${tx - nx},${ty - ny} ${tx + nx},${ty + ny}" fill="url(#beam${i})"/>`;
  });
  const defs = cols
    .map((c, i) => {
      const a = (fan[i] * Math.PI) / 180;
      return `<linearGradient id="beam${i}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="${base}" x2="${cx + Math.sin(a) * len}" y2="${base - Math.cos(a) * len}"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="0.55" stop-color="${c}" stop-opacity="0.10"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
    })
    .join('');
  return `<svg class="beams" style="opacity:${opacity}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${defs}<filter id="soft"><feGaussianBlur stdDeviation="${w * 0.006}"/></filter></defs><g filter="url(#soft)" style="mix-blend-mode:screen">${g}</g></svg>`;
}

const baseCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #0A0918; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #F3F0FF; -webkit-font-smoothing: antialiased; }
  .piece { position: relative; overflow: hidden; background:
      radial-gradient(120% 70% at 50% -5%, rgba(107,63,224,0.55) 0%, rgba(58,35,128,0.35) 35%, rgba(10,9,24,0) 70%),
      radial-gradient(90% 45% at 50% 108%, rgba(255,122,198,0.22) 0%, rgba(107,63,224,0.18) 40%, rgba(10,9,24,0) 75%),
      #0A0918; }
  .stars, .beams { position: absolute; inset: 0; width: 100%; height: 100%; }
  .brand { display: flex; align-items: center; }
  .brand img { display: block; }
  .word { font-weight: 600; letter-spacing: 0.32em; color: #F3F0FF; }
  .kicker { display: inline-block; font-weight: 700; letter-spacing: 0.16em; color: #C9B6FF; border: 1px solid rgba(169,124,255,0.55); background: rgba(169,124,255,0.12); border-radius: 999px; }
  .head { font-family: 'Inter Display', 'Inter', sans-serif; font-weight: 800; letter-spacing: -0.035em; line-height: 0.98; }
  .head em { font-style: normal; background: linear-gradient(90deg, #C9B6FF 0%, #A97CFF 45%, #FF7AC6 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .body { color: rgba(243,240,255,0.72); font-weight: 450; letter-spacing: -0.01em; }
  .qrcard { background: #FFFFFF; box-shadow: 0 0 0 1px rgba(255,255,255,0.4), 0 0 80px rgba(169,124,255,0.45); }
  .faint { color: rgba(243,240,255,0.42); }
`;

/** Story (1080×1920) or post (1080×1350): same layout, scaled to fit. */
function social(w, h) {
  const tall = h > 1500;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}
    .piece { width: ${w}px; height: ${h}px; }
    /* A story's top 250 and bottom 340 px sit under Instagram's own buttons. */
    .content { position: absolute; inset: 0; padding: ${tall ? 250 : 84}px 88px ${tall ? 340 : 72}px; display: flex; flex-direction: column; }
    .brand img { width: 76px; height: 76px; border-radius: 18px; }
    .brand .word { font-size: 30px; margin-left: 22px; }
    .kicker { margin-top: ${tall ? 90 : 64}px; font-size: 26px; padding: 14px 26px; align-self: flex-start; }
    .head { font-size: ${tall ? 132 : 112}px; margin-top: ${tall ? 44 : 32}px; }
    .body { font-size: ${tall ? 40 : 35}px; line-height: 1.32; margin-top: ${tall ? 40 : 28}px; max-width: 860px; }
    .spacer { flex: 1; }
    .row { display: flex; align-items: center; gap: 48px; }
    .qrcard { width: ${tall ? 380 : 320}px; height: ${tall ? 380 : 320}px; border-radius: 40px; padding: ${tall ? 34 : 28}px; flex: none; }
    .scan { font-size: ${tall ? 44 : 38}px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
    .url { margin-top: 18px; font-size: 26px; color: #C9B6FF; font-weight: 600; letter-spacing: 0.01em; }
    .note { margin-top: ${tall ? 48 : 40}px; font-size: 21px; }
  </style></head><body><div class="piece">
    ${stars(w, h, tall ? 140 : 100)}${beams(w, h, 0.9)}
    <div class="content">
      <div class="brand"><img src="${icon}"><span class="word">AFTERGLOW</span></div>
      <span class="kicker">${when.toUpperCase()} · ${venue.toUpperCase()} · ${esc(kit.city).toUpperCase()}</span>
      <div class="head">Seeing <em>${name}</em><br>tonight?</div>
      <div class="body">Film a minute of the set and post it on Afterglow. Every angle of the night, from everyone in the room.</div>
      <div class="spacer"></div>
      <div class="row">
        <div class="qrcard">${qr}</div>
        <div><div class="scan">Scan to film<br>the set and post it</div><div class="url">${shortLink}</div></div>
      </div>
      <div class="note faint">Free on the web, no app needed. Afterglow isn’t affiliated with ${name} or ${venue}.</div>
    </div>
  </div></body></html>`;
}

/** Flyer, 4×6 in (1200×1800 at 300 dpi). */
function flyer() {
  const w = 1200;
  const h = 1800;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}
    .piece { width: ${w}px; height: ${h}px; }
    .content { position: absolute; inset: 0; padding: 110px 100px 90px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .brand img { width: 84px; height: 84px; border-radius: 20px; }
    .brand .word { font-size: 34px; margin-left: 24px; }
    .kicker { margin-top: 90px; font-size: 28px; padding: 14px 28px; }
    .head { font-size: 140px; margin-top: 46px; }
    .body { font-size: 42px; line-height: 1.32; margin-top: 40px; max-width: 920px; }
    .spacer { flex: 1; }
    .qrcard { width: 470px; height: 470px; border-radius: 48px; padding: 40px; }
    .scan { margin-top: 44px; font-size: 46px; font-weight: 700; letter-spacing: -0.02em; }
    .url { margin-top: 12px; font-size: 30px; color: #C9B6FF; font-weight: 600; }
    .note { margin-top: 44px; font-size: 22px; }
  </style></head><body><div class="piece">
    ${stars(w, h, 150)}${beams(w, h, 0.85)}
    <div class="content">
      <div class="brand"><img src="${icon}"><span class="word">AFTERGLOW</span></div>
      <span class="kicker">${when.toUpperCase()} · ${venue.toUpperCase()}</span>
      <div class="head">Seeing <em>${name}</em><br>tonight?</div>
      <div class="body">Film a minute of the set and post it. Every angle of the night, from everyone in the room.</div>
      <div class="spacer"></div>
      <div class="qrcard">${qr}</div>
      <div class="scan">Scan to film the set</div>
      <div class="url">${shortLink}</div>
      <div class="note faint">Free on the web, no app needed. Afterglow isn’t affiliated with ${name} or ${venue}.</div>
    </div>
  </div></body></html>`;
}

/** One sticker's markup, 900×900 (3 in at 300 dpi), rounded square. */
function stickerInner() {
  return `<div class="sticker">
    ${stars(900, 900, 50, 11)}${beams(900, 900, 0.75)}
    <div class="s-content">
      <div class="brand"><img src="${icon}"><span class="word">AFTERGLOW</span></div>
      <div class="head">Filming<br><em>${name}</em><br>tonight?</div>
      <div class="s-bottom">
        <div class="s-text"><div class="s-post">Post it on Afterglow</div><div class="s-when faint">${venue} · ${when}</div></div>
        <div class="qrcard">${qr}</div>
      </div>
    </div>
  </div>`;
}
const stickerCss = `
  .sticker { position: relative; overflow: hidden; width: 900px; height: 900px; border-radius: 96px; background:
      radial-gradient(120% 80% at 30% -10%, rgba(107,63,224,0.65) 0%, rgba(58,35,128,0.35) 40%, rgba(10,9,24,0) 72%),
      radial-gradient(90% 60% at 60% 112%, rgba(255,122,198,0.28) 0%, rgba(10,9,24,0) 70%),
      #0A0918; }
  .s-content { position: absolute; inset: 0; padding: 74px 74px 70px; display: flex; flex-direction: column; }
  .sticker .brand img { width: 56px; height: 56px; border-radius: 14px; }
  .sticker .brand .word { font-size: 24px; margin-left: 16px; }
  .sticker .head { font-size: 112px; margin-top: 40px; }
  .s-bottom { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
  .s-post { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .s-when { font-size: 22px; margin-top: 10px; font-weight: 500; }
  .sticker .qrcard { width: 300px; height: 300px; border-radius: 36px; padding: 24px; flex: none; box-shadow: 0 0 50px rgba(169,124,255,0.5); }
`;
const sticker = () => `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}${stickerCss} html, body { background: transparent; }</style></head><body>${stickerInner()}</body></html>`;

/** Six stickers on a US Letter page with faint cut lines, for printing at home. */
function sheet() {
  const cell = `<div class="cell">${stickerInner()}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}${stickerCss}
    @page { size: 8.5in 11in; margin: 0; }
    html, body { background: #FFFFFF; }
    .page { width: 8.5in; height: 11in; display: grid; grid-template-columns: 3in 3in; grid-template-rows: 3in 3in 3in; gap: 0.35in 0.5in; justify-content: center; align-content: center; }
    .cell { width: 3in; height: 3in; outline: 0.5px dashed #BBBBBB; outline-offset: 0.04in; border-radius: 0.32in; }
    .cell .sticker { transform: scale(${(3 * 96) / 900}); transform-origin: 0 0; }
  </style></head><body><div class="page">${cell.repeat(6)}</div></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function shot(html, file, w, h, scale = 1) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, file), omitBackground: file.includes('sticker'), clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
async function pdf(html, file, wIn, hIn, px) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(out, file), width: `${wIn}in`, height: `${hIn}in`, printBackground: true, scale: px ? (wIn * 96) / px : 1, pageRanges: '1' });
  await page.close();
}

await shot(social(1080, 1920), 'story-1080x1920.png', 1080, 1920);
await shot(social(1080, 1350), 'post-1080x1350.png', 1080, 1350);
await shot(flyer(), 'flyer-4x6in.png', 1200, 1800);
await pdf(flyer(), 'flyer-4x6in.pdf', 4, 6, 1200);
await shot(sticker(), 'sticker-3in.png', 900, 900);
await pdf(sticker(), 'sticker-3in.pdf', 3, 3, 900);
await pdf(sheet(), 'sticker-sheet-letter.pdf', 8.5, 11);
writeFileSync(join(out, 'link.txt'), `${link}\n`);
await browser.close();
console.log(`Promo kit written to ${kit.out} (QR opens ${link})`);
