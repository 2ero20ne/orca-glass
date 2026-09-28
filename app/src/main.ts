import {
  AudioInputSource,
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import { api, currentBase, setApiLang, setConnection, setDemo, type Provider, type Thread, type Workspace } from './api';
import { parseCode, resolveBase } from './pairing';
import { applyPage, detectLang, setLang, t as tr } from './i18n';
import { clipBytes, tailBytes, tailRows } from './text';

// 画面 576x288。上に見出し(テキスト)、下に本文(リスト or テキスト)の2段構成で統一する。
const HEAD = { containerID: 1, containerName: 'head', xPosition: 0, yPosition: 0, width: 576, height: 36 };
const BODY = { containerID: 2, containerName: 'body', xPosition: 0, yPosition: 40, width: 576, height: 248 };
const LIST_ITEM_BYTES = 63;
const LIST_MAX = 20;
const TEXT_BYTES = 999;
// 本文欄に収まるのは約8行。最新行を見せるため末尾だけ送る
const BODY_ROWS = 8;
const POLL_MS = 3000;

type Screen =
  | { kind: 'list'; title: string; items: string[]; onPick: (i: number) => void; onBack?: () => void }
  | { kind: 'text'; title: string; text: string; tail?: boolean; onClick?: () => void; onBack?: () => void };

let bridge: EvenAppBridge;
let current: Screen | null = null;
let started = false;
let poll: ReturnType<typeof setInterval> | undefined;

// スレッドは最新行(末尾)、それ以外は先頭から見せる
function bodyText(s: { text: string; tail?: boolean }) {
  return s.tail ? tailBytes(tailRows(s.text, BODY_ROWS), TEXT_BYTES) : clipBytes(s.text, TEXT_BYTES);
}

async function show(s: Screen) {
  clearInterval(poll);
  current = s;
  const head = new TextContainerProperty({ ...HEAD, content: clipBytes(s.title, TEXT_BYTES), isEventCapture: 0 });
  const page =
    s.kind === 'list'
      ? {
          containerTotalNum: 2,
          textObject: [head],
          listObject: [
            new ListContainerProperty({
              ...BODY,
              isEventCapture: 1,
              itemContainer: new ListItemContainerProperty({
                itemCount: Math.min(s.items.length, LIST_MAX),
                itemName: s.items.slice(0, LIST_MAX).map((t) => clipBytes(t, LIST_ITEM_BYTES)),
              }),
            }),
          ],
        }
      : {
          containerTotalNum: 2,
          textObject: [head, new TextContainerProperty({ ...BODY, content: bodyText(s), isEventCapture: 1 })],
        };
  if (!started) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(page));
    started = true;
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(page));
  }
}

function updateText(title: string, text: string) {
  if (current?.kind !== 'text') return;
  current.title = title;
  current.text = text;
  const { containerID: hid, containerName: hname } = HEAD;
  const { containerID: bid, containerName: bname } = BODY;
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: hid, containerName: hname, content: clipBytes(title, TEXT_BYTES) }));
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: bid, containerName: bname, content: bodyText(current) }));
}

async function guard(title: string, f: () => Promise<void>, back: () => void) {
  try {
    await f();
  } catch (e) {
    await show({ kind: 'text', title, text: tr('error', (e as Error).message), onBack: back, onClick: back });
  }
}

// ---- 画面 ----

const MARK = { idle: '● ', busy: '◌ ', unknown: '  ' } as const;

function home() {
  return guard('Orca', async () => {
    const threads = await api.threads();
    await show({
      kind: 'list',
      title: tr('homeTitle', threads.filter((t) => t.state === 'idle').length, threads.length),
      items: [tr('newSession'), tr('usage'), ...threads.map((t) => `${MARK[t.state]}${t.title} [${t.agent}]`)],
      onPick: (i) => {
        if (i === 0) return newSession();
        if (i === 1) return usage();
        const t = threads[i - 2];
        if (t) thread(t);
      },
    });
  }, home);
}

function thread(t: Thread, note = '') {
  return guard(t.title, async () => {
    const title = () => `${t.title}${note ? `  ${note}` : ''}`;
    const { text } = await api.thread(t.handle);
    await show({ kind: 'text', title: title(), text, tail: true, onClick: () => replies(t), onBack: home });
    poll = setInterval(async () => {
      const r = await api.thread(t.handle).catch(() => null);
      if (r && current?.kind === 'text' && r.text !== current.text) updateText(title(), r.text);
    }, POLL_MS);
  }, home);
}

function replies(t: Thread) {
  return guard(t.title, async () => {
    const labels = await api.replies();
    await show({
      kind: 'list',
      title: tr('replyTitle', t.title),
      items: [tr('voice'), ...labels],
      onPick: async (i) => {
        if (i === 0) return record(t);
        const r = await api.reply(t.handle, i - 1).catch((e: Error) => ({ sent: tr('failed', e.message) }));
        thread(t, tr('sent', r.sent));
      },
      onBack: () => thread(t),
    });
  }, () => thread(t));
}

