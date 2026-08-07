from pathlib import Path

repls = {
    'scripts/run_pennant.mjs': [
        ("import { readFile } from 'node:fs/promises';\n", ""),
        ("import { drawLineup } from '../src/engine/lineup.mjs';\n", "import { drawLineup } from '../src/engine/lineup.mjs';\nimport { loadEngineConfig } from '../src/engine/config.mjs';\n"),
        ("const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));\n", "const cfg = await loadEngineConfig(ROOT);\n"),
    ],
    'scripts/run_identity_test.mjs': [
        ("import { readFile } from 'node:fs/promises';\n", ""),
        ("import { playSeason } from '../src/engine/season.mjs';\n", "import { playSeason } from '../src/engine/season.mjs';\nimport { loadEngineConfig } from '../src/engine/config.mjs';\n"),
        ("const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));\n", "const cfg = await loadEngineConfig(ROOT);\n"),
    ],
    'scripts/run_season_test.mjs': [
        ("import { readFile, writeFile } from 'node:fs/promises';\n", "import { writeFile } from 'node:fs/promises';\n"),
        ("import { drawLineup } from '../src/engine/lineup.mjs';\n", "import { drawLineup } from '../src/engine/lineup.mjs';\nimport { loadEngineConfig } from '../src/engine/config.mjs';\n"),
        ("const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'engine.json'), 'utf8'));\n", "const cfg = await loadEngineConfig(ROOT);\n"),
    ],
}

for fn, pairs in repls.items():
    p = Path(fn)
    s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'{fn}: expected exactly 1 match, got {n}: {old!r}')
        s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print('patched', fn)
