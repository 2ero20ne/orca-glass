// 中継サーバとトンネル監視をまとめて起動する(どちらかが落ちたら両方止める)
import { spawn } from 'node:child_process';

const here = new URL('..', import.meta.url).pathname;
const procs = [
  ['bridge', ['bridge/server.mjs'], { HOST: '127.0.0.1' }],
  ['tunnel', ['tunnel/watch.mjs'], {}],
].map(([name, args, env]) => {
  const p = spawn(process.execPath, args, { cwd: here, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (b) => String(b).trimEnd().split('\n').forEach((l) => console.log(`[${name}] ${l.replace(/token=\S+/, 'token=***')}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (code) => {
    console.log(`[${name}] exited (${code})`);
    procs.forEach((q) => q.kill());
    process.exit(code ?? 1);
  });
  return p;
});
process.on('SIGINT', () => procs.forEach((p) => p.kill()));
