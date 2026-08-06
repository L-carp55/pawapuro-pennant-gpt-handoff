// BASELESS PAGE.（http://www.baseless.org/）からパワプロの選手データを取得する。
//
// 目的: **特殊能力（赤得能・青得能・金特・ランク付き得能）**を入手する。
//   既取得の Game8（405人）は基礎能力7つのみで、特殊能力が一切含まれていなかった
//   （保存HTMLを調べて「チャンス」「対左」等の出現回数が全て0と確認、2026-08-04）。
//   baseless.org は**基礎能力7と特殊能力が同一の選手ブロックにテキストで**載っており、
//   名寄せ不要・OCR不要で突合できる。
//
// なぜ特殊能力が要るか（オーナー提案 2026-08-04）:
//   仕様05 §2は「得能が平均より多い→基礎能力を下げる」と定めるが「点数寄与は未校正」のまま。
//   パワプロ実装の得能を大量に集めれば、**得能が能力値にどれだけ効いているかを実測で決められる**。
//   実際、打率がほぼ同じ選手同士（233組）でもミートは平均7.2点・最大28点違っており、
//   この差が得能で説明されるべき部分＝測定対象が実在することは確認済み。
//   「昔ほど得能が付きにくい」ため、年をまたぐと得能の有無が効く様子を観測できる（オーナー指摘）。
//
// 出典・規約（2026-08-04調査）:
//   robots.txt は302で/404.htmlへ＝存在しない。サイトに**転載禁止条項も許可条項も無い**（規約未記載）。
//   個人運営で、ゲーム画面から独自抽出したデータ（2018年に手入力→OCR、2022年にOpenCV画像処理へ移行）。
//   フッターに「実況パワフルプロ野球はコナミ株式会社の登録商標です。」＝原データの著作権はコナミ。
//   **オーナー承認: 2026-08-04（規模96ページを明示して取得許可）**。私的な査定用途に限り、再配布しない。
//
// 相手サーバへの配慮:
//   - 直列（同時接続1本）・1リクエストあたり1.5秒の待機
//   - 取得済みはスキップ（再実行しても再取得しない）
//   - 保存はgzip
//
// 使い方: node scripts/fetch_baseless.mjs            （既定=2013以降の8作品×12球団=96ページ）
//         node scripts/fetch_baseless.mjs 2024       （特定作品のみ）

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'baseless');
const DELAY_MS = 1500;
const UA = 'Mozilla/5.0 (compatible; pawapuro-pennant-appraisal/0.1; personal, non-commercial)';

// 12球団のコード（baseless.orgのURL規則 dat_<球団コード>_<版>.html）。
// **コードは推測せず、取得したページ内のリンクから実際に抽出した**
// （初回にDeNA='DB'・オリックス='B'と推測して2球団が404になり、
//  ページ内リンクを解析して DeNA='BA'・オリックス='OBU' と判明。2026-08-04）
const TEAMS = [
  { code: 'G', team: '読売ジャイアンツ' },
  { code: 'T', team: '阪神タイガース' },
  { code: 'BA', team: '横浜DeNAベイスターズ' },
  { code: 'D', team: '中日ドラゴンズ' },
  { code: 'S', team: '東京ヤクルトスワローズ' },
  { code: 'C', team: '広島東洋カープ' },
  { code: 'H', team: '福岡ソフトバンクホークス' },
  { code: 'OBU', team: 'オリックス・バファローズ' },
  { code: 'M', team: '千葉ロッテマリーンズ' },
  { code: 'E', team: '東北楽天ゴールデンイーグルス' },
  { code: 'F', team: '北海道日本ハムファイターズ' },
  { code: 'L', team: '埼玉西武ライオンズ' },
];

// 2013以降の作品（source/worklist.html から実際に確認した年。推測ではない）。
// 版番号は年ごとに違うので、**各年の work.html を1回読んで実在する版を取得する**
// （初回に版を推測して2013が全滅したため。「推測せず実物から取る」へ変更、2026-08-04）
const YEARS = ['2013', '2014', '2016', '2018', '2020', '2022', '2024', '2026'];