// ---- 音声入力: G2 マイク → Mac の whisper.cpp → 確認して送信 ----

let recording: Uint8Array[] | null = null;
const MAX_REC_SEC = 60;

async function record(t: Thread) {
  recording = [];
  const t0 = Date.now();
  const stop = async (send: boolean) => {
    clearInterval(tick);
    const chunks = recording ?? [];
    recording = null;
    await bridge.audioControl(false);
    if (!send) return replies(t);
    const pcm = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) {
      pcm.set(c, off);
      off += c.length;
    }
    await show({ kind: 'text', title: tr('transcribing'), text: tr('processing', (pcm.length / 32000).toFixed(1)) });
    await guard(tr('voiceTitle'), async () => {
      const { text } = await api.transcribe(pcm);
      if (!text) return void (await show({ kind: 'text', title: tr('voiceTitle'), text: tr('notHeard'), onClick: () => replies(t), onBack: () => replies(t) }));
      await show({
        kind: 'text',
        title: tr('confirmSend'),
        text,
        onClick: async () => {
          const r = await api.say(t.handle, text).catch((e: Error) => ({ sent: tr('failed', e.message) }));
          thread(t, tr('sent', clipBytes(r.sent, 30)));
        },
        onBack: () => replies(t),
      });
    }, () => replies(t));
  };
  await show({
    kind: 'text',
    title: tr('recording', 0),
    text: tr('recordingHint'),
    onClick: () => stop(true),
    onBack: () => stop(false),
  });
  const tick = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    if (sec >= MAX_REC_SEC) return void stop(true);
    updateText(tr('recording', sec), tr('recordingHint'));
  }, 1000);
  const ok = await bridge.audioControl(true, AudioInputSource.Glasses);
  if (!ok) {
    clearInterval(tick);
    recording = null;
    await show({ kind: 'text', title: tr('voiceTitle'), text: tr('micFailed'), onClick: () => replies(t), onBack: () => replies(t) });
  }
}

function usage() {
  return guard(tr('usageTitle'), async () => {
    const u = await api.usage();
    // rateLimits には設定フラグ等も混ざるので provider を持つ項目だけ使う
    const all = Object.entries(u).filter(([, v]) => v && typeof v === 'object' && 'provider' in v);
    const ok = all.filter(([, v]) => v.status === 'ok');
    const ng = all.filter(([, v]) => v.status !== 'ok').map(([name]) => name);
    const lines = ok.map(([name, v]) => {
      const s = v.session ? `5h ${v.session.usedPercent}% (${v.session.resetDescription})` : '';
      const w = v.weekly ? `${tr('weekly')} ${v.weekly.usedPercent}% (${v.weekly.resetDescription})` : '';
      return `${name}\n  ${[s, w].filter(Boolean).join(' / ') || tr('noInfo')}`;
    });
    if (ng.length) lines.push(tr('unavailable', ng.join(', ')));
    await show({ kind: 'text', title: tr('usageTitle'), text: lines.join('\n'), onBack: home, onClick: home });
  }, home);
}

// 新規セッション: 作業場所 → エージェント → モデル → 最初の指示 → 確認
function newSession() {
  return guard(tr('newTitle'), async () => {
    const ws = await api.workspaces();
    await show({
      kind: 'list',
      title: tr('step1'),
      items: ws.map((w) => w.name),
      onPick: (i) => ws[i] && pickAgent(ws[i]),
      onBack: home,
    });
  }, home);
}

function pickAgent(w: Workspace) {
  return guard(tr('newTitle'), async () => {
    const ps = await api.providers();
    await show({
      kind: 'list',
      title: tr('step2', w.name),
      items: ps.map((p) => `${p.ok ? '○' : '×'} ${p.id}  ${p.note}`),
      onPick: (i) => ps[i]?.ok && pickModel(w, ps[i]),
      onBack: newSession,
    });
  }, newSession);
}

function pickModel(w: Workspace, p: Provider) {
  if (p.models.length === 1) return pickPrompt(w, p, p.models[0]);
  return show({
    kind: 'list',
    title: tr('step3', p.id),
    items: p.models,
    onPick: (i) => pickPrompt(w, p, p.models[i]),
    onBack: () => pickAgent(w),
  });
}

function pickPrompt(w: Workspace, p: Provider, model: string) {
  return guard(tr('newTitle'), async () => {
    const prompts = await api.prompts();
    await show({
      kind: 'list',
      title: tr('step4'),
      items: prompts,
      onPick: (i) => confirm(w, p, model, i, prompts[i]),
      onBack: () => pickModel(w, p),
    });
  }, () => pickModel(w, p));
}

