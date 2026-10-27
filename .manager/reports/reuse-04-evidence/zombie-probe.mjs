import { spawn } from 'node:child_process';
import { once } from 'node:events';
const probe = (id) => { try { process.kill(id, 0); return 'ok'; } catch (e) { return e.code; } };
const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
await once(child, 'spawn');
const log = [];
child.on('exit', () => log.push(`exit event: group=${probe(-child.pid)} pid=${probe(child.pid)}`));
process.kill(-child.pid, 'SIGTERM');
for (let i = 0; i < 6; i++) {
  log.push(`t+${i * 20}ms group=${probe(-child.pid)} pid=${probe(child.pid)} exitCode=${child.signalCode}`);
  await new Promise((r) => setTimeout(r, 20));
}
console.log(process.platform, process.version);
console.log(log.join('\n'));
