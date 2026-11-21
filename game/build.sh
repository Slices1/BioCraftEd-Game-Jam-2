#!/usr/bin/env bash
# Package the game for submission: ../dist/game.zip with index.html at the zip root.
# Excludes dev-only files. Fails loudly on absolute URLs or if the zip exceeds 25 MB.
set -euo pipefail
cd "$(dirname "$0")"
GAME_DIR="$(pwd)"
DIST="$(cd .. && pwd)/dist"
OUT="$DIST/game.zip"
LIMIT=$((25 * 1000 * 1000))

[ -f index.html ] || { echo "BUILD FAILED: index.html missing in $GAME_DIR" >&2; exit 1; }

# Rule: relative paths only. Look for root-absolute URLs in shipped text files.
BAD="$(grep -rnIE --include='*.html' --include='*.js' --include='*.css' --include='*.json' \
  --exclude-dir=tools \
  "(src|href)=[\"']/[^/]|url\(\s*[\"']?/[^/]|from\s+[\"']/[^/]|import\(\s*[\"']/[^/]|fetch\(\s*[\"']/[^/]" . || true)"
if [ -n "$BAD" ]; then
  echo "BUILD FAILED: root-absolute paths found (use relative paths, no leading '/'):" >&2
  echo "$BAD" >&2
  exit 1
fi

mkdir -p "$DIST"
rm -f "$OUT"

python3 -I - "$GAME_DIR" "$OUT" <<'PY'
import os, sys, zipfile, fnmatch
root, out = sys.argv[1], sys.argv[2]
EXCL_DIRS = {"tools", ".git", "node_modules", "dist", "raw"}
EXCL_FILES = {"poc.html", "env-test.html", "serve.sh", "build.sh", ".gitignore", "package.json", ".DS_Store", "Thumbs.db"}
EXCL_PATHS = {"assets/audio-manifest.json"}
EXCL_GLOBS = ["*.md", "*.zip", ".env", "*.env", "*~", "*.swp"]
n = 0
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, dirs, files in os.walk(root):
        rel_d = os.path.relpath(d, root)
        dirs[:] = sorted(x for x in dirs if not ((rel_d == "." and x in EXCL_DIRS) or x == "raw") and not x.startswith("."))
        for f in sorted(files):
            rel = os.path.normpath(os.path.join(rel_d, f)).replace(os.sep, "/")
            if f in EXCL_FILES or rel in EXCL_PATHS or any(fnmatch.fnmatch(f, g) for g in EXCL_GLOBS):
                continue
            z.write(os.path.join(d, f), rel)
            n += 1
print(f"zipped {n} files")
PY

SIZE=$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT")
python3 -I -c "import zipfile,sys; n=zipfile.ZipFile(sys.argv[1]).namelist(); assert 'index.html' in n, 'index.html not at zip root'" "$OUT" \
  || { echo "BUILD FAILED: index.html is not at the zip root" >&2; exit 1; }
printf 'Built %s: %d bytes (%.2f MB)\n' "$OUT" "$SIZE" "$(echo "$SIZE / 1000000" | bc -l 2>/dev/null || echo 0)"
if [ "$SIZE" -gt "$LIMIT" ]; then
  echo "BUILD FAILED: $OUT is $SIZE bytes, over the 25 MB limit ($LIMIT bytes)!" >&2
  exit 1
fi