/** その年に実在する版番号を work.html から取る。最終版（最も大きい版）を優先して返す */
async function versionsOf(year) {
  const url = `http://www.baseless.org/data/source/${year}/work.html`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  await sleep(DELAY_MS);
  if (!res.ok) return [];
  const html = new TextDecoder('shift_jis').decode(Buffer.from(await res.arrayBuffer()));
  const vs = [...new Set([...html.matchAll(/dat_[A-Za-z0-9]+_([\d_]+)\.html/g)].map(m => m[1]))];
  // 1_15 > 1_14 > ... > 1 の順（数値として降順）に並べ、最終版から試す
  const num = v => v.split('_').map(Number).reduce((a, b, i) => a + b / Math.pow(100, i), 0);
  return vs.sort((a, b) => num(b) - num(a));
}

const only = process.argv[2];
const targetYears = only ? YEARS.filter(y => y === only) : YEARS;

const sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(RAW, { recursive: true });

let fetched = 0, cached = 0, missing = 0;
const failed = [];
const found = [];

console.log(`対象: ${targetYears.length}作品 × ${TEAMS.length}球団 = 最大${targetYears.length * TEAMS.length}ページ`);
console.log(`速度: 1リクエスト${DELAY_MS}ms待機・直列\n`);

const works = [];
for (const w of targetYears.map(year => ({ year }))) {
  // その年の全球団が既に揃っているなら work.html も読まない（再実行時の無駄打ちを避ける）
  const allCached = TEAMS.every(t => existsSync(path.join(RAW, `${w.year}_${t.code}.htm.gz`)));
  if (allCached) { cached += TEAMS.length; console.log(`  ${w.year} 全12球団 取得済み（スキップ）`); continue; }
  w.versions = await versionsOf(w.year);
  if (!w.versions.length) { console.log(`  ${w.year} 版が取れなかった（work.htmlが読めない）`); continue; }
  console.log(`  ${w.year} 実在する版: ${w.versions.slice(0, 6).map(v => v.replace('_', '.')).join(', ')}${w.versions.length > 6 ? ' ...' : ''}`);
  works.push(w);
}
console.log('');

for (const w of works) {
  for (const t of TEAMS) {
    const out = path.join(RAW, `${w.year}_${t.code}.htm.gz`);
    if (existsSync(out)) { cached++; continue; }

    let ok = false;
    for (const v of w.versions) {
      const url = `http://www.baseless.org/data/source/${w.year}/dat_${t.code}_${v}.html`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        await sleep(DELAY_MS);
        if (!res.ok) continue;              // その版は無い → 次の版を試す
        // Shift-JIS なのでバイト列で受けてから復号する
        const buf = Buffer.from(await res.arrayBuffer());
        const html = new TextDecoder('shift_jis').decode(buf);
        // データが入っているページかを確認（0で埋めない・空を保存しない）
        if (html.length < 5000 || !/[弾ミパ走肩守捕]|ミート|パワー/.test(html)) continue;
        await writeFile(out, gzipSync(Buffer.from(html, 'utf8')));
        fetched++; ok = true;
        found.push({ year: w.year, team: t.team, version: v, kb: Math.round(html.length / 1024) });
        console.log(`  ${w.year} ${t.team.padEnd(14)} 版${v.replace('_', '.')}  ${(html.length / 1024).toFixed(0)}KB`);
        break;
      } catch (e) {
        failed.push(`${w.year}/${t.code}/${v}: ${e.message}`);
      }
    }
    if (!ok) { missing++; console.log(`  ${w.year} ${t.team.padEnd(14)} 取得できず（全版404 or 中身なし）`); }
  }
}

await writeFile(path.join(RAW, '_manifest.json'), JSON.stringify({
  _source: 'BASELESS PAGE.（http://www.baseless.org/）',
  _license: '転載禁止条項も許可条項も無い（規約未記載、2026-08-04調査）。原データの著作権はコナミ。私的な査定用途に限り再配布しない',
  _owner_approval: '2026-08-04（規模96ページを明示して取得許可）',
  _fetched_at: new Date().toISOString().slice(0, 10),
  teams: TEAMS, works: targetYears, found,
}, null, 1), 'utf8');

console.log(`\n取得 ${fetched} / 既存 ${cached} / 取得できず ${missing} / 例外 ${failed.length}`);
if (failed.length) console.log('例外:', failed.slice(0, 5).join(' / '));
