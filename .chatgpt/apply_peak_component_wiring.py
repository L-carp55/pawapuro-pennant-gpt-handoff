from pathlib import Path

p = Path('src/cards/pipeline.mjs')
s = p.read_text()

def replace_once(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'pipeline: expected 1 match, got {n}: {old[:120]!r}')
    s = s.replace(old, new, 1)

replace_once(
"import { recordEvidenceEndsBy, aggregateEvidenceAvailable } from '../ratings/evidence_time.mjs';\n",
"import { recordEvidenceEndsBy, aggregateEvidenceAvailable } from '../ratings/evidence_time.mjs';\n"
"import { loadSeasonRunFieldContributions } from './season_contributions.mjs';\n",
)

old = """  const seasons = all.map(p => ({
    season: p.season, position: p.position, line: toLine(p),
    lgRate: leagueRates(lgOf(p.season)), envFactors: envFactorsOf(p.season),
  }));

  let cardType, seasonLabel, seasonsUsed, line, formula = null, targetSeason;
  if (mode === 'prime') {
    const win = selectPrimeWindow(seasons, rv, { windowYears: 3, minPaPerYear: 200 });
    if (!win) return { error: '全盛期の窓が取れない（連続3年で各200打席以上が必要）' };
    const c = buildPrimeCompositeCard(win);
    cardType = 'prime_composite'; seasonLabel = null; seasonsUsed = c.seasonsUsed;
    line = c.line; formula = c.formula; targetSeason = win.end;
  } else {
"""
new = """  // 年度選定の「総合」は打撃だけでなく、同じrun単位のUBRと守備得点を使う。
  // 2019年以前はNPB Basementが無いのでnullのまま。0で埋めず、rankSeasons(total)が
  // 比較不能としてフェイルファストする。これにより2020+だけを持つ現代選手と、
  // 歴史年を含む選手の欠損を黙って混ぜない。
  const seasonContributions = loadSeasonRunFieldContributions(db, pid);
  const seasons = all.map(p => {
    const rf = seasonContributions.get(p.season) ?? null;
    return {
      season: p.season, position: p.position, line: toLine(p),
      lgRate: leagueRates(lgOf(p.season)), envFactors: envFactorsOf(p.season),
      runRuns: rf?.runRuns ?? null,
      fldRuns: rf?.fldRuns ?? null,
      runFieldEvidence: rf?.fieldingDetail ?? null,
    };
  });

  let cardType, seasonLabel, seasonsUsed, line, formula = null, targetSeason;
  if (mode === 'prime') {
    // 走守配線ができてもprimeはまだ再開しない。
    // 打撃は複数年合成だが走力・守備・弾道等が窓末年を参照する期間混在と、
    // 環境補正の二重適用余地が残るため、明示的に止める。
    return { error: 'prime自動生成は再設計中のため停止中（期間混在・環境補正・得能合成が未解決）' };
  } else {
"""
replace_once(old, new)

p.write_text(s)
