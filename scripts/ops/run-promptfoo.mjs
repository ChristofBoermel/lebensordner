import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const promptfooHome = resolve(repoRoot, '.cache', 'promptfoo-home');

mkdirSync(promptfooHome, { recursive: true });

const env = {
  ...process.env,
  HOME: promptfooHome,
  USERPROFILE: promptfooHome,
  PROMPTFOO_DISABLE_TELEMETRY: '1',
};

const result = spawnSync('npx', ['promptfoo', ...process.argv.slice(2)], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
