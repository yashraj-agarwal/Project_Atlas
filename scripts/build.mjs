import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(['index.html', 'css', 'assets', 'models', 'ASSET-CREDITS.md'].map((name) =>
  cp(new URL(name, root), new URL(name, output), { recursive: true })
));
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['js/main.js'],
  outdir: 'dist/js',
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  legalComments: 'linked',
  target: ['chrome109', 'firefox115', 'safari16.4'],
});
await cp(new URL('node_modules/three/LICENSE', root), new URL('THREE-LICENSE.txt', output));
await cp(new URL('node_modules/meshoptimizer/LICENSE.md', root), new URL('MESHOPTIMIZER-LICENSE.md', output));
