// Sol仕様 09_QA_TESTS の回帰テストのうち、文脈選択と凍結に関わるもの。
//   Q8   周辺集計から交差セルを捏造しない（02 §5.1 / 03 §4.1）
//   Q13  凍結前にKONAMIを参照したらエラーになる（05 §10.4）
//   02 §6.6 パワーの下限はゲーム側の慣習として別管理する
// あわせて 05 §3 チャンス（RBIを使わない）／§4 対左（ミート差と長打差を分ける）も検証する。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { selectContext, clutchDifferential, plattonDifferential, ContextFabricationError } from '../src/ratings/context_tier.mjs';
import { assertFrozen, loadLatestFreeze, verifyFreeze } from '../src/compare/freeze.mjs';
import { applyGameConventions } from '../src/ratings/game_conventions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// ---------------- Q8: 交差セルの捏造禁止 ----------------
{
  const total = { AB: 500, H: 140 };
  const vsR = { AB: 350, H: 105 };   // .300
  const vsL = { AB: 150, H: 35 };    // .233
  const risp = { AB: 120, H: 40 };   // .333
  const nonRisp = { AB: 380, H: 100 }; // .263

  // 周辺値だけ → 階層B。交差は作らない
  const b = selectContext({ total, vsR, vsL, risp, nonRisp });
  check('Q8-a 周辺値だけなら階層Bに留まる（Aへ昇格しない）', b.tier === 'B',
    `tier=${b.tier} 基準=${b.basis} 打率=${b.avg.toFixed(3)}`);
  check('Q8-b 階層Bの基準値は対右の実測そのもの（合成しない）',
    b.AB === vsR.AB && b.H === vsR.H, `AB=${b.AB} H=${b.H}（対右の生値と一致）`);
  check('Q8-c 交差セルを使わなかった理由が記録に残る',
    b.rejected.some(r => /復元できない/.test(r)), b.rejected[0]);

  // 周辺値から作った交差セルを渡そうとしたら例外で止まる
  let threw = null;
  try {
    selectContext({
      total, vsR, vsL, risp, nonRisp,
      vsR_nonRisp: { AB: 260, H: 78, source: 'estimated_from_marginals' },
    });
  } catch (e) { threw = e; }
  check('Q8-d 周辺値から作った交差セルを渡すと例外で止まる',
    threw instanceof ContextFabricationError, threw?.message.slice(0, 60) + '…');

  // 実測の交差セルがあれば階層A
  const a = selectContext({
    total, vsR, vsL, risp, nonRisp,
    vsR_nonRisp: { AB: 265, H: 82, source: 'measured' },
  });
  check('Q8-e 実測の交差セルがあれば階層Aになる', a.tier === 'A',
    `tier=${a.tier} AB=${a.AB} 打率=${a.avg.toFixed(3)}`);

  // 交差セルがあっても打数不足なら降格する（少数の交差セルに飛びつかない）
  const small = selectContext({
    total, vsR, vsL, risp, nonRisp,
    vsR_nonRisp: { AB: 40, H: 15, source: 'measured' },
  });
  check('Q8-f 交差セルの打数が足りなければ階層Bへ降りる', small.tier === 'B',
    `交差AB=40 → tier=${small.tier}`);

  // 分割が無ければ階層C
  const c = selectContext({ total });
  check('Q8-g 分割が無ければ階層Cで総合を使う', c.tier === 'C' && c.AB === total.AB,
    `tier=${c.tier} 打率=${c.avg.toFixed(3)}`);

  const empty = selectContext({ total: { AB: 0, H: 0 } });
  check('Q8-h 打数0は例外にせず NO_BATTING_SAMPLE を返す',
    empty.tier === 'NONE' && empty.basis === 'NO_BATTING_SAMPLE' && empty.avg == null,
    `tier=${empty.tier} basis=${empty.basis}`);
}

// ---------------- 05 §3 チャンスはRBIを使わない ----------------
{
  const risp = { AB: 120, H: 40 }, nonRisp = { AB: 380, H: 100 };
  const d1 = clutchDifferential(risp, nonRisp);
  // 打点を何倍にしても入力に無いので結果は変わらない（構造的にRBIを受け取らない）
  const d2 = clutchDifferential({ ...risp, RBI: 999 }, { ...nonRisp, RBI: 0 });
  check('§3-a チャンスは得点圏と非得点圏の差で測る',
    Math.abs(d1.diff - (40 / 120 - 100 / 380)) < 1e-12, `差=${d1.diff.toFixed(4)}`);
  check('§3-b 打点を変えてもチャンスの素点が動かない', d1.diff === d2.diff, 'RBIは入力に含まれない');

  const few = clutchDifferential({ AB: 20, H: 8 }, nonRisp);
  check('§3-c 得点圏打数が少なければ判定しない（0や平均で埋めない）',
    few.diff === null, few.reason);
}

