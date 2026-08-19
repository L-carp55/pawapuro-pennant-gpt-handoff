#!/usr/bin/env bash
set -euo pipefail

# SP-101 semantic repair wave 2 must be a pure transform of the last accepted
# identity/shared-metric foundation. The repair output filenames are also used
# as two of the historical inputs, so a second in-place run would otherwise
# read its own first-run products. Always restore exactly the frozen foundation
# before calling the semantic repair implementation.
FROZEN_FOUNDATION_COMMIT="ffb397775413a5e8b5ab23ff1bb5b1b221f6137e"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Fail closed if the immutable foundation commit is unavailable.
git cat-file -e "${FROZEN_FOUNDATION_COMMIT}^{commit}"

for rel in \
  outputs/derived/sp101_current100_multibridge_evidence.json \
  outputs/derived/sp101_dual_game_behavior_models.json
do
  git show "${FROZEN_FOUNDATION_COMMIT}:${rel}" > "${rel}"
done

python scripts/sp101_inference_semantic_repair_20260819.py
