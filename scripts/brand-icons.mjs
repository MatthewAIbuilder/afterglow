// Draws the Afterglow mark (an "A" arch with a sun setting over water) and renders every icon from it in Chromium.
// Run: node scripts/brand-icons.mjs   (writes docs/brand/icon.svg, assets/*.png, public/apple-touch-icon.png, public/og.png)
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const defs = `<defs>
<radialGradient id="bg" cx=".5" cy=".55" r=".8"><stop offset="0" stop-color="#1A0B4A"/><stop offset=".55" stop-color="#0A0728"/><stop offset="1" stop-color="#04041A"/></radialGradient>
<linearGradient id="arch" gradientUnits="userSpaceOnUse" x1="300" y1="820" x2="720" y2="220"><stop offset="0" stop-color="#FF7A5A"/><stop offset=".32" stop-color="#F23BA6"/><stop offset=".68" stop-color="#9B3DF0"/><stop offset="1" stop-color="#4F46FF"/></linearGradient>
<linearGradient id="ribbon" gradientUnits="userSpaceOnUse" x1="392" y1="820" x2="632" y2="390"><stop offset="0" stop-color="#FFC56A"/><stop offset=".5" stop-color="#FF63B8"/><stop offset="1" stop-color="#9A8CFF"/></linearGradient>
<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".45" stop-color="#FF8A5C"/><stop offset="1" stop-color="#E23C9A"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C74BD8"/><stop offset="1" stop-color="#4B2BE0"/></linearGradient>
<clipPath id="above"><rect x="380" y="560" width="264" height="168"/></clipPath>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
</defs>`;

/** The mark alone, drawn in a 1024 box (transparent). */
const ARCH = 'M268 806 C268 500 396 236 512 236 C628 236 756 500 756 806';
const INNER = 'M392 806 C392 580 450 392 512 392 C574 392 632 580 632 806';
const mark = `<g>
<g filter="url(#glow)" opacity=".5"><path d="${ARCH}" fill="none" stroke="url(#arch)" stroke-width="118" stroke-linecap="round"/></g>
<path d="${ARCH}" fill="none" stroke="url(#arch)" stroke-width="118" stroke-linecap="round"/>
<path d="${INNER}" fill="none" stroke="url(#ribbon)" stroke-width="38" stroke-linecap="round"/>
<circle cx="512" cy="700" r="96" fill="#FF8A5C" opacity=".3" filter="url(#glow)"/>
<g clip-path="url(#above)"><circle cx="512" cy="706" r="90" fill="url(#sun)"/></g>
<g fill="url(#sea)"><rect x="430" y="730" width="164" height="9" rx="4.5"/><rect x="444" y="752" width="136" height="8" rx="4"/><rect x="462" y="773" width="100" height="7" rx="3.5"/></g>
</g>`;

const svg = (inner, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${bg ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}${inner}</svg>`;
const scaled = (s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${mark}</g>`;
const mono = `<g transform="translate(512 512) scale(.64) translate(-512 -512)"><path d="M268 806 C268 500 396 236 512 236 C628 236 756 500 756 806" fill="none" stroke="#fff" stroke-width="118" stroke-linecap="round"/><path d="M392 806 C392 580 450 392 512 392 C574 392 632 580 632 806" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round"/><circle cx="512" cy="700" r="56" fill="#fff"/></g>`;

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
