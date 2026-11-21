#!/usr/bin/env python3
"""ElevenLabs asset generator (stdlib only). See ELEVENLABS.md.

  python3 tools/eleven.py                      # generate missing assets from assets/audio-manifest.json
  python3 tools/eleven.py --dry-run
  python3 tools/eleven.py --only jump,theme    # regenerate just these ids
  python3 tools/eleven.py --force              # regenerate everything
  python3 tools/eleven.py --list-voices [--search NAME]
  python3 tools/eleven.py --selftest           # test ffmpeg post-processing on a synthetic tone (no API)
Key: env ELEVENLABS_API_KEY or tools/.env (never commit).
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, time, random
import urllib.request, urllib.error, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API = "https://api.elevenlabs.io"
DEF_MANIFEST = os.path.join(ROOT, "assets", "audio-manifest.json")
ASSETS = os.path.join(ROOT, "assets")
KINDS = {"sfx": "sfx", "music": "music", "voice": "voice"}


def load_key():
    k = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("API_KEY")
    if k:
        return k.strip()
    p = os.path.join(HERE, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            m = re.match(r"(?:export\s+)?(ELEVENLABS_API_KEY|API_KEY)\s*=\s*(.*)$", line)
            if m:
                return m.group(2).strip().strip('"\'')
    return None


# ---------- ffmpeg ----------
def pick_codec():
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    except FileNotFoundError:
        sys.exit("ffmpeg not found")
    if "libmp3lame" in out:
        return "mp3", ["-c:a", "libmp3lame"]
    print("WARNING: libmp3lame missing, falling back to AAC .m4a", file=sys.stderr)
    return "m4a", ["-c:a", "aac"]


EXT, CODEC = None, None


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def ff(args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError("ffmpeg failed: " + r.stderr.strip()[-400:])


SIL = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01"


def post(kind, src, dst, loop=False, fade=1.5):
    if kind == "sfx":
        # trim silence both ends (reverse trick), normalise, mono, ~96k
        af = f"{SIL},areverse,{SIL},areverse,loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.95,afade=t=in:d=0.003"
        ff(["-i", src, "-af", af, "-ac", "1", "-ar", "44100"] + CODEC + ["-b:a", "96k", dst])
    elif kind == "voice":
        af = f"{SIL},areverse,{SIL},areverse,loudnorm=I=-18:TP=-1.5:LRA=11"
        ff(["-i", src, "-af", af, "-ac", "1", "-ar", "44100"] + CODEC + ["-b:a", "80k", dst])
    else:  # music
        tail = ["-ac", "2", "-ar", "44100"] + CODEC + ["-b:a", "128k", dst]
        d = duration(src)
        if loop and d > fade * 4:
            F, T = fade, d
            fc = (f"[0:a]asplit=3[h][m][t];[h]atrim=0:{F},asetpts=PTS-STARTPTS[head];"
                  f"[m]atrim={F}:{T-F},asetpts=PTS-STARTPTS[mid];[t]atrim={T-F},asetpts=PTS-STARTPTS[tl];"
                  f"[tl][head]acrossfade=d={F}:c1=qsin:c2=qsin[blend];[mid][blend]concat=n=2:v=0:a=1,"
                  f"loudnorm=I=-16:TP=-1.5:LRA=11[o]")
            ff(["-i", src, "-filter_complex", fc, "-map", "[o]"] + tail)
        else:
            af = f"afade=t=out:st={max(d-1.0,0):.2f}:d=1.0,loudnorm=I=-16:TP=-1.5:LRA=11"
            ff(["-i", src, "-af", af] + tail)


# ---------- HTTP ----------
def request(key, method, path, body=None, retries=5, timeout=300):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    hdr = {"xi-api-key": key, "Accept": "*/*", "User-Agent": "gamejam-audio-tool/1.0"}
    if data:
        hdr["Content-Type"] = "application/json"
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=hdr, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            if (e.code == 429 or e.code >= 500) and attempt < retries:
                wait = float(e.headers.get("Retry-After") or 0) or min(2 ** attempt * 2, 60)
                time.sleep(wait + random.random())
                continue
            raise RuntimeError(f"HTTP {e.code} {path}: {msg!r}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                time.sleep(min(2 ** attempt * 2, 60))
                continue
            raise RuntimeError(f"network error {path}: {e}")


def list_voices(key, search=None, limit=100):
    q = {"page_size": limit}
    if search:
        q["search"] = search
    return json.loads(request(key, "GET", "/v2/voices?" + urllib.parse.urlencode(q))).get("voices", [])


_voice_cache = {}


def resolve_voice(key, v):
    if re.fullmatch(r"[A-Za-z0-9]{20}", v):
        return v
    if v not in _voice_cache:
        vs = list_voices(key, v)
        exact = [x for x in vs if x["name"].lower() == v.lower()] or vs
        if not exact:
            raise RuntimeError(f"voice not found: {v}")
        _voice_cache[v] = exact[0]["voice_id"]
    return _voice_cache[v]


# ---------- jobs ----------
def build_jobs(man, ext):
    jobs = []
    for s in man.get("sfx", []):
        n = max(1, int(s.get("variants", 1)))
        for i in range(1, n + 1):
            name = s["id"] + (f"_{i}" if n > 1 else "")
            jobs.append(dict(kind="sfx", id=s["id"], spec=s, out=f"assets/sfx/{name}.{ext}"))
    for m in man.get("music", []):
        jobs.append(dict(kind="music", id=m["id"], spec=m, out=f"assets/music/{m['id']}.{ext}"))
    for v in man.get("voice", []):
        jobs.append(dict(kind="voice", id=v["id"], spec=v, out=f"assets/voice/{v['id']}.{ext}"))
    return jobs


def request_for(job, key=None):
    s, k = job["spec"], job["kind"]
    if k == "sfx":
        body = {"text": s["prompt"], "prompt_influence": s.get("prompt_influence", 0.5),
                "model_id": s.get("model", "eleven_text_to_sound_v3")}
        if s.get("duration"):
            body["duration_seconds"] = max(0.5, min(30, float(s["duration"])))
        if s.get("loop"):
            body["loop"] = True
        return "/v1/sound-generation?output_format=mp3_44100_128", body
    if k == "music":
        body = {"model_id": s.get("model", "music_v2_5")}
        if "composition_plan" in s:
            body["composition_plan"] = s["composition_plan"]
        else:
            body["prompt"] = s["prompt"]
            body["music_length_ms"] = int(max(3, min(600, s.get("length_s", 60))) * 1000)
            body["force_instrumental"] = s.get("instrumental", True)
        return "/v1/music?output_format=mp3_44100_128", body
    vid = resolve_voice(key, s["voice"]) if key else s["voice"]
    body = {"text": s["text"], "model_id": s.get("model", "eleven_multilingual_v2")}
    if "voice_settings" in s:
        body["voice_settings"] = s["voice_settings"]
    if "seed" in s:
        body["seed"] = s["seed"]
    return f"/v1/text-to-speech/{vid}?output_format=mp3_44100_128", body


def run_job(key, job):
    path, body = request_for(job, key)
    raw = request(key, "POST", path, body)
    out = os.path.join(ROOT, job["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "raw.mp3")
        open(src, "wb").write(raw)
        post(job["kind"], src, out, loop=bool(job["spec"].get("loop")))
    return job


def write_index(jobs):
    idx = {}
    for j in jobs:
        p = os.path.join(ROOT, j["out"])
        if os.path.exists(p):
            idx.setdefault(j["kind"], {}).setdefault(j["id"], []).append(j["out"].replace("assets/", "", 1))
    flat = {}
    for kind, d in idx.items():
        for i, paths in d.items():
            flat[i] = paths[0] if len(paths) == 1 else paths
    out = {"ids": flat, "base": "assets/",
           "kinds": {k: sorted(d.keys()) for k, d in idx.items()}}
    # paths are relative to assets/ ; "base" says so
    json.dump(out, open(os.path.join(ASSETS, "audio-index.json"), "w"), indent=2)
    return out


def table(rows):
    w = max([len(r[0]) for r in rows] + [4])
    print(f"{'file':<{w}}  {'KB':>8}  {'sec':>6}")
    tot = 0
    for f, sz, d in rows:
        tot += sz
        print(f"{f:<{w}}  {sz/1024:8.1f}  {d:6.2f}")
    print(f"TOTAL {len(rows)} files, {tot/1024/1024:.2f} MB")


def selftest():
    td = tempfile.mkdtemp(prefix="eleven-selftest-")
    try:
        src = os.path.join(td, "tone.mp3")
        # 0.4 s silence + 0.5 s decaying 880 Hz tone + 0.4 s silence
        ff(["-f", "lavfi", "-i", "sine=f=880:d=0.5", "-af", "afade=t=out:st=0.2:d=0.3,adelay=400,apad=pad_dur=0.4",
            "-b:a", "128k"] + CODEC + [src])
        print(f"raw tone {duration(src):.2f}s")
        rows = []
        for kind in ("sfx", "voice"):
            d = os.path.join(td, f"{kind}.{EXT}")
            post(kind, src, d)
            rows.append((os.path.basename(d), os.path.getsize(d), duration(d)))
        long = os.path.join(td, "long.mp3")
        ff(["-f", "lavfi", "-i", "sine=f=220:d=12", "-ac", "2", "-b:a", "128k"] + CODEC + [long])
        for loop in (True, False):
            d = os.path.join(td, f"music_{'loop' if loop else 'fade'}.{EXT}")
            post("music", long, d, loop=loop)
            rows.append((os.path.basename(d), os.path.getsize(d), duration(d)))
        table(rows)
    finally:
        shutil.rmtree(td, ignore_errors=True)


def main():
    global EXT, CODEC
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", default=DEF_MANIFEST)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="comma separated ids (regenerates them even if cached)")
    ap.add_argument("--threads", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--list-voices", action="store_true")
    ap.add_argument("--search")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    EXT, CODEC = pick_codec()
    if a.selftest:
        return selftest()
    key = load_key()
    if a.list_voices:
        if not key:
            sys.exit("no ELEVENLABS_API_KEY")
        for v in list_voices(key, a.search):
            lb = v.get("labels") or {}
            print(f"{v['voice_id']}  {v['name']:<24} {v.get('category','')}  {lb.get('gender','')} {lb.get('accent','')} {lb.get('descriptive','')}")
        return
    if not os.path.exists(a.manifest):
        sys.exit(f"manifest not found: {a.manifest} (copy tools/audio-manifest.example.json there)")
    man = json.load(open(a.manifest, encoding="utf-8"))
    jobs = build_jobs(man, EXT)
    only = set(a.only.split(",")) if a.only else None
    todo = []
    for j in jobs:
        if only is not None:
            if j["id"] in only:
                todo.append(j)
        elif a.force or not os.path.exists(os.path.join(ROOT, j["out"])):
            todo.append(j)
    print(f"{len(jobs)} assets in manifest, {len(todo)} to generate (codec .{EXT})")
    if a.dry_run:
        for j in todo:
            path, body = request_for(j)
            if j["kind"] == "voice":
                path = path.replace("<", "")
            print(f"- {j['kind']:5} {j['out']}\n    POST {path}\n    {json.dumps(body)}")
        return
    if todo and not key:
        sys.exit("ELEVENLABS_API_KEY not set (env or tools/.env)")
    rows, fails = [], []
    # music is limited to 2 concurrent on Creator; pool size caps everything
    with ThreadPoolExecutor(max_workers=max(1, a.threads)) as ex:
        futs = {ex.submit(run_job, key, j): j for j in todo}
        for f in as_completed(futs):
            j = futs[f]
            try:
                f.result()
                p = os.path.join(ROOT, j["out"])
                rows.append((j["out"], os.path.getsize(p), duration(p)))
                print("ok  ", j["out"], flush=True)
            except Exception as e:
                fails.append((j["out"], str(e)))
                print("FAIL", j["out"], e, file=sys.stderr, flush=True)
    os.makedirs(ASSETS, exist_ok=True)
    write_index(jobs)
    if rows:
        table(sorted(rows))
    allr = [os.path.join(ROOT, j["out"]) for j in jobs if os.path.exists(os.path.join(ROOT, j["out"]))]
    print(f"audio-index.json written; all audio on disk: {sum(map(os.path.getsize, allr))/1024/1024:.2f} MB in {len(allr)} files")
    if fails:
        sys.exit(1)


if __name__ == "__main__":
    main()
