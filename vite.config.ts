import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// A build id made from the game's own files, so every APK built from the same code gets the same
// id. The in-game update check compares it with the id of the newest published APK.
function hashTree(paths: string[]): string {
  const h = createHash('sha256');
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) for (const n of readdirSync(p).sort()) walk(join(p, n));
    else h.update(p).update(readFileSync(p));
  };
  for (const p of paths) walk(p);
  return h.digest('hex').slice(0, 12);
}
const BUILD_ID = process.env.BUILD_ID || hashTree(['index.html', 'src', 'public', 'package-lock.json']);
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

const versionFile = (): Plugin => ({
  name: 'stellar-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, version: pkg.version }) });
  },
});

export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [versionFile()],
});
