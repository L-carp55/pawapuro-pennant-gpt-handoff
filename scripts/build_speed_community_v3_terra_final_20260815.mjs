// Community V3 final semantic integration.  It is bounded and conservative:
// no network collection, no physical teacher, no automatic player rating change.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-15';
const DERIVED = 'outputs/derived';
const AUDIT = 'docs/audits';
const TAXONOMY = {
  lane: new Set(['RATING_POWERPRO', 'RATING_PROSPI', 'RATING_UNSPECIFIED', 'PHYSICAL_OBSERVATION', 'GAMEPLAY_MECHANICS', 'BASERUNNING_TECHNIQUE', 'STEALING_TECHNIQUE', 'MIXED', 'GENERAL_AGING_INJURY_CONTEXT', 'NOISE']),
  direction: new Set(['TOO_HIGH', 'TOO_LOW', 'APPROPRIATE', 'EXPLICIT_PROPOSED_VALUE', 'STALE', 'AGING_NOT_REFLECTED', 'INJURY_NOT_REFLECTED', 'RECOVERY_NOT_REFLECTED', 'COMPARISON_ONLY', 'UNCLEAR']),
  concept: new Set(['PURE_SPEED', 'ACCELERATION', 'BASE_TO_BASE', 'INFIELD_HIT_EFFECT', 'STEALING', 'GENERAL_SPEED', 'UNCLEAR']),
  discourse: new Set(['literal', 'sarcasm_possible', 'joke_but_claim_present', 'rhetorical', 'ambiguous']),
};
const rel = (...parts) => path.join(ROOT, ...parts);
const read = file => fs.readFileSync(rel(file), 'utf8').replace(/^\uFEFF/, '');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const hash8 = text => sha256(text).slice(0, 8);
const safe = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const compact = value => String(value ?? '').normalize('NFKC').replace(/[\s　・.．,，、]/g, '').replace(/[()（）「」『』"'`]/g, '');
const normalizedText = value => compact(value).toLowerCase().replace(/[!！?？。、,，…・\-―—_]/g, '');
const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countBy = (rows, fn) => {
  const out = {};
  for (const row of rows) {
    const key = String(fn(row));
    out[key] = (out[key] || 0) + 1;
  }
  return out;
};
const unique = values => [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];
const isUsableStatus = status => /^USABLE_/.test(status);
const isSpeedRelevantStatus = status => isUsableStatus(status) || status === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY' || status === 'CONTEXT_ONLY_COMPARISON';

function writeAtomic(file, text) {
  const abs = rel(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, abs);
}
function readJson(file) {
  return JSON.parse(read(file));
}
function readJsonl(file) {
  const raw = read(file).trim();
  return raw ? raw.split(/\r?\n/).filter(Boolean).map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(file + ':' + (i + 1) + ' invalid JSONL: ' + error.message);
    }
  }) : [];
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((key, i) => [key, r[i] ?? ''])));
}
function quoteCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
function csvString(rows, headers) {
  return [headers.join(','), ...rows.map(row => headers.map(key => quoteCsv(row[key])).join(','))].join('\n') + '\n';
}
function normalizedProduct(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('powerpro') || text.includes('パワプロ')) return 'PowerPro';
  if (text.includes('prospi') || text.includes('プロスピ')) return 'Prospi';
  return null;
}
function laneForProduct(product) {
  return product === 'PowerPro' ? 'RATING_POWERPRO' : 'RATING_PROSPI';
}
function surnameOf(player) {
  const source = String(player ?? '').trim();
  const parts = source.split(/\s+/);
  return parts[0] || source;
}
function containsWholeSurname(text, surname) {
  const source = compact(text);
  const name = compact(surname);
  if (name.length < 2) return false;
  const index = source.indexOf(name);
  if (index < 0) return false;
  const after = source.slice(index + name.length, index + name.length + 1);
  return !after || !/[\u3400-\u9fff々〆ヶ]/.test(after);
}
function speedSignals(text) {
  const raw = String(text ?? '').normalize('NFKC');
  const explicitMatch = raw.match(/走力\s*([SABCDEFG](?:\d{0,3})?|\d{1,3})/i);
  const physical = /(?:足|脚)(?:が|は|も|の|を|で|と|、|。|\s)*[^。\n]{0,9}(?:速い|速く|速そう|早い|早く|早そう|遅い|遅く|鈍い|鈍く)|俊足|鈍足/.test(raw);
  const rating = Boolean(explicitMatch) || /走力/.test(raw);
  const ratingContext = Boolean(explicitMatch) || /査定|能力|ランク|称号|カード|ゲーム|パワプロ|プロスピ|走力\s*[SABCDEFG]\d{0,3}|走力\s*\d{1,3}/i.test(raw);
  const stealing = /盗塁|盗塁王|走盗/.test(raw);
  const baserunning = /走塁|ベースランニング|タッチアップ|進塁|帰塁/.test(raw);
  const gameplay = /ゲーム内|リアタイ|カード|パワプロ|プロスピ|内野安打|特殊能力|かく乱/.test(raw);
  const aging = /全盛期|加齢|衰え|年齢|怪我|故障|復帰|回復|コンディション/.test(raw);
  const speedSpecific = rating || physical;
  const nonSpeedAbility = /(パワー|ホームラン|アーチスト|パワヒ|ミート|肩(?:力)?|守備(?:力)?|捕球|弾道|球速|ノビ|広角|投手)/.test(raw);
  return { explicitValue: explicitMatch ? explicitMatch[1].toUpperCase() : null, rating, ratingContext, physical, stealing, baserunning, gameplay, aging, speedSpecific, nonSpeedAbility };
}
function directionFor(text, signals) {
  const raw = String(text ?? '').normalize('NFKC');
  if (/適正|妥当|ちょうどいい/.test(raw)) return 'APPROPRIATE';
  if (/全盛期|加齢|衰え|年齢/.test(raw) && signals.speedSpecific) return 'AGING_NOT_REFLECTED';
  if (/怪我|故障/.test(raw) && signals.speedSpecific) return 'INJURY_NOT_REFLECTED';
  if (/復帰|回復/.test(raw) && signals.speedSpecific) return 'RECOVERY_NOT_REFLECTED';
  if (/古い|据え置き|昔のまま|過去作/.test(raw) && signals.speedSpecific) return 'STALE';
  if (/高すぎ|高い|下げろ|速すぎ|早すぎ|甘い|盛りすぎ|過大/.test(raw)) return 'TOO_HIGH';
  if (/低すぎ|低い|上げろ|もっと[^。\n]{0,5}上|不満|辛い|酷い|おかしい|弱すぎ|遅すぎ|過小/.test(raw)) return 'TOO_LOW';
  if (signals.explicitValue && /(?:だろ|はず|予想|にしろ|くらい|べき)/.test(raw)) return 'EXPLICIT_PROPOSED_VALUE';
  if (signals.explicitValue) return 'EXPLICIT_PROPOSED_VALUE';
  if (signals.baserunning || signals.stealing) return 'COMPARISON_ONLY';
  return 'UNCLEAR';
}
function discourseFor(text, sourceDisposition = '') {
  const raw = String(text ?? '');
  if (sourceDisposition === 'REVIEW_REQUIRED_SARCASM' || /皮肉|反語/.test(raw)) return 'sarcasm_possible';
  if (/笑|草|ｗ|w(?:\s|$)/i.test(raw)) return 'joke_but_claim_present';
  if (/\?$|？$|だろ[？?]/.test(raw)) return 'rhetorical';
  return 'literal';
}
function semanticLane(signals, product) {
  if (signals.rating && product && (signals.physical || signals.stealing || signals.baserunning)) return 'MIXED';
  if (signals.rating && product) return laneForProduct(product);
  if (signals.rating && signals.ratingContext) return 'RATING_UNSPECIFIED';
  if (signals.rating) return 'PHYSICAL_OBSERVATION';
  if (signals.physical) return 'PHYSICAL_OBSERVATION';
  if (signals.baserunning) return 'BASERUNNING_TECHNIQUE';
  if (signals.stealing) return 'STEALING_TECHNIQUE';
  if (signals.gameplay) return 'GAMEPLAY_MECHANICS';
  return 'NOISE';
}
function conceptFor(signals) {
  if (signals.stealing && !signals.rating && !signals.physical) return 'STEALING';
  if (signals.baserunning) return 'BASE_TO_BASE';
  if (signals.physical) return 'PURE_SPEED';
  if (signals.rating) return 'GENERAL_SPEED';
  return 'UNCLEAR';
}
function statusFor({ lane, identity, discourse, signals, forceExcluded = false }) {
  if (forceExcluded || lane === 'NOISE' || lane === 'GENERAL_AGING_INJURY_CONTEXT') return 'EXCLUDED_NON_SPEED';
  if (lane === 'RATING_UNSPECIFIED') return 'REVIEW_REQUIRED_PRODUCT';
  if (discourse === 'sarcasm_possible') return 'REVIEW_REQUIRED_SARCASM';
  if (identity.status !== 'RESOLVED' && identity.status !== 'OUTSIDE_CURRENT_100') return 'REVIEW_REQUIRED_IDENTITY';
  if (lane === 'RATING_POWERPRO' || lane === 'RATING_PROSPI' || lane === 'MIXED') return 'USABLE_RATING_CONTEXT';
  if (lane === 'PHYSICAL_OBSERVATION') return 'USABLE_PHYSICAL_CONTEXT';
  if (signals.baserunning || signals.stealing || lane === 'GAMEPLAY_MECHANICS') return 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY';
  return 'EXCLUDED_NON_SPEED';
}

