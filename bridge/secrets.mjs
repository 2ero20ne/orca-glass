// トークンと連絡板のトピック名。bridge とトンネル監視のどちらが先に起動しても同じ値を使う
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;

function secret(name, make) {
  const file = join(dir, name);
  try {
    // 'wx' は既にあれば失敗する。同時起動でも片方の値だけが残る
    writeFileSync(file, make(), { mode: 0o600, flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return readFileSync(file, 'utf8').trim();
}

export const token = () => secret('.token', () => randomBytes(18).toString('base64url'));
export const topic = () => secret('.topic', () => 'eho-' + randomBytes(12).toString('base64url'));
