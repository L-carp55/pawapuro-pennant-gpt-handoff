// SP-054/055 — 既存 Prospi run3 を再収集せず検品する。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT = path.join(ROOT, 'outputs', 'derived', 'speed_prospi_gamex_current_20260813_run3.csv');
const HIST = path.join(ROOT, 'outputs', 'derived', 'speed_prospi_gamex_historical_20260813_run3.csv');
const MASTER = path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_owner_review_master_20260813.csv');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sp054_055_prospi_run3_qa_20260813.json');

function parseCsv(p) {
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　・･]/g, '');
const master = parseCsv(MASTER);
const masterById = new Map(master.map(r => [r.player_id, r]));
const current = parseCsv(CURRENT);
const hist = parseCsv(HIST);

function qaRows(rows, expectedEditionPrefix) {
  const cards = rows.filter(r => r.record_type === 'MATCHED_CARD');
  const outcomes = rows.filter(r => r.record_type === 'PLAYER_OUTCOME');
  const findings = [];
  const accepted = [];
  const suspicious = [];
  const missing = [];

  for (const r of cards) {
    const m = masterById.get(r.canonical_player_id);
    const speed = Number(r.attribute_value);
    const issues = [];
    if (!m) issues.push('MASTER_ID_NOT_IN_100');
    if (m && nk(m.player) !== nk(r.player)) issues.push('MASTER_NAME_MISMATCH');
    if (!Number.isFinite(speed) || speed < 1 || speed > 99) issues.push('SPEED_OUT_OF_RANGE');
    if (r.attribute_name !== '走力') issues.push('ATTRIBUTE_NOT_SPEED');
    if (!r.source_url) issues.push('MISSING_URL');
    if (!r.edition) issues.push('MISSING_EDITION');
    if (expectedEditionPrefix && !String(r.edition).startsWith(expectedEditionPrefix) && !String(r.edition).includes(expectedEditionPrefix)) {
      issues.push('EDITION_UNEXPECTED');
    }
    if (!r.collected_at_utc) issues.push('MISSING_PROVENANCE_TIME');
    if (r.http_status && r.http_status !== '200') issues.push(`HTTP_${r.http_status}`);
    const cardType = r.source_card_type || '';
    const isSpecial = /スペシャル|セレクション|侍ジャパン|アニバ|エキサイティング|OB|TS/.test(cardType);
    const rec = {
      record_id: r.record_id,
      player: r.player,
      canonical_player_id: r.canonical_player_id,
      master_team_2026: m?.team ?? null,
      source_team: r.source_team,
      source_player_name: r.source_player_name,
      edition: r.edition,
      source_card_type: cardType,
      card_class: isSpecial ? 'SPECIAL_OR_BOOSTED' : 'REGULAR_OR_UNSPECIFIED',
      speed,
      source_url: r.source_url,
      fingerprint: r.source_row_fingerprint,
      issues,
    };
    if (issues.length) suspicious.push(rec);
    else accepted.push(rec);
  }

  const cardsByPlayerEd = new Map();
  for (const r of cards) {
    const k = `${r.canonical_player_id}|${r.edition}|${r.source_card_type}|${r.source_row_fingerprint}`;
    if (!cardsByPlayerEd.has(k)) cardsByPlayerEd.set(k, []);
    cardsByPlayerEd.get(k).push(r.record_id);
  }
  const exactDupes = [...cardsByPlayerEd.entries()].filter(([, v]) => v.length > 1);

  for (const r of outcomes) {
    const status = r.acquisition_status;
    const reason = r.exclusion_or_decision_reason || '';
    let hole = 'PLAYER_NOT_ON_PAGE';
    if (status === 'NOT_COLLECTED' || /ページが見つからない|HTTP 404|PAGE_NOT_COVERED/.test(reason)) {
      hole = 'PAGE_NOT_COVERED';
    } else if (/IDENTITY_UNRESOLVED|曖昧一致|照合不能/.test(reason)) {
      hole = 'IDENTITY_UNRESOLVED';
    } else if (status === 'NOT_FOUND' || /ページ内の不在|氏名不在/.test(reason)) {
      hole = 'PLAYER_NOT_ON_PAGE';
    } else if (/ゲーム未収録を確認|ACTUALLY_NOT_LISTED/.test(reason) && !/意味しない/.test(reason)) {
      hole = 'ACTUALLY_NOT_LISTED';
    }
    missing.push({
      record_id: r.record_id,
      player: r.player,
      canonical_player_id: r.canonical_player_id,
      edition: r.edition,
      acquisition_status: status,
      hole,
      reason: r.exclusion_or_decision_reason,
    });
  }

  if (exactDupes.length) findings.push({ id: 'P-01', severity: 'MAJOR', summary: `exact duplicate fingerprints: ${exactDupes.length}` });
  return {
    rows: rows.length,
    matched_cards: cards.length,
    player_outcomes: outcomes.length,
    accepted_cards: accepted.length,
    suspicious_cards: suspicious,
    exact_duplicate_fingerprints: exactDupes.length,
    missing_by_hole: missing.reduce((a, r) => { a[r.hole] = (a[r.hole] ?? 0) + 1; return a; }, {}),
    missing,
    findings,
    accepted,
  };
}