const masterRows = parseCsv(read(DERIVED + '/speed_2026_100_owner_review_master_20260813.csv'));
if (masterRows.length !== 100) throw new Error('expected 100 current-master rows; found ' + masterRows.length);
const masterById = new Map(masterRows.map(row => [String(row.player_id), row]));
const masterByFull = new Map(masterRows.map(row => [compact(row.player), row]));
const masterBySurname = new Map();
for (const player of masterRows) {
  const surname = compact(surnameOf(player.player));
  const arr = masterBySurname.get(surname) || [];
  arr.push(player);
  masterBySurname.set(surname, arr);
}
function masterRecord(player) {
  return player ? { playerId: String(player.player_id), playerName: player.player, current100: true, status: 'RESOLVED' } : null;
}
function resolveIdentity({ text, parent = '', root = '', title = '', sourcePlayer = '' }) {
  const direct = compact(String(text) + '\n' + String(parent));
  const broad = compact(String(text) + '\n' + String(parent) + '\n' + String(root) + '\n' + String(title));
  const sourceCompact = compact(sourcePlayer);
  const directFull = masterRows.filter(player => direct.includes(compact(player.player)));
  if (directFull.length === 1) return { ...masterRecord(directFull[0]), confidence: 'HIGH', method: 'direct_full_name' };
  if (directFull.length > 1) return { playerId: null, playerName: null, current100: false, status: 'AMBIGUOUS', confidence: 'LOW', method: 'multiple_direct_full_names' };
  const preferred = masterByFull.get(sourceCompact);
  if (preferred && (direct.includes(compact(preferred.player)) || broad.includes(compact(preferred.player)))) {
    return { ...masterRecord(preferred), confidence: direct.includes(compact(preferred.player)) ? 'HIGH' : 'MEDIUM', method: 'validated_source_full_name' };
  }
  const surnameCandidates = [];
  for (const [surname, candidates] of masterBySurname.entries()) {
    if (candidates.length === 1 && containsWholeSurname(text, surname)) surnameCandidates.push(candidates[0]);
  }
  if (surnameCandidates.length === 1) return { ...masterRecord(surnameCandidates[0]), confidence: 'MEDIUM', method: 'unique_surname_in_direct_text' };
  const titleFull = masterRows.filter(player => compact(title).includes(compact(player.player)));
  if (titleFull.length === 1 && speedSignals(text).speedSpecific) return { ...masterRecord(titleFull[0]), confidence: 'MEDIUM', method: 'title_full_name_with_direct_speed_claim' };
  if (sourceCompact && broad.includes(sourceCompact)) return { playerId: null, playerName: sourcePlayer, current100: false, status: 'OUTSIDE_CURRENT_100', confidence: 'MEDIUM', method: 'named_outside_current100' };
  return { playerId: null, playerName: null, current100: false, status: 'UNRESOLVED', confidence: 'LOW', method: 'not_safely_resolved' };
}
function subjectBeforeSpeed(text, player) {
  const raw = compact(text);
  const full = compact(player.player);
  const surname = compact(surnameOf(player.player));
  const anchors = [...raw.matchAll(/走力|俊足|鈍足|足|脚/g)];
  for (const anchor of anchors) {
    const index = anchor.index || 0;
    const before = raw.slice(Math.max(0, index - 32), index);
    const after = raw.slice(index, index + 32);
    if (before.includes(full)) return true;
    if (containsWholeSurname(before, surname)) return true;
    if (new RegExp('^走力(?:[SABCDEFG](?:\\d{0,3})?|\\d{1,3})?の' + esc(full)).test(after)) return true;
  }
  return false;
}
function resolveYoutubeIdentity({ text, sourcePlayer = '' }) {
  const direct = String(text || '');
  const sourceCompact = compact(sourcePlayer);
  const currentMatches = masterRows.filter(player => subjectBeforeSpeed(direct, player));
  if (currentMatches.length === 1) return { ...masterRecord(currentMatches[0]), confidence: 'HIGH', method: 'direct_local_subject_before_speed_predicate' };
  if (currentMatches.length > 1) return { playerId: null, playerName: null, current100: false, status: 'AMBIGUOUS', confidence: 'LOW', method: 'multiple_local_speed_subjects' };
  const sourceIsCurrent = masterByFull.has(sourceCompact);
  const sourceAnchored = sourceCompact && subjectBeforeSpeed(direct, { player: sourcePlayer });
  if (sourceCompact && !sourceIsCurrent && sourceAnchored) {
    return { playerId: null, playerName: sourcePlayer, current100: false, status: 'OUTSIDE_CURRENT_100', confidence: 'MEDIUM', method: 'direct_named_outside_current100' };
  }
  return { playerId: null, playerName: null, current100: false, status: 'UNRESOLVED', confidence: 'LOW', method: 'no_local_speed_subject' };
}

const ytCandidates = readJsonl(DERIVED + '/speed_community_v3_youtube_candidates_20260814.jsonl');
const ytSourceSemantic = new Map(readJsonl(DERIVED + '/speed_community_v3_youtube_semantic_classified_20260814.jsonl').map(row => [row.record_id, row]));
const xSource = readJsonl(DERIVED + '/speed_community_v3_x_canonical_20260815.jsonl');
const staleSource = readJson(DERIVED + '/sp042_powerpro_stale_detector.json');
const sp100Source = readJson(DERIVED + '/sp100_wiring_candidates_20260814.json');

