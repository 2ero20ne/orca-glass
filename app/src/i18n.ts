// 表示文言(日本語・英語)。G2 のフォントは絵文字を出せないので記号・文字だけで書く
export type Lang = 'ja' | 'en';

const dict = {
  ja: {
    error: 'エラー: {0}',
    homeTitle: 'Orca  ●入力待ち {0} / {1}',
    newSession: '＋ 新規セッション',
    usage: '◇ 使用量',
    replyTitle: '返信 → {0}',
    voice: '[音声] 話して返信',
    sent: '送信: {0}',
    failed: '失敗 {0}',
    transcribing: '文字起こし中…',
    processing: '{0}秒の音声を Mac で処理しています',
    voiceTitle: '音声入力',
    notHeard: '聞き取れませんでした',
    confirmSend: 'クリック=送信 / ダブル=やめる',
    recording: '● 録音中 {0}秒',
    recordingHint: '話し終えたらクリック\nダブルクリックで中止',
    micFailed: 'マイクを開始できませんでした',
    usageTitle: '使用量',
    weekly: '週',
    noInfo: '情報なし',
    unavailable: '使用不可: {0}',
    newTitle: '新規セッション',
    step1: '新規 1/4 作業場所',
    step2: '新規 2/4 エージェント ({0})',
    step3: '新規 3/4 モデル ({0})',
    step4: '新規 4/4 最初の指示',
    launch: '▶ 起動する',
    cancel: 'やめる',
    launching: '起動中…',
    waitingAgent: 'エージェントの準備を待っています(最大60秒)',
    launched: '起動しました',
    launchedNotSent: '起動しましたが指示は未送信です({0})',
    notPairedDiag: '未設定: 接続コードを貼って保存してください',
    notPaired: 'スマホの Orca Glass を開いて\n接続コードを設定してください\n\n(Mac 側の準備が必要です)',
    noRelay: '連絡板に Mac の接続先が見つかりません(Mac 側のトンネルが止まっている可能性)',
    viaCode: '接続コード',
    viaManual: '手動',
    diagOk: 'OK {0}ms\n方式: {1}\n接続先: {2}\nスレッド {3}件',
    diagNg: 'NG {0}\n方式: {1}\n接続先: {2}',
    offlineTitle: 'Mac につながりません',
    offline: 'Mac の中継サーバとトンネルが動いているか確認してください\n\n{0}\n\nクリックで再接続',
    badCode: 'NG 接続コードの形式が違います(eho1. で始まる1行)',
    // スマホ側の設定画面
    pageIntro: 'G2 から Mac 上の <a href="https://github.com/stablyai/orca">Orca</a> のエージェントを見る・返信する・起動するアプリです。<b>Mac 側の準備が必要です。</b>',
    setupTitle: 'はじめに(Mac 側の準備)',
    setupSteps: '<li>Mac に Orca を入れておく</li><li>Mac のエージェント(Claude Code など)に「Orca Glass をセットアップして」と頼む(スキル: <a href="https://github.com/2ero20ne/orca-glass">github.com/2ero20ne/orca-glass</a>)</li><li>最後に出る「接続コード」を下の欄に貼って保存</li>',
    opsTitle: 'グラスでの操作',
    opsList: '<li>上下スワイプ: 選ぶ / クリック: 決定 / ダブルクリック: 戻る</li><li>●入力待ち ◌作業中。スレッドを開いてクリックで返信メニュー</li><li>[音声] 話して返信: 話してクリック → 文字を確認してクリックで送信</li><li>＋新規セッション: 作業場所・エージェント・モデル・最初の指示を選んで起動</li>',
    codeLabel: '接続コード(Mac で <code>npm run pair</code> を実行して貼り付け)',
    manualSummary: '手動設定(接続コードを使わない場合)',
    baseLabel: '接続先URL(空ならこのページと同じ場所)',
    tokenLabel: 'トークン',
    langLabel: '言語',
    save: '保存して再接続',
    diagLabel: '診断',
    tryDemo: 'デモを試す(Mac なし)',
    viaDemo: 'デモ(架空のデータ)',
  },
  en: {
    error: 'Error: {0}',
    homeTitle: 'Orca  ●waiting {0} / {1}',
    newSession: '＋ New session',
    usage: '◇ Usage',
    replyTitle: 'Reply → {0}',
    voice: '[Voice] Speak a reply',
    sent: 'Sent: {0}',
    failed: 'Failed {0}',
    transcribing: 'Transcribing…',
    processing: 'Processing {0}s of audio on your Mac',
    voiceTitle: 'Voice',
    notHeard: 'Could not hear anything',
    confirmSend: 'Click=send / Double=cancel',
    recording: '● Recording {0}s',
    recordingHint: 'Click when you are done\nDouble-click to cancel',
    micFailed: 'Could not start the microphone',
    usageTitle: 'Usage',
    weekly: 'week',
    noInfo: 'no data',
    unavailable: 'Unavailable: {0}',
    newTitle: 'New session',
    step1: 'New 1/4 Workspace',
    step2: 'New 2/4 Agent ({0})',
    step3: 'New 3/4 Model ({0})',
    step4: 'New 4/4 First prompt',
    launch: '▶ Launch',
    cancel: 'Cancel',
    launching: 'Launching…',
    waitingAgent: 'Waiting for the agent to be ready (up to 60s)',
    launched: 'Launched',
    launchedNotSent: 'Launched, but the prompt was not sent ({0})',
    notPairedDiag: 'Not set up: paste the pairing code and save',
    notPaired: 'Open Orca Glass on your phone\nand enter the pairing code\n\n(Setup on your Mac is required)',
    noRelay: 'Could not find your Mac on the relay (the tunnel on your Mac may be stopped)',
    viaCode: 'pairing code',
    viaManual: 'manual',
    diagOk: 'OK {0}ms\nVia: {1}\nBridge: {2}\nThreads: {3}',
    diagNg: 'NG {0}\nVia: {1}\nBridge: {2}',
    offlineTitle: 'Cannot reach your Mac',
    offline: 'Check that the bridge and tunnel are running on your Mac\n\n{0}\n\nClick to reconnect',
    badCode: 'NG Invalid pairing code (one line starting with eho1.)',
    pageIntro: 'View, reply to and start <a href="https://github.com/stablyai/orca">Orca</a> agent sessions on your Mac from G2. <b>Setup on your Mac is required.</b>',
    setupTitle: 'Getting started (on your Mac)',
    setupSteps: '<li>Install Orca on your Mac</li><li>Ask your coding agent (Claude Code, etc.) to "set up Orca Glass" (skill: <a href="https://github.com/2ero20ne/orca-glass">github.com/2ero20ne/orca-glass</a>)</li><li>Paste the pairing code it gives you below and save</li>',
    opsTitle: 'On the glasses',
    opsList: '<li>Swipe up/down: select / Click: open / Double-click: back</li><li>● waiting for you ◌ working. Open a thread and click for replies</li><li>[Voice] Speak a reply: speak, click, check the text, click to send</li><li>＋ New session: pick workspace, agent, model and first prompt</li>',
    codeLabel: 'Pairing code (run <code>npm run pair</code> on your Mac and paste)',
    manualSummary: 'Manual setup (without a pairing code)',
    baseLabel: 'Bridge URL (empty = same place as this page)',
    tokenLabel: 'Token',
    langLabel: 'Language',
    save: 'Save and reconnect',
    diagLabel: 'Status',
    tryDemo: 'Try the demo (no Mac needed)',
    viaDemo: 'demo (sample data)',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Key = keyof typeof dict.ja;

let lang: Lang = 'en';

export function detectLang(pref: string): Lang {
  if (pref === 'ja' || pref === 'en') return pref;
  return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function setLang(l: Lang) {
  lang = l;
}

export const getLang = () => lang;

export function t(key: Key, ...args: (string | number)[]): string {
  return dict[lang][key].replace(/\{(\d)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}

// data-i18n 属性の付いた要素にその言語の文言を入れる(設定画面用。文言は固定の辞書なので innerHTML で良い)
export function applyPage() {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n as Key);
  });
}
