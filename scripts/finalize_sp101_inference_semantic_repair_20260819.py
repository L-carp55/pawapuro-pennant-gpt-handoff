#!/usr/bin/env python3
"""Finalize SP-101 only after the independent semantic audit passes."""
from __future__ import annotations
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"outputs"/"derived"
QA=OUT/"qa_sp101_inference_semantics_independent_20260819.json"
REG=ROOT/"docs"/"state"/"speed_task_registry.tsv"

def readj(p): return json.loads(p.read_text(encoding="utf-8"))
def writej(p,x): p.write_text(json.dumps(x,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8")

qa=readj(QA)
if qa.get("status")!="PASS_INFERENCE_SEMANTICS_INDEPENDENT_AUDIT":
    raise RuntimeError("independent semantic audit has not passed")

ledger=readj(OUT/"sp078_owner_verdict_ledger_20260816.json")
if ledger.get("owner_verdict_count")!=0 or ledger.get("records"):
    raise RuntimeError("SP-078 owner ledger must remain empty")

receipt_path=OUT/"sp101_inference_route_execution_receipt.json"
receipt=readj(receipt_path)
receipt["status"]="DONE_VALIDATED"
receipt["independent_semantic_audit"]="outputs/derived/qa_sp101_inference_semantics_independent_20260819.json"
receipt["independent_semantic_audit_status"]=qa["status"]
writej(receipt_path,receipt)

mult_path=OUT/"sp101_current100_multibridge_evidence.json"
mult=readj(mult_path)
mult["status"]="DONE_VALIDATED_AFTER_INDEPENDENT_SEMANTIC_AUDIT; SP102_NOT_RUN; OWNER_VERDICT_NOT_WRITTEN"
mult["independent_semantic_audit_status"]=qa["status"]
writej(mult_path,mult)

res_path=OUT/"sp101_residual_low_confidence_target_set.json"
res=readj(res_path)
res["status"]="FROZEN_VALIDATED_READY_FOR_SP102"
res["independent_semantic_audit"]="outputs/derived/qa_sp101_inference_semantics_independent_20260819.json"
writej(res_path,res)

raw=REG.read_text(encoding="utf-8-sig").strip().splitlines()
head=raw[0].split("\t")
rows=[]
for i,line in enumerate(raw[1:],2):
    c=line.split("\t")
    if len(c)!=len(head): raise RuntimeError(f"registry line {i} malformed")
    rows.append(dict(zip(head,c)))
by={r["task_id"]:r for r in rows}
sp=by["SP-101"]
sp["status"]="DONE_VALIDATED"
sp["next_action_or_blocker"]="EVIDENCE_STATUS=DONE_VALIDATED_WITH_BOUNDED_NEGATIVE_FINDINGS. Inference-semantic repair wave 2 passed independent QA: MB-01 distinct L2/mutual-kNN/covariance-aware Mahalanobis/OT semantics; MB-02 real player-clustered and forward holdouts; MB-07 typed graph with no fabricated pairwise partners; MB-16 independent comparable-lane consensus; MB-18 exact 100x18 removal-and-recompute ablation. The SP-102 residual target set is frozen and hash-bound to repaired upstreams. Owner verdict count remains 0; do not run SP-079 or shoulder."
arts=[x for x in sp.get("artifacts","").replace(",", ";").split(";") if x]
for a in [
    "scripts/sp101_inference_semantic_repair_20260819.py",
    "scripts/qa_sp101_inference_semantics_20260819.py",
    "outputs/derived/qa_sp101_inference_semantics_independent_20260819.json",
    "docs/audits/sp101_inference_semantics_independent_audit_20260819.md",
    "outputs/derived/sp101_semantic_repair_determinism_qa_20260819.json",
]:
    if a not in arts: arts.append(a)
sp["artifacts"]=";".join(arts)
sp102=by.get("SP-102")
if sp102:
    sp102["next_action_or_blocker"]="SP-101 is now DONE_VALIDATED and outputs/derived/sp101_residual_low_confidence_target_set.json is frozen. Next: activate SP-102 and search only the repaired residual target set; preserve narration/quoted-thread/comments/replies/linked-primary layers separately, deduplicate event origins, and keep comment-only influence low-confidence. Do not perform a global all-100 crawl."

out=[head]
for r in rows:
    out.append([str(r.get(h,"")).replace("\t"," ").replace("\n"," ") for h in head])
REG.write_text("\n".join("\t".join(c) for c in out)+"\n",encoding="utf-8")
print(json.dumps({"status":"SP101_DONE_VALIDATED","owner_verdict_count":ledger.get("owner_verdict_count"),"sp102_status":sp102.get("status") if sp102 else None},ensure_ascii=False))
