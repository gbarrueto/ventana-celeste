// Empaqueta la aplicación y el relay en deploy/ para despliegue en dispositivo.
import { build } from 'esbuild';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const out = resolve(app, 'deploy');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

try {
  await stat(resolve(app, 'dist'));
} catch {
  console.error('[pack] falta dist/. Corré `pnpm build` antes.');
  process.exit(1);
}

await cp(resolve(app, 'dist'), resolve(out, 'dist'), { recursive: true });
await cp(resolve(app, 'start.sh'), resolve(out, 'start.sh'));

await build({
  entryPoints: [resolve(app, 'server/relay.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  banner: { js: "import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" },
  outfile: resolve(out, 'relay.mjs'),
});

console.log('[pack] listo en deploy/.');
