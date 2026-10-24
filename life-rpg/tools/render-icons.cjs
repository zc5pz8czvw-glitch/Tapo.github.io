const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const svg = fs.readFileSync(process.argv[2], 'utf8'), out = process.argv[3];
  const b = await chromium.launch(); const p = await b.newPage();
  const shot = async (size, file, pad) => {
    await p.setViewportSize({ width: size, height: size });
    const inner = pad ? `<div style="width:${size}px;height:${size}px;background:#1c1450;display:grid;place-items:center"><div style="width:${size*0.8}px;height:${size*0.8}px">${svg.replace('width="1024" height="1024"', 'width="100%" height="100%"')}</div></div>` : svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`);
    await p.setContent(`<html><body style="margin:0;background:#11122a">${inner}</body></html>`);
    await p.screenshot({ path: path.join(out, file), omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(1024, 'icon-1024.png'); await shot(512, 'icon-512.png'); await shot(192, 'icon-192.png'); await shot(180, 'apple-touch-icon.png'); await shot(512, 'icon-maskable-512.png', true);
  await b.close();
})();
