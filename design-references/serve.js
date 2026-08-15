// Throwaway static server for the design playground. Not part of the game.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8765;
const TYPES = { '.html':'text/html; charset=utf-8', '.md':'text/plain; charset=utf-8',
  '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml' };

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') {
    const files = fs.readdirSync(ROOT).filter(f => !f.startsWith('.') && f !== 'serve.js').sort();
    const links = files.map(f => `<li><a href="/${f}">${f}</a></li>`).join('');
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{background:#14110F;color:#FFF8F0;font:16px/1.7 system-ui;padding:32px}
a{color:#FFD400}h1{font-size:20px;letter-spacing:.04em}li{margin:6px 0}</style>
<h1>Fighter RPG Showdown 3D — design-references</h1><ul>${links}</ul>`);
  }
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {'Content-Type':'text/plain'});
    return res.end('Not found');
  }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                      'Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log('serving ' + ROOT + ' on 0.0.0.0:' + PORT));
