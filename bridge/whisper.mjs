// G2 のマイク音声(PCM 16kHz mono s16le)を whisper.cpp で文字にする。すべて Mac 内で完結し外部に送らない
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
// 既定は setup が置く場所。VoiceInk が同じモデルを持っていればそれを使う
const MODEL_NAME = 'ggml-large-v3-turbo-q5_0.bin';
export const MODEL =
  process.env.WHISPER_MODEL ||
  [
    join(homedir(), '.cache/orca-glass', MODEL_NAME),
    join(homedir(), 'Library/Application Support/com.prakashjoshipax.VoiceInk/WhisperModels', MODEL_NAME),
  ].find(existsSync) ||
  join(homedir(), '.cache/orca-glass', MODEL_NAME);

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function transcribe(pcm, lang = 'ja') {
  const dir = await mkdtemp(join(tmpdir(), 'eho-'));
  try {
    const file = join(dir, 'in.wav');
    await writeFile(file, wav(pcm));
    const { stdout } = await run('whisper-cli', ['-m', MODEL, '-l', lang, '-nt', '-np', '-f', file], { timeout: 60_000 });
    return stdout.trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
