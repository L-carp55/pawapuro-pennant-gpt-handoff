// カード種別の回帰テスト（Sol仕様 02 §3 の条文を機械で保証する）
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonScore, leagueRates, battingRuns } from '../src/cards/season_score.mjs';
import { rankSeasons, buildPeakYearCard, selectionRobustness } from '../src/cards/peak_year.mjs';
import { selectPrimeWindow, buildPrimeCompositeCard, compositeLine } from '../src/cards/prime_composite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rvCfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8'));
const rv = rvCfg.values;
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

let pass = 0, fail = 0;
const t = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}${note ? '  — ' + note : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${note ? '  — ' + note : ''}`); }
};

// --- 実データで選手の年度列を作るヘルパ ---
const lgAgg = s => db.prepare(`
  SELECT SUM(pa) pa,SUM(ab) ab,SUM(h) h,SUM(b2) b2,SUM(b3) b3,SUM(hr) hr,
         SUM(bb) bb,SUM(hbp) hbp,SUM(sb) sb,SUM(cs) cs,SUM(sh) sh,SUM(sf) sf
  FROM v_batting WHERE season=?`).get(s);
const LG = {};
for (const r of db.prepare('SELECT DISTINCT season FROM v_batting').all()) LG[r.season] = leagueRates(lgAgg(r.season));

function seasonsOf(name) {
  const rows = db.prepare(`
    SELECT * FROM v_batting WHERE name LIKE ? AND position <> '投' ORDER BY season`).all(`%${name}%`);
  return rows.map(p => ({
    season: p.season, position: p.position,
    line: { PA: p.pa, AB: p.ab, H: p.h, B2: p.b2, B3: p.b3, HR: p.hr, BB: p.bb, HBP: p.hbp, SO: p.so, SH: p.sh, SF: p.sf, GDP: p.gdp, SB: p.sb, CS: p.cs },
    lgRate: LG[p.season], envFactors: { avg: 1, hr: 1 },
  }));
}

console.log('=== カード種別の回帰テスト ===\n');

// Q1: 得点価値の序列（run_values.jsonが壊れたら気づけるように）
t('Q1 得点価値の序列が保たれている',
  rv.hr > rv.xb2 && rv.xb2 > rv.b1 && rv.b1 > rv.bb && rv.outs < 0,
  `本塁打${rv.hr} > 二/三塁打${rv.xb2} > 単打${rv.b1} > 四球${rv.bb}、アウト${rv.outs}`);

// Q2: リーグ平均打者の得点貢献は0付近になるはず
{
  const agg = lgAgg(2024);
  const lr = LG[2024];
  const avgLine = { PA: 600, AB: 600 * (agg.ab / agg.pa), H: 600 * (agg.h / agg.pa), B2: 600 * (agg.b2 / agg.pa),
    B3: 600 * (agg.b3 / agg.pa), HR: 600 * (agg.hr / agg.pa), BB: 600 * (agg.bb / agg.pa), HBP: 600 * (agg.hbp / agg.pa),
    SH: 600 * (agg.sh / agg.pa), SF: 600 * (agg.sf / agg.pa), SB: 600 * (agg.sb / agg.pa), CS: 600 * (agg.cs / agg.pa) };
  const r = battingRuns(avgLine, lr, rv);
  t('Q2 リーグ平均の成績を入れると得点貢献が0になる', Math.abs(r.vsLeague) < 0.5,
    `${r.vsLeague.toFixed(3)}点`);
}

// Q3【仕様§3.1】ピーク単年カードは他年度を混ぜない
{
  const ss = seasonsOf('村上　宗隆');
  const ranked = rankSeasons(ss, rv);
  const card = buildPeakYearCard(ranked);
  t('Q3 ピーク単年カードの使用年度が必ず1年だけ',
    card.seasonsUsed.length === 1 && card.seasonsUsed[0] === card.seasonLabel,
    `${card.seasonLabel}年を選定、seasonsUsed=[${card.seasonsUsed}]`);
}

// Q4【仕様§3.2】全盛期合成カードは単一年ラベルを付けない
{
  const ss = seasonsOf('村上　宗隆');
  const win = selectPrimeWindow(ss, rv, { windowYears: 3 });
  const card = buildPrimeCompositeCard(win);
  t('Q4 全盛期合成カードに単一年ラベルが付かない',
    card.seasonLabel === null && card.seasonsUsed.length === 3,
    `期間${card.period}、seasonLabel=${card.seasonLabel}`);
}

// Q5【仕様§3.2】合成式が公開される
{
  const ss = seasonsOf('村上　宗隆');
  const card = buildPrimeCompositeCard(selectPrimeWindow(ss, rv, { windowYears: 3 }));
  t('Q5 合成式と対象期間が出力に含まれる',
    !!card.formula?.description && !!card.period && card.formula.noArbitraryCoefficients === true,
    card.formula.method);
}

// Q6【仕様§3.2】全盛期の窓は連続年でなければならない
{
  const ss = seasonsOf('村上　宗隆');
  const win = selectPrimeWindow(ss, rv, { windowYears: 3 });
  const yrs = win.seasons.map(s => s.season);
  t('Q6 全盛期の窓が連続した年になっている',
    yrs.every((y, i) => i === 0 || y === yrs[i - 1] + 1), `${yrs.join(', ')}`);
}

// Q7 合成後も 安打 = 単打+二塁打+三塁打+本塁打 が保たれる
{
  const ss = seasonsOf('村上　宗隆');
  const win = selectPrimeWindow(ss, rv, { windowYears: 3 });
  const L = compositeLine(win.seasons);
  const b1 = L.H - L.B2 - L.B3 - L.HR;
  t('Q7 合成後の安打の内訳が整合する', b1 >= 0 && L.H === b1 + L.B2 + L.B3 + L.HR,
    `H=${L.H} (単${b1}/二${L.B2}/三${L.B3}/本${L.HR})`);
}

// Q8 合成は打数を足し合わせる（平均でなく合算＝標本サイズが増える）
{
  const ss = seasonsOf('村上　宗隆');
  const win = selectPrimeWindow(ss, rv, { windowYears: 3 });
  const L = compositeLine(win.seasons);
  const sumAb = win.seasons.reduce((a, s) => a + s.line.AB, 0);
  t('Q8 合成後の打数が各年の合計になる', L.AB === sumAb, `${L.AB} = ${win.seasons.map(s => s.line.AB).join('+')}`);
}

// Q9 3つのピーク定義が区別される（仕様07 §8）
{
  const ss = seasonsOf('鈴木　誠也');
  const byTotal = buildPeakYearCard(rankSeasons(ss, rv, { mode: 'total' }), { mode: 'total' });
  const byBat = buildPeakYearCard(rankSeasons(ss, rv, { mode: 'batting' }), { mode: 'batting' });
  const byGame = buildPeakYearCard(rankSeasons(ss, rv, { mode: 'game' }), { mode: 'game' });
  t('Q9 打撃/総合/打席あたりの3つのモードが独立に動く',
    byTotal.selection.mode === 'total' && byBat.selection.mode === 'batting' && byGame.selection.mode === 'game',
    `総合${byTotal.seasonLabel} / 打撃${byBat.seasonLabel} / 質${byGame.seasonLabel}`);
}

// Q10 選定の頑健性が報告される
{
  const ss = seasonsOf('丸　佳浩');
  const ranked = rankSeasons(ss, rv);
  const rob = selectionRobustness(ranked);
  t('Q10 首位と次点の差が報告される', typeof rob.gap === 'number' && !!rob.note, rob.note);
}

// Q11 少打席の年が全盛期の窓に入らない
{
  const ss = seasonsOf('鈴木　誠也');
  const win = selectPrimeWindow(ss, rv, { windowYears: 3, minPaPerYear: 300 });
  t('Q11 全盛期の窓が最低打席の条件を満たす',
    win === null || win.seasons.every(s => s.line.PA >= 300),
    win ? win.seasons.map(s => `${s.season}:${s.line.PA}PA`).join(' ') : '該当窓なし');
}

// Q12 位置調整は打席数に比例する（フル出場でない年に満額を与えない）
{
  const lr = LG[2024];
  const base = { PA: 600, AB: 520, H: 140, B2: 25, B3: 2, HR: 20, BB: 60, HBP: 5, SH: 0, SF: 5, SB: 5, CS: 2 };
  const full = seasonScore({ line: base, lgRate: lr, rv, position: '捕', teamGames: 143 });
  const half = seasonScore({ line: { ...base, PA: 300 }, lgRate: lr, rv, position: '捕', teamGames: 143 });
  t('Q12 位置調整が出場量に比例する', full.parts.posAdj > half.parts.posAdj,
    `フル${full.parts.posAdj.toFixed(1)}点 vs 半分${half.parts.posAdj.toFixed(1)}点`);
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
db.close();
process.exit(fail ? 1 : 0);
