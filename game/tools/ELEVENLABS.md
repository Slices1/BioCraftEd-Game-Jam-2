# ElevenLabs API cheat sheet (researched 2026-11-21 from elevenlabs.io/docs)

Base: `https://api.elevenlabs.io`. Auth header: `xi-api-key: $ELEVENLABS_API_KEY`. JSON in, audio bytes out
(HTTP 200 body = the audio file). Errors: 401 key, 422 validation (`detail`), 429 concurrency/rate, 5xx retry.
Regional hosts exist (api.us.elevenlabs.io, api.eu.residency..., etc.); default host is fine.

## Sound effects  `POST /v1/sound-generation?output_format=mp3_44100_128`
```
{"text":"retro coin pickup, bright chime","duration_seconds":0.8,"prompt_influence":0.5,
 "loop":false,"model_id":"eleven_text_to_sound_v3"}
```
- duration_seconds 0.5-30 (docs elsewhere say 0.1); omit = auto. prompt_influence 0-1 (default 0.3).
- `loop:true` = seamless loop (v3 model; good for ambience/engine hums). v2 model deprecated, removed 2027-03-01.
- Cost: 40 credits/second when duration set (a 1 s sfx = 40 credits). Auto-duration cost not listed.
- Tips: describe action+setting; "impact", "whoosh", "ambience", "drone" help. Exact repeat counts unreliable.
- Concurrency: Creator = 6 (Free/Starter 4, Pro 6).
```
curl -s -X POST "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128" \
 -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
 -d '{"text":"8-bit jump boing","duration_seconds":0.6,"prompt_influence":0.5}' -o jump.mp3
```

## Music  `POST /v1/music?output_format=mp3_44100_128`
```
{"prompt":"upbeat chiptune-flavoured electronic loop, 128 bpm, driving bass, no vocals",
 "music_length_ms":60000,"force_instrumental":true,"model_id":"music_v2_5"}
```
- music_length_ms 3000-600000. `force_instrumental:true` guarantees no vocals (only with `prompt`).
- Alternative `composition_plan` (mutually exclusive with prompt): v1 = {positive_global_styles,
  negative_global_styles, sections[{section_name,duration_ms,...}]}; v2/v2.5 = {chunks:[...]}. Section 3-120 s.
- `seed` only with composition_plan. Models: music_v1 (default, DEPRECATED, removed 2027-01-31), music_v2, music_v2_5 (best).
  `auto` output_format => mp3_44100_128 (v1) / mp3_48000_192 (v2). 48k mp3 formats exist (mp3_48000_128).
- No loop parameter: ask for "seamless loop, same intro and outro" in prompt and crossfade in post (eleven.py does).
- Concurrency: Creator = 2 (Free 0 => music needs paid plan). Credit cost per second not in docs I could read.
- Licence: "cleared for nearly all commercial uses incl. gaming" — check elevenlabs.io/music-terms per plan.
- Slow: tens of seconds per request; keep the timeout >= 300 s.

## Text to speech  `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_64`
```
{"text":"Welcome back.","model_id":"eleven_v3",
 "voice_settings":{"stability":0.5,"similarity_boost":0.75,"style":0,"use_speaker_boost":true,"speed":1.0},
 "seed":42,"language_code":"en"}
```
- Models: `eleven_v3` (expressive, audio tags like [whispers] [laughs], 5000 chars, 70+ langs, not low-latency),
  `eleven_flash_v2_5` (~100 ms, 40k chars, half price/char), `eleven_multilingual_v2` (default, 10k chars, stable).
  (`eleven_turbo_*` deprecated = use flash.) v3 stability is discrete-ish (0.0 creative / 0.5 natural / 1.0 robust).
- output_format codec_rate_kbps: mp3_22050_32 ... mp3_44100_128, mp3_44100_192 (Creator+), opus_48000_*, pcm_*, wav_* (44.1k PCM needs Pro).
- previous_text/next_text improve continuity across lines. Voices ids: premade ones e.g. Rachel `21m00Tcm4TlvDq8ikWAM`.
- List voices: `GET /v2/voices?page_size=100&search=narrator` -> {voices:[{voice_id,name,category,labels,preview_url}],has_more,next_page_token}.
  Also `GET /v1/models`.

