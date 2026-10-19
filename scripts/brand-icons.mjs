// Draws the Afterglow mark (an "A" arch with a sun setting over water) and renders every icon from it in Chromium.
// Run: node scripts/brand-icons.mjs   (writes docs/brand/icon.svg, assets/*.png, public/apple-touch-icon.png, public/og.png)
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const defs = `<defs>
<radialGradient id="bg" cx=".5" cy=".55" r=".8"><stop offset="0" stop-color="#1A0B4A"/><stop offset=".55" stop-color="#0A0728"/><stop offset="1" stop-color="#04041A"/></radialGradient>
<linearGradient id="L" gradientUnits="userSpaceOnUse" x1="250" y1="820" x2="560" y2="230"><stop offset="0" stop-color="#FF7A5A"/><stop offset=".45" stop-color="#F23BA6"/><stop offset="1" stop-color="#8B4BFF"/></linearGradient>
<linearGradient id="R" gradientUnits="userSpaceOnUse" x1="800" y1="820" x2="480" y2="230"><stop offset="0" stop-color="#F23BA6"/><stop offset=".5" stop-color="#8B4BFF"/><stop offset="1" stop-color="#4F6BFF"/></linearGradient>
<linearGradient id="full" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A5C"/><stop offset=".5" stop-color="#F23BA6"/><stop offset="1" stop-color="#6A4BFF"/></linearGradient>
<radialGradient id="orb" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#9B7BFF"/><stop offset=".45" stop-color="#7A3BE0"/><stop offset=".75" stop-color="#D2349A"/><stop offset="1" stop-color="#FF8A3C"/></radialGradient>
<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C6BFF"/><stop offset=".55" stop-color="#FF4FB0"/><stop offset="1" stop-color="#FFB23C"/></linearGradient>
<radialGradient id="gloss" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="glow" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1424" height="1424"><feGaussianBlur stdDeviation="26"/></filter>
</defs>`;

/** The mark alone, drawn in a 1024 box (transparent). */
const LEGS = 'M270 810 L512 250 L754 810';
const orb = (cx, cy, r) => `<g filter="url(#glow)" opacity=".6"><circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="url(#rim)"/></g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#orb)" stroke="url(#rim)" stroke-width="${Math.max(4, r / 16)}"/><ellipse cx="${cx - r * 0.18}" cy="${cy - r * 0.45}" rx="${r * 0.55}" ry="${r * 0.3}" fill="url(#gloss)"/>`;
const mini = (cx, cy, r, c1, c2) => `<g filter="url(#glow)" opacity=".7"><circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="${c2}"/></g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}" stroke="${c2}" stroke-width="5"/><ellipse cx="${cx - r * 0.2}" cy="${cy - r * 0.4}" rx="${r * 0.5}" ry="${r * 0.28}" fill="#fff" opacity=".4"/>`;
const mark = `<g>
<g filter="url(#glow)" opacity=".4"><path d="${LEGS}" fill="none" stroke="url(#full)" stroke-width="120" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="M512 250 L270 810" stroke="url(#L)" stroke-width="124" stroke-linecap="round" fill="none"/>
<path d="M512 250 L754 810" stroke="url(#R)" stroke-width="124" stroke-linecap="round" fill="none"/>
<circle cx="512" cy="690" r="156" fill="none" stroke="#C9B6FF" stroke-opacity=".55" stroke-width="4"/>
${orb(512, 690, 92)}
${mini(644, 598, 24, '#6A4BFF', '#FF9A5C')}${mini(396, 800, 15, '#FF7A5A', '#FF4FB0')}
</g>`;

const svg = (inner, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${bg ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}${inner}</svg>`;
const scaled = (s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${mark}</g>`;
const mono = `<g transform="translate(512 512) scale(.64) translate(-512 -512)"><path d="${LEGS}" fill="none" stroke="#fff" stroke-width="124" stroke-linecap="round" stroke-linejoin="round"/><circle cx="512" cy="690" r="70" fill="#fff"/></g>`;

writeFileSync('docs/brand/icon.svg', svg(mark));

const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function render(markup, w, h, out, transparent = false) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>html,body{margin:0;background:${transparent ? 'transparent' : '#000'}}</style>${markup}`);
  await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
}
const img = (s, size) => `<div style="width:${size}px;height:${size}px">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;

await render(img(svg(mark), 1024), 1024, 1024, 'assets/icon.png');
await render(img(svg(mark), 1024), 1024, 1024, 'assets/splash-icon.png');
await render(img(svg(mark), 48), 48, 48, 'assets/favicon.png');
await render(img(svg(mark), 180), 180, 180, 'public/apple-touch-icon.png');
await render(img(svg('<rect width="1024" height="1024" fill="#04041A"/>', false), 1024), 1024, 1024, 'assets/android-icon-background.png');
await render(img(svg(scaled(0.64), false), 1024), 1024, 1024, 'assets/android-icon-foreground.png', true);
await render(img(svg(mono, false), 1024), 1024, 1024, 'assets/android-icon-monochrome.png', true);

const tile = `<div style="width:320px;height:320px;border-radius:72px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)">${svg(mark).replace('<svg ', '<svg width="320" height="320" ')}</div>`;
await render(
  `<div style="width:1200px;height:630px;background:radial-gradient(circle at 25% 20%,#2a1a5e 0,#120a33 45%,#080620 100%);display:flex;align-items:center;gap:60px;padding-left:120px;box-sizing:border-box;font-family:'DejaVu Sans',sans-serif">${tile}<div><div style="font-size:84px;font-weight:700;color:#f3eeff">Afterglow</div><div style="font-size:30px;line-height:46px;color:#c9bff5;margin-top:24px">Live sets from your festivals,<br>and a plan built from your sound.</div></div></div>`,
  1200,
  630,
  'public/og.png',
);
await render(
  `<div style="width:1200px;height:1200px;background:#04041A;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'DejaVu Sans',sans-serif">${svg(mark, false).replace('<svg ', '<svg width="720" height="720" ')}<div style="font-size:120px;font-weight:300;color:#f3eeff;margin-top:-40px;letter-spacing:2px">Afterglow</div><div style="font-size:36px;letter-spacing:14px;color:#C74BD8;margin-top:28px">FIND YOUR SOUND</div></div>`,
  1200,
  1200,
  'docs/brand/logo.png',
);
await b.close();
