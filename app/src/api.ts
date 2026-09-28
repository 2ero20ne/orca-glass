// 中継サーバ(bridge/server.mjs)の API クライアント。base が空ならアプリと同じオリジンを使う。
import { demoCall } from './demo';
import type { Lang } from './i18n';
let token = '';
let base = '';

let lang: Lang = 'en';
let demo = false;

export function setApiLang(l: Lang) {
  lang = l;
}

// デモモードでは通信せず、アプリ内の架空データを返す
export function setDemo(on: boolean) {
  demo = on;
}

let resolveBase: (() => Promise<string | null>) | null = null;

export function setConnection(c: { token: string; base: string; resolve?: () => Promise<string | null> }) {
  token = c.token;
  base = c.base.replace(/\/+$/, '');
  resolveBase = c.resolve ?? null;
}

export const currentBase = () => base;

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (demo) return demoCall(lang, method, path, body) as T;
  const binary = body instanceof Uint8Array;
  const req = () =>
    fetch(`${base}${path}${path.includes('?') ? '&' : '?'}lang=${lang}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': binary ? 'application/octet-stream' : 'application/json',
      },
      body: binary ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
    });
  let res: Response;
  try {
    res = await req();
  } catch (e) {
    // つながらない = トンネルの URL が変わった可能性。連絡板で最新を引き直して1回だけやり直す
    const next = resolveBase && (await resolveBase().catch(() => null));
    if (!next || next === base) throw e;
    base = next;
    res = await req();
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export type Thread = { handle: string; title: string; agent: string; state: 'idle' | 'busy' | 'unknown' };
export type Provider = { id: string; models: string[]; ok: boolean; note: string };
export type Workspace = { id: string; name: string };
type Limit = { usedPercent: number; resetDescription: string } | null;
export type Usage = Record<string, { status: string; error?: string | null; session?: Limit; weekly?: Limit }>;

export const api = {
  health: () => call<{ ok: boolean }>('GET', '/healthz'),
  threads: () => call<Thread[]>('GET', '/api/threads'),
  thread: (handle: string) => call<{ text: string }>('GET', `/api/thread?handle=${encodeURIComponent(handle)}`),
  replies: () => call<string[]>('GET', '/api/replies'),
  reply: (handle: string, index: number) => call<{ sent: string }>('POST', '/api/reply', { handle, index }),
  transcribe: (pcm: Uint8Array) => call<{ text: string }>('POST', '/api/transcribe', pcm),
  say: (handle: string, text: string) => call<{ sent: string }>('POST', '/api/say', { handle, text }),
  usage: () => call<Usage>('GET', '/api/usage'),
  providers: () => call<Provider[]>('GET', '/api/providers'),
  workspaces: () => call<Workspace[]>('GET', '/api/workspaces'),
  prompts: () => call<string[]>('GET', '/api/prompts'),
  startSession: (req: { workspaceId: string; agent: string; model: string; prompt: number }) =>
    call<{ handle: string; sent: boolean; reason?: string }>('POST', '/api/session', req),
};
