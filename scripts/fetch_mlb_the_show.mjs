// MLB The Show の公式API（https://mlbNN.theshow.com/apis/items.json）から選手カードの能力値を取得する。
//
// 目的（オーナー提案 2026-08-04）:
//   「MLB The Show の査定と同年度のパワプロの査定を比較して、ゲーム間の目盛りの対応を取る」。
//   MLB選手なら **Baseball Savant の物理実測** と **The Show のゲーム能力** が両方大量に揃うので、
//   「実測 → ゲーム能力」の対応を数百人規模で測れる（今の橋渡しは13〜59人しかない）。
//   The Show は走力(speed)・肩力(arm_strength)・送球精度(arm_accuracy)が**別項目**で、
//   パワプロの「肩力1本」より粒度が細かい。
//
// 出典・規約（2026-08-04調査）:
//   robots.txt はコメント1行のみで User-agent / Disallow の指定が一切無い。
//   利用規約にスクレイピング・自動アクセス・データマイニングの条項は見当たらなかった。
//   **ただし PlayStation 本体の利用規約は未読**（theshow.com が外部リンクしている先。一般条項の可能性あり）。
//   コミュニティ報告に「サーバー側スロットリングが実在する」との実測あり。
//   **オーナー承認: 2026-08-04（約650リクエストの規模を明示して取得許可）**。
//
// 相手サーバへの配慮:
//   - 直列（同時接続1本）・1リクエストあたり1.5秒の待機
//   - 取得済みページはスキップ（再実行しても再取得しない）
//   - 429/5xx を受けたら待機を伸ばして再試行（最大3回）。それでも駄目なら記録して次へ
//
// 使い方: node scripts/fetch_mlb_the_show.mjs              （既定=mlb21,23,24,25,26）
//         node scripts/fetch_mlb_the_show.mjs mlb25        （単年）

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'mlb_the_show');
const DELAY_MS = 1500;
const UA = 'Mozilla/5.0 (compatible; pawapuro-pennant-appraisal/0.1; personal, non-commercial)';
const EDITIONS = ['mlb21', 'mlb23', 'mlb24', 'mlb25', 'mlb26'];

const only = process.argv[2];
const editions = only ? EDITIONS.filter(e => e === only) : EDITIONS;

const sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(RAW, { recursive: true });

/** 1ページ取得。スロットリングされたら待機を伸ばして再試行 */
async function getPage(ed, page) {
  const url = `https://${ed}.theshow.com/apis/items.json?type=mlb_card&page=${page}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    if (res.ok) { await sleep(DELAY_MS); return await res.json(); }
    if (res.status === 429 || res.status >= 500) {
      const wait = DELAY_MS * Math.pow(3, attempt);   // 4.5s → 13.5s → 40.5s
      console.log(`    ${res.status} で待機 ${(wait / 1000).toFixed(1)}秒（${attempt}/3回目）`);
      await sleep(wait);
      continue;
    }
    await sleep(DELAY_MS);
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('スロットリングで3回失敗');
}

let totalFetched = 0, totalCached = 0;
const summary = [];

for (const ed of editions) {
  console.log(`\n=== ${ed} ===`);
  let first;
  try { first = await getPage(ed, 1); }
  catch (e) { console.log(`  1ページ目が取れない: ${e.message}`); summary.push({ edition: ed, error: e.message }); continue; }

  const totalPages = first.total_pages;
  console.log(`  全${totalPages}ページ / ${first.per_page}件ずつ`);

  let fetched = 0, cached = 0;
  for (let p = 1; p <= totalPages; p++) {
    const out = path.join(RAW, `${ed}_p${String(p).padStart(3, '0')}.json.gz`);
    if (existsSync(out)) { cached++; continue; }
    try {
      const data = p === 1 ? first : await getPage(ed, p);
      // 中身のあるページだけ保存する（0で埋めない・空を保存しない）
      if (!data.items?.length) { console.log(`  p${p}: itemsが空`); continue; }
      await writeFile(out, gzipSync(Buffer.from(JSON.stringify(data), 'utf8')));
      fetched++;
      if (p % 20 === 0 || p === totalPages) console.log(`  ${p}/${totalPages}ページ`);
    } catch (e) {
      console.log(`  p${p}: ${e.message}`);
    }
  }
  console.log(`  取得 ${fetched} / 既存 ${cached}`);
  totalFetched += fetched; totalCached += cached;
  summary.push({ edition: ed, total_pages: totalPages, fetched, cached });
}

await writeFile(path.join(RAW, '_manifest.json'), JSON.stringify({
  _source: 'MLB The Show 公式API（https://mlbNN.theshow.com/apis/items.json）',
  _license: 'robots.txtに規則なし。利用規約にスクレイピング条項は見当たらず。**PlayStation本体の規約は未読**（未確認事項として明記）',
  _owner_approval: '2026-08-04（約650リクエストの規模を明示して取得許可）',
  _fetched_at: new Date().toISOString().slice(0, 10),
  _scale_note: 'ovrは0-99、個別attributeは0-125（Diamond Dynastyの強化カードが99超に達するため。Live Seriesの実在選手カードは実質0-99帯）',
  _caveat: 'series_yearは全カードが2017を返すレガシーフィールドで年度判別に使えない。年度はドメイン(mlb25等)で区別する。seriesフィールドで"Live"（実在選手の現役カード）を分離できる',
  editions: summary,
}, null, 1), 'utf8');

console.log(`\n合計 取得 ${totalFetched} / 既存 ${totalCached}`);
