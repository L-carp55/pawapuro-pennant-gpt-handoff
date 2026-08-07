// 過去年カードへ本人の未来情報を混ぜないための共通ヘルパー。
//
// 「較正基準として後年のリーグ分布を使う」ことと、
// 「本人の2025年成績を2024年能力の証拠に使う」ことは別。
// このファイルが止めるのは後者（player-specific evidence leakage）。

/** record.seasons=[min,max] 等の本人証拠が査定年までに完結しているか。 */
export function recordEvidenceEndsBy(record, targetSeason) {
  if (!record || !Number.isFinite(targetSeason)) return false;
  const years = Array.isArray(record.seasons)
    ? record.seasons.filter(Number.isFinite)
    : [];
  if (!years.length) return false;
  return Math.max(...years) <= targetSeason;
}

/** 集約済みソース（例: 2020-2026 PBP全量）が査定年まで利用可能か。 */
export function aggregateEvidenceAvailable(maxEvidenceSeason, targetSeason) {
  if (!Number.isFinite(maxEvidenceSeason) || !Number.isFinite(targetSeason)) return false;
  return maxEvidenceSeason <= targetSeason;
}

/** 年別本人証拠をas-ofに切る。 */
export function filterEvidenceYears(rows, targetSeason, lookbackYears = null) {
  if (!Array.isArray(rows) || !Number.isFinite(targetSeason)) return [];
  const min = Number.isFinite(lookbackYears) ? targetSeason - lookbackYears : -Infinity;
  return rows.filter(r => Number.isFinite(r?.season) && r.season >= min && r.season <= targetSeason);
}
