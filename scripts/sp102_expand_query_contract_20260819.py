#!/usr/bin/env python3
from __future__ import annotations
import csv,gzip,importlib.util,json,re,sqlite3
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'/'derived'
BASE=ROOT/'scripts'/'sp102_targeted_video_comment_rescue_20260819.py'
spec=importlib.util.spec_from_file_location('sp102base',BASE); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

FOREIGN_ALIASES={
 'ソト':['Neftali Soto','Neftalí Soto'],
 'ファビアン':['Sandro Fabian','Sandro Fabián'],
 'モンテロ':['Elehuris Montero'],
}

def rgz(p):
    out=[]
    with gzip.open(p,'rt',encoding='utf-8') as f:
        for line in f:
            if line.strip():out.append(json.loads(line))
    return out

def team_history(player_key,current_team):
    pid=player_key.split(':',1)[-1]; teams=[]
    dbp=ROOT/'data/pennant.db'
    if dbp.exists():
        try:
            con=sqlite3.connect(dbp)
            rows=con.execute("SELECT DISTINCT team FROM v_batting WHERE player_id=? AND team IS NOT NULL AND team<>'' ORDER BY season",(pid,)).fetchall()
            teams=[str(x[0]) for x in rows if x and x[0]];con.close()
        except Exception:pass
    if current_team and current_team not in teams:teams.append(current_team)
    return list(dict.fromkeys(teams))
def short_team(s):
    for a,b in [('オリックス・バファローズ','オリックス'),('北海道日本ハムファイターズ','日本ハム'),('福岡ソフトバンクホークス','ソフトバンク'),('千葉ロッテマリーンズ','ロッテ'),('東北楽天ゴールデンイーグルス','楽天'),('埼玉西武ライオンズ','西武'),('横浜DeNAベイスターズ','DeNA'),('東京ヤクルトスワローズ','ヤクルト'),('広島東洋カープ','広島'),('読売ジャイアンツ','巨人'),('阪神タイガース','阪神'),('中日ドラゴンズ','中日')]:
        if a in s:return b
    return s

def comparator_map(target_keys):
    g=json.loads((OUT/'sp101_pairwise_ordinal_graph.json').read_text(encoding='utf-8')); out={}
    # Prefer an explicit signed current-current comparison endpoint; one comparator is enough for bounded search.
    current={p['stable_player_key']:p['player'] for p in json.loads((OUT/'sp101_residual_low_confidence_target_set.json').read_text(encoding='utf-8'))['players']}
    for e in g.get('signed_pairwise_edges',[]):
        a=e.get('faster_player_key');b=e.get('slower_player_key')
        if a in target_keys and b in current and a not in out:out[a]=current[b]
        if b in target_keys and a in current and b not in out:out[b]=current[a]
    return out

targets,_=m.target_set(); packets=json.loads((OUT/'sp101_current100_multibridge_evidence.json').read_text(encoding='utf-8'))['players']; pmap={p['stable_player_key']:p for p in packets}
comp=comparator_map({t['stable_player_key'] for t in targets})
search=rgz(OUT/'sp102_video_comment_search_ledger.jsonl.gz'); evidence=rgz(OUT/'sp102_comment_evidence_records.jsonl.gz'); primary=rgz(OUT/'sp102_primary_source_records.jsonl.gz')
existing_vids=defaultdict(set)
for r in search:
    if r.get('ledger_type')=='VIDEO_FETCH' and r.get('video_id'):existing_vids[r['stable_player_key']].add(r['video_id'])

