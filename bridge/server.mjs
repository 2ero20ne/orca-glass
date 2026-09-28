// Even Hub アプリ(グラス)と orca CLI をつなぐ中継サーバ。
// アプリの静的ファイルも同じオリジンで配るので、CORS は不要。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import * as o from './orca.mjs';
import { transcribe } from './whisper.mjs';

const here = new URL('.', import.meta.url).pathname;
const DIST = join(here, '../app/dist');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
// config.json(共有の既定値)に config.local.json(各自の環境・git 管理外)を上書きする
const config = JSON.parse(readFileSync(join(here, 'config.json'), 'utf8'));
const localFile = join(here, 'config.local.json');
if (existsSync(localFile)) Object.assign(config, JSON.parse(readFileSync(localFile, 'utf8')));

const tokenFile = join(here, '.token');
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(18).toString('base64url'), { mode: 0o600 });
const TOKEN = process.env.EHO_TOKEN || readFileSync(tokenFile, 'utf8').trim();

function authorized(req) {
  const got = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || '');
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

const run = promisify(execFile);
async function installed(cmd) {
  try {
    await run('/bin/sh', ['-lc', `command -v ${cmd}`]);
    return true;
  } catch {
    return false;
  }
}

// アプリから届く ?lang= に合わせた文言(日本語・英語)
const L = {
  ja: {
    unknownUsage: '使用量不明', unavailable: '使用不可', weekLimit: '週上限 ({0})', sessionLimit: '5h上限 ({0})',
    week: '週', notInstalled: '未インストール', noMenu: '選択肢が出ていません',
    dialog: '確認ダイアログ表示中', notReady: 'エージェントの準備が終わりません',
  },
  en: {
    unknownUsage: 'usage unknown', unavailable: 'unavailable', weekLimit: 'weekly limit ({0})', sessionLimit: '5h limit ({0})',
    week: 'week', notInstalled: 'not installed', noMenu: 'No choice menu on screen',
    dialog: 'a confirmation dialog is open', notReady: 'the agent did not become ready',
  },
};
const langOf = (q) => (q.get('lang') === 'ja' ? 'ja' : 'en');
const msg = (lang, key, ...a) => L[lang][key].replace(/\{(\d)\}/g, (_, i) => a[i]);
// config の文言は文字列か { ja, en }
const pick = (v, lang) => (typeof v === 'string' ? v : v[lang] ?? v.en ?? v.ja);

function limitSummary(rl, lang) {
  if (!rl) return { ok: true, note: msg(lang, 'unknownUsage') };
  if (rl.status === 'unavailable') return { ok: false, note: msg(lang, 'unavailable') };
  const s = rl.session?.usedPercent;
  const w = rl.weekly?.usedPercent;
  if (w >= 100) return { ok: false, note: msg(lang, 'weekLimit', rl.weekly.resetDescription) };
  if (s >= 100) return { ok: false, note: msg(lang, 'sessionLimit', rl.session.resetDescription) };
  const parts = [s != null && `5h ${s}%`, w != null && `${msg(lang, 'week')} ${w}%`].filter(Boolean);
  return { ok: true, note: parts.join(' ') || msg(lang, 'unknownUsage') };
}

async function providers(q) {
  const lang = langOf(q);
  const limits = await o.usage().catch(() => ({}));
  return Promise.all(
    config.agents.map(async (a) => {
      const has = await installed(a.command);
      const lim = limitSummary(limits[a.id], lang);
      return { id: a.id, models: a.models, ok: has && lim.ok, note: has ? lim.note : msg(lang, 'notInstalled') };
    }),
  );
}

const MAX_AUDIO = 16000 * 2 * 90; // 90秒分

async function raw(req, max) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw new Error('too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function body(req) {
  if (req.headers['content-type'] === 'application/octet-stream') return raw(req, MAX_AUDIO);
  const s = (await raw(req, 64 * 1024)).toString('utf8');
  return s ? JSON.parse(s) : {};
}

const routes = {
  'GET /api/threads': () => o.listThreads(),
  'GET /api/thread': (q) => o.readThread(q.get('handle')).then((text) => ({ text })),
  'GET /api/replies': (q) => config.replies.map((r) => pick(r.label, langOf(q))),
  'POST /api/reply': async (q, b) => {
    const lang = langOf(q);
    const r = config.replies[b.index];
    if (!r) throw new Error('unknown reply');
    const text = pick(r.text, lang);
    // Enter なしの数字は選択肢用。選択肢が無い時に送ると入力欄に数字が残り次の返信に混ざる
    if (!r.enter && /^\d+$/.test(text) && !(await o.hasNumberedMenu(b.handle))) {
      throw new Error(msg(lang, 'noMenu'));
    }
    await o.sendToThread(b.handle, text, r.enter);
    return { sent: pick(r.label, lang) };
  },
  // 音声入力: 文字起こしと、確認後の自由文送信
  'POST /api/transcribe': async (q, pcm) => ({ text: pcm.length ? await transcribe(pcm, langOf(q)) : '' }),
  'POST /api/say': async (_q, b) => {
    const text = String(b.text || '').trim();
    if (!text || text.length > 2000) throw new Error('bad text');
    await o.sendToThread(b.handle, text, true);
    return { sent: text };
  },
  'GET /api/usage': () => o.usage(),
  'GET /api/providers': providers,
  // Orca のフォルダ(非git)は CLI で名前を引けないため config で明示する
  'GET /api/workspaces': async () => [...(config.workspaces || []), ...(await o.listWorkspaces())],
  'GET /api/prompts': (q) => config.prompts.map((p) => pick(p.label, langOf(q))),
  'POST /api/session': async (q, b) => {
    const lang = langOf(q);
    const agent = config.agents.find((a) => a.id === b.agent);
    const prompt = config.prompts[b.prompt];
    if (!agent || !prompt || !agent.models.includes(b.model)) throw new Error('bad session request');
    const command = b.model === 'default' ? agent.command : `${agent.command} --model ${b.model}`;
    const r = await o.startSession({ workspaceId: b.workspaceId, command, prompt: pick(prompt.text, lang) });
    return r.reason ? { ...r, reason: msg(lang, r.reason) } : r;
  },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // アプリを別オリジン(固定の置き場所)から開いても呼べるようにする。認証は Bearer なので Cookie は使わない
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '600',
    });
    return res.end();
  }
  try {
    // トンネル死活監視用。情報は何も返さない
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) {
      if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) return send(res, 404, { error: 'not found' });
      return send(res, 200, await route(url.searchParams, req.method === 'POST' ? await body(req) : {}));
    }
    const file = join(DIST, normalize(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, HOST, () => {
  console.log(`evenhub-orca bridge: http://${HOST}:${PORT}/?token=${TOKEN}`);
});

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