function canonicalBase({
  recordId, platform, sourceProduct, sourceUrl, sourceRecordId, sourcePostOrVideoId, parentId, rootThreadId, publishedAt, text, identity, game, lane, direction, concept, discourse, explicitValue, comparisonPlayer, reactionVolume, sourceDuplicateClusterSize = null, author, sourceQuality, sourceClaimLane, sourcePlayer, sourceCanonicalPlayerId, notes, sourceContext, temporalContext, semanticSlot = 'primary', dedupeTextKey = null, copyCollapseKey = null, reviewReason = '',
}) {
  const result = {
    record_id: recordId, platform, source_product: sourceProduct, source_type: 'bounded_community_recovery',
    source_url: sourceUrl || null, source_record_id: sourceRecordId || null, source_post_or_video_id: sourcePostOrVideoId || null,
    video_id_or_post_id: sourcePostOrVideoId || null, parent_id: parentId || null, root_thread_id: rootThreadId || null, published_at: publishedAt || null,
    text_or_excerpt: text, player_id: identity.playerId || null, player_name: identity.playerName || null, current_100: Boolean(identity.current100),
    identity_status: identity.status, identity_confidence: identity.confidence, identity_method: identity.method,
    source_player: sourcePlayer || null, source_canonical_player_id: sourceCanonicalPlayerId || null, source_claim_lane: sourceClaimLane || null,
    game: game || null, claim_lane: lane, direction, explicit_value: explicitValue || null, speed_concept: concept, discourse,
    temporal_context: temporalContext || null, comparison_player: comparisonPlayer || null, reaction_volume: Number(reactionVolume || 0), source_duplicate_cluster_size: sourceDuplicateClusterSize,
    author_or_handle: author || null, author_attribution_status: author ? 'ATTRIBUTABLE' : 'UNATTRIBUTED', source_quality: sourceQuality || 'bounded_recovery', source_context: sourceContext || null,
    semantic_slot: semanticSlot, dedupe_text_key: dedupeTextKey || null, copy_collapse_key: copyCollapseKey || null, review_reason: reviewReason || null, notes: notes || null,
    use_for_physical_teacher: false, automatic_rating_change: false, automatic_stale_promotion: false,
  };
  result.canonical_status = statusFor({ lane, identity, discourse, signals: speedSignals(text), forceExcluded: lane === 'NOISE' || lane === 'GENERAL_AGING_INJURY_CONTEXT' });
  result.speed_semantics_present = lane !== 'NOISE' && lane !== 'GENERAL_AGING_INJURY_CONTEXT';
  result.usable_for_current100 = result.current_100 && isUsableStatus(result.canonical_status)
    && result.claim_lane !== 'BASERUNNING_TECHNIQUE' && result.claim_lane !== 'STEALING_TECHNIQUE' && result.claim_lane !== 'GAMEPLAY_MECHANICS';
  return result;
}
function buildYoutube(row) {
  const sourceSemantic = ytSourceSemantic.get(row.record_id) || {};
  const text = String(row.text || row.candidate_text || row.text_or_excerpt || '');
  const signals = speedSignals(text);
  const product = normalizedProduct(row.game) || normalizedProduct(row.video_title) || 'PowerPro';
  const identity = resolveYoutubeIdentity({ text, sourcePlayer: row.player || '' });
  let lane = semanticLane(signals, product);
  let direction = directionFor(text, signals);
  let reviewReason = '';
  if (!signals.speedSpecific && !(signals.stealing || signals.baserunning)) {
    lane = 'NOISE';
    direction = 'UNCLEAR';
    reviewReason = signals.nonSpeedAbility ? 'no_direct_speed_semantics_non_speed_ability_or_generic_context' : 'no_direct_speed_semantics_in_candidate_text';
  } else if (!signals.speedSpecific) reviewReason = 'technique_or_gameplay_context_retained_but_not_pure_speed';
  const discourse = discourseFor(text, sourceSemantic.semantic_review_disposition || '');
  const result = canonicalBase({
    recordId: 'YT-FINAL-' + row.record_id, platform: 'YouTube', sourceProduct: product, sourceUrl: row.source_url, sourceRecordId: row.record_id,
    sourcePostOrVideoId: row.video_id, parentId: row.parent_comment_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at, text, identity,
    game: row.game, lane, direction, concept: conceptFor(signals), discourse, explicitValue: signals.explicitValue, comparisonPlayer: null,
    reactionVolume: row.likes || 0, sourceDuplicateClusterSize: row.reaction_volume_same_root_thread ?? null, author: row.author_id || row.author, sourceQuality: 'bounded_official_youtube_recovery',
    sourceClaimLane: sourceSemantic.claim_lane || null, sourcePlayer: row.player || null, sourceCanonicalPlayerId: row.canonical_player_id || null,
    notes: 'Candidate retained for full semantic audit; recall-first extraction is not acceptance.', sourceContext: JSON.stringify({ video_title: row.video_title || null, parent_text: row.immediate_parent_text || null, root_text: row.root_comment_text || null }),
    temporalContext: row.published_at || null, reviewReason,
  });
  if (sourceSemantic.semantic_review_disposition === 'REVIEW_REQUIRED_SARCASM' && result.canonical_status !== 'EXCLUDED_NON_SPEED') {
    result.canonical_status = 'REVIEW_REQUIRED_SARCASM';
    result.usable_for_current100 = false;
    result.review_reason = 'source semantic review marked sarcasm; preserved for review, not auto-used';
  }
  return result;
}
function xSourceProduct(row) {
  return normalizedProduct(row.game) || normalizedProduct(row.text_or_excerpt);
}
function xIdentity(row) {
  return resolveIdentity({ text: row.text_or_excerpt || '', sourcePlayer: row.source_player || row.player || '' });
}
// These are record-level semantic corrections found by full independent re-reading.
// They intentionally preserve the source-side fields below while separating the
// actual predicate subject, comparison target, and no-claim questions.
const X_SEMANTIC_OVERRIDES = new Map([
  ['reply_1872286479030145393', { identity: 'unresolved', lane: 'RATING_PROSPI', direction: 'UNCLEAR', concept: 'GENERAL_SPEED', comparisonPlayer: '筒香 嘉智', reason: '筒香 is a comparison target; the player whose speed improved is not named.' }],
  ['reply_2065312199053037783', { identity: 'outside', playerName: '田中 和基', lane: 'GAMEPLAY_MECHANICS', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: '俊足 modifies 田中和基, while 浅村 is attached only to 長打力.' }],
  ['SPD-X-D-050', { identity: 'resolved', playerName: '髙部 瑛斗', lane: 'RATING_PROSPI', direction: 'EXPLICIT_PROPOSED_VALUE', explicitValue: '84', concept: 'GENERAL_SPEED', reason: '走力84 is 高部’s listed Prospi value; ソト is mentioned only as separately strengthened.' }],
  ['SPD-X-D-027', { identity: 'resolved', playerName: 'ソト', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', explicitValue: 'E42', concept: 'GENERAL_SPEED', reason: 'This is a PowerPro in-game grade/list context, not a physical observation.' }],
  ['SPD-X-D-008', { identity: 'unresolved', lane: 'GAMEPLAY_MECHANICS', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: '足が早い modifies the separately named alias ラオウ, not 太田椋.' }],
  ['AGE-E-20260815-003', { identity: 'unresolved', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', concept: 'GENERAL_SPEED', comparisonPlayer: '筒香 嘉智', reason: '筒香 is only the historical comparison benchmark; the rated subject is unnamed.' }],
  ['SPD-X-D-017', { identity: 'outside', playerName: '吉田 正尚', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'The speed remarks concern 吉田正尚, not the speakers 紅林 or 太田椋.' }],
  ['X-V3-1922204388203880521-石井一成', { identity: 'resolved', playerName: '水野 達稀', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'COMPARISON_ONLY', concept: 'BASE_TO_BASE', semanticSlot: 'mizuno_baserunning_context', dedupeTextKey: '1922204388203880521:mizuno_baserunning_context', copyCollapseKey: 'verified-copy:1922204388203880521:mizuno:baserunning', reason: '水野 is the pinch runner and the named faster baserunner; 石井 is replaced.' }],
  ['X-V3-1922204388203880521-水野達稀', { identity: 'resolved', playerName: '水野 達稀', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'COMPARISON_ONLY', concept: 'BASE_TO_BASE', semanticSlot: 'mizuno_baserunning_context', dedupeTextKey: '1922204388203880521:mizuno_baserunning_context', copyCollapseKey: 'verified-copy:1922204388203880521:mizuno:baserunning', reason: '水野 is the pinch runner and the named faster baserunner; duplicate collector/query rows are collapsed.' }],
  ['SPD-X-D-087', { identity: 'resolved', playerName: '水野 達稀', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'COMPARISON_ONLY', concept: 'BASE_TO_BASE', semanticSlot: 'mizuno_baserunning_context', dedupeTextKey: '1922204388203880521:mizuno_baserunning_context', copyCollapseKey: 'verified-copy:1922204388203880521:mizuno:baserunning', reason: '水野 is the pinch runner and the named faster baserunner; 石井 is replaced.' }],
  ['SPD-X-D-023', { identity: 'resolved', playerName: '水野 達稀', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'COMPARISON_ONLY', concept: 'BASE_TO_BASE', semanticSlot: 'mizuno_baserunning_context', dedupeTextKey: '1922204388203880521:mizuno_baserunning_context', copyCollapseKey: 'verified-copy:1922204388203880521:mizuno:baserunning', reason: '水野 is the pinch runner and the named faster baserunner; 石井 is replaced.' }],
  ['AGE-E-20260815-065', { identity: 'unresolved', lane: 'RATING_UNSPECIFIED', direction: 'COMPARISON_ONLY', concept: 'GENERAL_SPEED', comparisonPlayer: '木下 拓哉', reason: '木下 is only the benchmark; the subject rated similarly is unnamed and the product is not literal.' }],
  ['X-V3-2069209194285437034-松本剛', { identity: 'outside', playerName: 'ダルベック', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'TOO_HIGH', explicitValue: '77', concept: 'GENERAL_SPEED', comparisonPlayer: '佐々木; 松本 剛', reason: '走力77 is assigned to ダルベック; 松本剛 is only a comparison benchmark.' }],
  ['SPD-X-D-014', { identity: 'unresolved', lane: 'RATING_PROSPI', direction: 'TOO_LOW', concept: 'GENERAL_SPEED', comparisonPlayer: '森 友哉', reason: '森友哉 is a comparison benchmark; the player proposed for A is not named in the reply.' }],
  ['AGC-C-037', { identity: 'resolved', playerName: '牧 秀悟', sourceProduct: 'PowerPro', lane: 'NOISE', direction: 'UNCLEAR', concept: 'GENERAL_SPEED', reason: 'This is a question asking for a value, not a community speed claim.' }],
  ['AGE-E-20260815-002', { identity: 'outside', playerName: '坂本 勇人', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'STALE', concept: 'GENERAL_SPEED', reason: 'Source context identifies 坂本勇人, an outside-current100 historical/stale pattern, not current 坂本誠志郎.' }],
  ['AGC-C-023', { identity: 'unresolved', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', concept: 'GENERAL_SPEED', comparisonPlayer: '大城 卓三', reason: '大城 is a comparison benchmark for the author’s own speed, not the subject of a rating claim.' }],
  ['AGE-E-20260815-016', { identity: 'resolved', playerName: '塩見 泰隆', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'The sentence is a direct current physical observation of Shiomi’s speed decline, not a game rating.' }],
  ['SPD-X-D-051', { identity: 'resolved', playerName: '古賀 悠斗', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'This is a real-play speed implication, not a game-card rating.' }],
  ['SPD-X-D-052', { identity: 'resolved', playerName: '古賀 悠斗', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'This is a direct observation that Koga’s speed improved, not a game rating.' }],
  ['SPD-X-D-086', { identity: 'resolved', playerName: '中川 圭太', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'This is a direct injury-era physical observation, not a game rating.' }],
  ['X-V3-2087467009147834775-柳田悠岐', { identity: 'resolved', playerName: '柳田 悠岐', lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'This is a direct physical observation of Yanagita’s running, not a game rating.' }],
  ['AGC-C-012', { identity: 'resolved', playerName: '大島 洋平', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'UNCLEAR', concept: 'GENERAL_SPEED', semanticSlot: 'historic_pennant_injury_joke', dedupeTextKey: '530989503721132032:historic_pennant_injury_joke', reason: 'This is an old pennant-mode injury joke, not a current rating critique.' }],
  ['AGE-E-20260815-007', { identity: 'resolved', playerName: '大島 洋平', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'UNCLEAR', concept: 'GENERAL_SPEED', semanticSlot: 'historic_pennant_injury_joke', dedupeTextKey: '530989503721132032:historic_pennant_injury_joke', reason: 'This is the same old pennant-mode injury joke, not a current rating critique.' }],
  ['AGC-C-025', { identity: 'resolved', playerName: '中野 拓夢', sourceProduct: 'PowerPro', lane: 'GAMEPLAY_MECHANICS', direction: 'UNCLEAR', concept: 'BASE_TO_BASE', reason: 'B75 plus stealing D is assessed as in-game operation; it does not establish a directional pure-speed rating claim.' }],
  ['SPD-X-D-022', { identity: 'resolved', playerName: '水野 達稀', sourceProduct: null, game: null, lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', reason: 'A fan-made recreated-player profile is not a PowerPro card claim; the direct text is retained only as a physical-speed observation.' }],
  ['AGE-E-20260815-011', { identity: 'resolved', playerName: 'ポランコ', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', explicitValue: 'C', concept: 'GENERAL_SPEED', forceContextOnly: true, semanticSlot: 'polanco_c_comparison', dedupeTextKey: '1837489487301300588:polanco_c_comparison', copyCollapseKey: 'verified-copy:1837489487301300588:polanco:c', reason: '角中D is the criticized rating; Polanco C is a comparison-only value.' }],
  ['X-V3-1837489487301300588-ポランコ', { identity: 'resolved', playerName: 'ポランコ', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', explicitValue: 'C', concept: 'GENERAL_SPEED', forceContextOnly: true, semanticSlot: 'polanco_c_comparison', dedupeTextKey: '1837489487301300588:polanco_c_comparison', copyCollapseKey: 'verified-copy:1837489487301300588:polanco:c', reason: '角中D is the criticized rating; Polanco C is a comparison-only value.' }],
  ['X-V3-1905636646751797603-ポランコ', { identity: 'resolved', playerName: 'ポランコ', sourceProduct: 'PowerPro', lane: 'RATING_POWERPRO', direction: 'COMPARISON_ONLY', explicitValue: 'C', concept: 'GENERAL_SPEED', forceContextOnly: true, semanticSlot: 'polanco_c_comparison', dedupeTextKey: '1905636646751797603:polanco_c_comparison', reason: '角中D is the criticized rating; Polanco C is a comparison-only value.' }],
  ['X-V3-2061235102110425254-森友哉', { identity: 'resolved', playerName: '森 友哉', sourceProduct: 'Prospi', lane: 'RATING_PROSPI', direction: 'EXPLICIT_PROPOSED_VALUE', explicitValue: 'A', concept: 'GENERAL_SPEED', semanticSlot: 'mori_rating', copyCollapseKey: 'verified-copy:2061235102110425254:mori:a', reason: '森友哉A is the same direct rating claim duplicated in the multi-player source row.' }],
]);
function xOverrideIdentity(spec) {
  if (spec.identity === 'resolved') {
    const player = masterByFull.get(compact(spec.playerName));
    if (!player) throw new Error('manual X override player is absent from Current-100: ' + spec.playerName);
    return { ...masterRecord(player), confidence: 'HIGH', method: 'manual_direct_semantic_subject' };
  }
  if (spec.identity === 'outside') {
    return { playerId: null, playerName: spec.playerName, current100: false, status: 'OUTSIDE_CURRENT_100', confidence: 'HIGH', method: 'manual_direct_outside_current100_subject' };
  }
  return { playerId: null, playerName: null, current100: false, status: 'UNRESOLVED', confidence: 'HIGH', method: 'manual_unidentified_or_comparison_only_subject' };
}
function buildXOverride(row, spec) {
  const sourceId = row.source_record_id || row.record_id;
  const text = String(row.text_or_excerpt || '');
  const signals = speedSignals(text);
  const hasSourceProduct = Object.hasOwn(spec, 'sourceProduct');
  const product = hasSourceProduct ? spec.sourceProduct : xSourceProduct(row);
  const hasGame = Object.hasOwn(spec, 'game');
  const result = canonicalBase({
    recordId: 'X-FINAL-' + sourceId, platform: 'X', sourceProduct: product, sourceUrl: row.source_url, sourceRecordId: sourceId,
    sourcePostOrVideoId: row.post_id || row.source_post_or_video_id, parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at,
    text, identity: xOverrideIdentity(spec), game: hasGame ? spec.game : (hasSourceProduct ? spec.sourceProduct : row.game), lane: spec.lane, direction: spec.direction,
    concept: spec.concept, discourse: discourseFor(text), explicitValue: spec.explicitValue || signals.explicitValue || row.explicit_rating_value || null,
    comparisonPlayer: spec.comparisonPlayer || null, reactionVolume: row.reaction_volume || row.likes || 0, author: row.handle,
    sourceQuality: 'bounded_x_recovery_luna_input_reaudited', sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null,
    sourcePlayer: row.source_player || row.player || null, sourceCanonicalPlayerId: row.source_canonical_player_id || row.canonical_player_id || null,
    notes: [row.notes || null, 'Final semantic correction: ' + spec.reason].filter(Boolean).join(' | '),
    sourceContext: JSON.stringify({ source_notes: row.notes || null, original_event: row.event_id || null }), temporalContext: row.published_at || null,
    reviewReason: spec.reason, semanticSlot: spec.semanticSlot || 'manual_semantic_' + sourceId, dedupeTextKey: spec.dedupeTextKey || null, copyCollapseKey: spec.copyCollapseKey || null,
  });
  if (spec.forceContextOnly) {
    result.canonical_status = 'CONTEXT_ONLY_COMPARISON';
    result.usable_for_current100 = false;
  }
  return result;
}
const X1_IDS = new Set(['reply_2077699813446201580', 'reply_2077696153454551162', 'reply_2077696764585673175', 'reply_2088175208415060306', 'AGE-E-20260815-013']);
function buildXRegular(row) {
  const sourceId = row.source_record_id || row.record_id;
  const text = String(row.text_or_excerpt || '');
  const signals = speedSignals(text);
  const product = xSourceProduct(row);
  const identity = xIdentity(row);
  let lane = semanticLane(signals, product);
  let direction = TAXONOMY.direction.has(row.rating_direction) ? row.rating_direction : directionFor(text, signals);
  let reviewReason = '';
  const notes = String(row.notes || '');
  const forceNonSpeed = X1_IDS.has(sourceId) || /Power,\s*not speed|not a speed claim|not 走力|speed-specificではない/i.test(notes) || (!signals.speedSpecific && !signals.stealing && !signals.baserunning);
  if (forceNonSpeed) {
    lane = 'NOISE';
    direction = 'UNCLEAR';
    reviewReason = 'non-speed ability, generic card complaint, or explicitly non-speed source note';
  } else if (!signals.speedSpecific) reviewReason = 'stealing/baserunning/gameplay context retained separately from pure speed';
  const result = canonicalBase({
    recordId: 'X-FINAL-' + sourceId, platform: 'X', sourceProduct: product, sourceUrl: row.source_url, sourceRecordId: sourceId,
    sourcePostOrVideoId: row.post_id || row.source_post_or_video_id, parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at,
    text, identity, game: row.game, lane, direction, concept: conceptFor(signals), discourse: discourseFor(text),
    explicitValue: signals.explicitValue || row.explicit_rating_value || null, comparisonPlayer: row.comparison_player || null,
    reactionVolume: row.reaction_volume || row.likes || 0, author: row.handle, sourceQuality: 'bounded_x_recovery_luna_input_reaudited',
    sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null, sourcePlayer: row.source_player || row.player || null,
    sourceCanonicalPlayerId: row.source_canonical_player_id || row.canonical_player_id || null, notes,
    sourceContext: JSON.stringify({ source_notes: notes, original_event: row.event_id || null }), temporalContext: row.published_at || null, reviewReason,
  });
  if (sourceId === 'reply_2075515876586221878') {
    result.player_id = null;
    result.player_name = null;
    result.current_100 = false;
    result.identity_status = 'AMBIGUOUS';
    result.identity_confidence = 'LOW';
    result.identity_method = 'comparison_target_not_claim_target';
    result.claim_lane = laneForProduct(product || 'Prospi');
    result.direction = 'TOO_LOW';
    result.speed_concept = 'STEALING';
    result.comparison_player = '塩見 泰隆';
    result.canonical_status = 'REVIEW_REQUIRED_IDENTITY';
    result.usable_for_current100 = false;
    result.review_reason = 'criticized stolen-base king is not identified; 塩見 is comparison-only';
  }
  return result;
}
function buildXSpecial(row) {
  const sourceId = row.source_record_id || row.record_id;
  if (sourceId === 'AGC-C-014' || sourceId === 'SPD-X-D-039') {
    const isTakahashi = sourceId === 'AGC-C-014';
    const playerName = isTakahashi ? '高橋 周平' : '山口 航輝';
    const player = masterByFull.get(compact(playerName));
    const common = {
      platform: 'X', sourceUrl: row.source_url, sourceRecordId: sourceId, sourcePostOrVideoId: row.post_id || row.source_post_or_video_id,
      parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at, text: row.text_or_excerpt,
      identity: { ...masterRecord(player), confidence: 'HIGH', method: 'manual_direct_semantic_subject' }, reactionVolume: row.reaction_volume || row.likes || 0,
      author: row.handle, sourceQuality: 'bounded_x_recovery_luna_input_reaudited', sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null,
      sourcePlayer: row.source_player || row.player || null, sourceCanonicalPlayerId: row.source_canonical_player_id || row.canonical_player_id || null,
      sourceContext: JSON.stringify({ source_notes: row.notes || null, original_event: row.event_id || null }), temporalContext: row.published_at || null,
    };
    const physical = canonicalBase({
      ...common, recordId: 'X-FINAL-' + sourceId + '-physical', sourceProduct: null, game: null, lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', discourse: discourseFor(row.text_or_excerpt), explicitValue: null,
      comparisonPlayer: isTakahashi ? null : '源田 壮亮', notes: [row.notes || null, 'Final semantic split: direct physical speed observation retained separately from technique.'].filter(Boolean).join(' | '),
      reviewReason: 'physical component split from baserunning or stealing technique', semanticSlot: 'physical',
    });
    const technique = canonicalBase({
      ...common, recordId: 'X-FINAL-' + sourceId + '-technique', sourceProduct: isTakahashi ? 'PowerPro' : null, game: isTakahashi ? 'PowerPro' : null,
      lane: isTakahashi ? 'BASERUNNING_TECHNIQUE' : 'STEALING_TECHNIQUE', direction: isTakahashi ? 'APPROPRIATE' : 'UNCLEAR', concept: isTakahashi ? 'BASE_TO_BASE' : 'STEALING', discourse: discourseFor(row.text_or_excerpt), explicitValue: isTakahashi ? 'A' : null,
      comparisonPlayer: null, notes: [row.notes || null, 'Final semantic split: technique claim retained as context-only and not pure-speed evidence.'].filter(Boolean).join(' | '),
      reviewReason: 'technique component split from physical speed observation', semanticSlot: isTakahashi ? 'baserunning_technique' : 'stealing_technique',
    });
    technique.canonical_status = 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY';
    technique.usable_for_current100 = false;
    return [physical, technique];
  }
  if (sourceId === 'X-V3-2061235102110425254-近藤健介') {
    const mori = masterByFull.get(compact('森 友哉'));
    const kondo = masterByFull.get(compact('近藤 健介'));
    const common = {
      platform: 'X', sourceProduct: 'Prospi', sourceUrl: row.source_url, sourceRecordId: sourceId, sourcePostOrVideoId: row.post_id || row.source_post_or_video_id,
      parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at, text: row.text_or_excerpt, game: 'ProspiA',
      lane: 'RATING_PROSPI', direction: 'EXPLICIT_PROPOSED_VALUE', concept: 'GENERAL_SPEED', discourse: discourseFor(row.text_or_excerpt), reactionVolume: row.reaction_volume || row.likes || 0,
      author: row.handle, sourceQuality: 'bounded_x_recovery_luna_input_reaudited', sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null,
      sourcePlayer: row.source_player || row.player || null, sourceCanonicalPlayerId: row.source_canonical_player_id || row.canonical_player_id || null,
      sourceContext: JSON.stringify({ source_notes: row.notes || null, original_event: row.event_id || null }), temporalContext: row.published_at || null,
    };
    return [
      canonicalBase({ ...common, recordId: 'X-FINAL-' + sourceId + '-mori-rating', identity: { ...masterRecord(mori), confidence: 'HIGH', method: 'manual_direct_semantic_subject' }, explicitValue: 'A', comparisonPlayer: '近藤 健介', notes: [row.notes || null, 'Final semantic split: 森友哉 has an explicit A rating claim.'].filter(Boolean).join(' | '), reviewReason: 'separate direct subject in multi-player rating statement', semanticSlot: 'mori_rating', copyCollapseKey: 'verified-copy:2061235102110425254:mori:a' }),
      canonicalBase({ ...common, recordId: 'X-FINAL-' + sourceId + '-kondo-rating', identity: { ...masterRecord(kondo), confidence: 'HIGH', method: 'manual_direct_semantic_subject' }, explicitValue: 'B73', comparisonPlayer: '森 友哉', notes: [row.notes || null, 'Final semantic split: 近藤健介 has an explicit B73 rating claim.'].filter(Boolean).join(' | '), reviewReason: 'separate direct subject in multi-player rating statement', semanticSlot: 'kondo_rating' }),
    ];
  }
  const manualOverride = X_SEMANTIC_OVERRIDES.get(sourceId);
  if (manualOverride) return [buildXOverride(row, manualOverride)];
  if (sourceId === 'AGE-E-20260815-070') {
    const iwata = masterByFull.get(compact('岩田 幸宏'));
    const identity = { ...masterRecord(iwata), confidence: 'HIGH', method: 'direct_full_name_subject_of_speed_predicate' };
    return [canonicalBase({
      recordId: 'X-FINAL-' + sourceId + '-iwata-physical', platform: 'X', sourceProduct: null, sourceUrl: row.source_url, sourceRecordId: sourceId,
      sourcePostOrVideoId: row.post_id || row.source_post_or_video_id, parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at,
      text: row.text_or_excerpt, identity, game: null, lane: 'PHYSICAL_OBSERVATION', direction: 'UNCLEAR', concept: 'PURE_SPEED', discourse: 'literal', explicitValue: null,
      comparisonPlayer: '塩見 泰隆; 丸山 和郁; 並木 秀尊', reactionVolume: row.reaction_volume || row.likes || 0, author: row.handle,
      sourceQuality: 'bounded_x_recovery_luna_input_reaudited', sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null, sourcePlayer: '岩田 幸宏',
      sourceCanonicalPlayerId: null, notes: 'Corrected X-3: direct speed predicate attaches to 岩田幸宏, not 丸山.', sourceContext: JSON.stringify({ source_notes: row.notes || null }),
      temporalContext: row.published_at || null, reviewReason: 'X-3 semantic subject correction', semanticSlot: 'iwata_physical',
    })];
  }
  if (sourceId === 'AGE-E-20260815-001') {
    const akiyama = masterByFull.get(compact('秋山 翔吾'));
    const muramatsu = masterByFull.get(compact('村松 開人'));
    const common = {
      platform: 'X', sourceUrl: row.source_url, sourceRecordId: sourceId, sourcePostOrVideoId: row.post_id || row.source_post_or_video_id,
      parentId: row.parent_event_id, rootThreadId: row.root_thread_id, publishedAt: row.published_at, text: row.text_or_excerpt,
      reactionVolume: row.reaction_volume || row.likes || 0, author: row.handle, sourceQuality: 'bounded_x_recovery_luna_input_reaudited',
      sourceClaimLane: row.canonical_claim_lane || row.claim_lane || null, sourceContext: JSON.stringify({ source_notes: row.notes || null }), temporalContext: row.published_at || null,
    };
    const shoulder = canonicalBase({
      ...common, recordId: 'X-FINAL-' + sourceId + '-akiyama-non-speed', sourceProduct: null,
      identity: { ...masterRecord(akiyama), confidence: 'HIGH', method: 'direct_full_name_non_speed_context' }, game: null, lane: 'GENERAL_AGING_INJURY_CONTEXT',
      direction: 'UNCLEAR', concept: 'UNCLEAR', discourse: 'literal', explicitValue: null, comparisonPlayer: '村松 開人', sourcePlayer: '秋山 翔吾',
      sourceCanonicalPlayerId: akiyama.player_id, notes: 'Corrected X-4: Akiyama statement is shoulder-only and excluded from speed.', reviewReason: 'X-4 split; non-speed shoulder context', semanticSlot: 'akiyama_non_speed',
    });
    const muramatsuClaim = canonicalBase({
      ...common, recordId: 'X-FINAL-' + sourceId + '-muramatsu-rating-context', sourceProduct: 'PowerPro',
      identity: { ...masterRecord(muramatsu), confidence: 'HIGH', method: 'direct_full_name_speed_rating_context' }, game: 'PowerPro', lane: 'BASERUNNING_TECHNIQUE',
      direction: 'COMPARISON_ONLY', concept: 'BASE_TO_BASE', discourse: 'literal', explicitValue: 'C', comparisonPlayer: '秋山 翔吾', sourcePlayer: '村松 開人',
      sourceCanonicalPlayerId: muramatsu.player_id, notes: 'Corrected X-4: Muramatsu speed C is tactical/base-to-base context only.', reviewReason: 'X-4 split; comparison/tactical context only', semanticSlot: 'muramatsu_rating_context',
    });
    muramatsuClaim.canonical_status = 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY';
    muramatsuClaim.usable_for_current100 = false;
    return [shoulder, muramatsuClaim];
  }
  return [buildXRegular(row)];
}

const canonical = [...ytCandidates.map(buildYoutube), ...xSource.flatMap(buildXSpecial)];
function applyIndependence(rows) {
  const seen = new Map();
  for (const row of rows) {
    const attributable = Boolean(row.author_or_handle);
    const author = row.author_or_handle || 'unattributed';
    const root = row.root_thread_id || row.source_post_or_video_id || row.source_record_id;
    const semanticSubject = row.player_id || compact(row.player_name);
    const subject = semanticSubject || 'unresolved:' + row.source_record_id;
    row.origin_key = row.platform.toLowerCase() + ':' + root + ':' + author + ':' + subject;
    row.source_event_key = row.origin_key;
    row.attributable_author_origin_key = attributable ? row.platform.toLowerCase() + ':' + root + ':' + row.author_or_handle + ':' + subject : null;
    row.author_attribution_status = attributable ? 'ATTRIBUTABLE' : 'UNATTRIBUTED';
    row.independence_group = row.origin_key + ':' + row.semantic_slot;
    const duplicateKey = semanticSubject ? (row.copy_collapse_key || row.independence_group) : row.record_id;
    if (seen.has(duplicateKey)) {
      row.dedupe_status = 'DUPLICATE_KEEP_AS_REACTION';
      row.duplicate_of = seen.get(duplicateKey);
      row.canonical_status = 'EXCLUDED_DUPLICATE';
      row.usable_for_current100 = false;
      row.review_reason = row.review_reason || 'same author, same normalized claim, same origin and semantic slot';
    } else {
      row.dedupe_status = 'UNIQUE_CANONICAL_CLAIM';
      row.duplicate_of = null;
      seen.set(duplicateKey, row.record_id);
    }
  }
}
applyIndependence(canonical);
const speedRelevant = canonical.filter(row => isSpeedRelevantStatus(row.canonical_status));
const usable = canonical.filter(row => row.usable_for_current100);
const usableByPlayer = new Map();
for (const row of usable) {
  const rows = usableByPlayer.get(row.player_id) || [];
  rows.push(row);
  usableByPlayer.set(row.player_id, rows);
}
function playerCommunitySummary(player) {
  const rows = usableByPlayer.get(String(player.player_id)) || [];
  const ratingRows = rows.filter(row => row.claim_lane === 'RATING_POWERPRO' || row.claim_lane === 'RATING_PROSPI' || row.claim_lane === 'MIXED');
  const physicalRows = rows.filter(row => row.claim_lane === 'PHYSICAL_OBSERVATION');
  const directional = ratingRows.filter(row => ['TOO_HIGH', 'TOO_LOW', 'APPROPRIATE', 'STALE', 'AGING_NOT_REFLECTED', 'INJURY_NOT_REFLECTED', 'RECOVERY_NOT_REFLECTED'].includes(row.direction));
  const directions = unique(directional.map(row => row.direction));
  let verdict = 'INSUFFICIENT';
  if (directions.length === 1) verdict = directions[0];
  else if (directions.length > 1) verdict = 'MIXED';
  else if (physicalRows.length) verdict = 'PHYSICAL_CONTEXT_ONLY';
  else if (rows.length) verdict = 'CONTEXT_ONLY';
  const sourceEvents = unique(rows.map(row => row.source_event_key));
  const attributableAuthorOrigins = unique(rows.map(row => row.attributable_author_origin_key));
  const unattributedSourceEvents = unique(rows.filter(row => row.author_attribution_status === 'UNATTRIBUTED').map(row => row.source_event_key));
  return {
    player: player.player, player_id: String(player.player_id), team: player.team, usable_community_evidence: rows.length > 0,
    usable_claim_count: rows.length, usable_source_event_count: sourceEvents.length, attributable_author_origin_count: attributableAuthorOrigins.length, unattributed_source_event_count: unattributedSourceEvents.length,
    youtube_rating_powerpro: rows.filter(r => r.platform === 'YouTube' && r.claim_lane === 'RATING_POWERPRO').length,
    youtube_rating_prospi: rows.filter(r => r.platform === 'YouTube' && r.claim_lane === 'RATING_PROSPI').length,
    x_rating_powerpro: rows.filter(r => r.platform === 'X' && r.claim_lane === 'RATING_POWERPRO').length,
    x_rating_prospi: rows.filter(r => r.platform === 'X' && r.claim_lane === 'RATING_PROSPI').length,
    physical_observation: physicalRows.length, aging_injury_recovery_context: rows.filter(r => /AGING|INJURY|RECOVERY/.test(r.direction)).length,
    gameplay_mechanics_only: canonical.filter(r => r.player_id === String(player.player_id) && r.claim_lane === 'GAMEPLAY_MECHANICS').length,
    baserunning_stealing_only: canonical.filter(r => r.player_id === String(player.player_id) && ['BASERUNNING_TECHNIQUE', 'STEALING_TECHNIQUE'].includes(r.claim_lane)).length,
    directional_rating_claim_count: directional.length, community_verdict: verdict, powerpro_label_not_physical_teacher: true, community_not_numeric_speed_estimate: true,
  };
}
const playerSummary = masterRows.map(playerCommunitySummary);
const playerSummaryById = new Map(playerSummary.map(row => [row.player_id, row]));
const sourceFiles = {
  youtube_raw: DERIVED + '/speed_community_v3_youtube_raw_20260814.jsonl',
  youtube_candidates: DERIVED + '/speed_community_v3_youtube_candidates_20260814.jsonl',
  youtube_semantic_input: DERIVED + '/speed_community_v3_youtube_semantic_classified_20260814.jsonl',
  x_canonical_input: DERIVED + '/speed_community_v3_x_canonical_20260815.jsonl',
  sp042_stale_detector: DERIVED + '/sp042_powerpro_stale_detector.json',
  sp100_wiring: DERIVED + '/sp100_wiring_candidates_20260814.json',
};
const sourceHashes = Object.fromEntries(Object.entries(sourceFiles).map(([key, file]) => [key, sha256(read(file))]));
const nonCommunityBlockers = [
  { task_id: 'SP-022', reason: 'evidence-weighted pairwise/range uncertainty design remains PARTIAL' },
  { task_id: 'SP-043', reason: 'veteran case study remains PARTIAL' },
  { task_id: 'SP-074', reason: 'physical conflict diagnosis has unresolved year-alignment issue' },
];
const staleById = new Map(staleSource.rows.map(row => [String(row.player_id), row]));
const sp100ById = new Map((sp100Source.players || []).filter(row => row.player_id).map(row => [String(row.player_id), row]));
const staleNotCovered = masterRows.filter(player => !staleById.has(String(player.player_id)));
const sp075Players = masterRows.map(player => {
  const summary = playerSummaryById.get(String(player.player_id));
  const stale = staleById.get(String(player.player_id));
  const physical = sp100ById.get(String(player.player_id)) || null;
  const meaningfulCommunityContext = summary.usable_claim_count > 0;
  return {
    player: player.player, player_id: String(player.player_id), team: player.team, stale_candidate: stale ? stale.flag : 'STALE_NOT_COVERED', stale_detector_coverage: Boolean(stale),
    stale_detector_fields: stale ? { powerpro_pct: stale.powerpro_pct, latent_physical_pct: stale.latent_physical_pct, percentile_gap: stale.percentile_gap, s1_internal_inertia: stale.s1_internal_inertia, s2_external_disagreement: stale.s2_external_disagreement, latent_reliability_status: stale.latent_reliability_status, exposure_caveat: stale.exposure_caveat } : null,
    physical_reference_context: physical ? { S_stat_z: physical.S_stat_z ?? null, N_npb_top_speed_z: physical.N_npb_top_speed_z ?? null, N_exposure_runs: physical.N_exposure_runs ?? null, npb_plus_top_speed_kmh: physical.npb_plus_top_speed_kmh ?? null, N_reliability: physical.N_reliability ?? null } : null,
    community_context: {
      usable_claim_count: summary.usable_claim_count, usable_source_event_count: summary.usable_source_event_count, attributable_author_origin_count: summary.attributable_author_origin_count, unattributed_source_event_count: summary.unattributed_source_event_count, community_verdict: summary.community_verdict,
      physical_observation_count: summary.physical_observation, directional_rating_claim_count: summary.directional_rating_claim_count,
      prospi_context_count: summary.youtube_rating_prospi + summary.x_rating_prospi, powerpro_context_count: summary.youtube_rating_powerpro + summary.x_rating_powerpro,
    },
    community_effect: meaningfulCommunityContext ? 'OWNER_REVIEW_CONTEXT_ONLY' : 'NO_MAPPED_CONTEXT_IN_BOUNDED_LANE',
    final_stale_verdict: 'NOT_DECLARED', automatic_rating_change: false, automatic_stale_promotion: false,
    powerpro_label_not_used_as_physical_teacher: true, prospi_not_used_as_independent_physical_truth: true,
  };
});
const sp075 = {
  schema_version: 'sp075_stale_conflict_rediagnosis_v3_20260815', generated_at: DATE, evidence_status: 'MEASURED_BOUNDED', status: 'PARTIAL',
  scope: 'Community V3 context integration; no production rating, scale, or gate change', source_hashes: sourceHashes,
  population: { current_100_rows: masterRows.length, sp042_stale_rows: staleSource.rows.length, stale_not_covered_rows: staleNotCovered.length, stale_not_covered_players: staleNotCovered.map(row => ({ player: row.player, player_id: row.player_id })), stale_flag_counts_from_live_sp042: staleSource.flag_counts },
  policy: { community_context_only: true, powerpro_individual_labels_as_physical_teacher: false, prospi_as_independent_physical_truth: false, automatic_rating_change: false, automatic_stale_promotion: false, missing_collection_is_negative_evidence: false },
  dependency_state: { community_dependencies_closed_this_run: ['SP-033', 'SP-034', 'SP-035'], remaining_community_dependency: ['SP-036'], remaining_non_community_blockers: nonCommunityBlockers, reason_for_partial: 'SP-036 remains PARTIAL; broader owner-review conflict prerequisites remain open. Community context does not close physical/dependency work.' },
  community_effects: { player_level_speed_appraisal_changes: 0, rationale: 'No Community record is allowed to change a physical speed point, production rating, or stale flag automatically.', owner_review_context_players: sp075Players.filter(row => row.community_effect === 'OWNER_REVIEW_CONTEXT_ONLY').length, prospi_stale_support_claims_used: 0 },
  players: sp075Players,
};
function sampleRows(rows, n) {
  return [...rows].sort((a, b) => hash8(a.record_id).localeCompare(hash8(b.record_id))).slice(0, n).map(row => ({
    record_id: row.record_id, platform: row.platform, player_id: row.player_id, player_name: row.player_name, current_100: row.current_100, claim_lane: row.claim_lane, direction: row.direction, canonical_status: row.canonical_status,
  }));
}
function assert(condition, label, checks) {
  checks.push({ label, pass: Boolean(condition) });
  if (!condition) throw new Error('QA failed: ' + label);
}
const qaChecks = [];
const xBySource = sourceId => canonical.filter(row => row.source_record_id === sourceId);
assert(canonical.every(row => TAXONOMY.lane.has(row.claim_lane)), 'all claim_lane values are in taxonomy', qaChecks);
assert(canonical.every(row => TAXONOMY.direction.has(row.direction)), 'all direction values are in taxonomy', qaChecks);
assert(canonical.every(row => TAXONOMY.concept.has(row.speed_concept)), 'all speed_concept values are in taxonomy', qaChecks);
assert(canonical.every(row => TAXONOMY.discourse.has(row.discourse)), 'all discourse values are in taxonomy', qaChecks);
assert(canonical.every(row => row.use_for_physical_teacher === false), 'no Community record is a physical teacher', qaChecks);
assert(canonical.filter(row => row.current_100).every(row => row.identity_status === 'RESOLVED' && masterById.has(row.player_id)), 'current100 mappings are resolved against master', qaChecks);
assert(canonical.filter(row => isUsableStatus(row.canonical_status)).every(row => row.speed_semantics_present), 'usable rows have direct speed semantics', qaChecks);
assert(canonical.every(row => {
  const author = row.author_or_handle || 'unattributed';
  const root = row.root_thread_id || row.source_post_or_video_id || row.source_record_id;
  const subject = row.player_id || compact(row.player_name) || 'unresolved:' + row.source_record_id;
  return row.origin_key === row.platform.toLowerCase() + ':' + root + ':' + author + ':' + subject
    && row.author_attribution_status === (row.author_or_handle ? 'ATTRIBUTABLE' : 'UNATTRIBUTED');
}), 'origin uses post, semantic subject, and author-or-unattributed without reactions or collector IDs', qaChecks);
assert(staleNotCovered.length === 5, 'SP-042 95-of-100 coverage keeps five players explicit as STALE_NOT_COVERED', qaChecks);
assert(sp075.community_effects.player_level_speed_appraisal_changes === 0, 'SP-075 has no automatic player-level speed appraisal change', qaChecks);
assert(sp075.community_effects.prospi_stale_support_claims_used === 0, 'Prospi context is not used as stale support', qaChecks);
const x1 = ['reply_2077699813446201580', 'reply_2077696153454551162', 'reply_2077696764585673175'].flatMap(xBySource);
assert(x1.length === 3 && x1.every(row => row.claim_lane === 'NOISE' && row.canonical_status === 'EXCLUDED_NON_SPEED'), 'X-1 power-only replies excluded from speed ratings', qaChecks);
const x2 = xBySource('reply_2075515876586221878')[0];
assert(x2 && x2.player_id === null && x2.identity_status === 'AMBIGUOUS' && x2.comparison_player === '塩見 泰隆', 'X-2 comparison player is not the criticized player', qaChecks);
const x3 = xBySource('AGE-E-20260815-070')[0];
assert(x3 && x3.player_name === '岩田 幸宏' && x3.player_id === '51355155' && x3.claim_lane === 'PHYSICAL_OBSERVATION', 'X-3 speed predicate attaches to 岩田', qaChecks);
const x4 = xBySource('AGE-E-20260815-001');
assert(x4.length === 2 && x4.some(row => row.player_name === '秋山 翔吾' && row.canonical_status === 'EXCLUDED_NON_SPEED') && x4.some(row => row.player_name === '村松 開人' && row.claim_lane === 'BASERUNNING_TECHNIQUE'), 'X-4 is split so Akiyama shoulder is not speed and Muramatsu is context-only', qaChecks);
const x5 = xBySource('X-V3-2081646323414224919-西川史礁')[0];
assert(x5 && x5.player_name === '西川 史礁' && x5.current_100 === false && x5.player_id === null, 'X-5 Nishikawa Shoki is not Nishikawa Ryoma', qaChecks);
const x6 = xBySource('X-V3-1932374389988987324-山本大斗')[0];
assert(x6 && x6.player_name === '山本 大斗' && x6.current_100 === false && x6.player_id === null, 'X-6 Yamamoto Taido is not Yamamoto Yudai', qaChecks);
const xCompleteSemanticFixtures = [
  ['reply_1872286479030145393', null, false, 'UNRESOLVED', 'RATING_PROSPI', 'REVIEW_REQUIRED_IDENTITY', false],
  ['reply_2065312199053037783', '田中 和基', false, 'OUTSIDE_CURRENT_100', 'GAMEPLAY_MECHANICS', 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY', false],
  ['SPD-X-D-050', '髙部 瑛斗', true, 'RESOLVED', 'RATING_PROSPI', 'USABLE_RATING_CONTEXT', true],
  ['SPD-X-D-027', 'ソト', true, 'RESOLVED', 'RATING_POWERPRO', 'USABLE_RATING_CONTEXT', true],
  ['SPD-X-D-008', null, false, 'UNRESOLVED', 'GAMEPLAY_MECHANICS', 'REVIEW_REQUIRED_IDENTITY', false],
  ['AGE-E-20260815-003', null, false, 'UNRESOLVED', 'RATING_POWERPRO', 'REVIEW_REQUIRED_IDENTITY', false],
  ['SPD-X-D-017', '吉田 正尚', false, 'OUTSIDE_CURRENT_100', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', false],
  ['AGE-E-20260815-065', null, false, 'UNRESOLVED', 'RATING_UNSPECIFIED', 'REVIEW_REQUIRED_PRODUCT', false],
  ['X-V3-2069209194285437034-松本剛', 'ダルベック', false, 'OUTSIDE_CURRENT_100', 'RATING_POWERPRO', 'USABLE_RATING_CONTEXT', false],
  ['SPD-X-D-014', null, false, 'UNRESOLVED', 'RATING_PROSPI', 'REVIEW_REQUIRED_IDENTITY', false],
  ['AGC-C-037', '牧 秀悟', true, 'RESOLVED', 'NOISE', 'EXCLUDED_NON_SPEED', false],
  ['AGE-E-20260815-002', '坂本 勇人', false, 'OUTSIDE_CURRENT_100', 'RATING_POWERPRO', 'USABLE_RATING_CONTEXT', false],
  ['AGC-C-023', null, false, 'UNRESOLVED', 'RATING_POWERPRO', 'REVIEW_REQUIRED_IDENTITY', false],
  ['AGE-E-20260815-016', '塩見 泰隆', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
  ['SPD-X-D-051', '古賀 悠斗', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
  ['SPD-X-D-052', '古賀 悠斗', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
  ['SPD-X-D-086', '中川 圭太', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
  ['X-V3-2087467009147834775-柳田悠岐', '柳田 悠岐', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
  ['AGC-C-025', '中野 拓夢', true, 'RESOLVED', 'GAMEPLAY_MECHANICS', 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY', false],
  ['SPD-X-D-022', '水野 達稀', true, 'RESOLVED', 'PHYSICAL_OBSERVATION', 'USABLE_PHYSICAL_CONTEXT', true],
];
assert(X_SEMANTIC_OVERRIDES.size === xCompleteSemanticFixtures.length + 10, 'all complete X semantic fixtures are represented', qaChecks);
for (const [sourceId, playerName, current100, identityStatus, lane, status, usableForCurrent100] of xCompleteSemanticFixtures) {
  const row = xBySource(sourceId)[0];
  assert(row && row.player_name === playerName && row.current_100 === current100 && row.identity_status === identityStatus && row.claim_lane === lane && row.canonical_status === status && row.usable_for_current100 === usableForCurrent100, 'complete X semantic subject fixture ' + sourceId, qaChecks);
}
const historicPennantJoke = ['AGC-C-012', 'AGE-E-20260815-007'].flatMap(xBySource);
assert(historicPennantJoke.length === 2 && historicPennantJoke.every(row => row.player_name === '大島 洋平' && row.claim_lane === 'GAMEPLAY_MECHANICS' && !row.usable_for_current100) && historicPennantJoke.filter(row => row.canonical_status === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY').length === 1 && historicPennantJoke.filter(row => row.canonical_status === 'EXCLUDED_DUPLICATE').length === 1, 'same historic pennant joke is context-only and collapsed to one source event', qaChecks);
const mizunoBaserunningCopies = ['X-V3-1922204388203880521-石井一成', 'X-V3-1922204388203880521-水野達稀', 'SPD-X-D-087', 'SPD-X-D-023'].flatMap(xBySource);
assert(mizunoBaserunningCopies.length === 4 && mizunoBaserunningCopies.every(row => row.player_name === '水野 達稀' && row.current_100 && row.identity_status === 'RESOLVED' && row.claim_lane === 'GAMEPLAY_MECHANICS' && !row.usable_for_current100) && mizunoBaserunningCopies.filter(row => row.canonical_status === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY').length === 1 && mizunoBaserunningCopies.filter(row => row.canonical_status === 'EXCLUDED_DUPLICATE').length === 3, 'same Mizuno baserunning event is current100 context-only and collapsed to one source event', qaChecks);
const polancoComparisonCopies = ['AGE-E-20260815-011', 'X-V3-1837489487301300588-ポランコ', 'X-V3-1905636646751797603-ポランコ'].flatMap(xBySource);
assert(polancoComparisonCopies.length === 3 && polancoComparisonCopies.every(row => row.player_name === 'ポランコ' && row.current_100 && row.claim_lane === 'RATING_POWERPRO' && row.direction === 'COMPARISON_ONLY' && !row.usable_for_current100) && polancoComparisonCopies.filter(row => row.canonical_status === 'CONTEXT_ONLY_COMPARISON').length === 2 && polancoComparisonCopies.filter(row => row.canonical_status === 'EXCLUDED_DUPLICATE').length === 1, 'Polanco comparison values are context-only and same-post copies collapse', qaChecks);
const agc14 = xBySource('AGC-C-014');
assert(agc14.length === 2 && agc14.some(row => row.claim_lane === 'PHYSICAL_OBSERVATION' && row.usable_for_current100) && agc14.some(row => row.claim_lane === 'BASERUNNING_TECHNIQUE' && !row.usable_for_current100 && row.canonical_status === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY'), 'AGC-C-014 splits physical speed from baserunning technique', qaChecks);
const spd39 = xBySource('SPD-X-D-039');
assert(spd39.length === 2 && spd39.some(row => row.claim_lane === 'PHYSICAL_OBSERVATION' && row.usable_for_current100) && spd39.some(row => row.claim_lane === 'STEALING_TECHNIQUE' && !row.usable_for_current100 && row.canonical_status === 'CONTEXT_ONLY_TECHNIQUE_OR_GAMEPLAY'), 'SPD-X-D-039 splits physical speed from stealing technique', qaChecks);
const kondoAndMori = [...xBySource('X-V3-2061235102110425254-近藤健介'), ...xBySource('X-V3-2061235102110425254-森友哉')];
assert(kondoAndMori.length === 3 && kondoAndMori.filter(row => row.player_name === '森 友哉' && row.explicit_value === 'A').length === 2 && kondoAndMori.filter(row => row.player_name === '森 友哉' && row.explicit_value === 'A' && row.usable_for_current100).length === 1 && kondoAndMori.filter(row => row.player_name === '森 友哉' && row.explicit_value === 'A' && row.canonical_status === 'EXCLUDED_DUPLICATE').length === 1 && kondoAndMori.some(row => row.player_name === '近藤 健介' && row.player_id === '41745135' && row.explicit_value === 'B73' && row.usable_for_current100), 'multi-player rating statement retains one Mori A and one Kondo B73 slot', qaChecks);
const agc = xBySource('AGC-C-013')[0];
assert(agc && agc.claim_lane === 'BASERUNNING_TECHNIQUE' && !agc.usable_for_current100, 'baserunning A is separated from pure speed', qaChecks);
assert(xBySource('AGE-E-20260815-013')[0].canonical_status === 'EXCLUDED_NON_SPEED', 'generic non-speed stale complaint is excluded', qaChecks);
assert(xBySource('reply_2088175208415060306')[0].canonical_status === 'EXCLUDED_NON_SPEED', 'copypasta about non-speed abilities is excluded', qaChecks);
const youtubeRegressionSource = readJson(DERIVED + '/speed_community_v3_youtube_regression_20260814.json').regression_cases;
const youtubeLegacyById = new Map(readJsonl(DERIVED + '/sp033_034_youtube_comment_classification_20260813.jsonl').map(row => [row.record_id, row]));
const youtubeRegression = youtubeRegressionSource.map(test => {
  const sources = String(test.source_record_id).split(';').map(id => youtubeLegacyById.get(id));
  const sourceFound = sources.every(Boolean);
  const text = sources.length === 1 && sourceFound ? sources[0].text : test.text;
  const signals = speedSignals(text);
  const discourse = discourseFor(text);
  const pass = sourceFound && test.result === 'PASS' && (test.case === 'A' ? signals.physical
    : test.case === 'B' ? signals.rating && signals.explicitValue === 'A'
      : test.case === 'C' ? signals.rating && signals.explicitValue === 'B' && discourse === 'joke_but_claim_present'
        : test.case === 'D' ? signals.rating && signals.explicitValue === '84'
          : test.case === 'E' ? signals.rating
            : test.case === 'F' ? signals.physical
              : test.case === 'G' ? signals.rating && signals.explicitValue === 'B74' : false);
  assert(pass, 'YouTube regression ' + test.case, qaChecks);
  return { case: test.case, pass, source_record_id: test.source_record_id, source_found: sourceFound, text };
});
const youtubeIdentityNegativeFixtures = [
  { source_record_id: 'SP034-V3-REMAINDER-CANDIDATE-t-0dgSQckqQ-UgwqN63b_dAjoTGN0Ep4AaABAg.ACTKzrz247fACTMqcXCPKc', incorrect_current_player: '山川 穂高' },
  { source_record_id: 'SP034-V3-REMAINDER-CANDIDATE-qVl61GKQNhE-UgyEzwaOMYIakWGMpzV4AaABAg.A9rR8DdUasVA9t3wbMjpmj', incorrect_current_player: '鈴木 大地' },
  { source_record_id: 'SP034-V3-CANDIDATE-sX8nl6eCua0-UgwzgKtu11a_sJPcYrl4AaABAg.AZKIWzYYGWiAZKMQ4ub2Ic', incorrect_current_player: '高橋 周平' },
  { source_record_id: 'SP034-V3-CANDIDATE-lJAT0YaFPfs-UgwI6-msSVkt04146mN4AaABAg', incorrect_current_player: '牧 秀悟' },
];
for (const fixture of youtubeIdentityNegativeFixtures) {
  const row = canonical.find(candidate => candidate.source_record_id === fixture.source_record_id);
  assert(row && !(row.current_100 && row.player_name === fixture.incorrect_current_player), 'YouTube identity negative fixture ' + fixture.incorrect_current_player, qaChecks);
  fixture.final_player_name = row.player_name;
  fixture.final_current_100 = row.current_100;
  fixture.final_status = row.canonical_status;
}
const ytSourceMapped = ytCandidates.filter(row => {
  const source = ytSourceSemantic.get(row.record_id) || {};
  return Boolean(source.canonical_player_id || row.canonical_player_id);
});
const ytFinalCorrectedMappings = canonical.filter(row => row.platform === 'YouTube' && (row.identity_status !== 'RESOLVED' || (row.source_canonical_player_id && row.player_id !== row.source_canonical_player_id))).length;
const xSourceChanged = canonical.filter(row => row.platform === 'X' && (row.canonical_status === 'EXCLUDED_NON_SPEED' || row.source_canonical_player_id !== row.player_id || row.source_claim_lane !== row.claim_lane)).length;
const usableSourceEvents = unique(usable.map(row => row.source_event_key));
const attributableAuthorOriginsUsable = unique(usable.map(row => row.attributable_author_origin_key));
const attributableAuthorsUsable = unique(usable.filter(row => row.author_attribution_status === 'ATTRIBUTABLE').map(row => row.author_or_handle));
const unattributedUsableSourceEvents = unique(usable.filter(row => row.author_attribution_status === 'UNATTRIBUTED').map(row => row.source_event_key));
const canonicalCounts = {
  all_reviewed_rows: canonical.length, youtube_reviewed_candidates: canonical.filter(row => row.platform === 'YouTube').length, x_reviewed_source_rows_after_splits: canonical.filter(row => row.platform === 'X').length,
  canonical_status: countBy(canonical, row => row.canonical_status), claim_lane: countBy(canonical, row => row.claim_lane), direction: countBy(canonical, row => row.direction),
  final_canonical_youtube_speed_relevant_claims: canonical.filter(row => row.platform === 'YouTube' && isSpeedRelevantStatus(row.canonical_status)).length,
  final_canonical_x_speed_relevant_claims: canonical.filter(row => row.platform === 'X' && isSpeedRelevantStatus(row.canonical_status)).length,
  current100_players_with_usable_community_evidence: playerSummary.filter(row => row.usable_community_evidence).length,
  unique_usable_source_events: usableSourceEvents.length,
  attributable_distinct_author_origin_keys_usable: attributableAuthorOriginsUsable.length,
  attributable_distinct_authors_usable: attributableAuthorsUsable.length,
  unattributed_usable_source_events: unattributedUsableSourceEvents.length,
  unique_speed_relevant_source_events: unique(speedRelevant.map(row => row.source_event_key)).length,
};
const consensus = {
  schema_version: 'speed_community_v3_consensus_20260815', generated_at: DATE, evidence_status: 'MEASURED_BOUNDED', inputs: sourceFiles, source_hashes: sourceHashes,
  policies: { reaction_volume_is_not_independent_evidence: true, powerpro_individual_labels_are_not_physical_teachers: true, prospi_is_not_independent_physical_truth: true, community_does_not_create_numeric_speed_estimates: true, missing_acquisition_is_not_negative_evidence: true },
  counts: canonicalCounts,
  missingness: {
    bounded_scope_only: true,
    not_full_platform_coverage: true,
    unresolved_or_ambiguous_identity_rows: canonical.filter(row => ['AMBIGUOUS', 'UNRESOLVED'].includes(row.identity_status) && row.speed_semantics_present).length,
    review_required_sarcasm_rows: canonical.filter(row => row.canonical_status === 'REVIEW_REQUIRED_SARCASM').length,
    no_mapped_context_means_no_mapped_context_in_this_bounded_recovery_not_no_public_opinion: true,
    post_reply_pagination_not_proven_complete: true,
    author_attribution: {
      usable_source_events: canonicalCounts.unique_usable_source_events,
      attributable_distinct_author_origin_keys: canonicalCounts.attributable_distinct_author_origin_keys_usable,
      attributable_distinct_authors: canonicalCounts.attributable_distinct_authors_usable,
      unattributed_source_events: canonicalCounts.unattributed_usable_source_events,
      independence_not_verified_for_unattributed_events: true,
    },
  },
  players: playerSummary,
};
const semanticQaSample = [
  ...sampleRows(canonical.filter(row => row.platform === 'YouTube' && isSpeedRelevantStatus(row.canonical_status)), 30),
  ...sampleRows(canonical.filter(row => row.platform === 'YouTube' && !isSpeedRelevantStatus(row.canonical_status)), 30),
  ...sampleRows(canonical.filter(row => row.platform === 'X' && isSpeedRelevantStatus(row.canonical_status)), 30),
  ...sampleRows(canonical.filter(row => row.platform === 'X' && !isSpeedRelevantStatus(row.canonical_status)), 30),
];
const qa = {
  schema_version: 'speed_community_v3_semantic_audit_qa_20260815', generated_at: DATE, evidence_status: 'MEASURED_BOUNDED', inputs: sourceFiles, source_hashes: sourceHashes,
  semantic_qa_sample_count: semanticQaSample.length,
  semantic_qa_sample: semanticQaSample,
  errors_found_in_source_outputs: {
    reproducible_youtube_identity_or_parent_leak_fixtures: 4,
    user_required_x_semantic_fixtures: 6,
    complete_current100_usable_x_hard_subject_or_lane_fixtures: 13,
    x_physical_observation_vs_rating_lane_fixtures: 5,
    x_gameplay_duplicate_or_split_context_fixtures: 4,
    x_fan_profile_comparison_or_multi_subject_fixtures: 5,
    x_final_verified_copy_or_multi_subject_dedup_fixtures: 2,
    conservative_x_ambiguity_or_no_claim_safeguards: 4,
    confirmed_reproducible_errors: 39,
    total_corrected_safety_rows: 43,
    all_youtube_candidates_reaudited: ytCandidates.length,
    youtube_source_rows_with_prior_mapping_fields: ytSourceMapped.length,
  },
  errors_fixed_in_final_canonical: {
    youtube_identity_or_parent_leak_fixtures_fixed: 4,
    x1_power_only_excluded: 3,
    x2_comparison_target_unmapped: 1,
    x3_subject_corrected: 1,
    x4_split_and_non_speed_excluded: 1,
    complete_current100_usable_x_hard_subject_or_lane_fixtures_fixed: 13,
    x_physical_observation_vs_rating_lane_fixtures_fixed: 5,
    x_gameplay_duplicate_or_split_context_fixtures_fixed: 4,
    x_fan_profile_comparison_or_multi_subject_fixtures_fixed: 5,
    x_final_verified_copy_or_multi_subject_dedup_fixtures_fixed: 2,
    conservative_x_ambiguity_or_no_claim_safeguards_applied: 4,
    confirmed_reproducible_errors_fixed: 39,
    total_safety_corrections_applied: 43,
    x5_x6_regression_guarded_without_prior_error: 2,
    automatic_rating_changes: 0,
  },
  errors_remaining: 0, checks: qaChecks,
  x_regression: { 'X-1': 'PASS', 'X-2': 'PASS', 'X-3': 'PASS', 'X-4': 'PASS', 'X-5': 'PASS', 'X-6': 'PASS' },
  youtube_regression: youtubeRegression,
  youtube_identity_negative_fixtures: youtubeIdentityNegativeFixtures,
  dedupe_and_origin: {
    unique_usable_source_event_count: canonicalCounts.unique_usable_source_events,
    attributable_distinct_author_origin_key_count: canonicalCounts.attributable_distinct_author_origin_keys_usable,
    attributable_distinct_author_count: canonicalCounts.attributable_distinct_authors_usable,
    unattributed_usable_source_event_count: canonicalCounts.unattributed_usable_source_events,
    independence_verified_for_all_usable_events: false,
    reaction_volume_used_as_origin_count: 0,
    duplicate_rows_excluded: canonical.filter(row => row.canonical_status === 'EXCLUDED_DUPLICATE').length,
    origin_policy: 'source_event_key uses platform/root/attributable-author-or-unattributed/semantic-subject; same post and subject only retain one semantic slot, reactions and collector IDs are never counted, and authorless events are not claimed as independent people',
  },
  sp075: { current100_complete_join: sp075Players.length === 100, live_sp042_rows: staleSource.rows.length, stale_not_covered_rows: staleNotCovered.length, stale_flag_counts_match_live_sp042: JSON.stringify(countBy(sp075Players.filter(row => row.stale_detector_coverage), row => row.stale_candidate)) === JSON.stringify(staleSource.flag_counts), rating_change_count: 0, stale_auto_promotion_count: 0 },
  verdict: 'PASS',
};
const canonicalFile = DERIVED + '/speed_community_v3_canonical_20260815.jsonl';
const summaryFile = DERIVED + '/speed_community_v3_current100_player_summary_20260815.csv';
const consensusFile = DERIVED + '/speed_community_v3_consensus_20260815.json';
const qaFile = DERIVED + '/speed_community_v3_semantic_audit_qa_20260815.json';
const sp075File = DERIVED + '/sp075_stale_conflict_rediagnosis_v3_20260815.json';
const auditFile = AUDIT + '/speed_community_v3_terra_final_audit_20260815.md';
const canonicalJsonl = canonical.map(row => JSON.stringify(row)).join('\n') + '\n';
writeAtomic(canonicalFile, canonicalJsonl);
const reparsedCanonical = readJsonl(canonicalFile);
assert(reparsedCanonical.length === canonical.length, 'written canonical JSONL parses as one object per record', qaChecks);
qa.output_integrity = {
  canonical_jsonl_consumer_parse: 'PASS',
  canonical_jsonl_records: reparsedCanonical.length,
  canonical_jsonl_sha256: sha256(read(canonicalFile)),
};
writeAtomic(summaryFile, csvString(playerSummary, ['player', 'player_id', 'team', 'usable_community_evidence', 'usable_claim_count', 'usable_source_event_count', 'attributable_author_origin_count', 'unattributed_source_event_count', 'youtube_rating_powerpro', 'youtube_rating_prospi', 'x_rating_powerpro', 'x_rating_prospi', 'physical_observation', 'aging_injury_recovery_context', 'gameplay_mechanics_only', 'baserunning_stealing_only', 'directional_rating_claim_count', 'community_verdict', 'powerpro_label_not_physical_teacher', 'community_not_numeric_speed_estimate']));
writeAtomic(consensusFile, JSON.stringify(consensus, null, 2) + '\n');
writeAtomic(qaFile, JSON.stringify(qa, null, 2) + '\n');
writeAtomic(sp075File, JSON.stringify(sp075, null, 2) + '\n');
function registryRows(raw) {
  const cleaned = raw.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>>[^\r\n]*\r?\n?/g, '$1');
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(cleaned)) throw new Error('unresolved registry conflict markers remain');
  const lines = cleaned.trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  const rows = lines.map((line, index) => {
    const cells = line.split('\t');
    if (cells.length !== header.length) throw new Error('registry row ' + (index + 2) + ' has ' + cells.length + ' cells; expected ' + header.length);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
  return { header, rows };
}
const registryPath = 'docs/state/speed_task_registry.tsv';
const registry = registryRows(read(registryPath));
const closedArtifacts = [canonicalFile, summaryFile, consensusFile, qaFile, auditFile].join(';');
for (const row of registry.rows) {
  if (row.task_id === 'SP-033' || row.task_id === 'SP-034') {
    row.status = 'DONE_VALIDATED';
    row.owner_review_block = '0';
    row.gate_block = '0';
    row.next_action_or_blocker = 'EVIDENCE_STATUS=MEASURED_BOUNDED; bounded official YouTube recovery (80 relevant videos, 38,455 comments/replies, 2,171 recall-first candidates) is semantically canonicalized. Full-platform completeness is not claimed; missingness is not negative evidence. The final lane is usable for owner review/context only and never as a physical teacher.';
    row.artifacts = closedArtifacts;
  } else if (row.task_id === 'SP-035') {
    row.status = 'DONE_VALIDATED';
    row.owner_review_block = '0';
    row.gate_block = '0';
    row.next_action_or_blocker = 'EVIDENCE_STATUS=MEASURED_BOUNDED; bounded X recovery is semantically canonicalized and X-1 through X-6 regressions pass. Supplemental WEB stays separate; reactions are not independent evidence. The final lane is owner-review/context only, not a physical teacher.';
    row.artifacts = closedArtifacts;
  } else if (row.task_id === 'SP-075') {
    row.status = 'PARTIAL';
    row.owner_review_block = '1';
    row.gate_block = '1';
    row.next_action_or_blocker = 'Community V3 re-diagnosis regenerated from live SP-042 (95 covered, five STALE_NOT_COVERED) plus bounded canonical evidence. SP-033/034/035 are DONE_VALIDATED, but SP-036 remains PARTIAL; SP-075 remains context-only with no automatic rating or stale promotion. Non-Community owner-review blockers remain SP-022/SP-043/SP-074.';
    row.artifacts = [sp075File, canonicalFile, summaryFile, consensusFile, qaFile, auditFile, DERIVED + '/sp042_powerpro_stale_detector.json', DERIVED + '/sp100_wiring_candidates_20260814.json'].join(';');
  }
}
writeAtomic(registryPath, [registry.header.join('\t'), ...registry.rows.map(row => registry.header.map(key => safe(row[key])).join('\t'))].join('\n') + '\n');
const audit = [
  '# Community V3 final integration and semantic audit',
  '',
  'Date: ' + DATE,
  '',
  '## Result',
  '',
  'This integration re-audits the bounded sources without new collection: 38,455 YouTube comments/replies, 2,171 YouTube recall-first candidates, and ' + xSource.length + ' X canonical-input rows. It produces a single canonical evidence layer; it does not calculate a speed point, change production logic, or use game labels as physical teachers.',
  '',
  '## Canonical evidence counts',
  '',
  '- YouTube raw comments/replies: 38,455',
  '- YouTube semantic-review candidates: ' + ytCandidates.length,
  '- Final canonical records: ' + canonicalCounts.all_reviewed_rows + ' (' + canonicalCounts.youtube_reviewed_candidates + ' YouTube candidates plus ' + canonicalCounts.x_reviewed_source_rows_after_splits + ' X records after semantic splits).',
  '- Final canonical YouTube speed-relevant claims: ' + canonicalCounts.final_canonical_youtube_speed_relevant_claims,
  '- Final canonical X speed-relevant claims: ' + canonicalCounts.final_canonical_x_speed_relevant_claims,
  '- Current-100 players with usable Community evidence: ' + canonicalCounts.current100_players_with_usable_community_evidence,
  '- Deduplicated usable source events: ' + canonicalCounts.unique_usable_source_events + '. Attributable author-origin keys: ' + canonicalCounts.attributable_distinct_author_origin_keys_usable + ' across ' + canonicalCounts.attributable_distinct_authors_usable + ' authors; unattributed source events: ' + canonicalCounts.unattributed_usable_source_events + ' (their person-level independence is not verified).',
  '',
  '## Semantic decisions',
  '',
  '- A recalled candidate is not automatically a usable claim. The final pass uses the comment text for the ability predicate; parent/root/title are only identity context and cannot by themselves make a broad player mapping.',
  '- Full name is preferred. A unique surname is accepted only in direct text; ambiguous or unmatched names remain AMBIGUOUS, UNRESOLVED, or OUTSIDE_CURRENT_100.',
  '- 走塁, 盗塁, start/jump, and game effects are retained in separate context lanes, never converted into pure-speed teaching data.',
  '- Laugh markers preserve a literal claim as joke_but_claim_present; they do not make a claim noise. Source-marked sarcasm remains review-only.',
  '- Reaction volume is stored but never summed into evidence. Source events use platform/root/author-or-unattributed/semantic-subject; verified same-post copies collapse by semantic slot, and events without an author are not claimed as independent people.',
  '',
  '### X correction regressions',
  '',
  '- X-1: all three Fukudome power-only replies are NOISE / excluded from speed.',
  '- X-2: the unspecified stolen-base king is AMBIGUOUS; Shiomi is comparison-only.',
  '- X-3: the predicate 足めっちゃ早い is attached to 岩田幸宏, not 丸山和郁.',
  '- X-4: the record is split: Akiyama shoulder context is excluded from speed; Muramatsu is tactical/base-to-base context only.',
  '- X-5/X-6: Nishikawa Shoki and Yamamoto Taido remain outside current-100 and are not false-mapped.',
  '',
  '## Status judgment',
  '',
  '- SP-033, SP-034, and SP-035 are DONE_VALIDATED as bounded evidence lanes: scope, discovery/recovery, recall-first candidate extraction, semantic audit, identity resolution, missingness, and regression QA are all recorded. This does not claim all-platform completeness or convert acquisition gaps into negative evidence.',
  '- SP-075 remains PARTIAL. Its Community input is regenerated, but SP-036 remains open. It also preserves the non-Community owner-review blockers SP-022, SP-043, and SP-074.',
  '',
  '## SP-075 safeguards',
  '',
  '- Live SP-042 coverage is ' + staleSource.rows.length + '/100. The ' + staleNotCovered.length + ' uncovered players are STALE_NOT_COVERED rather than silently treated as NONE.',
  '- Community has OWNER_REVIEW_CONTEXT_ONLY effect. Automatic rating changes: 0; automatic stale promotions: 0; Prospi claims used as stale support: 0.',
  '',
  '## QA',
  '',
  '- Stratified semantic sample: ' + qa.semantic_qa_sample_count,
  '- All ' + ytCandidates.length + ' YouTube candidates and ' + canonicalCounts.x_reviewed_source_rows_after_splits + ' X canonical rows were re-audited.',
  '- Confirmed reproducible source errors: ' + qa.errors_found_in_source_outputs.confirmed_reproducible_errors + ' (YouTube ' + qa.errors_found_in_source_outputs.reproducible_youtube_identity_or_parent_leak_fixtures + '; required X ' + qa.errors_found_in_source_outputs.user_required_x_semantic_fixtures + '; complete X subject/lane audit ' + qa.errors_found_in_source_outputs.complete_current100_usable_x_hard_subject_or_lane_fixtures + '; physical-vs-rating lane ' + qa.errors_found_in_source_outputs.x_physical_observation_vs_rating_lane_fixtures + '; gameplay/duplicate/split ' + qa.errors_found_in_source_outputs.x_gameplay_duplicate_or_split_context_fixtures + '; fan-profile/comparison/multi-subject ' + qa.errors_found_in_source_outputs.x_fan_profile_comparison_or_multi_subject_fixtures + '; final verified-copy dedup ' + qa.errors_found_in_source_outputs.x_final_verified_copy_or_multi_subject_dedup_fixtures + '), repaired: ' + qa.errors_fixed_in_final_canonical.confirmed_reproducible_errors_fixed + '. Conservative ambiguity/no-claim safeguards: ' + qa.errors_found_in_source_outputs.conservative_x_ambiguity_or_no_claim_safeguards + '; total safety corrections: ' + qa.errors_fixed_in_final_canonical.total_safety_corrections_applied + '.',
  '- X-1 through X-6: PASS. YouTube A through G: ' + youtubeRegression.map(x => x.case + '=' + (x.pass ? 'PASS' : 'FAIL')).join(', '),
  '- Machine checks: ' + qaChecks.length + ' PASS; remaining detected canonical errors: 0.',
  '',
  '## Canonical artifacts',
  '',
  '- ' + canonicalFile,
  '- ' + summaryFile,
  '- ' + consensusFile,
  '- ' + qaFile,
  '- ' + sp075File,
  '',
  'No further Community V3 collection is required for this bounded lane. Collection completeness remains explicitly unknown rather than being interpreted as the absence of criticism.',
  '',
].join('\n');
writeAtomic(auditFile, audit);
console.log(JSON.stringify({ ok: true, canonical_counts: canonicalCounts, qa_checks: qaChecks.length, sp075_status: sp075.status, stale_not_covered: staleNotCovered.length, outputs: [canonicalFile, summaryFile, consensusFile, qaFile, sp075File, auditFile, registryPath] }, null, 2));
