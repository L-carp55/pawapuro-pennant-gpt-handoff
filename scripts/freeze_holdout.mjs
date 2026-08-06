// ホールドアウト（答え合わせ用に取り分ける選手群）の封印。
//
// なぜ（2026-08-04）: これから「MLB実測 → 能力値」の変換式を作る。作る時は手元のデータに
// 合うように調整するので、**同じデータで測れば当然よく当たる**。それでは「本当に当たる式」か
// 「合わせ込んだだけ」かを区別できない。そこで一部の選手を最初に取り分け、式が完成するまで
// 一度も見ないでおく。**後から取り分けても意味がない**（一度見たデータは見なかったことにできない）。
//
// 正本の根拠: thinking_framework_core_v2 §2.1「holdout=答え合わせ用に生成役へ見せずに取っておく既存の正解」、
// メモリ feedback_holdout_contamination_in_design。
//
// 選び方: 恣意性を排すため**player_idのハッシュで機械的に決める**（名前や能力の高低で選ばない）。
// 同じ入力なら何度走らせても同じ結果になるので、後から「都合よく選び直した」ことができない。
import { DatabaseSync } from 'node:sqlite';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'configs', 'holdout_mlb_bridge.json');
const RATIO = Number(process.argv[2] ?? 0.25); // 既定=1/4を試験用に取り分ける

if (existsSync(OUT)) {
  console.error(`既に封印済みです: ${path.relative(ROOT, OUT)}`);
  console.error('**上書きしません**。取り分けをやり直すと「都合よく選び直した」ことになり、ホールドアウトの意味が消えるため。');
  console.error('本当にやり直す必要がある場合は、理由を記録したうえで手で削除してから再実行してください。');
  process.exit(1);
}

/**
 * 既に露出した選手（試験用に使えない）。
 *
 * 2026-08-04、変換式の設計に入る前の実測でこれらの選手の「MLB実測値」と「現行査定値」の
 * 組を出力し、オーナーへの報告にも書いた。**一度見た値は見なかったことにできない**ので、
 * この選手たちは「初見で当たるか」の試験には使えない。
 * 恣意的な選び直しではなく、**露出したという事実に基づく除外**なので train 側へ固定する。
 *
 * 出所: 走力の実測トップ3/ボトム3、肩力の実測トップ3/ボトム3（_tmp_measure_mlb_gap の出力）と、
 * オーナー報告に載せた3人（鈴木誠也・パーラ・ブリンソン）。
 */
const EXPOSED = [
  'ブリンソン', 'スパンジェンバーグ', 'ピレラ',   // 走力 実測トップ3
  'アギラー', 'ボーア', 'スモーク',              // 走力 実測ボトム3
  '鈴木 誠也', 'パーラ',                        // 肩力 実測トップ3（ブリンソンは上と重複）
  'バレラ', 'ガルビス',                         // 肩力 実測ボトム3（アギラーは上と重複）
];

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const rows = db.prepare(`
  SELECT npb_name, proeye_id, sprint_speed_avg, arm_mph_avg
  FROM mlb_bridge WHERE proeye_id IS NOT NULL
  ORDER BY proeye_id`).all();

const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const exposedSet = new Set(EXPOSED.map(norm));
const isExposed = r => exposedSet.has(norm(r.npb_name));

// player_idのSHA-256の先頭を数値化し、小さい方から RATIO 割を試験用にする。
// 能力の高低・有名かどうか・データの揃い具合と無関係に決まる。
// ただし**露出済みの選手は試験用にしない**（上記EXPOSED）。
const scored = rows.map(r => ({
  ...r,
  exposed: isExposed(r),
  h: parseInt(createHash('sha256').update(String(r.proeye_id)).digest('hex').slice(0, 8), 16) / 0xffffffff,
}));
const test = scored.filter(r => !r.exposed && r.h < RATIO);
const train = scored.filter(r => r.exposed || r.h >= RATIO);

const exposedFound = scored.filter(r => r.exposed).map(r => r.npb_name);
const notFound = EXPOSED.filter(n => !scored.some(r => norm(r.npb_name) === norm(n)));

const payload = {
  _purpose: 'MLB実測→能力値の変換式づくりにおける答え合わせ用（ホールドアウト）',
  _rule: '**test に入っている選手は、変換式が完成するまで一度も見ない**。式の設計・係数決め・調整の一切に使わない。完成後に初めて当てさせ、当たれば「本当に当たる式」、外れれば「合わせ込んだだけ」と判定する。',
  _selection: 'player_idのSHA-256から機械的に決定（名前・能力・データの揃い具合と無関係）。同じ入力なら何度走らせても同じ結果になるので、後から選び直せない',
  _frozen_at: '2026-08-04',
  _ratio: RATIO,
  _no_overwrite: 'このファイルが存在する限り freeze_holdout.mjs は上書きを拒否する',
  _exposed_excluded: {
    _why: '2026-08-04、変換式の設計に入る前の実測でこれらの選手の「MLB実測値」と「現行査定値」の組を出力し、オーナー報告にも書いた。一度見た値は見なかったことにできないので試験用には使えない。恣意的な選び直しではなく、露出したという事実に基づく除外',
    players: exposedFound,
    not_found_in_bridge: notFound,
  },
  counts: { total: scored.length, train: train.length, test: test.length, exposed_forced_to_train: exposedFound.length },
  // 試験用は**名前だけ**を記録し、実測値は載せない（ファイルを開いた時に値が目に入らないように）
  test_players: test.map(r => ({ name: r.npb_name, proeye_id: r.proeye_id })),
  train_players: train.map(r => ({ name: r.npb_name, proeye_id: r.proeye_id })),
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2), 'utf8');

console.log(`封印しました → ${path.relative(ROOT, OUT)}`);
console.log(`  作る用（train）: ${train.length}人  （うち露出済みで強制的にこちらへ入れた ${exposedFound.length}人）`);
console.log(`  試験用（test）:  ${test.length}人  ← 変換式が完成するまで見ない`);
if (notFound.length) console.log(`  ※露出リストのうち橋渡しに居なかった: ${notFound.join(' / ')}`);
console.log('');
console.log('試験用に入った選手（名前のみ。実測値は意図的に表示しない）:');
console.log('  ' + test.map(r => r.npb_name).join(' / '));
db.close();