const currentQa = qaRows(current, '2026');
const histQa = qaRows(hist, '2025');
const histByEd = {};
for (const r of hist.filter(x => x.record_type === 'MATCHED_CARD')) {
  histByEd[r.edition] = (histByEd[r.edition] ?? 0) + 1;
}

const out = {
  generated_at: '2026-08-13',
  recollection: false,
  current_2026s1: {
    claimed: 17,
    observed_matched_cards: currentQa.matched_cards,
    accepted: currentQa.accepted_cards,
    missing_by_hole: currentQa.missing_by_hole,
    note: 'NOT_FOUND on GameX 2026 S1 page is PLAYER_NOT_ON_PAGE, not "player absent from Prospi".',
  },
  historical: {
    claimed: { '2025 Series 2': 88, '2025 Series 1': 43 },
    observed_matched_by_edition: histByEd,
    accepted: histQa.accepted_cards,
    missing_by_hole: histQa.missing_by_hole,
    note: '2024 Series 2 remains PAGE_NOT_COVERED / NOT_COLLECTED in run3 diagnosis. Not a game-absence finding.',
  },
  current_detail: { suspicious_cards: currentQa.suspicious_cards, findings: currentQa.findings },
  historical_detail: { suspicious_cards: histQa.suspicious_cards, findings: histQa.findings },
  regular_vs_special: {
    current_regular: currentQa.accepted.filter(r => r.card_class !== 'SPECIAL_OR_BOOSTED').length,
    current_special: currentQa.accepted.filter(r => r.card_class === 'SPECIAL_OR_BOOSTED').length,
    hist_regular: histQa.accepted.filter(r => r.card_class !== 'SPECIAL_OR_BOOSTED').length,
    hist_special: histQa.accepted.filter(r => r.card_class === 'SPECIAL_OR_BOOSTED').length,
  },
  acceptance_sufficient_for_sp056: currentQa.accepted_cards >= 10 && histQa.accepted_cards >= 50,
  verdict: (currentQa.findings.some(f => f.severity === 'BLOCK') || histQa.findings.some(f => f.severity === 'BLOCK'))
    ? 'BLOCK'
    : 'PASS_FOR_QA_EVIDENCE',
};
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  current_cards: currentQa.matched_cards,
  hist_cards: histQa.matched_cards,
  hist_by_ed: histByEd,
  current_missing: currentQa.missing_by_hole,
  hist_missing: histQa.missing_by_hole,
  special: out.regular_vs_special,
  acceptance_sufficient_for_sp056: out.acceptance_sufficient_for_sp056,
  verdict: out.verdict,
}, null, 2));
