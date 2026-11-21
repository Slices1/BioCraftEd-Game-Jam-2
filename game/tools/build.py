# Windows-friendly port of build.sh: ../dist/game.zip with index.html at the root, dev files excluded, < 25 MB.
import os, sys, zipfile, fnmatch, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(os.path.dirname(root), "dist")
out = os.path.join(dist, "game.zip")
EXCL_DIRS = {"tools", ".git", "node_modules", "dist", "raw"}
EXCL_FILES = {"poc.html", "env-test.html", "test-logic.html", "test-render.html", "serve.sh", "build.sh", ".gitignore",
              "package.json", ".DS_Store", "Thumbs.db"}
EXCL_PATHS = {"assets/audio-manifest.json"}
EXCL_GLOBS = ["*.md", "*.zip", ".env", "*.env", "*~", "*.swp"]
BAD = re.compile(r"""(src|href)=["']/[^/]|url\(\s*["']?/[^/]|from\s+["']/[^/]|import\(\s*["']/[^/]|fetch\(\s*["']/[^/]""")

os.makedirs(dist, exist_ok=True)
if os.path.exists(out):
    os.remove(out)
n, bad = 0, []
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, dirs, files in os.walk(root):
        rel_d = os.path.relpath(d, root)
        dirs[:] = sorted(x for x in dirs if not ((rel_d == "." and x in EXCL_DIRS) or x == "raw") and not x.startswith("."))
        for f in sorted(files):
            rel = os.path.normpath(os.path.join(rel_d, f)).replace(os.sep, "/")
            if f in EXCL_FILES or rel in EXCL_PATHS or any(fnmatch.fnmatch(f, g) for g in EXCL_GLOBS):
                continue
            p = os.path.join(d, f)
            if f.endswith((".html", ".js", ".css", ".json")) and not rel.startswith("vendor/"):
                if BAD.search(open(p, encoding="utf-8", errors="ignore").read()):
                    bad.append(rel)
            z.write(p, rel)
            n += 1
size = os.path.getsize(out)
assert "index.html" in zipfile.ZipFile(out).namelist(), "index.html not at zip root"
print(f"zipped {n} files -> {out}: {size / 1e6:.2f} MB")
if bad:
    print("WARNING root-absolute paths in:", bad)
if size > 25e6:
    sys.exit("BUILD FAILED: over 25 MB")
