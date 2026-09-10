// Publica el contenido de deploy/ en la rama huérfana deploy/dual-telescope.
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

await rm(wt, { recursive: true, force: true });
try { git('worktree', 'prune'); } catch { /* nada que podar */ }

const exists = git('branch', '--list', BRANCH) !== '';
if (exists) {
  git('worktree', 'add', wt, BRANCH);
} else {
  git('worktree', 'add', '--orphan', '-b', BRANCH, wt);
}

for (const entry of await readdir(wt)) {
  if (entry !== '.git') await rm(resolve(wt, entry), { recursive: true, force: true });
}
await mkdir(wt, { recursive: true });
await cp(pkg, wt, { recursive: true });

gitIn(wt, 'add', '-A');
// Fuerza bit de ejecución para start.sh en el índice git.
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
