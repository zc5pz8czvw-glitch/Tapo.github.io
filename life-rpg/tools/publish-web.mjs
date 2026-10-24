// Copiază site-ul construit (build/site) în life-rpg/web, folderul servit de GitHub Pages din ramura main:
// https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/  (jocul + confidențialitate + termeni + suport)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'build/site'), DST = path.join(ROOT, 'web');
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true });
console.log('WEB OK → life-rpg/web (fă commit și merge în main ca să apară pe GitHub Pages)');
