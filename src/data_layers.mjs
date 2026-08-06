// データの層分け（Sol仕様 03 §1.2）。
//
// 仕様の要求は raw / normalized / derived / ratings / comparison への分離と、
// 「派生値を生データへ上書きしない」こと。
//
// 名前だけ決めても守られないので、ここに層の定義と**機械で確かめられる規則**を置く。
//   1. 各層がどのフォルダに対応するか（唯一の定義。スクリプトはここを参照する）
//   2. 書き込み先がその層として正しいかを確かめる関門（assertWritable）
//   3. 生データが取込後に書き換えられていないことを確かめる指紋（rawManifest / verifyRaw）

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/** 層の定義。フォルダ＝層。1つのフォルダが2つの層を兼ねない */
export const LAYERS = {
  raw: {
    dirs: ['data/raw'],
    desc: '取得したままの生データ。取込後は一切書き換えない',
    writable_by: ['fetch_*.mjs'],
    read_only_after_ingest: true,
  },
  normalized: {
    dirs: ['data/pennant.db'],
    desc: '生データを型と単位を揃えて入れ直したもの。集約ビュー（v_*）を含む',
    writable_by: ['build_db*.mjs', 'link_players.mjs', 'parse_nf3.mjs'],
    read_only_after_ingest: false,
  },
  derived: {
    dirs: ['outputs/derived', 'configs'],
    desc: '正規化データから回帰・推定で導いた係数と中間結果。導出スクリプトと対で置く',
    writable_by: ['calibrate_*.mjs'],
    read_only_after_ingest: false,
  },
  ratings: {
    dirs: ['outputs/cards', 'outputs/reports'],
    desc: '最終的な能力値。選手カードとレポート',
    writable_by: ['build_card*.mjs', 'appraise_*.mjs'],
    read_only_after_ingest: false,
  },
  comparison: {
    dirs: ['outputs/freeze', 'outputs/comparison'],
    desc: '凍結レコードと外部（KONAMI）との比較。凍結前に比較へ書き込まない',
    writable_by: ['freeze_appraisal.mjs', 'compare_*.mjs'],
    read_only_after_ingest: false,
  },
  // 仕様の5層はデータの層。人が読む文書と実行ログはデータではないので別枠にする。
  // ここを設けないと「層の外」に溜まり続け、層分けの点検が常時警告になって意味を失う。
  reports: {
    dirs: ['docs', 'sessions'],
    desc: '人が読む文書（設計・引継ぎ・チェックリスト）。データではない',
    writable_by: ['*'],
    read_only_after_ingest: false,
  },
  logs: {
    dirs: ['outputs/logs'],
    desc: '実行ログ。再現には使わない（再現に要るものは derived へ置く）',
    writable_by: ['*'],
    read_only_after_ingest: false,
  },
};

/** outputs直下のMarkdownは成果物の説明文とみなし、層の点検から外す */
export const isDocument = rel => /^outputs\/[^/]+\.md$/.test(rel.replace(/\\/g, '/'));

/** 相対パスがどの層に属するか。どこにも属さなければ null */
export function classify(rel) {
  const p = rel.replace(/\\/g, '/');
  for (const [name, def] of Object.entries(LAYERS)) {
    if (def.dirs.some(d => p === d || p.startsWith(d + '/'))) return name;
  }
  return null;
}

/**
 * 書き込み前の関門。派生値を生データの層へ書こうとしたら止める（仕様§1.2）。
 * @throws {Error}
 */
export function assertWritable(rel, layer) {
  const actual = classify(rel);
  if (actual === null) {
    throw new Error(`層の定義に無い場所への書き込み: ${rel}（src/data_layers.mjs に追加するか、既存の層へ置く）`);
  }
  if (actual !== layer) {
    throw new Error(
      `層の取り違え: ${rel} は「${actual}」層だが「${layer}」として書こうとしている（仕様03 §1.2）。` +
      (actual === 'raw' ? '生データへ派生値を上書きしてはならない。' : ''));
  }
  if (layer === 'raw' && LAYERS.raw.read_only_after_ingest) {
    // 取得スクリプト以外からのraw書き込みを禁じる
    const caller = (process.argv[1] ?? '').replace(/\\/g, '/').split('/').pop() ?? '';
    if (!/^fetch_/.test(caller)) {
      throw new Error(`生データ層への書き込みは取得スクリプト(fetch_*.mjs)だけに許される（実行元: ${caller || '不明'}）`);
    }
  }
  return true;
}

const sha256 = b => createHash('sha256').update(b).digest('hex');

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return out;
  if (statSync(abs).isFile()) { out.push(rel.replace(/\\/g, '/')); return out; }
  for (const e of readdirSync(abs)) walk(root, path.join(rel, e), out);
  return out;
}

/** 生データの指紋を作る。取込直後に1回作り、以後は照合に使う */
export function rawManifest(root) {
  const files = LAYERS.raw.dirs.flatMap(d => walk(root, d)).sort();
  const entries = files.map(f => ({ path: f, sha256: sha256(readFileSync(path.join(root, f))), bytes: statSync(path.join(root, f)).size }));
  return {
    generated_at: new Date().toISOString().slice(0, 19) + 'Z',
    file_count: entries.length,
    total_bytes: entries.reduce((a, e) => a + e.bytes, 0),
    _purpose: '生データが取込後に書き換えられていないことを確かめるため（仕様03 §1.2）',
    files: entries,
  };
}

// 指紋は**守る対象の外**に置く。生データと同じ data/raw/ に置くと、
// 生データごと入れ替わった時に指紋も一緒に入れ替わり、照合が意味を失う。
// data/raw/ は版管理から外している（45MB・再取得できる）ので、指紋だけは追跡できる場所に残す。
export const MANIFEST_PATH = 'outputs/derived/raw_manifest.json';

export function writeRawManifest(root) {
  const m = rawManifest(root);
  // 指紋そのものは指紋の対象から外す
  m.files = m.files.filter(f => f.path !== MANIFEST_PATH);
  m.file_count = m.files.length;
  const p = path.join(root, MANIFEST_PATH);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(m, null, 1), 'utf8');
  return m;
}

/** 生データが指紋と一致するかを確かめる。追加は許すが、変更・欠落は報告する */
export function verifyRaw(root) {
  const p = path.join(root, MANIFEST_PATH);
  if (!existsSync(p)) return { ok: false, reason: '指紋が未作成' };
  const m = JSON.parse(readFileSync(p, 'utf8'));
  const changed = [], missing = [];
  for (const e of m.files) {
    const abs = path.join(root, e.path);
    if (!existsSync(abs)) { missing.push(e.path); continue; }
    if (sha256(readFileSync(abs)) !== e.sha256) changed.push(e.path);
  }
  const now = new Set(rawManifest(root).files.map(f => f.path));
  const added = [...now].filter(f => f !== MANIFEST_PATH && !m.files.some(e => e.path === f));
  return { ok: !changed.length && !missing.length, changed, missing, added, generated_at: m.generated_at };
}
