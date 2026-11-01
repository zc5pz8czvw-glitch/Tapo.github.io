const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
(async()=>{
  const ROOT=__dirname;
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':'font/woff2'});fs.createReadStream(p).pipe(r)}).listen(0);
  await new Promise(r=>srv.on('listening',r));
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const pg=await b.newPage({viewport:{width:1080,height:1920}});
  await pg.goto(`http://127.0.0.1:${srv.address().port}/scene.html`);await pg.waitForFunction(()=>window.__ready);
  const out=await pg.evaluate(()=>{const o=[];for(let t=4.4;t<19;t+=0.25)o.push([t.toFixed(2),JSON.stringify(window.frameBounds(t))]);return o});
  out.forEach(l=>console.log(l.join(' ')));await b.close();srv.close();
})();
