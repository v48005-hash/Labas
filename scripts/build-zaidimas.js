'use strict';
// Sukuria vieną savarankišką failą dss-patikra.html (žaidimas + three.js + stiliai),
// kurį galima nusiųsti kolegoms ir atidaryti dukart spustelėjus – be serverio ir interneto.
// Paleidimas: npx esbuild turi būti pasiekiamas (npm i -D esbuild) → node scripts/build-zaidimas.js
const fs = require('fs');
const path = require('path');
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');

const dir = path.join(__dirname, '..', 'public', 'zaidimas');
const out = path.join(__dirname, '..', 'dss-patikra.html');
const js = esbuild.buildSync({
  entryPoints: [path.join(dir, 'js', 'main.js')], bundle: true, minify: true, format: 'iife', write: false,
  alias: { three: path.join(dir, 'vendor', 'three.module.min.js') }, legalComments: 'none',
}).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// tekstūros ir dangaus panoramos – kaip data: URI, kad veiktų atidarius failą iš disko
const assets = {};
for (const f of fs.readdirSync(path.join(dir, 'tex')).filter(f => f.endsWith('.jpg'))) {
  assets[f.slice(0, -4)] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, 'tex', f)).toString('base64');
}
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace(/<script type="importmap">.*?<\/script>\n?/s, '')
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>window.DSS_ASSETS=${JSON.stringify(assets)};</script>\n<script>${js}</script>`);
fs.writeFileSync(out, html);
console.log('Sukurta:', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
