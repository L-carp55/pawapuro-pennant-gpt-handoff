// 独自査定の凍結（Sol仕様 05 §10 Blind Freeze）。
//
// なぜ必要か: KONAMI（パワプロ）の能力値を先に見てから自作査定を触ると、
//   「自作査定がどれくらい当たっているか」を測れなくなる。合わせにいったのか
//   独立に一致したのかが区別できなくなるため（§10.4 禁止事項）。
//   そこで、比較の前に自作査定・設定・コードをハッシュで固定する。
//
// 凍結の中身（§10.1）:
//   1. 入力データを固定  → DBファイルのハッシュ
//   2. 独自査定を完了    → outputs/cards/*.json のハッシュ
//   3. 得能を確定        → 同上（カードに含まれる）
//   4. 計算ログを保存    → 同上（calc_log）
//   5. SHA256で凍結      → 本ファイルが作る freeze レコード
//
// 比較コードは必ず assertFrozen() を通す。凍結前に呼ぶと例外で止まる（回帰テストQ13）。

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const FREEZE_DIR = 'outputs/freeze';

const sha256 = buf => createHash('sha256').update(buf).digest('hex');

/** ファイル1つのハッシュ（大きいファイルもそのまま読む。DBは20MB程度） */
export function hashFile(p) {
  return { path: p, sha256: sha256(readFileSync(p)), bytes: statSync(p).size };
}

/** ディレクトリ配下のファイルを名前順にハッシュ */
export function hashDir(root, dir, filter = () => true) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter(filter).sort()
    .map(f => ({ ...hashFile(path.join(abs, f)), path: path.posix.join(dir, f) }));
}

/**
 * 凍結レコードを作る。
 * @param {string} root プロジェクトルート
 * @param {object} opts {label, note, gitCommit}
 */
export function createFreeze(root, opts = {}) {
  const { label = 'independent-appraisal', note = null, gitCommit = null } = opts;

  const entries = [
    ...hashDir(root, 'outputs/cards', f => f.endsWith('.json')),
    ...hashDir(root, 'configs', f => f.endsWith('.json')),
    ...hashDir(root, 'src/ratings', f => f.endsWith('.mjs')),
    ...hashDir(root, 'src/cards', f => f.endsWith('.mjs')),
    ...(existsSync(path.join(root, 'data/pennant.db')) ? [{ ...hashFile(path.join(root, 'data/pennant.db')), path: 'data/pennant.db' }] : []),
  ];

  // 全体を1つのハッシュに畳む（順序を固定してから）
  const manifest = entries.map(e => `${e.sha256}  ${e.path}`).sort().join('\n');
  const rootHash = sha256(Buffer.from(manifest, 'utf8'));

  const record = {
    label,
    frozen_at: new Date().toISOString().slice(0, 19) + 'Z',
    git_commit: gitCommit,
    root_sha256: rootHash,
    file_count: entries.length,
    card_count: entries.filter(e => e.path.startsWith('outputs/cards/')).length,
    note,
    _purpose: 'Sol仕様05 §10 Blind Freeze。KONAMI比較の前に自作査定を固定する',
    _rule: '凍結後に査定を変更した場合は再凍結し、比較レポートに両方の凍結IDを記す',
    files: entries,
  };

  const dir = path.join(root, FREEZE_DIR);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `freeze_${rootHash.slice(0, 12)}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');
  writeFileSync(path.join(dir, 'latest.json'), JSON.stringify({ root_sha256: rootHash, file: path.basename(file), frozen_at: record.frozen_at }, null, 2), 'utf8');
  return { record, file };
}

/** 最新の凍結レコードを読む。無ければ null */
export function loadLatestFreeze(root) {
  const p = path.join(root, FREEZE_DIR, 'latest.json');
  if (!existsSync(p)) return null;
  const head = JSON.parse(readFileSync(p, 'utf8'));
  const full = path.join(root, FREEZE_DIR, head.file);
  return existsSync(full) ? JSON.parse(readFileSync(full, 'utf8')) : null;
}

/**
 * KONAMI比較を行う前の関門（§10.4）。
 * 凍結が無い状態で比較コードを走らせようとしたら、ここで止める。
 * @throws {Error} 凍結レコードが無い場合
 */
export function assertFrozen(root, what = 'KONAMI比較') {
  const f = loadLatestFreeze(root);
  if (!f) {
    throw new Error(
      `${what}は凍結前に実行できない（Sol仕様05 §10.4）。\n` +
      `先に node scripts/freeze_appraisal.mjs で独自査定を凍結すること。\n` +
      `理由: KONAMIの能力値を見てから自作査定を触ると、独立に一致したのか合わせにいったのかを区別できなくなる。`);
  }
  return f;
}

/**
 * 凍結後に査定が変わっていないかを検証する。
 * 変わっていたら「どのファイルが」まで返す（黙って通さない）。
 */
export function verifyFreeze(root) {
  const f = loadLatestFreeze(root);
  if (!f) return { ok: false, reason: '凍結レコードが無い' };
  const changed = [], missing = [];
  for (const e of f.files) {
    const abs = path.join(root, e.path);
    if (!existsSync(abs)) { missing.push(e.path); continue; }
    if (sha256(readFileSync(abs)) !== e.sha256) changed.push(e.path);
  }
  return { ok: !changed.length && !missing.length, changed, missing, root_sha256: f.root_sha256, frozen_at: f.frozen_at };
}