## Voice design (cheap): `POST /v1/text-to-voice/design`
`{"voice_description":"gruff old pirate, raspy","model_id":"eleven_ttv_v3","auto_generate_text":true}`
-> `previews[{generated_voice_id,audio_base_64,duration_secs}]`; save a pick with `POST /v1/text-to-voice`
(body: voice_name, voice_description, generated_voice_id) to get a reusable voice_id. Not wired into eleven.py.

## Limits (Creator plan)
SFX 6 concurrent, music 2, TTS: not read (assume ~10; script default 3 total is safe). 429 => backoff (script does).

## CLIENT-SAFE "exceptional" ideas (no key in browser)
**ElevenLabs Agents (Conversational AI) in-browser** — `npm i @elevenlabs/client` or ESM via CDN
(`import {Conversation} from 'https://esm.sh/@elevenlabs/client'`; pin a version):
```js
await navigator.mediaDevices.getUserMedia({audio:true});          // from a user gesture
const c = await Conversation.startSession({agentId:'agent_xxx', connectionType:'webrtc',
  clientTools:{ spawnEnemy:({kind})=>{...}, setMood:async({mood})=>{...} },
  onModeChange:m=>{}, onMessage:m=>{} });
c.sendContextualUpdate('player has 2 hp, boss at 30%');          // feed game state, no reply forced
c.sendUserMessage('...'); c.setMicMuted(true); c.endSession(); c.getOutputVolume();
```
- Create agent in dashboard (ElevenAgents). Auth: either allowlist (<=10 exact hostnames, Security tab) with no key
  needed, or signed URL/token via your backend (not available here: no server). So: allowlist-only public agent.
  Gotcha: itch.io/jam hosts serve from odd subdomains (html-classic.itch.zone) — add them or test the real host.
- Client tools: define type=Client in dashboard, names case-sensitive, handler keys must match; "Wait for response" returns value.
- Voice default WebRTC (48 kHz pcm fixed). Needs mic permission + HTTPS; iOS needs user gesture. Cost: agent minutes billed
  to YOUR account for anyone who plays => cap with the dashboard's daily/concurrency limits; keep text-only fallback
  (`textOnly` conversations use websocket).
- Game idea: a talking NPC/announcer/narrator that reacts to live state via sendContextualUpdate and drives the
  game through client tools (voice commands, "negotiate with the boss"). Theme-neutral; ~1-2 h to wire once keyword known.
- Other client-safe option: pre-generate everything at build time (this pipeline) — zero runtime risk. Never ship the key.

## Music: BPM / structure control and clean loops (jam requirement: DnB level)
- Yes: put BPM, key, instrumentation in the prompt ("174 BPM", "F minor") — followed approximately, not sample-exact.
- Structure: use `composition_plan` instead of `prompt` (v1: `sections`, v2/2.5: `chunks`; each 3-120 s) with per-section
  styles, e.g. intro 8 bars / drop / break / drop / outro. At 174 BPM one bar = 1.379 s; 16 bars = 22.07 s (`duration_ms` 22069).
  NOTE: composition_plan and prompt are mutually exclusive; exact plan field names for v2/v2.5 `chunks` were not
  documented on the page I read — check the API reference / use the plan-creation endpoint before relying on it.
- No native loop flag. Clean loop recipe: request a plan whose last section mirrors the first (same drum/bass), then
  eleven.py crossfades tail into head (`loop:true` => ~1.5 s equal-power-ish acrossfade, output shortened by the fade).
  Safest: generate 2 takes, pick the one whose ends match; trim to whole bars (bar = 240/BPM s) if the track starts on beat.
- Prompt (game level, instrumental, 174 BPM): see `audio-manifest.example.json` ids `dnb_level` (liquid) and
  `dnb_neuro` (neurofunk); calm menu track id `menu`.
