import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.md': 'text/plain' };

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Missing file');
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
      const stream = createReadStream(path);
      res.on('close', () => stream.destroy());
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return server.listen(port, '127.0.0.1');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serve(Number(process.env.PORT || 4173)).on('listening', function () {
    console.log('Atlas: http://127.0.0.1:' + this.address().port);
  });
}
