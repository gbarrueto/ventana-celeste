// Publica el paquete de deploy/ en su propia rama huérfana.
//
// La rama contiene SÓLO el paquete — nada del código fuente, ni historia del
// repo principal. Así el dispositivo puede clonarla con --single-branch --depth 1
// y bajarse apenas esa app, no el monorepo entero.
//
// Se usa un worktree aparte a propósito: nunca toca el working tree actual, así
// que no hay riesgo de dejarlo a medias si algo falla en el medio.
//
// Uso:
//   pnpm run publish:deploy              # commitea en la rama local
//   pnpm run publish:deploy -- --push    # y además la sube
//   PUSH=1 pnpm run publish:deploy       # equivalente, pero no funciona en
//                                        # PowerShell (usar --push ahí)
import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const pkg = resolve(app, 'deploy');
const repo = resolve(app, '../..');
const BRANCH = 'deploy/dual-telescope';
const wt = resolve(repo, '.deploy-worktree');

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const gitIn = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();

try {
  await stat(pkg);
} catch {
  console.error('[publish] falta deploy/. Corré `pnpm run pack:deploy` antes.');
  process.exit(1);
}

// Un worktree colgado de un intento anterior no debe bloquear este.
await rm(wt, { recursive: true, force: true });
try { git('worktree', 'prune'); } catch { /* nada que podar */ }

const exists = git('branch', '--list', BRANCH) !== '';
if (exists) {
  git('worktree', 'add', wt, BRANCH);
} else {
  // Huérfana: sin ancestros comunes con main, así el clon pesa lo que el paquete.
  git('worktree', 'add', '--orphan', '-b', BRANCH, wt);
}

// Se vacía y se rellena, para que borrar un archivo en el paquete también lo
// borre en la rama.
for (const entry of await readdir(wt)) {
  if (entry !== '.git') await rm(resolve(wt, entry), { recursive: true, force: true });
}
await mkdir(wt, { recursive: true });
await cp(pkg, wt, { recursive: true });

gitIn(wt, 'add', '-A');
// En Windows core.filemode suele ser false, así que git ignora el permiso del
// disco y guardaría start.sh como 100644 — y entonces cada clon en el
// dispositivo da "permission denied". Se fuerza el bit en el índice, que no
// depende del sistema de archivos donde se publica.
gitIn(wt, 'update-index', '--chmod=+x', 'start.sh');
const dirty = gitIn(wt, 'status', '--porcelain') !== '';
if (!dirty) {
  console.log('[publish] sin cambios respecto de la última publicación.');
} else {
  const rev = git('rev-parse', '--short', 'HEAD');
  gitIn(wt, 'commit', '-q', '-m', `deploy: dual-telescope desde ${rev}`);
  console.log(`[publish] commit en ${BRANCH} (fuente: ${rev})`);
}

const push = process.env.PUSH === '1' || process.argv.includes('--push');
if (push) {
  gitIn(wt, 'push', '-u', 'origin', BRANCH);
  console.log('[publish] subido a origin.');
} else {
  console.log(`[publish] para subirlo:  git push -u origin ${BRANCH}`);
}

git('worktree', 'remove', wt, '--force');
console.log('[publish] listo.');
