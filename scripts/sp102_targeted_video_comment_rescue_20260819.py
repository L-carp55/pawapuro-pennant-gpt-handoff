#!/usr/bin/env python3
"""SP-102 targeted video/comment rescue for the frozen residual speed set.

Boundaries:
- Reads the frozen post-SP101 residual target set and searches ONLY targets with
  comment_search_allowed_in_SP102=true.
- Audits prior YouTube/Community corpus for an exclusion receipt, but never
  counts reused prior records as fresh SP-102 evidence.
- Uses the public yt-dlp route when no official YouTube Data API key exists;
  the API availability state is recorded, never inferred.
- Preserves comment/reply/subtitle/description/linked-primary layers separately.
- Comment-only claims are capped at LOW_DIRECTIONAL and can never become a
  direct physical/timed anchor or a final player speed rating.
- 50m, home-to-first, baserunning, acceleration, and generic foot-speed axes
  remain separate; there is no 50m -> Sprint Speed conversion.
"""
from __future__ import annotations

import gzip
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.parse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "derived"
TARGET_PATH = OUT / "sp101_residual_low_confidence_target_set.json"
API_PRESENT = bool(os.environ.get("YOUTUBE_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("YT_API_KEY"))
MAX_RESULTS_PER_QUERY = 2
MAX_VIDEOS_PER_PLAYER = 3
MAX_COMMENTS_PER_VIDEO = 80

QUERY_VARIANTS = [
    ("GENERIC_FOOT_SPEED", '"{name}" 足 速い プロ野球'),
    ("RUNNING_COMPARISON", '"{name}" 走力 比較'),
    ("TIMED_RUNNING", '"{name}" 50m 一塁到達'),
    ("REACTION_COMPILATION", '"{name}" なんJ 反応集 足'),
]

SPEED_MARKERS = (
    "足が速", "足速", "脚が速", "脚速", "俊足", "鈍足", "足が遅", "脚が遅", "走力",
    "スピード", "一塁到達", "一塁まで", "ホームから一塁", "50m", "50ｍ", "五十メートル",
    "加速", "初速", "一歩目", "走塁", "ベースランニング", "三塁到達", "二塁到達",
    "90フィート", "90ft", "T90", "秒速", "秒台", "秒で",
)
DIRECTION_FAST = ("足が速", "足速", "脚が速", "脚速", "俊足", "速い", "速すぎ", "爆速", "快足")
DIRECTION_SLOW = ("足が遅", "脚が遅", "鈍足", "遅い", "遅すぎ", "遅く")
REACTION_TERMS = ("なんj", "なんJ", "2ch", "5ch", "反応集", "まとめ", "ネットの反応", "掲示板")
TEAM_OR_BASEBALL_TERMS = ("プロ野球", "NPB", "野球", "オリックス", "中日", "日本ハム", "ロッテ", "広島", "ヤクルト", "楽天", "DeNA", "横浜", "ソフトバンク", "巨人", "阪神", "西武")
OFFICIAL_DOMAINS = (
    "npb.jp", "carp.co.jp", "hanshintigers.jp", "dragons.jp", "giants.jp", "baystars.co.jp",
    "yakult-swallows.co.jp", "buffaloes.co.jp", "softbankhawks.co.jp", "fighters.co.jp",
    "rakuteneagles.jp", "marines.co.jp", "seibulions.jp",
)
URL_RE = re.compile(r"https?://[^\s<>()\]\[\"'、。]+", re.I)
SEC_RE = re.compile(r"(?<!\d)(\d{1,2}(?:\.\d{1,3})?)\s*秒")
VTT_TAG_RE = re.compile(r"<[^>]+>")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def norm(s: Any) -> str:
    return re.sub(r"\s+", "", str(s or "").normalize("NFKC") if hasattr(str(s or ""), "normalize") else str(s or ""))


def nfkc(s: Any) -> str:
    import unicodedata
    return unicodedata.normalize("NFKC", str(s or ""))


def compact(s: Any) -> str:
    return re.sub(r"[\s　]+", "", nfkc(s)).lower()


def stable_hash(*parts: Any, n: int = 20) -> str:
    return hashlib.sha256("\x1f".join(str(x or "") for x in parts).encode("utf-8")).hexdigest()[:n]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def write_jsonl_gz(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as gz:
            for row in rows:
                gz.write((json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8"))


def iter_jsonl(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    try:
        with opener(path, "rt", encoding="utf-8", errors="replace") as f:
            for line_no, line in enumerate(f, 1):
                if not line.strip():
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except (OSError, EOFError):
        return


def target_set() -> tuple[list[dict[str, Any]], set[str]]:
    src = load_json(TARGET_PATH)
    targeted = [p for p in src.get("players", []) if p.get("comment_search_allowed_in_SP102") is True]
    targeted.sort(key=lambda p: int(p.get("queue_order") or 0))
    if len(targeted) != 30:
        raise RuntimeError(f"frozen SP-102 target denominator changed: expected 30, got {len(targeted)}")
    keys = {p["stable_player_key"] for p in targeted}
    if len(keys) != 30:
        raise RuntimeError("frozen SP-102 target keys are not unique")
    return targeted, keys


def player_aliases(player: str) -> list[str]:
    c = compact(player)
    raw = nfkc(player).strip()
    aliases = [raw, c]
    parts = re.split(r"[\s　]+", raw)
    if len(parts) >= 2:
        surname = compact(parts[0])
        if len(surname) >= 2:
            aliases.append(surname)
    return list(dict.fromkeys(a for a in aliases if a))


def contains_full_name(text: str, player: str) -> bool:
    return compact(player) in compact(text)


def contains_speed(text: str) -> bool:
    t = nfkc(text)
    return any(m in t for m in SPEED_MARKERS) or bool(SEC_RE.search(t))


def extract_axis(text: str) -> str:
    t = nfkc(text).lower()
    if "50m" in t or "50ｍ" in t or "五十メートル" in t:
        return "FIELD_50M"
    if any(x in t for x in ("一塁到達", "一塁まで", "ホームから一塁", "h2f", "hp_to_1b")):
        return "HOME_TO_FIRST"
    if any(x in t for x in ("90フィート", "90ft", "t90")):
        return "T90_SHORT_DISTANCE"
    if any(x in t for x in ("加速", "初速", "一歩目", "爆発力")):
        return "ACCELERATION_EXPLOSIVENESS"
    if any(x in t for x in ("走塁", "ベースランニング", "三塁到達", "二塁到達", "タッチアップ")):
        return "BASERUNNING_TECHNIQUE"
    return "GENERIC_FOOT_SPEED"


def direction(text: str) -> str:
    t = nfkc(text)
    fast = any(x in t for x in DIRECTION_FAST)
    slow = any(x in t for x in DIRECTION_SLOW)
    if fast and not slow:
        return "FAST_DIRECTIONAL"
    if slow and not fast:
        return "SLOW_DIRECTIONAL"
    return "UNCLEAR_OR_MIXED"


def seconds(text: str) -> list[float]:
    out=[]
    for m in SEC_RE.finditer(nfkc(text)):
        try:
            v=float(m.group(1))
            if 2.0 <= v <= 20.0:
                out.append(v)
        except ValueError:
            pass
    return out


def sentence_claim(text: str) -> str:
    t = re.sub(r"\s+", " ", html.unescape(nfkc(text))).strip()
    if len(t) <= 260:
        return t
    positions=[t.find(m) for m in SPEED_MARKERS if t.find(m)>=0]
    pos=min(positions) if positions else 0
    return t[max(0,pos-100):min(len(t),pos+160)].strip()


def extract_urls(text: str) -> list[str]:
    return list(dict.fromkeys(URL_RE.findall(str(text or ""))))


def source_text(row: dict[str, Any]) -> str:
    for k in ("text_or_excerpt", "text", "comment_text", "body", "description"):
        if row.get(k):
            return str(row[k])
    return ""


def source_url(row: dict[str, Any]) -> str:
    for k in ("source_url", "url", "video_url"):
        if row.get(k): return str(row[k])
    return ""


def source_video(row: dict[str, Any]) -> str:
    for k in ("source_post_or_video_id", "video_id", "video_id_or_post_id"):
        v=str(row.get(k) or "")
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", v): return v
    u=source_url(row)
    q=urllib.parse.urlparse(u)
    if q.hostname and "youtube" in q.hostname:
        return urllib.parse.parse_qs(q.query).get("v", [""])[0]
    return ""


def prior_corpus_files() -> list[Path]:
    candidates=[]
    for p in OUT.glob("*.jsonl"):
        name=p.name.lower()
        if "youtube" in name or "community_v3" in name:
            candidates.append(p)
    for p in OUT.glob("*.jsonl.gz"):
        name=p.name.lower()
        if "youtube" in name or "community_v3" in name:
            candidates.append(p)
    # Avoid scanning SP-102 outputs on rerun.
    return sorted(p for p in set(candidates) if not p.name.startswith("sp102_"))


def match_target(row: dict[str, Any], text: str, targets: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, str]:
    source_player = str(row.get("player_name") or row.get("player") or row.get("source_player") or "")
    source_id = str(row.get("player_id") or row.get("canonical_player_id") or "")
    for t in targets:
        pid=t["stable_player_key"].split(":",1)[-1]
        if source_id and source_id == pid:
            return t, "CANONICAL_ID"
        if source_player and compact(source_player) == compact(t["player"]):
            return t, "EXPLICIT_SOURCE_PLAYER"
        if contains_full_name(text, t["player"]):
            return t, "EXPLICIT_FULL_NAME_IN_TEXT"
    return None, "NO_EXPLICIT_TARGET"


def evidence_record(target: dict[str, Any], *, origin: str, layer: str, text: str, url: str, video_id: str = "", author: str = "", author_id: str = "", parent_id: str = "", published_at: Any = None, identity_basis: str, source_quality: str, reused: bool, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    ax=extract_axis(text)
    vals=seconds(text)
    comment_only=layer in {"COMMENT","REPLY"}
    usable=identity_basis in {"CANONICAL_ID","EXPLICIT_SOURCE_PLAYER","EXPLICIT_FULL_NAME_IN_TEXT","EXPLICIT_FULL_NAME_IN_LAYER"}
    if ax == "BASERUNNING_TECHNIQUE":
        influence="LOW_CONTEXT_ONLY" if comment_only else "LOW_TO_MEDIUM_CONTEXT"
    else:
        influence="LOW_DIRECTIONAL" if comment_only else "LOW_TO_MEDIUM_CONTEXT"
    rid="SP102-EV-"+stable_hash(target["stable_player_key"],origin,layer,url,author_id or author,text)
    rec={
        "record_id":rid,
        "stable_player_key":target["stable_player_key"],
        "player":target["player"],
        "queue_order":target["queue_order"],
        "target_selection_state":target["target_selection_state"],
        "source_origin":origin,
        "source_layer":layer,
        "source_url":url,
        "video_id":video_id,
        "author":author or None,
        "author_id":author_id or None,
        "parent_id":parent_id or None,
        "published_at":published_at,
        "text":text,
        "claim_excerpt":sentence_claim(text),
        "speed_axis":ax,
        "direction":direction(text),
        "explicit_seconds":vals,
        "identity_basis":identity_basis,
        "usable_directional_context":usable,
        "source_quality":source_quality,
        "comment_only":comment_only,
        "influence_cap":influence,
        "direct_physical_anchor_allowed":False,
        "final_rating_allowed":False,
        "field_50m_converted_to_sprint_speed":False,
        "reused_existing_corpus":reused,
    }
    if extra: rec.update(extra)
    return rec


def collect_prior_reuse(targets: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    seen=set()
    files=prior_corpus_files()
    rows_scanned=0
    matched=0
    domains=Counter()
    for p in files:
        for row in iter_jsonl(p):
            rows_scanned+=1
            text=source_text(row)
            if not text or not contains_speed(text):
                continue
            target,basis=match_target(row,text,targets)
            if not target:
                continue
            url=source_url(row)
            key=(target["stable_player_key"],url,compact(text),str(row.get("author_id") or row.get("author_id_or_name") or row.get("author") or ""))
            if key in seen: continue
            seen.add(key)
            matched+=1
            host=(urllib.parse.urlparse(url).hostname or "").lower() or "(missing)"
            domains[host]+=1
    return [],{
        "files_scanned":[str(p.relative_to(ROOT)) for p in files],
        "rows_scanned":rows_scanned,
        "matched_speed_records":matched,
        "excluded_from_sp102_canonical_evidence":matched,
        "source_domain_counts":dict(sorted(domains.items())),
        "exclusion_reason":"prior corpus is not a fresh targeted YouTube retrieval; source layers and semantic classes are not reused as SP-102 evidence",
    }


def run_search(query: str) -> tuple[list[dict[str, Any]], str | None, str]:
    cmd=["yt-dlp","--ignore-config","--no-update","--no-warnings","--flat-playlist","--dump-single-json",f"ytsearch{MAX_RESULTS_PER_QUERY}:{query}"]
    try:
        cp=subprocess.run(cmd,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=90,check=False)
    except Exception as e:
        return [],repr(e),subprocess.list2cmdline(cmd)
    if cp.returncode!=0:
        return [],f"yt-dlp exit={cp.returncode}; stderr={(cp.stderr or '')[-2000:]}",subprocess.list2cmdline(cmd)
    try:
        j=json.loads(cp.stdout)
        return [x for x in (j.get("entries") or []) if x],None,subprocess.list2cmdline(cmd)
    except Exception as e:
        return [],f"invalid search JSON: {e}; stdout_tail={cp.stdout[-1000:]}",subprocess.list2cmdline(cmd)


def title_relevance(title: str, player: str, variant: str, rank: int) -> float:
    t=nfkc(title)
    score=-rank
    if contains_full_name(t,player): score+=100
    parts=re.split(r"[\s　]+",nfkc(player).strip())
    if parts and len(compact(parts[0]))>=2 and compact(parts[0]) in compact(t): score+=35
    if any(x in t for x in REACTION_TERMS): score+=50
    if any(x in t for x in TEAM_OR_BASEBALL_TERMS): score+=15
    if contains_speed(t): score+=20
    if variant=="REACTION_COMPILATION": score+=10
    return score


def parse_vtt(path: Path) -> str:
    lines=[]
    last=""
    try:
        for raw in path.read_text(encoding="utf-8",errors="replace").splitlines():
            s=raw.strip()
            if not s or s.startswith("WEBVTT") or "-->" in s or re.fullmatch(r"\d+",s): continue
            s=html.unescape(VTT_TAG_RE.sub("",s)).strip()
            if not s or s==last: continue
            lines.append(s); last=s
    except OSError:
        return ""
    return " ".join(lines)


def fetch_video(video_id: str) -> tuple[dict[str, Any] | None, list[tuple[str,str]], str | None, str]:
    url=f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory(prefix="sp102_youtube_") as td:
        template=Path(td)/"%(id)s.%(ext)s"
        cmd=[
            "yt-dlp","--ignore-config","--no-update","--no-warnings","--skip-download",
            "--write-info-json","--write-comments","--write-subs","--write-auto-subs","--sub-langs","ja.*,ja",
            "--sub-format","vtt","--extractor-args",f"youtube:max_comments={MAX_COMMENTS_PER_VIDEO},{MAX_COMMENTS_PER_VIDEO},{MAX_COMMENTS_PER_VIDEO},{MAX_COMMENTS_PER_VIDEO}",
            "--output",str(template),url,
        ]
        try:
            cp=subprocess.run(cmd,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=240,check=False)
        except Exception as e:
            return None,[],repr(e),subprocess.list2cmdline(cmd)
        info_path=Path(td)/f"{video_id}.info.json"
        if not info_path.exists():
            return None,[],f"yt-dlp exit={cp.returncode}; no info JSON; stderr={(cp.stderr or '')[-2000:]}",subprocess.list2cmdline(cmd)
        try:
            info=json.loads(info_path.read_text(encoding="utf-8"))
        except Exception as e:
            return None,[],f"unreadable info JSON: {e}",subprocess.list2cmdline(cmd)
        subs=[]
        for p in sorted(Path(td).glob(f"{video_id}*.vtt")):
            txt=parse_vtt(p)
            if txt:
                layer="MANUAL_SUBTITLE" if ".ja." in p.name and "orig" not in p.name else "AUTO_CAPTION_TRANSCRIPT"
                subs.append((layer,txt))
        err=None if cp.returncode==0 else f"yt-dlp exit={cp.returncode}; stderr={(cp.stderr or '')[-2000:]}"
        return info,subs,err,subprocess.list2cmdline(cmd)


def candidate_identity(title: str, player: str) -> str:
    if contains_full_name(title,player): return "FULL_NAME_IN_TITLE"
    parts=re.split(r"[\s　]+",nfkc(player).strip())
    if parts and len(compact(parts[0]))>=2 and compact(parts[0]) in compact(title) and any(x in title for x in TEAM_OR_BASEBALL_TERMS):
        return "SURNAME_IN_BASEBALL_TITLE_SEARCH_ONLY"
    return "SEARCH_ASSOCIATION_ONLY"


def extract_layer_records(target: dict[str, Any], info: dict[str, Any], subtitles: list[tuple[str,str]], fetch_url: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records=[]; primary=[]
    video_id=str(info.get("id") or "")
    title=str(info.get("title") or "")
    description=str(info.get("description") or "")
    channel=str(info.get("channel") or info.get("uploader") or "")
    channel_id=str(info.get("channel_id") or info.get("uploader_id") or "")
    base_extra={"video_title":title,"channel":channel,"channel_id":channel_id,"video_context_identity":candidate_identity(title,target["player"])}
    if description and contains_speed(description):
        basis="EXPLICIT_FULL_NAME_IN_LAYER" if contains_full_name(description,target["player"]) else "VIDEO_CONTEXT_ONLY"
        records.append(evidence_record(target,origin="FRESH_TARGETED_YOUTUBE",layer="UPLOADER_DESCRIPTION",text=description,url=fetch_url,video_id=video_id,author=channel,author_id=channel_id,published_at=info.get("timestamp") or info.get("upload_date"),identity_basis=basis,source_quality="UPLOADER_DESCRIPTION",reused=False,extra=base_extra))
    for sub_layer,txt in subtitles:
        # Keep only local windows around speed markers to prevent giant transcripts.
        if not contains_speed(txt): continue
        chunks=[]
        for marker in SPEED_MARKERS:
            start=0
            while True:
                pos=txt.find(marker,start)
                if pos<0: break
                chunks.append(txt[max(0,pos-180):min(len(txt),pos+260)])
                start=pos+len(marker)
        if not chunks and SEC_RE.search(txt): chunks=[txt[:800]]
        for idx,ch in enumerate(chunks[:20]):
            basis="EXPLICIT_FULL_NAME_IN_LAYER" if contains_full_name(ch,target["player"]) else "VIDEO_CONTEXT_ONLY"
            records.append(evidence_record(target,origin="FRESH_TARGETED_YOUTUBE",layer=sub_layer,text=ch,url=fetch_url,video_id=video_id,author=channel,author_id=channel_id,published_at=info.get("timestamp") or info.get("upload_date"),identity_basis=basis,source_quality="VIDEO_SUBTITLE_OR_AUTO_CAPTION",reused=False,extra={**base_extra,"transcript_window_index":idx,"subtitle_is_not_on_screen_ocr":True}))
    for c in info.get("comments") or []:
        text=str(c.get("text") or "")
        if not text or not contains_speed(text): continue
        is_reply=bool(c.get("parent") not in (None,"","root"))
        basis="EXPLICIT_FULL_NAME_IN_TEXT" if contains_full_name(text,target["player"]) else "VIDEO_CONTEXT_ONLY"
        records.append(evidence_record(target,origin="FRESH_TARGETED_YOUTUBE",layer="REPLY" if is_reply else "COMMENT",text=text,url=f"https://www.youtube.com/watch?v={video_id}&lc={c.get('id') or ''}",video_id=video_id,author=str(c.get("author") or ""),author_id=str(c.get("author_id") or ""),parent_id=str(c.get("parent") or ""),published_at=c.get("timestamp"),identity_basis=basis,source_quality="PUBLIC_YOUTUBE_USER_COMMENT",reused=False,extra={**base_extra,"like_count":c.get("like_count"),"comment_id":c.get("id"),"context_only_due_to_no_explicit_target":basis=="VIDEO_CONTEXT_ONLY"}))
    link_sources=[("UPLOADER_DESCRIPTION",description)] + [("COMMENT",str(c.get("text") or "")) for c in info.get("comments") or []]
    seen_urls=set()
    for layer,txt in link_sources:
        for u in extract_urls(txt):
            if u in seen_urls: continue
            seen_urls.add(u)
            host=(urllib.parse.urlparse(u).hostname or "").lower()
            official=any(host==d or host.endswith("."+d) for d in OFFICIAL_DOMAINS)
            primary.append({
                "record_id":"SP102-PRIMARY-"+stable_hash(target["stable_player_key"],video_id,u),
                "stable_player_key":target["stable_player_key"],"player":target["player"],"queue_order":target["queue_order"],
                "linked_from_video_id":video_id,"linked_from_layer":layer,"linked_url":u,"domain":host,
                "official_domain_candidate":official,
                "validation_status":"OFFICIAL_DOMAIN_LINKED_NOT_CONTENT_VALIDATED" if official else "LINKED_EXTERNAL_NOT_PRIMARY_VALIDATED",
                "used_as_physical_anchor":False,"primary_source_wins_if_validated":True,
            })
    return records,primary


def canonical_event_key(rec: dict[str, Any]) -> str:
    vals=rec.get("explicit_seconds") or []
    axis=rec.get("speed_axis")
    if vals and axis in {"FIELD_50M","HOME_TO_FIRST","T90_SHORT_DISTANCE"}:
        return "TIME|"+rec["stable_player_key"]+"|"+axis+"|"+"|".join(f"{float(v):.3f}" for v in vals)
    claim=compact(rec.get("claim_excerpt"))
    if rec.get("comment_only"):
        # User opinions are independent unless the exact claim appears to quote another layer.
        author=compact(rec.get("author_id") or rec.get("author"))
        return "COMMENT|"+rec["stable_player_key"]+"|"+axis+"|"+author+"|"+stable_hash(claim,n=16)
    return "CONTENT|"+rec["stable_player_key"]+"|"+axis+"|"+stable_hash(claim,n=16)


def dedup_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    # First collapse exact record/source duplicates across reused corpora and fresh retrieval.
    exact={}
    for r in records:
        k=(r["stable_player_key"],r.get("source_url"),compact(r.get("text")),compact(r.get("author_id") or r.get("author")))
        if k not in exact or (exact[k].get("reused_existing_corpus") and not r.get("reused_existing_corpus")):
            exact[k]=r
    unique=list(exact.values())
    # Detect comment/reply exact quotation of content-layer claim and collapse event origin only.
    content_claims=defaultdict(list)
    for r in unique:
        if not r.get("comment_only"):
            c=compact(r.get("claim_excerpt"))
            if len(c)>=14: content_claims[r["stable_player_key"]].append((c,r["record_id"]))
    groups=defaultdict(list)
    for r in unique:
        event=canonical_event_key(r)
        if r.get("comment_only"):
            c=compact(r.get("claim_excerpt"))
            for cc,rid in content_claims.get(r["stable_player_key"],[]):
                if len(c)>=14 and (c in cc or cc in c):
                    event="QUOTED_CONTENT|"+r["stable_player_key"]+"|"+rid
                    r["quoted_existing_content_record_id"]=rid
                    r["comment_artifact_class_promotion_forbidden"]=True
                    break
        r["event_origin_key"]=event
        groups[event].append(r)
    registry=[]
    for event,members in sorted(groups.items()):
        primary_members=[m for m in members if not m.get("comment_only")]
        chosen=(primary_members or members)[0]
        registry.append({
            "event_origin_key":event,
            "stable_player_key":chosen["stable_player_key"],"player":chosen["player"],"speed_axis":chosen["speed_axis"],
            "member_record_ids":[m["record_id"] for m in members],"member_count":len(members),
            "source_layers":sorted({m["source_layer"] for m in members}),
            "chosen_context_record_id":chosen["record_id"],
            "duplicate_comment_quote_collapsed":any(m.get("quoted_existing_content_record_id") for m in members),
            "reaction_volume_not_summed_into_evidence":True,
        })
    unique.sort(key=lambda r:(int(r.get("queue_order") or 0),r.get("video_id") or "",r.get("source_layer") or "",r["record_id"]))
    return unique,registry


def main() -> None:
    targets,target_keys=target_set()
    collection_started=now()
    search_ledger=[]
    prior_records,prior_receipt=collect_prior_reuse(targets)
    evidence=list(prior_records)
    primary_records=[]
    per_target_candidates=defaultdict(dict)

    for target in targets:
        for variant,template in QUERY_VARIANTS:
            query=template.format(name=target["player"])
            entries,error,cmd=run_search(query)
            result_rows=[]
            for rank,e in enumerate(entries,1):
                vid=str(e.get("id") or "")
                title=str(e.get("title") or "")
                if not re.fullmatch(r"[A-Za-z0-9_-]{11}",vid): continue
                rel=title_relevance(title,target["player"],variant,rank)
                result_rows.append({"rank":rank,"video_id":vid,"title":title,"url":e.get("url") or f"https://www.youtube.com/watch?v={vid}","channel":e.get("channel") or e.get("uploader"),"relevance_score":rel,"identity_hint":candidate_identity(title,target["player"])})
                old=per_target_candidates[target["stable_player_key"]].get(vid)
                candidate={"video_id":vid,"title":title,"score":rel,"variants":set([variant]),"best_rank":rank}
                if old:
                    old["score"]=max(old["score"],rel); old["variants"].add(variant); old["best_rank"]=min(old["best_rank"],rank)
                else:
                    per_target_candidates[target["stable_player_key"]][vid]=candidate
            search_ledger.append({
                "ledger_type":"SEARCH_QUERY","stable_player_key":target["stable_player_key"],"player":target["player"],"queue_order":target["queue_order"],
                "query_variant":variant,"query_text":query,"result_count":len(result_rows),"results":result_rows,
                "acquisition_route":"yt-dlp ytsearch public route","youtube_data_api_key_present":API_PRESENT,"youtube_data_api_called":False,
                "error":error,"attempted_command":cmd,"searched_at":now(),"targeted_scope_only":True,
            })

    # Fetch at most three videos per player after all four search variants have competed.
    for target in targets:
        cand=list(per_target_candidates[target["stable_player_key"]].values())
        for c in cand: c["variants"]=sorted(c["variants"])
        cand.sort(key=lambda c:(-c["score"],c["best_rank"],c["video_id"]))
        selected=cand[:MAX_VIDEOS_PER_PLAYER]
        if not selected:
            search_ledger.append({"ledger_type":"VIDEO_FETCH","stable_player_key":target["stable_player_key"],"player":target["player"],"queue_order":target["queue_order"],"video_id":None,"status":"NO_SEARCH_RESULT_SELECTED","error":None,"targeted_scope_only":True})
        for c in selected:
            info,subs,error,cmd=fetch_video(c["video_id"])
            rec={
                "ledger_type":"VIDEO_FETCH","stable_player_key":target["stable_player_key"],"player":target["player"],"queue_order":target["queue_order"],
                "video_id":c["video_id"],"title_from_search":c["title"],"selected_from_variants":c["variants"],"selection_score":c["score"],
                "status":"FETCHED" if info else "FETCH_FAILED","error":error,"attempted_command":cmd,"fetched_at":now(),
                "youtube_data_api_key_present":API_PRESENT,"youtube_data_api_called":False,"targeted_scope_only":True,
            }
            if info:
                rec.update({"video_title":info.get("title"),"channel":info.get("channel") or info.get("uploader"),"channel_id":info.get("channel_id") or info.get("uploader_id"),"reported_comment_count":info.get("comment_count"),"retrieved_comment_count":len(info.get("comments") or []),"subtitle_files_recovered":len(subs),"description_present":bool(info.get("description")),"on_screen_caption_ocr":"NOT_PERFORMED"})
                ev,pr=extract_layer_records(target,info,subs,f"https://www.youtube.com/watch?v={c['video_id']}")
                evidence.extend(ev); primary_records.extend(pr)
            search_ledger.append(rec)

    evidence,dedup_registry=dedup_records(evidence)
    # Remove primary link duplicates.
    primary_by={}
    for r in primary_records:
        primary_by[(r["stable_player_key"],r["linked_url"])]=r
    primary_records=sorted(primary_by.values(),key=lambda r:(r["queue_order"],r["linked_url"]))

    by_target=defaultdict(list)
    for r in evidence: by_target[r["stable_player_key"]].append(r)
    ev_by_target=defaultdict(list)
    for r in dedup_registry: ev_by_target[r["stable_player_key"]].append(r)
    prim_by_target=defaultdict(list)
    for r in primary_records: prim_by_target[r["stable_player_key"]].append(r)
    search_by_target=defaultdict(list)
    for r in search_ledger: search_by_target[r["stable_player_key"]].append(r)

    summaries=[]; linkage=[]
    for t in targets:
        rows=by_target[t["stable_player_key"]]
        usable=[r for r in rows if r.get("usable_directional_context")]
        timed=[r for r in usable if r.get("explicit_seconds") and r.get("speed_axis") in {"FIELD_50M","HOME_TO_FIRST","T90_SHORT_DISTANCE"}]
        official_links=[r for r in prim_by_target[t["stable_player_key"]] if r.get("official_domain_candidate")]
        searches=[r for r in search_by_target[t["stable_player_key"]] if r["ledger_type"]=="SEARCH_QUERY"]
        fetches=[r for r in search_by_target[t["stable_player_key"]] if r["ledger_type"]=="VIDEO_FETCH"]
        successful=sum(r.get("status")=="FETCHED" for r in fetches)
        failed=sum(r.get("status")=="FETCH_FAILED" for r in fetches)
        if timed:
            post="TIMED_CONTEXT_ADDED_NOT_DIRECT_PHYSICAL_ANCHOR"
        elif usable:
            post="DIRECTIONAL_CONTEXT_ADDED_LOW_INFLUENCE"
        else:
            post="MEASURED_NO_USABLE_NEW_SPEED_CONTEXT"
        summaries.append({
            "queue_order":t["queue_order"],"stable_player_key":t["stable_player_key"],"player":t["player"],
            "pre_rescue_confidence":t["pre_rescue_confidence"],"target_selection_state":t["target_selection_state"],"target_reasons":t["target_reasons"],
            "query_variant_attempts":len(searches),"query_errors":sum(bool(r.get("error")) for r in searches),
            "selected_video_fetches":len(fetches),"successful_video_fetches":successful,"failed_video_fetches":failed,
            "evidence_records":len(rows),"usable_low_influence_records":len(usable),"timed_context_records":len(timed),
            "distinct_event_origins":len(ev_by_target[t["stable_player_key"]]),"linked_primary_candidates":len(prim_by_target[t["stable_player_key"]]),"official_domain_link_candidates":len(official_links),
            "post_rescue_context_status":post,"final_speed_rating_created":False,"owner_verdict_created":False,
            "acquisition_limit":"YOUTUBE_DATA_API_KEY_NOT_AVAILABLE; public yt-dlp bounded route used" if not API_PRESENT else "YOUTUBE_DATA_API_KEY_PRESENT_BUT_PUBLIC_YTDLP_ROUTE_USED",
        })
        linkage.append({
            "queue_order":t["queue_order"],"stable_player_key":t["stable_player_key"],"player":t["player"],
            "sp101_target_state":t["target_selection_state"],"sp101_target_reasons":t["target_reasons"],
            "sp102_post_rescue_context_status":post,"evidence_record_ids":[r["record_id"] for r in usable],
            "event_origin_keys":[r["event_origin_key"] for r in ev_by_target[t["stable_player_key"]]],
            "conflict_resolved_to_final_rating":False,
            "resolution_note":"SP-102 may add low-influence directional/timed context only. Final practical rating remains blocked in SP-079 and owner verdict remains untouched.",
        })

    aggregate={
        "schema_version":"sp102_target_post_rescue_summary_20260819","generated_at":"2026-08-19",
        "collection_started_at":collection_started,"collection_finished_at":now(),"scope":"speed_only_targeted_rescue",
        "targeted_count":len(targets),"non_targeted_count":70,"query_variants_per_player":len(QUERY_VARIANTS),
        "search_query_attempts":sum(r["ledger_type"]=="SEARCH_QUERY" for r in search_ledger),
        "video_fetch_attempts":sum(r["ledger_type"]=="VIDEO_FETCH" and r.get("video_id") for r in search_ledger),
        "youtube_data_api_key_present":API_PRESENT,"youtube_data_api_called":False,
        "public_route":"yt-dlp public YouTube search/comment/subtitle route",
        "prior_corpus_reuse":prior_receipt,"evidence_record_count":len(evidence),"event_origin_count":len(dedup_registry),"linked_primary_record_count":len(primary_records),
        "players":summaries,"status_counts":dict(Counter(x["post_rescue_context_status"] for x in summaries)),
        "guards":{"global_all100_crawl_performed":False,"non_target_players_searched":0,"field_50m_to_sprint_speed_conversion":False,"comment_only_direct_anchor":False,"final_player_rating_created":False,"owner_verdict_written":False,"prior_corpus_evidence_excluded":True},
    }

    write_jsonl_gz(OUT/"sp102_video_comment_search_ledger.jsonl.gz",search_ledger)
    write_jsonl_gz(OUT/"sp102_comment_evidence_records.jsonl.gz",evidence)
    write_jsonl_gz(OUT/"sp102_primary_source_records.jsonl.gz",primary_records)
    write_jsonl_gz(OUT/"sp102_event_dedup_registry.jsonl.gz",dedup_registry)
    write_json(OUT/"sp102_target_post_rescue_summary.json",aggregate)
    write_json(OUT/"sp102_sp101_resolution_linkage.json",{"schema_version":"sp102_sp101_resolution_linkage_20260819","generated_at":"2026-08-19","players":linkage,"guards":{"sp101_frozen_target_only":True,"final_rating_created":False,"owner_verdict_written":False}})
    print(json.dumps({"targeted":len(targets),"queries":aggregate["search_query_attempts"],"video_fetches":aggregate["video_fetch_attempts"],"evidence":len(evidence),"events":len(dedup_registry),"api_key":API_PRESENT,"status_counts":aggregate["status_counts"]},ensure_ascii=False))


if __name__ == "__main__":
    main()
