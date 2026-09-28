// グラスの表示上限はバイト数で決まる(リスト項目 63B / テキスト 999B)。日本語は1文字3バイト。
const enc = new TextEncoder();

export function clipBytes(s: string, max: number): string {
  if (enc.encode(s).length <= max) return s;
  let out = '';
  for (const ch of s) {
    if (enc.encode(out + ch + '…').length > max) break;
    out += ch;
  }
  return out + '…';
}

// 末尾を残して先頭を落とす(ターミナルは最新が下にあるため)
export function tailBytes(s: string, max: number): string {
  if (enc.encode(s).length <= max) return s;
  const chars = [...s];
  let out = '';
  for (let i = chars.length - 1; i >= 0; i--) {
    if (enc.encode(chars[i] + out).length > max - 3) break;
    out = chars[i] + out;
  }
  return '…' + out;
}

// 表示行数で末尾を切る。1行 = 半角約56字(全角約28字)。折り返しを見積もって最新 maxRows 行分だけ残す
const COLS = 54;
const width = (s: string) => [...s].reduce((n, c) => n + (/[ᄀ-￿]/.test(c) ? 2 : 1), 0);

export function tailRows(s: string, maxRows: number): string {
  const out: string[] = [];
  let rows = 0;
  for (const line of s.split('\n').reverse()) {
    const r = Math.max(1, Math.ceil(width(line) / COLS));
    if (rows + r > maxRows) {
      const room = maxRows - rows;
      if (room > 0) out.unshift('…' + [...line].slice(-Math.floor((room * COLS) / 2)).join(''));
      break;
    }
    out.unshift(line);
    rows += r;
  }
  return out.join('\n');
}
