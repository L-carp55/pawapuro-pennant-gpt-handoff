// Opus Bulk Review — 実修理の結果を台帳へ反映（2026-08-14 第3便）
//
// 第1便=巻き戻し、第2便=知見の書き戻し、本便=**実際に直して測り直した結果**。
// 数値はすべて再生成した成果物から機械的に読む（手打ちしない）。
//
// 使い方: node scripts/opus_largewave_review_repairs_writeback_20260814.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const REG = 'docs/state/speed_task_registry.tsv';

function readTsv(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '').trimEnd();
  const lines = raw.split(/\r?\n/);
  const head = lines[0].split('\t');
  return { head, rows: lines.slice(1).filter(Boolean).map(l => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, c[i]]));
  }) };
}
const J = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const dig = (o, ...keys) => { // 深さ優先で最初に見つかったキーの値を返す（成果物の形に依存しすぎない読み方）
  const want = new Set(keys);
  let hit;
  const walk = (v, d) => {
    if (hit !== undefined || d > 8 || v == null || typeof v !== 'object') return;
    for (const [k, vv] of Object.entries(v)) {
      if (want.has(k) && (typeof vv === 'number' || typeof vv === 'string')) { hit = vv; return; }
      walk(vv, d + 1);
    }
  };
  walk(o, 0);
  return hit;
};

const reg = readTsv(REG);
const byId = new Map(reg.rows.map(r => [r.task_id, r]));
const log = [];

const sp061 = J('outputs/derived/sp061_pinch_runner_weak_context_20260814.json');
const sp036 = J('outputs/derived/sp036_generic_label_sweep_20260814.json');
const sp062 = J('outputs/derived/sp062_defensive_chase_close_20260814.json');
const sp045 = J('outputs/derived/sp045_injury_search_20260814.json');
const sp060 = J('outputs/derived/sp060_scouting_inventory_20260814.json');

const N = (o, ...k) => { const v = dig(o, ...k); return v === undefined ? '(未記録)' : v; };

