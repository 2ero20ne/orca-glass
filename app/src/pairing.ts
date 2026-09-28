// 接続コード `eho1.<トピック>.<トークン>` と、連絡板(ntfy.sh)からの接続先解決
import { hmacSha256Hex } from './hmac';

const NTFY = 'https://ntfy.sh';

export type Pairing = { topic: string; token: string };

export function parseCode(code: string): Pairing | null {
  const m = code.trim().match(/^eho1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  return m ? { topic: m[1], token: m[2] } : null;
}

// 連絡板の直近の書き込みから、トークンで署名が合う最新の URL を返す(偽の書き込みは無視)
export async function resolveBase(p: Pairing): Promise<string | null> {
  const res = await fetch(`${NTFY}/${p.topic}/json?poll=1&since=12h`);
  if (!res.ok) return null;
  let best: { u: string; t: number } | null = null;
  for (const line of (await res.text()).split('\n')) {
    try {
      const ev = JSON.parse(line);
      if (ev.event !== 'message') continue;
      const m = JSON.parse(ev.message);
      if (typeof m.u !== 'string' || typeof m.t !== 'number' || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(m.u)) continue;
      if (hmacSha256Hex(p.token, `${m.u}|${m.t}`) !== m.s) continue;
      if (!best || m.t > best.t) best = { u: m.u, t: m.t };
    } catch {
      // 壊れた行・他人の書き込みは読み飛ばす
    }
  }
  return best?.u ?? null;
}
