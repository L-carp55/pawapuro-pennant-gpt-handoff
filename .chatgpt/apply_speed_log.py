from pathlib import Path

p = Path('src/cards/card_schema.mjs')
s = p.read_text()
old = """    running: run ? {
      speed: run.speed, stealing: run.stealing?.rating ?? null, baserunning: run.baserunning?.rating ?? null,
      _speed_z_final: run._z, _speed_z_single_year: run._singleYearZ ?? null,
"""
new = """    running: run ? {
      speed: run.speed,
      speed_display: run.speedDisplay ?? null,
      speed_evidence: run.speedEvidence ?? null,
      stealing: run.stealing?.rating ?? null, baserunning: run.baserunning?.rating ?? null,
      _speed_z_final: run._z, _speed_z_single_year: run._singleYearZ ?? null,
"""
if s.count(old) != 1:
    raise SystemExit(f'card_schema: expected 1 match, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