const PATCH = {
  'SP-061':
    '【2026-08-14 Opus review: 実バグを修理して測り直した】旧sweepはコーパス選択が .records/.sources/.items しか見ておらず、'
    + 'キー名が source_records の785KBファイル（代走17件を含む）を0件マッチのまま通していた。'
    + '任意の配列値キー・JSONL・ルート配列を受ける形へ書き直し、走査対象も列挙し直した。'
    + `結果: 走査ファイル 2→${N(sp061, 'files_scanned', 'n_files_scanned')}、走査レコード ${N(sp061, 'records_scanned', 'n_records_scanned')}、`
    + `代走マッチ 5→${N(sp061, 'matched_rows', 'n_matched_rows', 'total_matched_rows')}件。`
    + '選手が特定できる投稿が5件新たに出た（岡大海・土田龍空・藤岡裕大・林琢真・鈴木大地。旧成果物には1件も出ていなかった）。'
    + 'スキップした87ファイルは理由つきで列挙。構造化された双子を持たないCSV4件は raw 出現数18件と NOT_COLLECTED を明記。'
    + 'Grokの検索**プロンプト**側にマッチしたものは別勘定（0件）。'
    + '｜残り: 走塁の文脈レーンとしての重み付けは未定。EX-017 は母数が変わったため再判定が要る（本便では閉じていない）',
  'SP-036':
    '【2026-08-14 Opus review: 重複計上を修理】event_id の名前空間を正規化し（yt:video:X / youtube:X / youtube:X:root / youtube:X:<parent> → youtube:X）、'
    + 'origin をコメント単位の同一性で数える形へ変更。'
    + `結果: origins 7→${N(sp036, 'origins', 'n_origins', 'origin_count')}（3件が名前空間の違いで二重に数えられていた）、unique_videos ${N(sp036, 'unique_videos', 'n_unique_videos')}。`
    + '行は削除していない（証拠除外の原則）。代わりに attributed_to_player / likely_not_player_observation のフラグを追加し、'
    + `**選手証拠として使えるのは ${N(sp036, 'usable_as_player_evidence', 'n_usable_as_player_evidence')}件**（山川穂高の1件のみ）と明示。`
    + 'ゲーム挙動のジョーク（タップ/画面）1件は一致トークンつきで理由を記録。'
    + '｜残り: 1件では EX-011 の「大量棄却は厳しすぎた」を支持できない。再判定が要る',
  'SP-062':
    '【2026-08-14 Opus review: 文字列リテラルだけの成果物を実測へ置換】旧版は384バイト全てが手打ちの文字列で、DBもderivedも一度も参照していなかった。'
    + `実測: sqlite_master + PRAGMA table_info で ${N(sp062, 'objects_scanned', 'n_objects_scanned')}オブジェクト / ${N(sp062, 'columns_scanned', 'n_columns_scanned')}カラムを走査。`
    + 'キーワード一致8オブジェクト、直線追走を**分離できるものは0**（守備文脈の列を要求する判定が npb_plus_measurement.chase_pct を正しく弾いた＝あれは選球のchase）。'
    + `コーパス側は ${N(sp062, 'mention_rows_outside_prompts', 'range_metric_mention_rows')}行の言及があるが分離条件（動作語＋計測単位）を通るものは0。`
    + '★副産物の発見: outputs/derived/web_collected_measurements.json に**構造化された range 指標607行が既に在った**'
    + '（RngR 72 / UZR 111 / UZR_1200 96 / UZR_200 15 / range_runs 313）。これまで不可視だった。MEASURED_POSITIVE だが直線追走は分離しない。'
    + '外部NPBトラッキングは NOT_COLLECTED（未取得であって「無い」ではない）。'
    + '｜残り: 607行の range 指標を走力とは別の用途で使えるかは未評価。EX-018 の再判定材料',
  'SP-045':
    '【2026-08-14 Opus review: 手打ち定数を実測へ置換】旧版は pennant_db_injury_tables:"none" を手で書いていただけで、DBハンドルを開いたまま一度も問い合わせていなかった。'
    + `実測: ${N(sp045, 'objects_scanned', 'n_objects_scanned')}オブジェクト / ${N(sp045, 'columns_scanned', 'n_columns_scanned')}カラムを走査し、`
    + '故障関連（故障/離脱/injury/DL/IL/登録抹消）に一致するテーブル・ビューは**0**、カラムも**0**。'
    + '（DL/IL の判定は (^|_)(dl|il)($|_) で境界を切ってあるので "fielding" 等に誤爆しない）'
    + `テキスト側は ${N(sp045, 'text_rows_with_injury_term', 'injury_term_rows')}行が故障語を含むが、日付つき24行・部位つき6行・**両方揃うものは0**。`
    + '公式のIL/登録抹消フィードと、打席減→故障の変換は NOT_COLLECTED として明示（後者は意図的に導出しない）',
  'SP-060':
    '【2026-08-14 Opus review: 1件しか数えていなかった棚卸しを3レーンで測り直した】'
    + `31ファイル / 2,840レコードを走査。lane A: configs/scouting.json の走力1件（2026-100内は0）。`
    + `lane B: provenance欄のscouting/draft行37件＋文脈欄12件を8ファイルから抽出し、**23人**を特定（うち2026-100内は**21人**）。`
    + 'lane C: 自由記述にスカウト評が引用されている4ファイル。'
    + `**被覆 1件 → 21/100人**へ実質的に前進。広い外部スカウト収集は NOT_COLLECTED。`
    + '｜残り: 教師値にはしない（SP-046 B-1）。EX-016 は母数が変わったため再判定が要る',
};

for (const [id, txt] of Object.entries(PATCH)) {
  const r = byId.get(id);
  if (!r) { log.push(`MISSING ${id}`); continue; }
  r.next_action_or_blocker = txt;
  const cur = (r.artifacts || '').split(';').map(s => s.trim()).filter(Boolean);
  if (!cur.includes('docs/audits/opus_largewave_bulk_review_20260814.md')) {
    cur.push('docs/audits/opus_largewave_bulk_review_20260814.md');
    r.artifacts = cur.join(';');
  }
  log.push(`${id}: updated (${r.status})`);
}

const out = [reg.head.join('\t'),
  ...reg.rows.map(r => reg.head.map(h => (r[h] ?? '').replace(/[\t\r\n]/g, ' ')).join('\t'))].join('\n') + '\n';
if (!DRY) fs.writeFileSync(path.join(ROOT, REG), out, 'utf8');
console.log(log.join('\n'));
console.log(`\n${DRY ? '[DRY]' : '[APPLIED]'} repairs write-back done`);