// ---------------- 05 §4 対左はミート差と長打差を分ける ----------------
{
  const vsR = { AB: 350, H: 105, B2: 20, B3: 1, HR: 15 };
  const vsL = { AB: 150, H: 35, B2: 10, B3: 0, HR: 12 };
  const p = plattonDifferential(vsL, vsR);
  check('§4-a 対左はミート差と長打差を別々に返す',
    p.meetDiff != null && p.sluggingDiff != null && p.meetDiff !== p.sluggingDiff,
    `ミート差=${p.meetDiff.toFixed(3)} 長打差=${p.sluggingDiff.toFixed(3)}`);
  check('§4-b 打率が下でも長打が上なら符号が食い違う（1つに潰していない）',
    p.meetDiff < 0 && p.sluggingDiff > 0, '対左は打率↓・長打↑という実在するパターンを表現できる');
}

// ---------------- Q13: 凍結前のKONAMI参照はエラー ----------------
{
  // 凍結レコードが無いディレクトリを作って試す
  const empty = mkdtempSync(path.join(tmpdir(), 'freeze-test-'));
  let threw = null;
  try { assertFrozen(empty); } catch (e) { threw = e; }
  check('Q13-a 凍結前にKONAMI比較を呼ぶと例外で止まる', threw instanceof Error,
    threw?.message.split('\n')[0]);
  check('Q13-b 例外メッセージが次にやることを示す',
    /freeze_appraisal/.test(threw?.message ?? ''), '凍結コマンドを案内する');
  rmSync(empty, { recursive: true, force: true });

  // 本プロジェクトの状態
  const f = loadLatestFreeze(ROOT);
  if (f) {
    const v = verifyFreeze(ROOT);
    check('Q13-c 凍結済みなら内容が変わっていないか検証できる', typeof v.ok === 'boolean',
      v.ok ? `凍結時点と一致（${f.frozen_at}）` : `変更あり: ${v.changed.length}件 / 欠落${v.missing.length}件`);
  } else {
    check('Q13-c 本プロジェクトは未凍結（＝KONAMI比較は封じられている）', true,
      '査定が改訂中のため正しい状態。凍結は査定確定後');
  }
}

// ---------------- 02 §6.6 パワーの下限は「ゲーム側の慣習」として別管理 ----------------
{
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
  const modern = { season: 2024, isPitcher: false, isSpecialCard: false };

  const low = applyGameConventions({ power: 12.3 }, modern, cfg);
  check('§6.6-a 現代の野手にパワー20未満が出たら表示用は下限まで上がる',
    low.power_display === 20, `査定12.3 → 表示${low.power_display}`);
  check('§6.6-b 査定値そのものは書き換えない（別管理）',
    low.adjustments[0]?.appraised === 12.3 && /慣習/.test(low.adjustments[0]?.reason ?? ''),
    `調整の記録に査定値${low.adjustments[0]?.appraised}が残る`);

  const ok = applyGameConventions({ power: 55 }, modern, cfg);
  check('§6.6-c 下限を超えている選手には何もしない',
    ok.power_display === 55 && ok.adjustments.length === 0, '調整0件');

  // 仕様の明記: 歴史選手・特殊カード・投手には自動適用しない
  const old = applyGameConventions({ power: 12.3 }, { ...modern, season: 2005 }, cfg);
  check('§6.6-d 歴史選手（2015年より前）には当てない',
    old.power_display === 12.3 && old.adjustments.length === 0, `2005年 → ${old.power_display}のまま`);

  const pit = applyGameConventions({ power: 12.3 }, { ...modern, isPitcher: true }, cfg);
  check('§6.6-e 投手には当てない', pit.power_display === 12.3, `${pit.power_display}のまま`);

  const sp = applyGameConventions({ power: 12.3 }, { ...modern, isSpecialCard: true }, cfg);
  check('§6.6-f 特殊カードには当てない', sp.power_display === 12.3, `${sp.power_display}のまま`);
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