extra_candidates=defaultdict(dict); coverage_receipts=[]
for t in targets:
    key=t['stable_player_key']; name=t['player']; packet=pmap.get(key,{})
    teams=team_history(key,packet.get('team') or t.get('team'))
    current=short_team(teams[-1]) if teams else ''
    former=short_team(teams[-2]) if len(teams)>=2 else ''
    aliases=FOREIGN_ALIASES.get(name,[])
    compact_name=re.sub(r'[\s　]+','',name)
    plan=[
      ('ACCELERATION_FULL_EFFORT',f'"{compact_name}" {current} 一塁到達 内野安打 加速 全力疾走'),
      ('DECLINE_INJURY_PINCHRUN',f'"{name}" {current} 衰え 怪我 代走 足'),
    ]
    if former and former!=current:plan.append(('FORMER_TEAM_CONTEXT',f'"{name}" {former} 走力 足 速い'))
    if t.get('target_selection_state')=='TARGETED_MATERIAL_CONFLICT' and comp.get(key):plan.append(('EXPLICIT_PAIRWISE_COMPARISON',f'"{name}" "{comp[key]}" 足 どっちが速い 比較'))
    for alias in aliases:plan.append(('ROMANIZED_OR_ENGLISH_ALIAS',f'"{alias}" baseball speed running'))
    coverage_receipts.append({'stable_player_key':key,'player':name,'compact_name_variant_searched':True,'current_team_query':current or None,'former_team_query':former or None,'romanized_english_aliases_searched':aliases,'nickname_search_status':'NO_CURATED_NICKNAME_SOURCE; registered/full/compact variants used without inventing nicknames','explicit_comparison_player':comp.get(key),'extra_query_variants':[x[0] for x in plan]})
    for variant,query in plan:
        entries,error,cmd=m.run_search(query); result_rows=[]
        for rank,e in enumerate(entries,1):
            vid=str(e.get('id') or '');title=str(e.get('title') or '')
            if not re.fullmatch(r'[A-Za-z0-9_-]{11}',vid):continue
            rel=m.title_relevance(title,name,variant,rank); rr={'rank':rank,'video_id':vid,'title':title,'url':e.get('url') or f'https://www.youtube.com/watch?v={vid}','channel':e.get('channel') or e.get('uploader'),'relevance_score':rel,'identity_hint':m.candidate_identity(title,name)};result_rows.append(rr)
            old=extra_candidates[key].get(vid);c={'video_id':vid,'title':title,'score':rel,'variants':set([variant]),'best_rank':rank}
            if old:old['score']=max(old['score'],rel);old['variants'].add(variant);old['best_rank']=min(old['best_rank'],rank)
            else:extra_candidates[key][vid]=c
        search.append({'ledger_type':'SEARCH_QUERY','stable_player_key':key,'player':name,'queue_order':t['queue_order'],'query_variant':variant,'query_text':query,'result_count':len(result_rows),'results':result_rows,'acquisition_route':'yt-dlp ytsearch public route','youtube_data_api_key_present':m.API_PRESENT,'youtube_data_api_called':False,'error':error,'attempted_command':cmd,'searched_at':m.now(),'targeted_scope_only':True,'binding_query_expansion':True})

# Fetch at most two genuinely new videos per player from the expansion wave.
for t in targets:
    key=t['stable_player_key'];cs=list(extra_candidates[key].values())
    for c in cs:c['variants']=sorted(c['variants'])
    cs=[c for c in cs if c['video_id'] not in existing_vids[key]];cs.sort(key=lambda c:(-c['score'],c['best_rank'],c['video_id']))
    for c in cs[:2]:
        info,subs,error,cmd=m.fetch_video(c['video_id']); rec={'ledger_type':'VIDEO_FETCH','stable_player_key':key,'player':t['player'],'queue_order':t['queue_order'],'video_id':c['video_id'],'title_from_search':c['title'],'selected_from_variants':c['variants'],'selection_score':c['score'],'status':'FETCHED' if info else 'FETCH_FAILED','error':error,'attempted_command':cmd,'fetched_at':m.now(),'youtube_data_api_key_present':m.API_PRESENT,'youtube_data_api_called':False,'targeted_scope_only':True,'binding_query_expansion':True}
        if info:
            rec.update({'video_title':info.get('title'),'channel':info.get('channel') or info.get('uploader'),'channel_id':info.get('channel_id') or info.get('uploader_id'),'reported_comment_count':info.get('comment_count'),'retrieved_comment_count':len(info.get('comments') or []),'subtitle_files_recovered':len(subs),'description_present':bool(info.get('description')),'on_screen_caption_ocr':'NOT_PERFORMED'})
            ev,pr=m.extract_layer_records(t,info,subs,f"https://www.youtube.com/watch?v={c['video_id']}");evidence.extend(ev);primary.extend(pr)
        search.append(rec)

evidence,dedup=m.dedup_records(evidence)
# Deduplicate primary records without promoting them.
pd={}
for r in primary:pd[(r['stable_player_key'],r['linked_url'])]=r
primary=sorted(pd.values(),key=lambda r:(r['queue_order'],r['linked_url']))
m.write_jsonl_gz(OUT/'sp102_video_comment_search_ledger.jsonl.gz',search);m.write_jsonl_gz(OUT/'sp102_comment_evidence_records.jsonl.gz',evidence);m.write_jsonl_gz(OUT/'sp102_primary_source_records.jsonl.gz',primary);m.write_jsonl_gz(OUT/'sp102_event_dedup_registry.jsonl.gz',dedup)
(OUT/'sp102_query_contract_coverage_20260819.json').write_text(json.dumps({'schema_version':'sp102_query_contract_coverage_20260819','generated_at':'2026-08-19','targeted_count':30,'players':coverage_receipts,'extra_search_query_count':sum(len(x['extra_query_variants']) for x in coverage_receipts),'guard':'no non-target search; nicknames are not invented when no curated alias source exists'},ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'extra_queries':sum(len(x['extra_query_variants']) for x in coverage_receipts),'total_search_rows':sum(r.get('ledger_type')=='SEARCH_QUERY' for r in search),'extra_video_fetches':sum(bool(r.get('binding_query_expansion')) and r.get('ledger_type')=='VIDEO_FETCH' for r in search),'evidence':len(evidence)},ensure_ascii=False))
