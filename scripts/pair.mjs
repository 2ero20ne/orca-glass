// 接続コード eho1.<トピック>.<トークン> を表示し、macOS ならクリップボードにも入れる
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const dir = new URL('../bridge/', import.meta.url).pathname;
for (const f of ['.token', '.topic']) {
  if (!existsSync(dir + f)) {
    console.error(`bridge/${f} がありません。先に npm start で一度起動してください。`);
    process.exit(1);
  }
}
const code = `eho1.${readFileSync(dir + '.topic', 'utf8').trim()}.${readFileSync(dir + '.token', 'utf8').trim()}`;
try {
  execFileSync('pbcopy', { input: code });
  console.log('接続コードをクリップボードにコピーしました。iPhone の Orca Glass に貼り付けてください。');
} catch {
  console.log('接続コード(iPhone の Orca Glass に貼り付け):');
  console.log(code);
}
