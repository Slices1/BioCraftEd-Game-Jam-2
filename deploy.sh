#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
git add -A
git commit -qm "Deploy $(date +%H:%M)" || echo "(nothing new)"
git push -q origin main
echo "https://slices1.github.io/BioCraftEd-Game-Jam-2/ (rebuild ~1 min)"
