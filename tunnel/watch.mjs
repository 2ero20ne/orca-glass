// Quick Tunnel(登録不要の trycloudflare)を張り続け、切断とURL変化を記録する計測用スクリプト。
// 1分ごとにトンネル経由で /healthz を叩き、log.tsv に追記する。落ちたら張り直す(URLは変わる)。
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const LOG = join(here, 'log.tsv');
const CURRENT = join(here, 'current-url');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8787';
const PROBE_MS = 60_000;
const DEAD_AFTER = 5; // 連続失敗がこの回数(=5分)でトンネル死亡とみなし張り直す

// 連絡板(ntfy.sh)。トピック名は推測できない乱数、URL にはトークンで署名してなりすましを防ぐ
const NTFY = process.env.NTFY || 'https://ntfy.sh';
const PUBLISH_MS = 60 * 60_000; // ntfy.sh の保持期限より短い間隔で書き直す
const bridgeDir = join(here, '../bridge');
const topicFile = join(bridgeDir, '.topic');
if (!existsSync(topicFile)) writeFileSync(topicFile, 'eho-' + randomBytes(12).toString('base64url'), { mode: 0o600 });
const TOPIC = readFileSync(topicFile, 'utf8').trim();
const TOKEN = readFileSync(join(bridgeDir, '.token'), 'utf8').trim();

async function publish() {
  if (!url) return;
  const t = Date.now();
  const s = createHmac('sha256', TOKEN).update(`${url}|${t}`).digest('hex');
  try {
    const res = await fetch(`${NTFY}/${TOPIC}`, { method: 'POST', body: JSON.stringify({ u: url, t, s }) });
    log('publish', res.ok ? 'ok' : `HTTP ${res.status}`);
  } catch (e) {
    log('publish', `fail ${e.message}`);
  }
}

let url = null;
let fails = 0;
let child = null;

function log(event, detail = '') {
  const line = [new Date().toISOString(), event, url || '-', detail].join('\t');
  appendFileSync(LOG, line + '\n');
  console.log(line);
}

function start() {
  url = null;
  fails = 0;
  child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', ORIGIN], { stdio: ['ignore', 'ignore', 'pipe'] });
  log('start', `pid=${child.pid}`);
  child.stderr.on('data', (buf) => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== url) {
      url = m[0];
      writeFileSync(CURRENT, url + '\n');
      log('url');
      publish();
    }
  });
  child.on('exit', (code, sig) => {
    log('exit', `code=${code} sig=${sig}`);
    child = null;
    setTimeout(start, 5000);
  });
}

async function probe() {
  if (!url || !child) return;
  // 先に Mac 側(bridge)を直接確かめる。bridge 停止をトンネルの切断と数えない
  const local = await fetch(`${ORIGIN}/healthz`, { signal: AbortSignal.timeout(5_000) }).catch(() => null);
  if (!local?.ok) return log('origin-down', local ? `HTTP ${local.status}` : 'unreachable');
  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (fails > 0) log('recovered', `after ${fails} fails`);
    fails = 0;
    log('ok', `${Date.now() - t0}ms`);
  } catch (e) {
    fails++;
    log('fail', `${fails} ${e.message}`);
    if (fails >= DEAD_AFTER) {
      log('dead', 'restarting tunnel');
      child?.kill();
    }
  }
}

process.on('SIGTERM', () => {
  log('stop');
  child?.kill();
  process.exit(0);
});

start();
setInterval(probe, PROBE_MS);
setInterval(publish, PUBLISH_MS);