function confirm(w: Workspace, p: Provider, model: string, prompt: number, label: string) {
  return show({
    kind: 'list',
    title: `${w.name} / ${p.id} ${model} / ${label}`,
    items: [tr('launch'), tr('cancel')],
    onPick: async (i) => {
      if (i !== 0) return home();
      await show({ kind: 'text', title: tr('launching'), text: tr('waitingAgent') });
      await guard(tr('newTitle'), async () => {
        const r = await api.startSession({ workspaceId: w.id, agent: p.id, model, prompt });
        const text = r.sent || !prompt ? tr('launched') : tr('launchedNotSent', r.reason ?? '');
        await show({ kind: 'text', title: tr('newTitle'), text, onClick: home, onBack: home });
      }, home);
    },
    onBack: () => pickPrompt(w, p, model),
  });
}

// ---- 入力 ----

function onEvent(e: EvenHubEvent) {
  if (e.audioEvent) {
    recording?.push(e.audioEvent.audioPcm);
    return;
  }
  const s = current;
  if (!s) return;
  const ev = e.listEvent ?? e.textEvent ?? e.sysEvent;
  if (!ev) return;
  // CLICK_EVENT(0) は既定値のため JSON から省かれて届くことがある
  const type = ev.eventType ?? OsEventTypeList.CLICK_EVENT;
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (s.onBack) s.onBack();
    else bridge.shutDownPageContainer(1);
    return;
  }
  if (type !== OsEventTypeList.CLICK_EVENT) return;
  if (s.kind === 'list') {
    // 先頭項目(0)も既定値として省かれうる
    if (e.listEvent) s.onPick(e.listEvent.currentSelectItemIndex ?? 0);
  } else {
    s.onClick?.();
  }
}

// ---- 接続設定(スマホ側の画面) ----

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

function diag(line: string) {
  $('diag').textContent = line;
}

async function connect() {
  const code = await bridge.getLocalStorage('code');
  const pairing = parseCode(code);
  $('code').value = code;
  $('base').value = await bridge.getLocalStorage('base');
  $('token').value = await bridge.getLocalStorage('token');
  const t0 = Date.now();
  setDemo(code === 'demo');
  if (code === 'demo') {
    diag(tr('diagOk', 0, tr('viaDemo'), '-', 3));
    return home();
  }
  if (!pairing && !$('token').value) {
    diag(tr('notPairedDiag'));
    return show({ kind: 'text', title: 'Orca Glass', text: tr('notPaired') });
  }
  try {
    if (pairing) {
      const base = await resolveBase(pairing);
      if (!base) throw new Error(tr('noRelay'));
      setConnection({ token: pairing.token, base, resolve: () => resolveBase(pairing) });
    } else {
      setConnection({ token: $('token').value, base: $('base').value });
    }
    await api.health();
    const threads = await api.threads();
    diag(tr('diagOk', Date.now() - t0, tr(pairing ? 'viaCode' : 'viaManual'), currentBase() || location.origin, threads.length));
  } catch (e) {
    diag(tr('diagNg', (e as Error).message, tr(pairing ? 'viaCode' : 'viaManual'), currentBase() || location.origin));
    return show({
      kind: 'text',
      title: tr('offlineTitle'),
      text: tr('offline', (e as Error).message),
      onClick: () => connect(),
    });
  }
  await home();
}

function useLang(pref: string) {
  const l = detectLang(pref);
  setLang(l);
  setApiLang(l);
  applyPage();
}

async function main() {
  bridge = await waitForEvenAppBridge();
  // QR の URL に ?token=&base= があれば端末に保存する(以降は無くてよい)
  const q = new URLSearchParams(location.search);
  for (const k of ['token', 'base', 'code', 'lang']) {
    // evenhub qr は QR 内の & を &amp; にするため "amp;base" でも受ける
    const v = q.get(k) ?? q.get(`amp;${k}`);
    if (v != null) await bridge.setLocalStorage(k, v);
  }
  const pref = (await bridge.getLocalStorage('lang')) || 'auto';
  $('lang').value = pref;
  useLang(pref);
  $('conn').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await bridge.setLocalStorage('lang', $('lang').value);
    useLang($('lang').value);
    const code = $('code').value.trim();
    if (code && code !== 'demo' && !parseCode(code)) return diag(tr('badCode'));
    await bridge.setLocalStorage('code', code);
    await bridge.setLocalStorage('base', $('base').value.trim());
    await bridge.setLocalStorage('token', $('token').value.trim());
    await connect();
  });
  $('demo').addEventListener('click', async () => {
    await bridge.setLocalStorage('code', 'demo');
    await connect();
  });
  bridge.onEvenHubEvent(onEvent);
  await connect();
}

main();
