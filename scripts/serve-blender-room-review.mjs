import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'docs/3d-rooms/candidates/blender-v3');
const routes = new Map([
  ['/', path.join(root, 'scripts/lib/blender-review-viewer.html')],
  ['/asset.glb', path.join(assets, 'review-room-candidate.glb')],
  ['/composition.json', path.join(assets, 'composition.json')],
  ['/lighting.json', path.join(assets, 'lighting-manifest.json')],
  ['/manifest.json', path.join(assets, 'asset-manifest.json')],
  ['/production.png', path.join(assets, 'renders/production.png')],
  ['/three.module.js', path.join(root, 'node_modules/three/build/three.module.js')],
  ['/three.core.js', path.join(root, 'node_modules/three/build/three.core.js')],
]);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    let file = routes.get(url.pathname);
    if (url.pathname.startsWith('/addons/')) {
      const addonRoot = path.join(root, 'node_modules/three/examples/jsm');
      const target = path.resolve(addonRoot, decodeURIComponent(url.pathname.slice(8)));
      if (target.startsWith(addonRoot + path.sep) && target.endsWith('.js')) file = target;
    }
    if (!file) { res.writeHead(404).end('Not found'); return; }
    const bytes = await fs.readFile(file);
    res.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream','content-length':bytes.length,'cache-control':'no-store'});
    res.end(bytes);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}`,scope:'local review only; no world mutation'})));
