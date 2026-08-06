// 球団名とリーグの対応（2006-2025年の実データに出現する14種）
//
// プロEYE球のCSVにリーグ列が無いため、球団名から導く。
// 改称（横浜ベイスターズ→横浜DeNAベイスターズ 2012／西武ライオンズ→埼玉西武ライオンズ 2008）
// も同じ球団として扱う。

const CENTRAL = [
  '読売ジャイアンツ', '阪神タイガース', '中日ドラゴンズ',
  '横浜DeNAベイスターズ', '横浜ベイスターズ',
  '広島東洋カープ', '東京ヤクルトスワローズ',
];
const PACIFIC = [
  '福岡ソフトバンクホークス', '北海道日本ハムファイターズ',
  '埼玉西武ライオンズ', '西武ライオンズ',
  'オリックス・バファローズ', '千葉ロッテマリーンズ', '東北楽天ゴールデンイーグルス',
];

/** 球団名 → 'セ' | 'パ' | null（未知の球団はnull。0や空文字で埋めない＝仕様03 §1.3） */
export function leagueOf(team) {
  if (!team) return null;
  if (CENTRAL.includes(team)) return 'セ';
  if (PACIFIC.includes(team)) return 'パ';
  return null;
}

/** 改称をまたいで同じ球団を指す正規名 */
const CANONICAL = {
  '横浜ベイスターズ': '横浜DeNAベイスターズ',
  '西武ライオンズ': '埼玉西武ライオンズ',
};
export function canonicalTeam(team) {
  return CANONICAL[team] ?? team;
}

export const ALL_TEAMS = [...CENTRAL, ...PACIFIC];
