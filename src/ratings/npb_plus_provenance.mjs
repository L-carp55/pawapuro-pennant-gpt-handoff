// NPB+ raw フィールドの provenance を強制する唯一の合流点。
//
// ■ なぜ合流点にするか
//   2026-08-14 の owner訂正で、NPB+アプリ／選手画面の走力系 direct measurement は
//   「最高速度のみ」と確定した。にもかかわらず `hp_to_1b_sec` が NPB+ 測定として
//   ingest され、SP-100 の parallel-forms reliability → Spearman-Brown → confidence
//   → Candidate N/F まで数値伝播していた（docs/audits/luna_npb_plus_provenance_contamination_20260814.md）。
//   個々の消費側で気をつける方式は、同じ誤りを次の新規スクリプトで再生産する。
//   **生JSONLを各自が読む形をやめ、ここを通さないと取り出せない形にする。**
//
// ■ fail closed の意味
//   - 分類が MISATTRIBUTED_SOURCE のフィールドを NPB+ 測定として要求したら throw する。
//   - raw 値は消さない。監査用に `readRawForAudit()` で明示的にだけ取れる。
//     「読めない」のではなく「NPB+測定として使えない」を機械で表現する。
//
// ■ 使い方
//   import { loadNpbPlusMeasurements, NPB_PLUS_RELIABILITY } from '../ratings/npb_plus_provenance.mjs';
//   const { players, provenance } = loadNpbPlusMeasurements(ROOT);

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * NPB+ 測定として使ってはいけないフィールド名の集合。
 * production 側（direct_measurement 等）が root を知らなくても引けるように既定rootで解決する。
 * 正本が読めない時は**空集合で黙らせず例外**にする（門番が静かに無効化されるのを防ぐ）。
 */
let _misattributed = null;
export function misattributedFields(root = DEFAULT_ROOT) {
  if (_misattributed) return _misattributed;
  const prov = loadProvenance(root);
  _misattributed = new Set(Object.entries(prov.fields)
    .filter(([, v]) => v.class === 'MISATTRIBUTED_SOURCE')
    .map(([k]) => k));
  return _misattributed;
}

export function loadProvenance(root) {
  return JSON.parse(readFileSync(path.join(root, 'configs', 'npb_plus_field_provenance.json'), 'utf8'));
}

/** 生JSONL。監査目的でのみ使う。走力の測定として消費しないこと。 */
export function readRawForAudit(root) {
  return readFileSync(path.join(root, 'data', 'manual', 'npb_plus_screens.jsonl'), 'utf8')
    .split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}

/**
 * NPB+ の直接計測として使ってよいフィールドだけを取り出す。
 * 誤帰属フィールドを要求したら例外を投げる（fail closed）。
 *
 * @param {string} root リポジトリルート
 * @param {string[]} fields 取り出したいフィールド名（既定: VERIFIED_NPB_PLUS 全部）
 */
export function loadNpbPlusMeasurements(root, fields = null) {
  const prov = loadProvenance(root);
  const allowed = Object.entries(prov.fields)
    .filter(([, v]) => v.usable_as_npb_plus_measurement === true)
    .map(([k]) => k);

  const want = fields ?? allowed;
  const violations = want.filter(f => !allowed.includes(f));
  if (violations.length) {
    const detail = violations.map(f => {
      const c = prov.fields[f];
      return c
        ? `${f} = ${c.class}${c.true_source ? ` (true_source=${c.true_source})` : ''}`
        : `${f} = 未登録フィールド（configs/npb_plus_field_provenance.json に分類が無い）`;
    }).join(' / ');
    throw new Error(
      `[NPB+ provenance fail-closed] NPB+の直接計測として使えないフィールドを要求した: ${detail}\n`
      + `  owner訂正(2026-08-14): NPB+の走力系 direct measurement は最高速度のみ。\n`
      + `  raw値が要るなら readRawForAudit() を使い、NPB+測定としては消費しないこと。\n`
      + `  正本: configs/npb_plus_field_provenance.json`);
  }

  const rows = readRawForAudit(root);
  const players = rows.map(r => {
    const out = { name: r.name, name_key: nk(r.name) };
    for (const f of want) out[f] = r[f] ?? null;
    return out;
  });

  return {
    players,
    byName: new Map(players.map(p => [p.name_key, p])),
    fields_used: want,
    provenance: {
      source: 'data/manual/npb_plus_screens.jsonl',
      classification: 'configs/npb_plus_field_provenance.json',
      fields: Object.fromEntries(want.map(f => [f, prov.fields[f].class])),
      excluded_misattributed: Object.entries(prov.fields)
        .filter(([, v]) => v.class === 'MISATTRIBUTED_SOURCE')
        .map(([k, v]) => ({ field: k, true_source: v.true_source })),
    },
  };
}

/** NPB+ 単体の測定信頼性の現在の判定。数値ではなく判定を返すのが要点。 */
export function npbPlusReliability(root) {
  const prov = loadProvenance(root);
  const r = prov.reliability_status.npb_plus_generic_measurement_reliability;
  return {
    verdict: r.verdict,                 // 'NOT_IDENTIFIABLE'
    value: null,                        // ★数値を作らない
    why: r._why,
    reopen_condition: r._reopen_condition,
  };
}

export const NPB_PLUS_RELIABILITY_NOT_IDENTIFIABLE = 'NOT_IDENTIFIABLE';
