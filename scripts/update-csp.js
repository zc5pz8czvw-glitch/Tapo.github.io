// Recomputes the sha256 hashes of the inline <script> blocks in index.html and writes them into
// the Content-Security-Policy meta tag. Run after editing any inline script:  npm run update-csp
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const out = html.replace(/script-src [^;]*;/, `script-src ${hashes.join(' ')};`);
if (process.argv.includes('--check')) {
  if (out !== html) { console.error('CSP script hashes are out of date — run: npm run update-csp'); process.exit(1); }
  console.log('CSP script hashes are up to date.');
} else {
  fs.writeFileSync(file, out);
  console.log('script-src ' + hashes.join(' '));
}
