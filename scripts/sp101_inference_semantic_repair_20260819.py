#!/usr/bin/env python3
"""SP-101 inference-semantic repair wave 2.

This layer is intentionally network-free. It reuses the already collected and
identity-repaired SP-101 foundation, and recomputes only inference semantics
that were rejected by the second independent audit.

It does NOT write owner verdicts, SP-079 ratings, shoulder outputs, or execute
SP-102 search.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import importlib.util
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

DATE = "2026-08-19"
ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts" / "sp101_repair_and_regenerate_20260818.py"

spec = importlib.util.spec_from_file_location("sp101_base_repair", BASE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot import SP-101 repaired foundation")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

FEATURES = list(base.FEATURES)
ROUTES = list(base.ROUTES)
ROUTE_KEYS = [f"{rid}_{name}" for rid, name in ROUTES]
TARGET_STATES = list(base.TARGET_STATES)
LEDGER_PATH = ROOT / "outputs" / "derived" / "sp078_owner_verdict_ledger_20260816.json"
LOCK_PATH = ROOT / "docs" / "state" / "speed_owner_review_integrity_lock_20260817.json"
OUT = ROOT / "outputs" / "derived"

KNN_K = 5
MAHALANOBIS_SHRINKAGE = 0.10
MAHALANOBIS_RIDGE = 1e-6
OT_EPSILON = 0.12
OT_MAX_ITER = 250
OT_TOL = 1e-8
CONSENSUS_MIN_INDEPENDENT_COMPARABLE = 2
CONFLICT_TOLERANCE = 0.20
BAND_LOW = 0.35
BAND_HIGH = 0.65


def clean(v: Any) -> str:
    return base.clean(v)


def as_float(v: Any) -> float | None:
    return base.as_float(v)


def stable_bytes(v: Any) -> bytes:
    return (json.dumps(v, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def write_json(path: Path, v: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(stable_bytes(v))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def median(values: Iterable[Any]) -> float | None:
    vals = [float(x) for x in values if as_float(x) is not None]
    return statistics.median(vals) if vals else None


def percentile(values: list[float], value: float | None) -> float | None:
    return base.percentile(values, value)


def feature_values(left: dict[str, Any], right: dict[str, Any]) -> tuple[list[str], list[float], list[float]]:
    return base.feature_values(left, right)


def l2(xs: list[float], ys: list[float]) -> float:
    return base.l2(xs, ys)


def band_of(pct: float | None) -> str | None:
    if pct is None:
        return None
    if pct < BAND_LOW:
        return "LOW"
    if pct < BAND_HIGH:
        return "MID"
    return "HIGH"


def corr(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / math.sqrt(vx * vy)


def metrics(actual: list[float], pred: list[float]) -> dict[str, Any]:
    if not actual or len(actual) != len(pred):
        return {"n": 0, "mae": None, "rmse": None, "correlation": None, "mean_error": None}
    err = [p - a for a, p in zip(actual, pred)]
    return {
        "n": len(actual),
        "mae": statistics.mean(abs(e) for e in err),
        "rmse": math.sqrt(statistics.mean(e * e for e in err)),
        "correlation": corr(actual, pred),
        "mean_error": statistics.mean(err),
    }


# ---------- deterministic The Show target semantics ----------

def build_show_targets(panel: list[dict[str, Any]]) -> tuple[dict[tuple[str, int], dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, Any]]:
    groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    non_live = 0
    for row in panel:
        speed = as_float(row.get("speed"))
        mlbam = clean(row.get("mlbam_id"))
        season = base.as_int(row.get("season"))
        if row.get("non_live_excluded") not in (False, 0, "false", "False", None):
            non_live += 1
        if speed is None or not mlbam or season is None:
            continue
        groups[(mlbam, season)].append(row)
        by_key[clean(row.get("stable_player_key"))].append(row)
    targets: dict[tuple[str, int], dict[str, Any]] = {}
    repeated = 0
    for key, rows in sorted(groups.items()):
        speeds = sorted(float(r["speed"]) for r in rows if as_float(r.get("speed")) is not None)
        if len(speeds) > 1:
            repeated += 1
        editions = sorted({clean(r.get("mlb_the_show_edition")) for r in rows if clean(r.get("mlb_the_show_edition"))})
        targets[key] = {
            "mlbam_id": key[0],
            "season": key[1],
            "target_speed": statistics.median(speeds),
            "policy": "SEASON_MEDIAN_LIVE_SPEED",
            "observation_count": len(speeds),
            "min_speed": min(speeds),
            "max_speed": max(speeds),
            "editions": editions,
            "show_card_uuids": sorted({clean(r.get("show_card_uuid")) for r in rows if clean(r.get("show_card_uuid"))}),
        }
    receipt = {
        "policy": "SEASON_MEDIAN_LIVE_SPEED",
        "same_player_season_repeated_groups": repeated,
        "player_season_targets": len(targets),
        "row_order_invariant": True,
        "cross_time_fallback_policy": "NOT_USED_FOR_MB02_TRAINING; analog display may use nearest season only with explicit temporal_gap_years",
        "non_live_rows_in_primary_target_input": non_live,
    }
    return targets, by_key, receipt


def nearest_show_target(targets: dict[tuple[str, int], dict[str, Any]], mlbam: str, season: int | None) -> dict[str, Any] | None:
    rows = [v for (pid, _), v in targets.items() if pid == clean(mlbam)]
    if not rows:
        return None
    if season is None:
        chosen = max(rows, key=lambda r: (r["season"], r["observation_count"]))
    else:
        chosen = min(rows, key=lambda r: (abs(r["season"] - season), -r["observation_count"], -r["season"]))
    return {**chosen, "temporal_gap_years": None if season is None else chosen["season"] - season}


# ---------- linear algebra / MB-01 ----------

def transpose(a: list[list[float]]) -> list[list[float]]:
    return [list(row) for row in zip(*a)] if a else []


def mat_inf_norm(a: list[list[float]]) -> float:
    return max((sum(abs(v) for v in row) for row in a), default=0.0)


def invert_matrix(a: list[list[float]]) -> list[list[float]] | None:
    n = len(a)
    if n == 0 or any(len(row) != n for row in a):
        return None
    aug = [list(map(float, row)) + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-12:
            return None
        aug[col], aug[pivot] = aug[pivot], aug[col]
        pv = aug[col][col]
        aug[col] = [v / pv for v in aug[col]]
        for r in range(n):
            if r == col:
                continue
            factor = aug[r][col]
            if factor:
                aug[r] = [x - factor * y for x, y in zip(aug[r], aug[col])]
    return [row[n:] for row in aug]


def covariance_inverse(rows: list[dict[str, Any]], names: list[str]) -> tuple[list[list[float]] | None, dict[str, Any]]:
    fields = [f"{name.lower()}_league_season_percentile" for name in names]
    complete = []
    for row in rows:
        vals = [as_float(row.get(f)) for f in fields]
        if all(v is not None for v in vals):
            complete.append([float(v) for v in vals])
    p = len(names)
    if p < 2 or len(complete) < max(10, p + 3):
        return None, {"status": "UNIDENTIFIABLE", "n": len(complete), "p": p, "reason": "insufficient_complete_rows"}
    means = [statistics.mean(col) for col in transpose(complete)]
    cov = [[0.0] * p for _ in range(p)]
    den = max(1, len(complete) - 1)
    for row in complete:
        z = [row[i] - means[i] for i in range(p)]
        for i in range(p):
            for j in range(p):
                cov[i][j] += z[i] * z[j] / den
    diag = [max(cov[i][i], 1e-8) for i in range(p)]
    reg = [[0.0] * p for _ in range(p)]
    for i in range(p):
        for j in range(p):
            if i == j:
                reg[i][j] = (1 - MAHALANOBIS_SHRINKAGE) * cov[i][j] + MAHALANOBIS_SHRINKAGE * diag[i] + MAHALANOBIS_RIDGE
            else:
                reg[i][j] = (1 - MAHALANOBIS_SHRINKAGE) * cov[i][j]
    inv = invert_matrix(reg)
    if inv is None:
        return None, {"status": "UNIDENTIFIABLE", "n": len(complete), "p": p, "reason": "regularized_covariance_not_invertible"}
    cond = mat_inf_norm(reg) * mat_inf_norm(inv)
    return inv, {
        "status": "COVARIANCE_AWARE",
        "n": len(complete),
        "p": p,
        "shrinkage": MAHALANOBIS_SHRINKAGE,
        "ridge": MAHALANOBIS_RIDGE,
        "condition_number_inf": cond,
    }


def mahalanobis(xs: list[float], ys: list[float], inv: list[list[float]]) -> float:
    d = [x - y for x, y in zip(xs, ys)]
    tmp = [sum(inv[i][j] * d[j] for j in range(len(d))) for i in range(len(d))]
    return math.sqrt(max(0.0, sum(d[i] * tmp[i] for i in range(len(d)))))


def common_support(target: dict[str, Any], candidates: list[dict[str, Any]], names: list[str]) -> bool:
    for name in names:
        field = f"{name.lower()}_league_season_percentile"
        x = as_float(target.get(field))
        vals = sorted(float(v) for r in candidates if (v := as_float(r.get(field))) is not None)
        if x is None or len(vals) < 5:
            return False
        lo = vals[max(0, int(0.01 * (len(vals) - 1)))]
        hi = vals[min(len(vals) - 1, int(0.99 * (len(vals) - 1)))]
        if x < lo - 1e-9 or x > hi + 1e-9:
            return False
    return True


def sinkhorn(cost: list[list[float]], epsilon: float = OT_EPSILON, max_iter: int = OT_MAX_ITER, tol: float = OT_TOL) -> tuple[list[list[float]], dict[str, Any]]:
    n, m = len(cost), len(cost[0]) if cost else 0
    if n == 0 or m == 0:
        return [], {"status": "INSUFFICIENT_DATA"}
    a = [1.0 / n] * n
    b = [1.0 / m] * m
    K = [[math.exp(-max(0.0, c) / epsilon) for c in row] for row in cost]
    u = [1.0] * n
    v = [1.0] * m
    converged = False
    iterations = 0
    for it in range(max_iter):
        iterations = it + 1
        for i in range(n):
            denom = sum(K[i][j] * v[j] for j in range(m))
            u[i] = a[i] / max(denom, 1e-300)
        for j in range(m):
            denom = sum(K[i][j] * u[i] for i in range(n))
            v[j] = b[j] / max(denom, 1e-300)
        if it % 10 == 0 or it == max_iter - 1:
            plan = [[u[i] * K[i][j] * v[j] for j in range(m)] for i in range(n)]
            row_err = max(abs(sum(plan[i]) - a[i]) for i in range(n))
            col_err = max(abs(sum(plan[i][j] for i in range(n)) - b[j]) for j in range(m))
            if max(row_err, col_err) < tol:
                converged = True
                break
    plan = [[u[i] * K[i][j] * v[j] for j in range(m)] for i in range(n)]
    row_err = max(abs(sum(plan[i]) - a[i]) for i in range(n))
    col_err = max(abs(sum(plan[i][j] for i in range(n)) - b[j]) for j in range(m))
    total_cost = sum(plan[i][j] * cost[i][j] for i in range(n) for j in range(m))
    return plan, {
        "status": "CONVERGED" if converged else "MAX_ITER_REACHED",
        "epsilon": epsilon,
        "iterations": iterations,
        "row_marginal_max_error": row_err,
        "column_marginal_max_error": col_err,
        "transport_cost": total_cost,
    }


def latest_by_player(rows: list[dict[str, Any]], key_field: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[clean(row.get(key_field))].append(row)
    return [max(items, key=lambda x: int(x.get("season") or 0)) for _, items in sorted(grouped.items()) if items]


def analog_row_template(key: str, player: str, target: dict[str, Any] | None, method: str) -> dict[str, Any]:
    return {
        "target_player_key": key,
        "target_player": player,
        "target_season": target.get("season") if target else None,
        "method": method,
        "matched_player_key": None,
        "matched_player": None,
        "matched_mlbam_id": None,
        "matched_season": None,
        "feature_ids_used": "",
        "feature_count": 0,
        "feature_distance": None,
        "neighbor_rank_target_to_candidate": None,
        "neighbor_rank_candidate_to_target": None,
        "caliper": None,
        "common_support_status": "NO_COMMON_SUPPORT",
        "match_confidence": "MISSING",
        "analog_state": "NO_VALID_ANALOG",
        "exclusion_reason": "target_or_support_missing",
        "the_show_speed": None,
        "the_show_target_policy": "SEASON_MEDIAN_LIVE_SPEED",
        "the_show_temporal_gap_years": None,
        "covariance_status": None,
        "covariance_condition_number": None,
        "transport_weight": None,
        "transport_row_probability": None,
        "transport_cost": None,
        "transport_marginal_error": None,
        "evidence_ids": [],
        "evidence_count": 0,
        "normalization": "within_league_season_percentile",
    }


def set_analog_match(row: dict[str, Any], cand: dict[str, Any], names: list[str], distance: float, show: dict[str, Any] | None, valid: bool, reason: str = "") -> None:
    evidence = [
        f"MLB_SHARED:{clean(cand.get('mlbam_id'))}:{clean(cand.get('season'))}",
        clean(cand.get("source_url_or_endpoint")) + "#" + clean(cand.get("payload_hash")),
    ]
    evidence = sorted({x for x in evidence if x.strip("#")})
    row.update({
        "matched_player_key": f"MLBAM:{clean(cand.get('mlbam_id'))}",
        "matched_player": cand.get("mlb_name"),
        "matched_mlbam_id": clean(cand.get("mlbam_id")),
        "matched_season": base.as_int(cand.get("season")),
        "feature_ids_used": "|".join(names),
        "feature_count": len(names),
        "feature_distance": round(distance, 10),
        "common_support_status": "COMMON_SUPPORT" if valid else "REJECTED_SUPPORT_OR_CALIPER",
        "match_confidence": "MEDIUM_MULTI_FEATURE" if valid else "REJECTED",
        "analog_state": "VALID_MULTI_FEATURE_ANALOG" if valid else "NO_VALID_ANALOG",
        "exclusion_reason": "" if valid else reason,
        "the_show_speed": show.get("target_speed") if show else None,
        "the_show_temporal_gap_years": show.get("temporal_gap_years") if show else None,
        "evidence_ids": evidence,
        "evidence_count": len(evidence),
    })


def build_mb01(current_keys: list[str], current_base: dict[str, dict[str, Any]], npb_rows: list[dict[str, Any]], shared_rows: list[dict[str, Any]], show_targets: dict[tuple[str, int], dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized_npb = base.add_within_league_normalization(npb_rows)
    normalized_mlb = base.add_within_league_normalization([dict(r, league="MLB") for r in shared_rows])
    latest_npb = {}
    for row in normalized_npb:
        key = clean(row.get("stable_player_key"))
        if key in current_keys and (key not in latest_npb or int(row.get("season") or 0) > int(latest_npb[key].get("season") or 0)):
            latest_npb[key] = row
    candidates = [r for r in latest_by_player([r for r in normalized_mlb if (as_float(r.get("plate_appearances")) or 0) >= 50], "mlbam_id") if clean(r.get("mlbam_id"))]

    pair_l2: dict[tuple[str, str], tuple[list[str], float]] = {}
    for key in current_keys:
        t = latest_npb.get(key)
        if not t:
            continue
        for c in candidates:
            names, xs, ys = feature_values(t, c)
            if len(names) >= 2:
                pair_l2[(key, clean(c["mlbam_id"]))] = (names, l2(xs, ys))

    target_rank: dict[tuple[str, str], int] = {}
    reverse_rank: dict[tuple[str, str], int] = {}
    for key in current_keys:
        ranked = sorted([(d, mid) for (k, mid), (_, d) in pair_l2.items() if k == key])
        for rank, (_, mid) in enumerate(ranked, 1):
            target_rank[(key, mid)] = rank
    for c in candidates:
        mid = clean(c["mlbam_id"])
        ranked = sorted([(d, key) for (key, m), (_, d) in pair_l2.items() if m == mid])
        for rank, (_, key) in enumerate(ranked, 1):
            reverse_rank[(key, mid)] = rank

    out: list[dict[str, Any]] = []
    cand_by_mid = {clean(c["mlbam_id"]): c for c in candidates}

    for key in current_keys:
        t = latest_npb.get(key)
        row = analog_row_template(key, current_base[key].get("player", key), t, "NORMALIZED_L2_NEAREST_BASELINE")
        options = sorted([(d, mid, names) for (k, mid), (names, d) in pair_l2.items() if k == key])
        if options:
            d, mid, names = options[0]
            c = cand_by_mid[mid]
            support = common_support(t, candidates, names) if t else False
            show = nearest_show_target(show_targets, mid, base.as_int(c.get("season")))
            set_analog_match(row, c, names, d, show, support, "outside_common_support" if not support else "")
            row["neighbor_rank_target_to_candidate"] = 1
            row["neighbor_rank_candidate_to_target"] = reverse_rank.get((key, mid))
        out.append(row)

    for key in current_keys:
        t = latest_npb.get(key)
        row = analog_row_template(key, current_base[key].get("player", key), t, "MUTUAL_KNN")
        mutual = []
        for (k, mid), (names, d) in pair_l2.items():
            if k != key:
                continue
            tr = target_rank.get((key, mid), 10**9)
            rr = reverse_rank.get((key, mid), 10**9)
            if tr <= KNN_K and rr <= KNN_K:
                mutual.append((tr, rr, d, mid, names))
        if mutual:
            tr, rr, d, mid, names = min(mutual)
            c = cand_by_mid[mid]
            support = common_support(t, candidates, names) if t else False
            show = nearest_show_target(show_targets, mid, base.as_int(c.get("season")))
            set_analog_match(row, c, names, d, show, support, "outside_common_support" if not support else "")
            row["neighbor_rank_target_to_candidate"] = tr
            row["neighbor_rank_candidate_to_target"] = rr
            row["caliper"] = f"mutual_top_{KNN_K}"
        else:
            row["exclusion_reason"] = "no_mutual_knn_relation"
        out.append(row)

    cov_cache: dict[tuple[str, ...], tuple[list[list[float]] | None, dict[str, Any]]] = {}
    all_cov_rows = candidates + [latest_npb[k] for k in current_keys if k in latest_npb]
    for key in current_keys:
        t = latest_npb.get(key)
        row = analog_row_template(key, current_base[key].get("player", key), t, "CALIPERED_MAHALANOBIS")
        options = []
        if t:
            for c in candidates:
                names, xs, ys = feature_values(t, c)
                if len(names) < 2:
                    continue
                nk = tuple(names)
                if nk not in cov_cache:
                    cov_cache[nk] = covariance_inverse(all_cov_rows, names)
                inv, diag = cov_cache[nk]
                if inv is None:
                    continue
                d = mahalanobis(xs, ys, inv)
                cal = 2.5 * math.sqrt(len(names))
                support = common_support(t, candidates, names)
                if support and d <= cal:
                    options.append((d, clean(c["mlbam_id"]), names, cal, diag))
        if options:
            d, mid, names, cal, diag = min(options)
            c = cand_by_mid[mid]
            show = nearest_show_target(show_targets, mid, base.as_int(c.get("season")))
            set_analog_match(row, c, names, d, show, True)
            row.update({
                "caliper": round(cal, 8),
                "covariance_status": diag["status"],
                "covariance_condition_number": diag.get("condition_number_inf"),
                "neighbor_rank_target_to_candidate": target_rank.get((key, mid)),
                "neighbor_rank_candidate_to_target": reverse_rank.get((key, mid)),
            })
        else:
            row["exclusion_reason"] = "no_covariance_identifiable_candidate_within_caliper_and_common_support"
            identifiable = [d for inv, d in cov_cache.values() if inv is not None]
            row["covariance_status"] = "COVARIANCE_AWARE_NO_MATCH" if identifiable else "MEASURED_UNIDENTIFIABLE"
        out.append(row)

    ot_targets = [(k, latest_npb[k]) for k in current_keys if k in latest_npb]
    cost = []
    pair_meta = []
    for key, t in ot_targets:
        row_cost = []
        row_meta = []
        for c in candidates:
            names, xs, ys = feature_values(t, c)
            if len(names) < 2:
                row_cost.append(5.0)
            else:
                miss_penalty = (len(FEATURES) - len(names)) / len(FEATURES) * 0.35
                row_cost.append(l2(xs, ys) + miss_penalty)
            row_meta.append(names)
        cost.append(row_cost)
        pair_meta.append(row_meta)
    plan, ot_diag = sinkhorn(cost) if cost and candidates else ([], {"status": "INSUFFICIENT_DATA"})
    ot_index = {k: i for i, (k, _) in enumerate(ot_targets)}
    m = len(candidates)
    for key in current_keys:
        t = latest_npb.get(key)
        row = analog_row_template(key, current_base[key].get("player", key), t, "OPTIMAL_TRANSPORT_SINKHORN")
        if key in ot_index and plan and m:
            i = ot_index[key]
            j = max(range(m), key=lambda jj: (plan[i][jj], -cost[i][jj], clean(candidates[jj].get("mlbam_id"))))
            c = candidates[j]
            names = pair_meta[i][j]
            d = cost[i][j]
            conditional = plan[i][j] / (1.0 / len(ot_targets))
            support = len(names) >= 2 and common_support(t, candidates, names) and d <= 0.90 and conditional >= (1.0 / m)
            show = nearest_show_target(show_targets, clean(c.get("mlbam_id")), base.as_int(c.get("season")))
            set_analog_match(row, c, names, d, show, support, "transport_low_weight_or_outside_support" if not support else "")
            row.update({
                "transport_weight": plan[i][j],
                "transport_row_probability": conditional,
                "transport_cost": ot_diag.get("transport_cost"),
                "transport_marginal_error": max(ot_diag.get("row_marginal_max_error", 0.0), ot_diag.get("column_marginal_max_error", 0.0)),
                "caliper": "cost<=0.90 and conditional_weight>=uniform_candidate_mass",
                "neighbor_rank_target_to_candidate": target_rank.get((key, clean(c.get("mlbam_id")))),
                "neighbor_rank_candidate_to_target": reverse_rank.get((key, clean(c.get("mlbam_id")))),
            })
        else:
            row["exclusion_reason"] = "transport_insufficient_data"
        out.append(row)

    order_map = {k: int(current_base[k].get("queue_order") or 0) for k in current_keys}
    method_order = {m: i for i, m in enumerate(["NORMALIZED_L2_NEAREST_BASELINE", "MUTUAL_KNN", "CALIPERED_MAHALANOBIS", "OPTIMAL_TRANSPORT_SINKHORN"])}
    out.sort(key=lambda r: (order_map.get(r["target_player_key"], 0), method_order.get(r["method"], 99)))

    valid_by_method = Counter(r["method"] for r in out if r["analog_state"] == "VALID_MULTI_FEATURE_ANALOG")
    match_by_method = defaultdict(dict)
    for r in out:
        match_by_method[r["method"]][r["target_player_key"]] = r.get("matched_mlbam_id")
    equality = 0
    for key in current_keys:
        vals = [match_by_method[m].get(key) for m in method_order if m != "NORMALIZED_L2_NEAREST_BASELINE"]
        if vals and len(set(vals)) == 1 and vals[0] is not None:
            equality += 1
    summary = {
        "schema_version": "sp101_metric_neighborhood_player_summary_semantic_repair_20260819",
        "route_id": "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE",
        "target_denominator": len(current_keys),
        "mlb_candidate_player_denominator": len(candidates),
        "normalization": "within_league_season_percentile",
        "methods": [
            {"method": "NORMALIZED_L2_NEAREST_BASELINE", "algorithm": "pairwise Euclidean/L2 over common normalized features", "role": "honest_baseline"},
            {"method": "MUTUAL_KNN", "algorithm": "bidirectional top-k membership", "k": KNN_K},
            {"method": "CALIPERED_MAHALANOBIS", "algorithm": "regularized covariance-aware quadratic distance", "shrinkage": MAHALANOBIS_SHRINKAGE, "ridge": MAHALANOBIS_RIDGE},
            {"method": "OPTIMAL_TRANSPORT_SINKHORN", "algorithm": "entropic empirical transport coupling with uniform marginals", **ot_diag},
        ],
        "valid_rows_by_method": dict(valid_by_method),
        "all_three_repaired_methods_same_candidate_count": equality,
        "covariance_subset_diagnostics": [d for _, d in cov_cache.values()],
        "transport_diagnostics": ot_diag,
        "common_support": {
            "valid_rows": sum(valid_by_method.values()),
            "no_valid_rows": len(out) - sum(valid_by_method.values()),
            "raw_rate_match_forbidden": True,
        },
        "physical_truth_guard": "Analog similarity is unsigned context; it cannot create a faster/slower edge.",
    }
    return out, summary


# ---------- MB-02 real validation ----------

def fit_shared_model(rows: list[dict[str, Any]], features: list[str], target: str = "the_show_speed") -> dict[str, Any]:
    return base.fit_shared_model(rows, features, target)


def predict_fit(fit: dict[str, Any], row: dict[str, Any]) -> float | None:
    if fit.get("status") != "RIDGE_FIT_SHARED_INDICATORS":
        return None
    try:
        return float(fit["intercept_centered"]) + sum(
            float(fit["coefficients_centered"][f]) * ((float(row[f]) - float(fit["means"][f])) / float(fit["scales"][f]))
            for f in fit["features"]
        )
    except Exception:
        return None


def fold_of(player_cluster: str, k: int = 5) -> int:
    return int(hashlib.sha256(player_cluster.encode("utf-8")).hexdigest()[:12], 16) % k


def clustered_cv(rows: list[dict[str, Any]], features: list[str], k: int = 5, persist_predictions: bool = True) -> dict[str, Any]:
    usable = [r for r in rows if all(as_float(r.get(f)) is not None for f in features) and as_float(r.get("the_show_speed")) is not None]
    groups = sorted({clean(r.get("player_cluster")) for r in usable if clean(r.get("player_cluster"))})
    folds = []
    all_actual: list[float] = []
    all_pred: list[float] = []
    all_predictions: list[dict[str, Any]] = []
    for fold in range(k):
        test_groups = {g for g in groups if fold_of(g, k) == fold}
        train = [r for r in usable if clean(r.get("player_cluster")) not in test_groups]
        test = [r for r in usable if clean(r.get("player_cluster")) in test_groups]
        fit = fit_shared_model(train, features)
        preds = []
        actual = []
        prediction_rows = []
        if fit.get("status") == "RIDGE_FIT_SHARED_INDICATORS":
            for r in test:
                p = predict_fit(fit, r)
                if p is None:
                    continue
                a = float(r["the_show_speed"])
                preds.append(p)
                actual.append(a)
                prediction_rows.append({
                    "mlbam_id": clean(r.get("player_cluster")),
                    "season": int(r.get("forward_season") or r.get("season") or 0),
                    "actual": a,
                    "prediction": p,
                    "error": p - a,
                })
        m = metrics(actual, preds)
        folds.append({
            "fold": fold,
            "train_rows": len(train),
            "test_rows": len(test),
            "train_player_ids": sorted({clean(r.get("player_cluster")) for r in train}),
            "test_player_ids": sorted(test_groups),
            "player_overlap_count": len({clean(r.get("player_cluster")) for r in train} & test_groups),
            "fit_status": fit.get("status"),
            "metrics": m,
            "predictions": prediction_rows if persist_predictions else [],
        })
        all_actual.extend(actual)
        all_pred.extend(preds)
        if persist_predictions:
            all_predictions.extend(prediction_rows)
    return {
        "status": "EXECUTED_PLAYER_CLUSTERED_HOLDOUT" if all_pred else "INSUFFICIENT_DATA",
        "fold_rule": "sha256(MLBAM_ID)%5",
        "fold_count": k,
        "unique_player_groups": len(groups),
        "aggregate_metrics": metrics(all_actual, all_pred),
        "folds": folds,
        "predictions": all_predictions if persist_predictions else [],
        "no_player_crosses_train_test": all(f["player_overlap_count"] == 0 for f in folds),
    }


def forward_cv(rows: list[dict[str, Any]], features: list[str]) -> dict[str, Any]:
    usable = [r for r in rows if all(as_float(r.get(f)) is not None for f in features) and as_float(r.get("the_show_speed")) is not None]
    seasons = sorted({int(r.get("forward_season") or 0) for r in usable if int(r.get("forward_season") or 0) > 0})
    tests = []
    all_a, all_p = [], []
    for season in seasons:
        train = [r for r in usable if int(r.get("forward_season") or 0) < season]
        test = [r for r in usable if int(r.get("forward_season") or 0) == season]
        if len(train) < max(10, len(features) + 2) or len(test) < 2:
            tests.append({"test_season": season, "status": "INSUFFICIENT_DATA", "train_rows": len(train), "test_rows": len(test)})
            continue
        fit = fit_shared_model(train, features)
        actual, pred, rows_out = [], [], []
        if fit.get("status") == "RIDGE_FIT_SHARED_INDICATORS":
            for r in test:
                p = predict_fit(fit, r)
                if p is None:
                    continue
                a = float(r["the_show_speed"])
                actual.append(a); pred.append(p)
                rows_out.append({"mlbam_id": clean(r.get("player_cluster")), "season": season, "actual": a, "prediction": p, "error": p-a})
        m = metrics(actual, pred)
        tests.append({"test_season": season, "status": "EXECUTED" if pred else "INSUFFICIENT_DATA", "train_rows": len(train), "test_rows": len(test), "metrics": m, "predictions": rows_out})
        all_a.extend(actual); all_p.extend(pred)
    executed = [x for x in tests if x.get("status") == "EXECUTED"]
    return {
        "status": "EXECUTED_FORWARD_SEASON_HOLDOUT" if executed else "INSUFFICIENT_DATA",
        "rule": "fit only seasons strictly before each test season",
        "season_receipts": tests,
        "aggregate_metrics": metrics(all_a, all_p),
        "executed_season_count": len(executed),
    }


def edition_effects(panel: list[dict[str, Any]], show_target_receipt: dict[str, Any]) -> dict[str, Any]:
    groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for r in panel:
        speed = as_float(r.get("speed"))
        pid = clean(r.get("mlbam_id"))
        season = base.as_int(r.get("season"))
        if speed is not None and pid and season is not None:
            groups[(pid, season)].append(r)
    repeated = {k: v for k, v in groups.items() if len(v) >= 2}
    edition_resid: dict[str, list[float]] = defaultdict(list)
    within_spans = []
    for _, rows in repeated.items():
        med = statistics.median(float(r["speed"]) for r in rows)
        vals = [float(r["speed"]) for r in rows]
        within_spans.append(max(vals)-min(vals))
        for r in rows:
            edition = clean(r.get("mlb_the_show_edition")) or "UNKNOWN"
            edition_resid[edition].append(float(r["speed"]) - med)
    identifiable = {e: xs for e, xs in edition_resid.items() if len(xs) >= 5}
    return {
        "status": "MEASURED_EDITION_UPDATE_EFFECTS" if len(identifiable) >= 2 else "MEASURED_NOT_IDENTIFIABLE",
        "repeated_player_season_groups": len(repeated),
        "repeated_observation_rows": sum(len(v) for v in repeated.values()),
        "median_within_player_season_speed_span": statistics.median(within_spans) if within_spans else None,
        "edition_residuals": {e: {"n": len(xs), "mean_residual_vs_player_season_median": statistics.mean(xs)} for e, xs in sorted(edition_resid.items())},
        "identifiable_edition_count_n_ge_5": len(identifiable),
        "target_policy": show_target_receipt["policy"],
        "negative_finding": None if len(identifiable) >= 2 else "Too few repeated player-season observations by multiple editions/updates to identify stable edition coefficients.",
    }


def build_mb02(shared: list[dict[str, Any]], panel: list[dict[str, Any]], show_targets: dict[tuple[str, int], dict[str, Any]], target_receipt: dict[str, Any], baseline_dual: dict[str, Any]) -> dict[str, Any]:
    shared_norm = base.add_within_league_normalization([dict(r, league="MLB") for r in shared])
    features = [f + "_league_season_percentile" for f in FEATURES]
    model_rows = []
    unmatched_exact = 0
    for r in shared_norm:
        pid = clean(r.get("mlbam_id"))
        season = base.as_int(r.get("season"))
        target = show_targets.get((pid, season)) if season is not None else None
        if target is None:
            unmatched_exact += 1
            continue
        model_rows.append({**r, "the_show_speed": target["target_speed"], "player_cluster": pid, "forward_season": season, "show_target_observation_count": target["observation_count"]})
    fit = fit_shared_model(model_rows, features)
    grouped = clustered_cv(model_rows, features)
    forward = forward_cv(model_rows, features)
    ablation = []
    base_mae = grouped.get("aggregate_metrics", {}).get("mae")
    for f in features:
        reduced = [g for g in features if g != f]
        cv = clustered_cv(model_rows, reduced, persist_predictions=False)
        mae = cv.get("aggregate_metrics", {}).get("mae")
        ablation.append({
            "removed_feature": f,
            "status": cv.get("status"),
            "heldout_metrics": cv.get("aggregate_metrics"),
            "delta_heldout_mae_vs_full": None if mae is None or base_mae is None else mae - base_mae,
        })
    legacy = baseline_dual.get("legacy_show_speed_from_statcast_sprint_submodel") or baseline_dual.get("the_show_speed_from_mlb_indicators") or {}
    powerpro = baseline_dual.get("powerpro_speed_from_npb_indicators", {})
    return {
        "schema_version": "sp101_dual_game_behavior_models_semantic_repair_20260819",
        "route_id": "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS",
        "the_show_speed_from_mlb_shared_indicators": {
            "formula": "The Show Live Speed season median ~ MLB shared indicators after league-season normalization",
            "target_definition": target_receipt,
            "rows": len(model_rows),
            "shared_rows_without_exact_same_season_show_target": unmatched_exact,
            "features": features,
            "fit_all_rows_descriptive_only": fit,
            "player_clustered_holdout": grouped,
            "forward_season_holdout": forward,
            "edition_update_effects": edition_effects(panel, target_receipt),
            "feature_family_ablation_heldout": ablation,
            "cross_time_fallback_used_for_training": False,
            "source_evidence": "sp101_mlb_shared_indicator_player_seasons.csv.gz + sp101_the_show_live_player_year_panel.jsonl.gz",
        },
        "legacy_show_speed_from_statcast_sprint_submodel": {
            "status": "PRESERVED_SEPARATE_BASELINE_SUBMODEL",
            "baseline_receipt": legacy,
            "not_replaced_by_shared_model": True,
        },
        "powerpro_speed_from_npb_indicators": {
            **powerpro,
            "role": "SEPARATE_HISTORICAL_POWERPRO_BEHAVIOR_LANE",
        },
        "model_separation": {
            "direct_powerpro_to_show_model_fit": False,
            "powerpro_label_in_physical_path": False,
            "the_show_is_direct_physical_measurement": False,
        },
    }


# ---------- MB-07 graph semantics ----------

def build_graph(packets: list[dict[str, Any]], analog_rows: list[dict[str, Any]], transitions: list[dict[str, Any]], show_by_key: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    signed = []
    temporal = []
    similarity = []
    bands = []
    annotations = []

    def add_rank_edges(family: str, vals: list[tuple[str, str, float, list[str]]]) -> None:
        vals = sorted(vals, key=lambda x: (x[2], x[0]))
        for a, b in zip(vals, vals[1:]):
            if b[2] - a[2] < 0.05:
                continue
            signed.append({
                "edge_type": "SIGNED_PAIRWISE_FASTER_SLOWER",
                "faster_player_key": b[0], "faster_player": b[1],
                "slower_player_key": a[0], "slower_player": a[1],
                "source_family": family,
                "signed_margin": b[2]-a[2],
                "evidence_ids": sorted(set(a[3] + b[3])),
                "semantic_basis": "both endpoints possess comparable source-family percentile observations",
            })

    physical_vals, show_vals, pawa_vals = [], [], []
    all_show_speeds = [float(r["speed"]) for rows in show_by_key.values() for r in rows if as_float(r.get("speed")) is not None]
    for p in packets:
        key, name = clean(p.get("stable_player_key")), clean(p.get("player"))
        phys = as_float((p.get("independent_physical_estimate") or {}).get("peak_speed_percentile_context"))
        if phys is not None:
            physical_vals.append((key, name, phys, [f"PHYSICAL:{key}"]))
            bands.append({"relation_type": "POPULATION_BAND", "player_key": key, "source_family": "DIRECT_PHYSICAL", "percentile": phys, "band": band_of(phys)})
        show_rows = show_by_key.get(key, [])
        s = median(r.get("speed") for r in show_rows)
        sp = percentile(all_show_speeds, s)
        if sp is not None:
            show_vals.append((key, name, sp, [f"THE_SHOW:{clean(r.get('show_card_uuid'))}" for r in show_rows[:3] if clean(r.get("show_card_uuid"))]))
            bands.append({"relation_type": "POPULATION_BAND", "player_key": key, "source_family": "THE_SHOW_LIVE", "percentile": sp, "band": band_of(sp)})
        pp = as_float((p.get("historical_powerpro_behavior_expectation_range") or {}).get("percentile_context"))
        if pp is not None:
            pawa_vals.append((key, name, pp, [f"POWERPRO:{key}"]))
            bands.append({"relation_type": "POPULATION_BAND", "player_key": key, "source_family": "POWERPRO_BEHAVIOR", "percentile": pp, "band": band_of(pp)})
    add_rank_edges("DIRECT_PHYSICAL", physical_vals)
    add_rank_edges("THE_SHOW_LIVE", show_vals)
    add_rank_edges("POWERPRO_BEHAVIOR", pawa_vals)

    for r in analog_rows:
        if r.get("analog_state") != "VALID_MULTI_FEATURE_ANALOG" or r.get("method") == "NORMALIZED_L2_NEAREST_BASELINE":
            continue
        similarity.append({
            "link_type": "UNSIGNED_SIMILARITY",
            "target_player_key": r["target_player_key"],
            "analog_player_key": r.get("matched_player_key"),
            "method": r.get("method"),
            "distance": r.get("feature_distance"),
            "evidence_ids": r.get("evidence_ids", []),
            "signed_direction": None,
        })

    for key, rows in sorted(show_by_key.items()):
        by_season = defaultdict(list)
        for r in rows:
            season = base.as_int(r.get("season"))
            if season is not None and as_float(r.get("speed")) is not None:
                by_season[season].append(float(r["speed"]))
        points = sorted((s, statistics.median(v)) for s, v in by_season.items())
        for (s0, v0), (s1, v1) in zip(points, points[1:]):
            if abs(v1-v0) < 1e-9:
                continue
            temporal.append({
                "edge_type": "WITHIN_PLAYER_TEMPORAL_CHANGE",
                "player_key": key,
                "from_season": s0, "to_season": s1,
                "from_speed": v0, "to_speed": v1,
                "direction": "FASTER" if v1 > v0 else "SLOWER",
                "source_family": "THE_SHOW_LIVE",
                "evidence_ids": [f"THE_SHOW_TEMPORAL:{key}:{s0}:{s1}"],
            })

    for r in transitions:
        annotations.append({
            "annotation_type": "LEAGUE_TRANSITION_CONTEXT",
            "player_key": r.get("stable_player_key"),
            "transition_direction": r.get("transition_direction"),
            "from_year": r.get("from_end_year"), "to_year": r.get("to_start_year"),
            "evidence_ids": r.get("evidence_ids", []),
            "signed_speed_relation": False,
        })

    for p in packets:
        context = p.get("contextual_evidence_summary") or {}
        for field in ["powerpro_rating_context_rows", "physical_observation_rows", "technique_context_rows"]:
            rows = context.get(field, []) if isinstance(context, dict) else []
            for r in rows or []:
                left = clean(r.get("faster_player_key") or r.get("faster_player"))
                right = clean(r.get("slower_player_key") or r.get("slower_player"))
                if left and right:
                    signed.append({
                        "edge_type": "SIGNED_PAIRWISE_FASTER_SLOWER",
                        "faster_player_key": left, "slower_player_key": right,
                        "source_family": "COMMUNITY_EXPLICIT_PAIR",
                        "evidence_ids": [clean(r.get("record_id") or r.get("source_record_id") or r.get("url"))],
                        "semantic_basis": "source record explicitly supplies both endpoints",
                    })
                else:
                    annotations.append({
                        "annotation_type": "COMMUNITY_SINGLE_PLAYER_CONTEXT",
                        "player_key": p.get("stable_player_key"),
                        "source_field": field,
                        "evidence_ids": [clean(r.get("record_id") or r.get("source_record_id") or r.get("url"))],
                        "signed_speed_relation": False,
                    })
    return {
        "schema_version": "sp101_pairwise_ordinal_graph_semantic_repair_20260819",
        "route_id": "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH",
        "signed_pairwise_edges": sorted(signed, key=lambda x: (clean(x.get("source_family")), clean(x.get("faster_player_key")), clean(x.get("slower_player_key")))),
        "within_player_temporal_edges": sorted(temporal, key=lambda x: (clean(x.get("player_key")), int(x.get("from_season") or 0))),
        "similarity_links": sorted(similarity, key=lambda x: (clean(x.get("target_player_key")), clean(x.get("method")), clean(x.get("analog_player_key")))),
        "population_band_relations": sorted(bands, key=lambda x: (clean(x.get("player_key")), clean(x.get("source_family")))),
        "context_annotations": sorted(annotations, key=lambda x: (clean(x.get("player_key")), clean(x.get("annotation_type")))),
        "semantic_guards": {
            "analog_similarity_can_create_signed_edge": False,
            "transition_context_can_create_signed_edge_without_speed_before_after": False,
            "single_player_community_can_create_two_player_edge": False,
            "arbitrary_partner_selection_forbidden": True,
        },
    }


# ---------- MB-16 consensus ----------

def lane(name: str, available: bool, role: str, pct: float | None, confidence: str, evidence_ids: list[str], independence_group: str, temporal_relevance: str = "CURRENT_OR_EXPLICIT") -> dict[str, Any]:
    comparable = available and pct is not None
    return {
        "lane": name, "available": bool(available), "role": role,
        "comparable": comparable,
        "comparable_percentile": pct if comparable else None,
        "band": band_of(pct) if comparable else None,
        "confidence": confidence, "temporal_relevance": temporal_relevance,
        "independence_group": independence_group,
        "evidence_ids": sorted({x for x in evidence_ids if clean(x)}),
    }


def consensus(lanes: list[dict[str, Any]], enabled: bool = True) -> dict[str, Any]:
    if not enabled:
        return {"state": "CONSENSUS_ROUTE_REMOVED", "independent_comparable_lane_count": 0, "comparable_lanes": [], "spread": None, "bands": []}
    reps = {}
    for l in lanes:
        if l.get("comparable"):
            reps.setdefault(l["independence_group"], l)
    comps = list(reps.values())
    if len(comps) < CONSENSUS_MIN_INDEPENDENT_COMPARABLE:
        return {
            "state": "INSUFFICIENT_INDEPENDENT_LANES",
            "independent_comparable_lane_count": len(comps),
            "comparable_lanes": [l["lane"] for l in comps],
            "spread": None,
            "bands": [l.get("band") for l in comps],
        }
    vals = [float(l["comparable_percentile"]) for l in comps]
    spread = max(vals)-min(vals)
    state = "MATERIAL_CONFLICT" if spread >= CONFLICT_TOLERANCE else "CONSENSUS_SUPPORTED"
    return {
        "state": state,
        "independent_comparable_lane_count": len(comps),
        "comparable_lanes": [l["lane"] for l in comps],
        "spread": spread,
        "bands": [l.get("band") for l in comps],
        "tolerance": CONFLICT_TOLERANCE,
    }


def build_lane_inventory(packet: dict[str, Any], show_rows: list[dict[str, Any]], all_show: list[float], valid_analogs: list[dict[str, Any]], graph: dict[str, Any]) -> list[dict[str, Any]]:
    key = clean(packet.get("stable_player_key"))
    phys = as_float((packet.get("independent_physical_estimate") or {}).get("peak_speed_percentile_context"))
    show_speed = median(r.get("speed") for r in show_rows)
    show_pct = percentile(all_show, show_speed)
    pp = as_float((packet.get("historical_powerpro_behavior_expectation_range") or {}).get("percentile_context"))
    analog_ids = [e for r in valid_analogs for e in r.get("evidence_ids", [])]
    signed = [e for e in graph.get("signed_pairwise_edges", []) if e.get("faster_player_key") == key or e.get("slower_player_key") == key]
    temporal = [e for e in graph.get("within_player_temporal_edges", []) if e.get("player_key") == key]
    annotations = [e for e in graph.get("context_annotations", []) if e.get("player_key") == key]
    return [
        lane("INDEPENDENT_PHYSICAL", phys is not None, "PHYSICAL", phys, "HIGH" if phys is not None else "MISSING", [f"PHYSICAL:{key}"] if phys is not None else [], "PHYSICAL"),
        lane("THE_SHOW_APPRAISAL", show_pct is not None, "EXTERNAL_GAME_APPRAISAL", show_pct, "MEDIUM" if show_pct is not None else "MISSING", [f"THE_SHOW:{clean(r.get('show_card_uuid'))}" for r in show_rows[:3] if clean(r.get("show_card_uuid"))], "THE_SHOW"),
        lane("POWERPRO_BEHAVIOR", pp is not None, "HISTORICAL_GAME_BEHAVIOR", pp, "MEDIUM" if pp is not None else "MISSING", [f"POWERPRO:{key}"] if pp is not None else [], "POWERPRO", "HISTORICAL_VISIBLE"),
        lane("MB01_ANALOG_CONSTRAINT", bool(valid_analogs), "UNSIGNED_SIMILARITY_CONSTRAINT", None, "MEDIUM" if valid_analogs else "MISSING", analog_ids[:10], "THE_SHOW_DERIVED"),
        lane("VALID_ORDINAL_TEMPORAL_CONTEXT", bool(signed or temporal or annotations), "ORDINAL_TEMPORAL_CONTEXT", None, "LOW_TO_MEDIUM" if (signed or temporal or annotations) else "MISSING", [x for e in (signed+temporal+annotations) for x in e.get("evidence_ids", [])][:10], "CONTEXT"),
    ]


# ---------- MB-18 synthesis / true route removal ----------

def old_route_evidence(packet: dict[str, Any], route_key: str) -> list[str]:
    rec = (packet.get("decision_use_receipt") or {}).get(route_key, {})
    ids = rec.get("evidence_ids", []) if isinstance(rec, dict) else []
    return sorted({clean(x) for x in ids if clean(x)})


def route_evidence_map(packet: dict[str, Any], lanes: list[dict[str, Any]], graph: dict[str, Any], valid_analogs: list[dict[str, Any]]) -> dict[str, list[str]]:
    key = clean(packet.get("stable_player_key"))
    out = {rk: old_route_evidence(packet, rk) for rk in ROUTE_KEYS}
    out["MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE"] = [e for r in valid_analogs for e in r.get("evidence_ids", [])]
    out["MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS"] = next((l["evidence_ids"] for l in lanes if l["lane"] == "THE_SHOW_APPRAISAL"), [])
    out["MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL"] = next((l["evidence_ids"] for l in lanes if l["lane"] == "INDEPENDENT_PHYSICAL"), [])
    out["MB-06_RATING_INERTIA_AND_STALENESS_MODEL"] = next((l["evidence_ids"] for l in lanes if l["lane"] == "POWERPRO_BEHAVIOR"), [])
    out["MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH"] = [f"ORDINAL_GRAPH:{key}"] if any(
        e.get("faster_player_key") == key or e.get("slower_player_key") == key or e.get("player_key") == key
        for fam in ["signed_pairwise_edges", "within_player_temporal_edges", "context_annotations"]
        for e in graph.get(fam, [])
    ) else []
    out["MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"] = [x for l in lanes for x in l["evidence_ids"]]
    out["MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE"] = [f"QA_NEGATIVE_CONTROL:{key}"]
    out["MB-18_DECISION_USE_AND_ABLATION_RECEIPT"] = [f"ABLATION_ENGINE:{key}"]
    return {k: sorted({x for x in v if clean(x)}) for k, v in out.items()}


def apply_route_removal(lanes: list[dict[str, Any]], route_key: str | None) -> list[dict[str, Any]]:
    disabled = {
        "MB-01_COMMON_METRIC_NEIGHBORHOOD_BRIDGE": {"MB01_ANALOG_CONSTRAINT"},
        "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS": {"THE_SHOW_APPRAISAL"},
        "MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL": {"INDEPENDENT_PHYSICAL"},
        "MB-06_RATING_INERTIA_AND_STALENESS_MODEL": {"POWERPRO_BEHAVIOR"},
        "MB-07_PAIRWISE_ORDINAL_EVIDENCE_GRAPH": {"VALID_ORDINAL_TEMPORAL_CONTEXT"},
    }.get(route_key, set())
    return [{**l, "available": False, "comparable": False, "comparable_percentile": None, "band": None} if l["lane"] in disabled else dict(l) for l in lanes]


def confidence_tier(lanes: list[dict[str, Any]], con: dict[str, Any], evidence: dict[str, list[str]], removed_route: str | None) -> str:
    n = con.get("independent_comparable_lane_count", 0)
    if n == 0:
        tier = "VERY_LOW"
    elif n == 1:
        tier = "LOW"
    elif n == 2:
        tier = "MEDIUM"
    else:
        tier = "HIGH"
    mb12 = evidence.get("MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE", [])
    if removed_route == "MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE":
        mb12 = []
    if tier == "LOW" and mb12:
        tier = "MEDIUM"
    if con.get("state") == "MATERIAL_CONFLICT" and tier == "HIGH":
        tier = "MEDIUM"
    return tier


def synthesize(lanes: list[dict[str, Any]], evidence: dict[str, list[str]], removed_route: str | None = None) -> dict[str, Any]:
    active_lanes = apply_route_removal(lanes, removed_route)
    con_enabled = removed_route != "MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"
    con = consensus(active_lanes, enabled=con_enabled)
    tier = confidence_tier(active_lanes, con, evidence, removed_route)
    numeric = [float(l["comparable_percentile"]) for l in active_lanes if l.get("comparable")]
    center = statistics.median(numeric) if numeric else None
    direction = band_of(center)
    mb12_present = bool(evidence.get("MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE")) and removed_route != "MB-12_SCOUTING_GRADE_AND_TIMED_TEST_BRIDGE"
    video_present = bool(evidence.get("MB-14_VIDEO_FRAME_TIMING")) and removed_route != "MB-14_VIDEO_FRAME_TIMING"
    recoverable_missing = []
    if not mb12_present:
        recoverable_missing.append("TIMED_SCOUTING_OR_END_TO_END_CONTEXT")
    if not video_present:
        recoverable_missing.append("VIDEO_FRAME_OR_COMMENT_CONTEXT")
    prelim = con.get("state") == "MATERIAL_CONFLICT" or tier in {"LOW", "VERY_LOW"} or (tier == "MEDIUM" and bool(recoverable_missing))
    return {
        "lane_availability": {l["lane"]: bool(l.get("available")) for l in active_lanes},
        "independent_comparable_lane_count": con.get("independent_comparable_lane_count"),
        "consensus_state": con.get("state"),
        "consensus_spread": con.get("spread"),
        "confidence_tier": tier,
        "band_direction": direction,
        "synthesis_percentile_median": center,
        "recoverable_missing_evidence": recoverable_missing,
        "preliminary_target_eligibility": prelim,
        "removed_route": removed_route,
    }


def changed_fields(full: dict[str, Any], ablated: dict[str, Any]) -> list[str]:
    keys = ["lane_availability", "independent_comparable_lane_count", "consensus_state", "confidence_tier", "band_direction", "synthesis_percentile_median", "recoverable_missing_evidence", "preliminary_target_eligibility"]
    return [k for k in keys if full.get(k) != ablated.get(k)]


def influence_class(full: dict[str, Any], ablated: dict[str, Any], evidence_present: bool, route_key: str) -> tuple[str, str]:
    if not evidence_present and route_key not in {"MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT", "MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE", "MB-18_DECISION_USE_AND_ABLATION_RECEIPT"}:
        return "ROUTE_MISSING_NOT_APPLICABLE", "NONE"
    if full.get("preliminary_target_eligibility") != ablated.get("preliminary_target_eligibility"):
        return "CHANGES_TARGET_ELIGIBILITY", "TARGET_ELIGIBILITY"
    if full.get("consensus_state") != ablated.get("consensus_state"):
        return "CHANGES_CONFLICT_CLASS", "CONFLICT_CLASS"
    if full.get("confidence_tier") != ablated.get("confidence_tier"):
        return "CHANGES_CONFIDENCE_TIER", "CONFIDENCE_TIER"
    if full.get("band_direction") != ablated.get("band_direction") or full.get("synthesis_percentile_median") != ablated.get("synthesis_percentile_median"):
        return "CHANGES_BAND_OR_DIRECTION", "BAND_OR_DIRECTION"
    if evidence_present:
        if changed_fields(full, ablated):
            return "SUPPORTS_SAME_STATE", "SUPPORTING_STATE_ONLY"
        return "NO_EFFECT_DESPITE_EVIDENCE_PRESENT", "NONE"
    return "SUPPORTS_SAME_STATE", "NONE"


def target_from_state(full: dict[str, Any], cells: list[dict[str, Any]], evidence: dict[str, list[str]]) -> tuple[str, list[str], float, str]:
    reasons = []
    conflict = full.get("consensus_state") == "MATERIAL_CONFLICT"
    sensitive = [c for c in cells if c["decision_effect"] not in {"NONE", "SUPPORTING_STATE_ONLY"}]
    tier = full.get("confidence_tier")
    recoverable = bool(full.get("recoverable_missing_evidence"))
    score = 0.0
    if conflict:
        score += 0.50; reasons.append("genuine_multi_lane_material_conflict")
    if tier in {"LOW", "VERY_LOW"}:
        score += 0.25; reasons.append("residual_confidence_low")
    if recoverable:
        score += 0.15; reasons.append("plausibly_recoverable_evidence_family_missing")
    if sensitive:
        score += min(0.20, 0.05 * len(sensitive)); reasons.append(f"route_removal_sensitive_routes={len(sensitive)}")
    score = round(min(1.0, score), 4)
    if conflict:
        state = "TARGETED_MATERIAL_CONFLICT"
    elif tier in {"LOW", "VERY_LOW"} and score >= 0.50:
        state = "TARGETED_LOW_CONFIDENCE"
    elif tier in {"HIGH", "MEDIUM"} and not sensitive and not conflict:
        state = "NOT_TARGETED_SUFFICIENT_CONFIDENCE"
    else:
        state = "NOT_TARGETED_LOW_EXPECTED_INFORMATION_GAIN"
    gain = "HIGH" if score >= 0.60 else ("MEDIUM" if score >= 0.35 else "LOW")
    return state, reasons or ["no_repaired_residual_trigger"], score, gain


# ---------- synthetic semantic canaries ----------

def synthetic_canaries() -> dict[str, Any]:
    t = [0.0, 0.0]
    c0 = [0.1, 0.4]
    c1 = [0.5, 0.05]
    l2_choice = 0 if l2(t, c0) < l2(t, c1) else 1
    inv = [[0.01, 0.0], [0.0, 1.0]]
    mah_choice = 0 if mahalanobis(t, c0, inv) < mahalanobis(t, c1, inv) else 1
    plan, diag = sinkhorn([[0.10, 0.20], [0.11, 10.0]], epsilon=0.05, max_iter=500, tol=1e-10)
    ot_row0 = 0 if plan[0][0] >= plan[0][1] else 1

    def L(name, available, pct, group):
        return lane(name, available, "TEST", pct, "HIGH", [name] if available else [], group)
    agree4 = consensus([L("a",1,.52,"a"),L("b",1,.55,"b"),L("c",1,.54,"c"),L("d",1,.51,"d")])
    one = consensus([L("a",1,.52,"a"),L("b",0,None,"b"),L("c",0,None,"c"),L("d",0,None,"d")])
    agree2 = consensus([L("a",1,.52,"a"),L("b",1,.56,"b")])
    conflict2 = consensus([L("a",1,.15,"a"),L("b",1,.85,"b")])
    unsigned = consensus([L("a",1,.52,"a"), lane("analog", True, "UNSIGNED", None, "MEDIUM", ["x"], "b")])

    lanes = [L("INDEPENDENT_PHYSICAL",1,.20,"PHYSICAL"), L("THE_SHOW_APPRAISAL",1,.80,"THE_SHOW"), L("POWERPRO_BEHAVIOR",1,.22,"POWERPRO"),
             lane("MB01_ANALOG_CONSTRAINT",True,"UNSIGNED",None,"MEDIUM",["analog"],"THE_SHOW_DERIVED"),
             lane("VALID_ORDINAL_TEMPORAL_CONTEXT",False,"CTX",None,"MISSING",[],"CONTEXT")]
    evidence = {rk: [] for rk in ROUTE_KEYS}
    evidence["MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS"]=["show"]
    evidence["MB-03_MULTI_TRAIT_LATENT_MEASUREMENT_MODEL"]=["physical"]
    evidence["MB-06_RATING_INERTIA_AND_STALENESS_MODEL"]=["pawa"]
    evidence["MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT"]=["all"]
    evidence["MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE"]=["negative"]
    evidence["MB-18_DECISION_USE_AND_ABLATION_RECEIPT"]=["ablation"]
    full = synthesize(lanes, evidence)
    abl_show = synthesize(lanes, evidence, "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS")
    abl_negative = synthesize(lanes, evidence, "MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE")
    cls_show = influence_class(full, abl_show, True, "MB-02_DUAL_SHARED_INDICATOR_BEHAVIOR_MODELS")[0]
    cls_neg = influence_class(full, abl_negative, True, "MB-17_NEGATIVE_CONTROL_AND_PLACEBO_SUITE")[0]
    checks = {
        "l2_and_mahalanobis_distinct": l2_choice != mah_choice,
        "ot_uses_global_coupling_not_local_nearest": ot_row0 == 1 and diag.get("status") in {"CONVERGED","MAX_ITER_REACHED"},
        "four_of_four_agree_consensus": agree4["state"] == "CONSENSUS_SUPPORTED" and agree4["independent_comparable_lane_count"] == 4,
        "one_of_four_insufficient": one["state"] == "INSUFFICIENT_INDEPENDENT_LANES" and one["independent_comparable_lane_count"] == 1,
        "two_of_four_agree_consensus": agree2["state"] == "CONSENSUS_SUPPORTED" and agree2["independent_comparable_lane_count"] == 2,
        "two_of_four_conflict": conflict2["state"] == "MATERIAL_CONFLICT",
        "unsigned_analog_does_not_manufacture_consensus": unsigned["state"] == "INSUFFICIENT_INDEPENDENT_LANES",
        "removing_conflicting_route_changes_state": cls_show in {"CHANGES_CONFLICT_CLASS","CHANGES_TARGET_ELIGIBILITY","CHANGES_CONFIDENCE_TIER","CHANGES_BAND_OR_DIRECTION"},
        "evidence_present_negative_control_zero_effect": cls_neg == "NO_EFFECT_DESPITE_EVIDENCE_PRESENT",
    }
    return {"checks": checks, "pass": all(checks.values()), "details": {"l2_choice":l2_choice,"mahalanobis_choice":mah_choice,"ot_row0_choice":ot_row0,"ot_diag":diag,"show_ablation_class":cls_show,"negative_control_class":cls_neg}}


def main() -> None:
    ledger_hash_before = sha256_file(LEDGER_PATH)
    lock = read_json(LOCK_PATH)
    if lock.get("locked") is not True:
        raise RuntimeError("owner-review lock must remain active during SP-101 semantic repair")

    queue, current_by_order, current_by_norm, queue_by_key, curated_by_name, _supp = base.load_foundation()
    appearance, shared, _manifest = base.load_collected()
    panel, baseline_multibridge, _current_show, baseline_dual, events = base.load_baseline()
    if len(current_by_order) != 100:
        raise RuntimeError("current100 is not exact 100")

    show_targets, show_by_key, show_target_receipt = build_show_targets(panel)
    actual_by_key, ids_by_key, years_by_key, actual_names_by_key = base.build_actual_maps(appearance, current_by_norm)
    npb_rows, _ = base.build_npb_features(current_by_norm, actual_names_by_key, curated_by_name)

    current_keys = [f"PROEYE:{clean(current_by_order[o].get('identity',{}).get('production_player_id'))}" for o in sorted(current_by_order)]
    old_packets = baseline_multibridge.get("players", [])
    old_by_key = {clean(p.get("stable_player_key")): p for p in old_packets}
    current_base = {}
    for o in sorted(current_by_order):
        ident = current_by_order[o].get("identity", {})
        key = f"PROEYE:{clean(ident.get('production_player_id'))}"
        p = dict(old_by_key.get(key, {}))
        p.update({"stable_player_key":key,"queue_order":o,"player":ident.get("player"),"team":ident.get("team")})
        current_base[key] = p

    analog_rows, analog_summary = build_mb01(current_keys, current_base, npb_rows, shared, show_targets)
    analog_path = OUT / "sp101_metric_neighborhood_analog_pairs.csv.gz"
    analog_fields = [
        "target_player_key","target_player","target_season","method","matched_player_key","matched_player","matched_mlbam_id","matched_season",
        "feature_ids_used","feature_count","feature_distance","neighbor_rank_target_to_candidate","neighbor_rank_candidate_to_target","caliper",
        "common_support_status","match_confidence","analog_state","exclusion_reason","the_show_speed","the_show_target_policy","the_show_temporal_gap_years",
        "covariance_status","covariance_condition_number","transport_weight","transport_row_probability","transport_cost","transport_marginal_error",
        "evidence_ids","evidence_count","normalization"
    ]
    base.write_gzip_csv(analog_path, analog_rows, analog_fields)
    write_json(OUT / "sp101_metric_neighborhood_player_summary.json", analog_summary)

    dual = build_mb02(shared, panel, show_targets, show_target_receipt, baseline_dual)
    write_json(OUT / "sp101_dual_game_behavior_models.json", dual)

    transitions = []
    tr_path = OUT / "sp101_npb_mlb_transition_segments.csv"
    if tr_path.exists():
        with tr_path.open(encoding="utf-8", newline="") as f:
            transitions = list(csv.DictReader(f))

    packets = [dict(current_base[k]) for k in current_keys]
    graph = build_graph(packets, analog_rows, transitions, show_by_key)
    write_json(OUT / "sp101_pairwise_ordinal_graph.json", graph)

    all_show = [float(r["speed"]) for rows in show_by_key.values() for r in rows if as_float(r.get("speed")) is not None]
    analog_by_key = defaultdict(list)
    for r in analog_rows:
        if r.get("analog_state") == "VALID_MULTI_FEATURE_ANALOG" and r.get("method") != "NORMALIZED_L2_NEAREST_BASELINE":
            analog_by_key[r["target_player_key"]].append(r)

    ablation_cells = []
    utilization_players = []
    residual_players = []
    packet_out = []
    influence_counts = Counter()

    for p in packets:
        key = clean(p.get("stable_player_key"))
        valid_analogs = analog_by_key.get(key, [])
        lanes = build_lane_inventory(p, show_by_key.get(key, []), all_show, valid_analogs, graph)
        evidence = route_evidence_map(p, lanes, graph, valid_analogs)
        full = synthesize(lanes, evidence)
        cells = []
        decision_use = {}
        for route_key in ROUTE_KEYS:
            ablated = synthesize(lanes, evidence, route_key)
            fields = changed_fields(full, ablated)
            cls, effect = influence_class(full, ablated, bool(evidence.get(route_key)), route_key)
            influence_counts[cls] += 1
            cell = {
                "queue_order": p.get("queue_order"), "player": p.get("player"), "stable_player_key": key,
                "route": route_key,
                "evidence_present": bool(evidence.get(route_key)),
                "evidence_count": len(evidence.get(route_key, [])),
                "evidence_ids": evidence.get(route_key, []),
                "full_state": full,
                "ablated_state": ablated,
                "changed_fields": fields,
                "influence_classification": cls,
                "decision_effect": effect,
            }
            cells.append(cell); ablation_cells.append(cell)
            state = "BLOCKED_MISSING_DATA" if cls == "ROUTE_MISSING_NOT_APPLICABLE" else ("CONTRADICTED" if full["consensus_state"]=="MATERIAL_CONFLICT" and route_key=="MB-16_CROSS_SOURCE_CONSENSUS_AND_DISAGREEMENT" else ("USED_DIRECTLY" if effect not in {"NONE","SUPPORTING_STATE_ONLY"} else ("SUPPORTED_NO_CHANGE" if evidence.get(route_key) else "AVAILABLE_NOT_DECISION_EFFECTIVE")))
            decision_use[route_key] = {
                "state": state,
                "evidence_ids": evidence.get(route_key, []),
                "evidence_count": len(evidence.get(route_key, [])),
                "full_state": full,
                "ablated_state": ablated,
                "changed_fields": fields,
                "influence_classification": cls,
                "decision_effect": effect,
            }
        target_state, reasons, info_score, info_gain = target_from_state(full, cells, evidence)
        p["lane_inventory_semantic_repair"] = lanes
        p["route_disagreement"] = {
            "state": full["consensus_state"],
            "genuine_independent_comparable_lane_count": full["independent_comparable_lane_count"],
            "spread": full["consensus_spread"],
            "tolerance": CONFLICT_TOLERANCE,
            "unsigned_analog_not_counted_as_signed_lane": True,
        }
        p["residual_confidence"] = full["confidence_tier"]
        p["sp102_target_selection_state"] = target_state
        p["sp102_target_reasons"] = reasons
        p["decision_use_receipt"] = decision_use
        packet_out.append(p)
        utilization_players.append({"queue_order":p.get("queue_order"),"player":p.get("player"),"stable_player_key":key,"lane_inventory":lanes,"consensus":consensus(lanes),"decision_use":decision_use})
        residual_players.append({
            "queue_order":p.get("queue_order"),"stable_player_key":key,"player":p.get("player"),
            "target_selection_state":target_state,"target_reasons":reasons,
            "pre_rescue_confidence":full["confidence_tier"],
            "expected_information_gain":info_gain,"expected_information_gain_score":info_score,
            "route_sensitive_count":sum(c["decision_effect"] not in {"NONE","SUPPORTING_STATE_ONLY"} for c in cells),
            "route_sensitive_routes":[c["route"] for c in cells if c["decision_effect"] not in {"NONE","SUPPORTING_STATE_ONLY"}],
            "comment_search_allowed_in_SP102":target_state.startswith("TARGETED_"),
            "selection_basis":"post_SP101_semantic_repair_consensus_and_true_route_ablation",
        })

    canaries = synthetic_canaries()
    if not canaries["pass"]:
        raise RuntimeError(f"semantic canaries failed: {canaries}")

    utilization = {
        "schema_version":"sp101_requirements_to_decision_utilization_semantic_repair_20260819",
        "generated_at":DATE,"population":{"intended":100,"emitted":len(utilization_players),"route_count":len(ROUTES)},
        "route_inventory":[{"route_id":rid,"route_name":name} for rid,name in ROUTES],
        "players":utilization_players,
        "influence_class_counts":dict(influence_counts),
        "semantic_guards":{"unsigned_similarity_not_consensus_direction":True,"context_only_not_numeric_disagreement":True},
    }
    write_json(OUT / "sp101_requirements_to_decision_utilization.json", utilization)

    ablation = {
        "schema_version":"sp101_route_ablation_qa_semantic_repair_20260819","generated_at":DATE,
        "route_count":len(ROUTES),"current100_count":100,"cells":len(ablation_cells),
        "ablation_policy":"full synthesis -> remove exactly one route -> recompute same synthesis from scratch",
        "required_influence_classes":["NO_EFFECT_DESPITE_EVIDENCE_PRESENT","SUPPORTS_SAME_STATE","CHANGES_CONFLICT_CLASS","CHANGES_CONFIDENCE_TIER","CHANGES_TARGET_ELIGIBILITY","CHANGES_BAND_OR_DIRECTION","ROUTE_MISSING_NOT_APPLICABLE"],
        "influence_class_counts":dict(influence_counts),
        "ablation_cells":ablation_cells,
        "synthetic_canaries":canaries,
        "all100x18_exact":len(ablation_cells)==100*len(ROUTES),
    }
    write_json(OUT / "sp101_route_ablation_qa.json", ablation)

    upstream = {
        "analog_summary_sha256":sha256_file(OUT / "sp101_metric_neighborhood_player_summary.json"),
        "dual_model_sha256":sha256_file(OUT / "sp101_dual_game_behavior_models.json"),
        "graph_sha256":sha256_file(OUT / "sp101_pairwise_ordinal_graph.json"),
        "ablation_sha256":sha256_file(OUT / "sp101_route_ablation_qa.json"),
    }
    residual = {
        "schema_version":"sp101_residual_low_confidence_target_set_semantic_repair_20260819","generated_at":DATE,
        "status":"FROZEN_AFTER_SEMANTIC_REPAIR_PENDING_INDEPENDENT_QA",
        "scope":"speed_only","selection_contract":"outputs/derived/sp102_target_selection_contract_20260818.json",
        "population":{"intended":100,"emitted":len(residual_players),"unique_queue_orders":len({r["queue_order"] for r in residual_players})},
        "target_state_vocabulary":TARGET_STATES,
        "target_state_counts":dict(Counter(r["target_selection_state"] for r in residual_players)),
        "players":residual_players,"search_status":"SP-102_NOT_RUN","owner_verdict_count":0,
        "upstream_semantic_hashes":upstream,
    }
    write_json(OUT / "sp101_residual_low_confidence_target_set.json", residual)

    multibridge = {
        "schema_version":"sp101_current100_multibridge_evidence_semantic_repair_20260819","generated_at":DATE,
        "status":"SEMANTIC_REPAIR_COMPLETE_PENDING_INDEPENDENT_QA; SP102_NOT_RUN; OWNER_VERDICT_NOT_WRITTEN",
        "population":{"intended":100,"emitted":len(packet_out),"unique_queue_orders":len({p["queue_order"] for p in packet_out})},
        "four_output_architecture":["independent_physical_estimate","the_show_implied_appraisal_range","historical_powerpro_behavior_expectation_range","contextual_evidence_summary"],
        "players":packet_out,
        "route_disagreement_counts":dict(Counter(p["route_disagreement"]["state"] for p in packet_out)),
        "residual_target_state_counts":residual["target_state_counts"],
        "physical_path_guard":{"powerpro_label_used":False,"final_practical_rating_created":False},
    }
    write_json(OUT / "sp101_current100_multibridge_evidence.json", multibridge)

    receipt = {
        "schema_version":"sp101_inference_route_execution_receipt_semantic_repair_20260819","generated_at":DATE,
        "status":"SEMANTIC_REPAIR_COMPLETE_PENDING_INDEPENDENT_QA",
        "scope":"speed_only; SP-102 search not run; SP-078 owner verdict not written; SP-079 and shoulder not run",
        "p0_routes":{
            "MB-01":"EXECUTED_DISTINCT_L2_MUTUAL_KNN_COVARIANCE_MAHALANOBIS_AND_OT",
            "MB-02":"EXECUTED_REAL_CLUSTERED_AND_FORWARD_HOLDOUTS",
            "MB-07":"EXECUTED_TYPED_GRAPH_NO_ARBITRARY_PARTNERS",
            "MB-16":"EXECUTED_INDEPENDENT_COMPARABLE_LANE_CONSENSUS",
            "MB-18":"EXECUTED_100x18_REMOVAL_AND_RECOMPUTE",
        },
        "semantic_canaries":canaries,
        "sp102_target_freeze_hashes":upstream,
        "owner_verdict_count":read_json(LEDGER_PATH).get("owner_verdict_count"),
    }
    write_json(OUT / "sp101_inference_route_execution_receipt.json", receipt)

    semantic_qa_seed = {
        "schema_version":"sp101_semantic_repair_execution_qa_20260819","generated_at":DATE,
        "status":"PASS_REPAIR_EXECUTION_PENDING_INDEPENDENT_AUDIT",
        "show_target_policy":show_target_receipt,
        "mb01":analog_summary,
        "mb02_validation":{
            "grouped":dual["the_show_speed_from_mlb_shared_indicators"]["player_clustered_holdout"]["aggregate_metrics"],
            "forward":dual["the_show_speed_from_mlb_shared_indicators"]["forward_season_holdout"]["aggregate_metrics"],
        },
        "graph_counts":{k:len(graph.get(k,[])) for k in ["signed_pairwise_edges","within_player_temporal_edges","similarity_links","population_band_relations","context_annotations"]},
        "consensus_counts":dict(Counter(p["route_disagreement"]["state"] for p in packet_out)),
        "ablation":{"cells":len(ablation_cells),"influence_class_counts":dict(influence_counts)},
        "target_counts":residual["target_state_counts"],
        "synthetic_canaries":canaries,
    }
    write_json(OUT / "qa_sp101_inference_semantic_repair_execution_20260819.json", semantic_qa_seed)

    if sha256_file(LEDGER_PATH) != ledger_hash_before:
        raise RuntimeError("SP-078 owner ledger mutated")
    if read_json(LEDGER_PATH).get("owner_verdict_count") != 0:
        raise RuntimeError("SP-078 owner verdict count is not zero")
    if len(packet_out) != 100 or len(ablation_cells) != 1800:
        raise RuntimeError("current100 or 100x18 ablation cardinality failed")
    print(json.dumps({
        "status":"PASS_REPAIR_EXECUTION_PENDING_INDEPENDENT_QA",
        "current100":len(packet_out),"ablation_cells":len(ablation_cells),
        "target_counts":residual["target_state_counts"],
        "mb01_valid_by_method":analog_summary["valid_rows_by_method"],
        "grouped_holdout":dual["the_show_speed_from_mlb_shared_indicators"]["player_clustered_holdout"]["aggregate_metrics"],
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
