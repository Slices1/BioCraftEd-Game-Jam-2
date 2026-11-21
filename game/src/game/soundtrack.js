// CORVID soundtrack: menu / factory / dnb (finale) with crossfades. Falls back to procedural moods.
import { startMusic, stopMusic, moods } from '../audio/music.js';

let audio = null, want = null, loadDone = false, procOn = null;
const FALLBACK = { menu: 'chill', factory: 'tense', dnb: 'dnb' };

function haveFile(name) { return !!(audio && audio.buffers && audio.buffers.has(name)); }

function apply() {
  if (!audio || !want) return;
  if (haveFile(want) || !loadDone) {
    if (procOn) { stopMusic(0.8); procOn = null; }
    audio.music(want, { fade: want === 'dnb' ? 0.6 : 1.5 });
    return;
  }
  // file missing: procedural fallback
  audio.music(null, { fade: 0.8 });
  const mood = FALLBACK[want];
  const m = moods.includes(mood) ? mood : (want === 'dnb' ? 'dnb' : moods[0]);
  if (procOn !== m && audio.ctx) {
    try { startMusic(audio.ctx, audio.musicBus, { mood: m, intensity: want === 'dnb' ? 1 : 0.35 }); procOn = m; } catch (e) { /* ignore */ }
  }
}

export function initSoundtrack(a, loadPromise) {
  audio = a;
  if (loadPromise && loadPromise.then) loadPromise.then(() => { loadDone = true; if (want && !haveFile(want)) apply(); }, () => { loadDone = true; apply(); });
  else loadDone = true;
}
export function playMenu() { want = 'menu'; apply(); }
export function setRoomMusic(roomIndex, totalRooms) {
  want = (totalRooms > 1 && roomIndex >= totalRooms - 1) ? 'dnb' : 'factory';
  apply();
}
