// 追加進塁再構築 + 独立ラベル監査を同じraw PBPから再実行し、
// 監査結果をMarkdownへ固定する。repository DBは触らず、一時SQLiteのみ使う。
//
// Usage:
//   PBP_RAW_DIR=/tmp/npb_pbp_2024 node scripts/write_baserunning_rebuild_audit.mjs 2024 docs/audits/...md

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const year = Number(process.argv[2]);
const outPath = path.resolve(process.argv[3] ?? path.join(ROOT, 'docs', 'audits', `baserunning_rebuild_${year}.md`));
const rawDir = process.env.PBP_RAW_DIR ? path.resolve(process.env.PBP_RAW_DIR) : null;
if (!Number.isInteger(year) || !rawDir) throw new Error('usage: PBP_RAW_DIR=... node scripts/write_baserunning_rebuild_audit.mjs YEAR OUTPUT.md');

const tmp = mkdtempSync(path.join(os.tmpdir(), `pawapuro-baserunning-${year}-`));
const dbPath = path.join(tmp, `rebuilt_${year}.sqlite`);
const run = (script, extraEnv = {}) => execFileSync(process.execPath, [path.join(ROOT, script)], {
  cwd: ROOT,
  env: { ...process.env, ...extraEnv },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
});

function match(text, re, fallback = null) {
  const m = text.match(re);
  return m ? m.slice(1) : fallback;
}
function extractKind(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp(`${escaped}\\s+(\\d+)件\\s+成功\\s+([0-9.]+)%\\s+判定不能除外\\s+(\\d+)`));
  return m ? { n: Number(m[1]), success_pct: Number(m[2]), ambiguous_excluded: Number(m[3]) } : null;
}

try {
  const builder = run('scripts/build_baserunning_advances.mjs', {
    PBP_RAW_DIR: rawDir,
    PBP_DB_PATH: dbPath,
    PBP_DRY_RUN: '0',
  });
  const labels = run('scripts/audit_baserunning_event_labels.mjs', { PBP_DB_PATH: dbPath });

  const [eventTotal] = match(builder, /走塁の確定可能な機会:\s*([\d,]+)件/) ?? ['0'];
  const [runnerTotal] = match(builder, /走者\s+(\d+)人/) ?? ['0'];
  const [uncCur, uncNext] = match(builder, /uncertain state exclusions current=(\d+) next=(\d+)/) ?? ['0','0'];
  const [recResolved, recUncertain, recNoPattern] = match(builder, /reconciliation explicitResolved=(\d+) explicitUncertain=(\d+) noPattern=(\d+)/) ?? ['0','0','0'];
  const [parsedStart, parsedStartPct] = match(labels, /開始塁を明示文から読めた:\s*(\d+)\s*\(([0-9.]+)%\)/) ?? ['0','0'];
  const [badStart, badStartPct] = match(labels, /開始塁の明確な不一致:\s*(\d+)\s*\(([0-9.]+)%\)/) ?? ['0','0'];
  const [parsedOutcome, parsedOutcomePct] = match(labels, /終了塁からsuccessを明確に再判定できた:\s*(\d+)\s*\(([0-9.]+)%\)/) ?? ['0','0'];
  const [contradictions, contradictionPct] = match(labels, /そのうち保存successと矛盾:\s*(\d+)\s*\(([0-9.]+)%\)/) ?? ['0','0'];

  const kinds = {
    single_1st_to_3rd: extractKind(builder, '単打で一塁→三塁'),
    single_2nd_to_home: extractKind(builder, '単打で二塁→生還'),
    double_1st_to_home: extractKind(builder, '二塁打で一塁→生還'),
  };

  const decision = Number(badStartPct) <= 1.0 && Number(contradictionPct) <= 0.5
    ? 'PASS_FOR_MULTIYEAR_REBUILD'
    : 'KEEP_PROVISIONAL_RECONSTRUCTION';

  const md = `# ${year} 追加進塁PBP再構築監査\n\n` +
`日付: 2026-08-07\n\n` +
`判定: **${decision}**\n\n` +
`## 入力・安全規律\n\n` +
`- source: Nippon Baseball Data Repository / GitHub Release \`pbp\`\n` +
`- raw PBPは一時ディレクトリへ取得し、repositoryへcommitしない。\n` +
`- repositoryの\`data/pennant.db\`は変更しない。一時SQLiteだけへ再構築する。\n` +
`- 打球直前状態は打席内の実投球列を追跡し、説明文の明示塁配置とhybrid runner identityを保守的にreconcileする。\n` +
`- identity/配置が一意でないケースは除外し、0や推定値で埋めない。\n\n` +
`## 再構築結果\n\n` +
`| 指標 | 値 |\n|---|---:|\n` +
`| 確定可能イベント | ${eventTotal} |\n` +
`| 走者 | ${runnerTotal} |\n` +
`| uncertain current除外 | ${uncCur} |\n` +
`| uncertain next除外 | ${uncNext} |\n` +
`| 明示配置reconcile成功 | ${recResolved} |\n` +
`| 明示配置reconcile不確定 | ${recUncertain} |\n` +
`| 明示配置なしpitch | ${recNoPattern} |\n\n` +
`| event | n | success | ambiguity excluded |\n|---|---:|---:|---:|\n` +
`${kinds.single_1st_to_3rd ? `| 単打 一→三 | ${kinds.single_1st_to_3rd.n} | ${kinds.single_1st_to_3rd.success_pct}% | ${kinds.single_1st_to_3rd.ambiguous_excluded} |\n` : ''}` +
`${kinds.single_2nd_to_home ? `| 単打 二→本 | ${kinds.single_2nd_to_home.n} | ${kinds.single_2nd_to_home.success_pct}% | ${kinds.single_2nd_to_home.ambiguous_excluded} |\n` : ''}` +
`${kinds.double_1st_to_home ? `| 二塁打 一→本 | ${kinds.double_1st_to_home.n} | ${kinds.double_1st_to_home.success_pct}% | ${kinds.double_1st_to_home.ambiguous_excluded} |\n` : ''}` +
`\n## 独立ラベル監査\n\n` +
`| 指標 | 件数 | 率 |\n|---|---:|---:|\n` +
`| 説明文から開始塁を読めた | ${parsedStart} | ${parsedStartPct}% |\n` +
`| 開始塁の明確な不一致 | ${badStart} | ${badStartPct}% |\n` +
`| successを独立再判定できた | ${parsedOutcome} | ${parsedOutcomePct}% |\n` +
`| 保存successとの矛盾 | ${contradictions} | ${contradictionPct}% |\n\n` +
`## 受入基準\n\n` +
`- 開始塁の明確な不一致 <= 1.0%\n` +
`- success矛盾 <= 0.5%\n` +
`- 条件を満たすまではplayer-specific走塁responseの較正に使わない。\n\n` +
`## raw command output\n\n<details><summary>builder</summary>\n\n\`\`\`text\n${builder.trim()}\n\`\`\`\n</details>\n\n` +
`<details><summary>label audit</summary>\n\n\`\`\`text\n${labels.trim()}\n\`\`\`\n</details>\n`;
  writeFileSync(outPath, md, 'utf8');
  console.log(`wrote ${outPath}`);
  console.log(`decision=${decision} bad_start=${badStartPct}% contradiction=${contradictionPct}% events=${eventTotal}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
