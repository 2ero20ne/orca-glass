// orca CLI の薄いラッパー。全て `--json` で呼び、result を返す。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ORCA = process.env.ORCA_BIN || 'orca';

export async function orca(args, { timeoutMs = 15000 } = {}) {
  const { stdout } = await run(ORCA, [...args, '--json'], {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  const out = JSON.parse(stdout);
  if (!out.ok) throw new Error(out.error?.message || JSON.stringify(out.error || out));
  return out.result;
}

// Claude Code はタイトル先頭に状態記号を付ける: ✳ = 入力待ち、◐◓◑◒ 等 = 作業中
function stateFromTitle(title) {
  if (!title) return 'unknown';
  if (title.startsWith('✳')) return 'idle';
  if (/^[◐◓◑◒⠁-⣿]/u.test(title)) return 'busy';
  return 'unknown';
}

export async function listThreads() {
  const { terminals } = await orca(['terminal', 'list']);
  return terminals
    .filter((t) => t.connected && !t.orphaned && t.agentIdentity)
    .map((t) => ({
      handle: t.handle,
      title: (t.title || 'Untitled').replace(/^[✳◐◓◑◒⠁-⣿]\s*/u, ''),
      agent: t.agentIdentity,
      state: stateFromTitle(t.title),
      lastOutputAt: t.lastOutputAt,
    }))
    .sort((a, b) => (b.lastOutputAt || 0) - (a.lastOutputAt || 0));
}

// エージェントの本文ではない UI の定型表示(アンケート・Tips・更新通知)。グラスの狭い画面を占有するので落とす
const NOISE = [
  /^⏺ Can Anthropic look at your session transcript/,
  /^Learn more: https:\/\/code\.claude\.com\/docs\//,
  /^y: Yes\s+n: No/,
  /^⏺? ?How is Claude doing this session\?/,
  /^1: Bad\s+2: Fine\s+3: Good/,
  /^Tip: /,
  /Update installed · Restart to update$/,
  /^\(disable recaps in \/config\)$/,
  /^\(ctrl\+b to run in background\)$/,
];

// 画面末尾の入力欄(──── ❯ ──── とステータス行)を落とし、本文だけ残す
export function cleanScreen(lines) {
  const seps = lines.flatMap((l, i) => (/^\s*─{10,}\s*$/.test(l) ? [i] : []));
  const body = seps.length >= 2 ? lines.slice(0, seps[seps.length - 2]) : lines;
  return unwrap(body.map((l) => l.trimEnd()))
    .map((l) => l.trim())
    .filter((l) => !NOISE.some((re) => re.test(l)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 全角は2桁として数える
const cols = (s) => [...s].reduce((n, c) => n + (/[ᄀ-￿]/.test(c) ? 2 : 1), 0);

// 端末幅で折り返された行をつなぎ直す(グラスは自前で折り返すため)
function unwrap(lines) {
  const width = Math.max(0, ...lines.map(cols));
  const out = [];
  let prevFull = false;
  for (const l of lines) {
    if (prevFull && l.trim()) out[out.length - 1] += l.trim();
    else out.push(l);
    prevFull = cols(l) >= width - 4;
  }
  return out;
}

// Claude Code の画面から回答の文章だけを残す。行頭の記号で種類を見分け、続く字下げ行は同じ種類として扱う
//   ⏺ 文章 = 回答 / ⏺ Tool(…) = ツール実行 / ⎿ = ツール出力 / ✻ ∴ など = 思考・作業中 / ❯ = 利用者の入力
// ツール名は「Bash(」「Web Search(」のような語+括弧、MCP は「server - tool (MCP)(」
const TOOL_CALL =
  /^⏺ (?:[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)?\(|[\w.-]+ - [\w .-]+ \(MCP\)|Update Todos\b|Agent ".*" (?:finished|launched|failed|stopped))/;
// 折りたたまれたツールの要約行(例: "Called claude-in-chrome 2 times, ran 1 shell command")
const TOOL_SUMMARY =
  /^\s{2}(?:(?:Called [\w.-]+(?: \d+ times)?|[Rr]an \d+ (?:shell |bash )?commands?|[Rr]ead \d+ files?|[Ss]earched for \d+ patterns?|[Ll]isted \d+ (?:directories|directory|paths?)|[Ee]dited \d+ files?|[Ww]rote \d+ files?|[Ff]etched \d+ (?:urls?|pages?))(?:, |$))+$/;
const STATUS = /^[✻✢✳✶✽∴·*◐◓◑◒] /;

export function answersOnly(lines) {
  const out = [];
  let keep = false;
  let head = -1; // 今の回答ブロックの先頭行の位置
  for (const l of lines) {
    if (/^\s*─{10,}\s*$/.test(l)) break; // 入力欄から下は画面の枠
    if (l.startsWith('⏺ ')) {
      keep = !TOOL_CALL.test(l);
      if (keep) {
        out.push('', l.slice(2));
        head = out.length - 1;
      }
    } else if (/^\s*⎿/.test(l)) {
      // ツール実行は「説明1行 + ⎿ 出力」。説明は ⏺ 行(実行中の表示)か字下げ行のどちらかで、回答ではない
      if (keep && out.length - 1 === head) out.splice(head - 1, 2);
      else if (keep && out[out.length - 1]?.trim()) out.pop();
      keep = false;
    } else if (STATUS.test(l) || l.startsWith('❯') || TOOL_SUMMARY.test(l)) {
      keep = false;
    } else if (keep) {
      out.push(l);
    }
  }
  return out;
}

// Codex の画面: • 文章 = 回答 / • Ran … など = ツール・お知らせ / └ = 出力 / › = 入力(最後の › 行は入力欄) / ⚠ ■ = 警告・エラー
const CODEX_EVENT =
  /^• (?:Ran|Explored|Edited|Added|Deleted|Updated Plan|Called|Searched|Read|Listed|Waited|Worked|Working|Model changed|You have|Context|Compact)/;

export function codexAnswersOnly(lines) {
  // Orca の画面幅や TUI の再描画によって入力欄に左余白が付くことがある。
  // `›` 以降は入力欄とモデル/ショートカット等のステータスなのでまとめて除外する。
  const last = lines.map((l) => /^›(?:\s|$)/.test(l.trimStart())).lastIndexOf(true);
  const body = last >= 0 ? lines.slice(0, last) : lines;
  const out = [];
  let keep = false;
  for (const l of body) {
    const line = l.trimStart();
    if (line.startsWith('• ')) {
      keep = !CODEX_EVENT.test(line);
      if (keep) out.push('', line.slice(2));
    } else if (/^(?:└|[›⚠■>])/.test(line) || /^(\+ Show details|↓ Back to bottom)/.test(line)) {
      keep = false;
    } else if (keep) {
      out.push(l);
    }
  }
  return out;
}

// スレッドのエージェント種別(terminal show の agentIdentity)。変わらないので覚えておく
const agentCache = new Map();
async function agentOf(handle) {
  if (!agentCache.has(handle)) {
    const r = await orca(['terminal', 'show', '--terminal', handle]).catch(() => null);
    agentCache.set(handle, r?.terminal?.agentIdentity ?? null);
  }
  return agentCache.get(handle);
}

export async function readThread(handle) {
  const { terminal } = await orca(['terminal', 'read', '--terminal', handle, '--screen']);
  const lines = terminal.tail || [];
  const agent = await agentOf(handle);
  const pick = agent === 'claude' ? answersOnly : agent === 'codex' ? codexAnswersOnly : null;
  const answer = pick && cleanScreen(pick(lines));
  return answer || cleanScreen(lines);
}

// 番号付きの選択肢(❯ 1. Yes / 2. … )が画面に出ているか
export async function hasNumberedMenu(handle) {
  const { terminal } = await orca(['terminal', 'read', '--terminal', handle, '--screen']);
  const tail = (terminal.tail || []).slice(-25);
  // 返答中の箇条書き「1. 2.」と区別するため、選択中の印 ❯ が付いた番号行を必須にする
  // 選択中の印は Claude Code が ❯、Codex が ›
  const selected = tail.some((l) => /^\s*[❯›]\s*\d+\.\s/.test(l));
  return selected && tail.filter((l) => /^\s*([❯›]\s*)?\d+\.\s/.test(l)).length >= 2;
}

export async function sendToThread(handle, text, enter) {
  const args = ['terminal', 'send', '--terminal', handle, '--text', text];
  if (enter) args.push('--enter');
  return orca(args);
}

export async function usage() {
  const { rateLimits } = await orca(['account', 'list']);
  return rateLimits;
}

export async function listWorkspaces() {
  const { worktrees } = await orca(['worktree', 'list']);
  return worktrees
    .filter((w) => !w.isArchived)
    .map((w) => ({
      id: w.id,
      name: w.path.split('/').pop() + (w.isMainWorktree ? '' : `:${w.displayName}`),
    }));
}

export async function startSession({ workspaceId, command, prompt }) {
  const created = await orca(['terminal', 'create', '--worktree', `id:${workspaceId}`, '--command', command]);
  const handle = created.terminal?.handle || created.handle;
  if (!handle) throw new Error('terminal create returned no handle');
  if (!prompt) return { handle, sent: false };
  // 起動途中に送った入力は失われるので、TUI が落ち着くのを確認してから送る
  const w = await orca(
    ['terminal', 'wait', '--terminal', handle, '--for', 'tui-idle', '--timeout-ms', '60000'],
    { timeoutMs: 70000 },
  ).catch(() => null); // タイムアウトは ok:false + 非ゼロ終了で返る
  if (!w?.wait?.satisfied) return { handle, sent: false, reason: 'notReady' };
  // 初回フォルダの信頼確認などのダイアログに指示を打ち込まないよう、画面を見てから送る
  const { terminal } = await orca(['terminal', 'read', '--terminal', handle, '--screen']);
  if (/Enter to confirm|trust this folder|Do you want to/i.test((terminal.tail || []).join('\n'))) {
    return { handle, sent: false, reason: 'dialog' };
  }
  await sendToThread(handle, prompt, true);
  return { handle, sent: true };
}
