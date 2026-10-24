import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
function walk(p) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const f = p + '/' + e.name;
    if (e.isDirectory()) walk(f);
    else if (f.endsWith('.js'))
      execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
  }
}
for (const p of ['apps', 'packages', 'domain-packs', 'tests', 'scripts']) walk(p);
console.log('Syntaxe JavaScript valide.');
