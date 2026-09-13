import clickSfxUrl from '../click-sfx.wav';

let sfxAudioBuffer = null;
let audioCtx = null;

// RAM Cache for pre-loaded prompt audio files
const promptAudioCache = {};
const promptAudioElements = {};

const PROMPT_AUDIO_URLS = [
  '/audio/prompts/lr_sentence_1.mp3',
  '/audio/prompts/lr_sentence_2.mp3',
  '/audio/prompts/lr_sentence_3.mp3',
  '/audio/prompts/story_passage.mp3'
];

/**
 * Pre-decode SFX audio buffer into RAM for instant 0ms latency.
 */
export const preloadSfx = () => {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
    }
    fetch(clickSfxUrl)
      .then(res => res.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => {
        sfxAudioBuffer = decoded;
      })
      .catch(() => {});
  } catch (e) {}
};

/**
 * Pre-download & pre-decode ALL prompt audio MP3 files on app startup / candidate login
 * so there is ZERO network delay or loading waiting time during the test!
 */
export const preloadAllPromptAudio = () => {
  // 1. Preload via HTML5 Audio elements for browser HTTP cache
  PROMPT_AUDIO_URLS.forEach((url) => {
    try {
      if (!promptAudioElements[url]) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        audio.load();
        promptAudioElements[url] = audio;
      }
    } catch (e) {}
  });

  // 2. Pre-decode into Web Audio API RAM buffers for instant 0ms playback
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
    }

    PROMPT_AUDIO_URLS.forEach((url) => {
      if (!promptAudioCache[url]) {
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((buf) => audioCtx.decodeAudioData(buf))
          .then((decoded) => {
            promptAudioCache[url] = decoded;
            console.log('⚡ Preloaded & RAM-cached prompt audio:', url);
          })
          .catch(() => {});
      }
    });
  } catch (e) {}
};

/**
 * Play a preloaded prompt audio file with zero latency.
 */
export const playPreloadedPromptAudio = (url, onEndCallback) => {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // 1. Try playing from pre-decoded RAM AudioBuffer (0ms latency, zero fetch delay)
    if (audioCtx && promptAudioCache[url]) {
      const source = audioCtx.createBufferSource();
      source.buffer = promptAudioCache[url];
      source.connect(audioCtx.destination);

      source.onended = () => {
        if (onEndCallback) onEndCallback();
      };

      source.start(0);
      return {
        stop: () => {
          try { source.stop(); } catch (e) {}
        }
      };
    }

    // 2. Fallback to pre-loaded HTML5 Audio element
    let audio = promptAudioElements[url];
    if (!audio) {
      audio = new Audio(url);
      promptAudioElements[url] = audio;
    }

    audio.currentTime = 0;
    audio.onended = () => {
      if (onEndCallback) onEndCallback();
    };

    audio.play().catch((err) => {
      console.warn("Audio play blocked/error:", err);
      if (onEndCallback) onEndCallback();
    });

    return {
      stop: () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      }
    };
  } catch (e) {
    if (onEndCallback) onEndCallback();
    return { stop: () => {} };
  }
};

/**
 * Instantaneous zero-latency click SFX trigger.
 */
export const playInstantClickSfx = () => {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (audioCtx && sfxAudioBuffer) {
      const source = audioCtx.createBufferSource();
      source.buffer = sfxAudioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
      return;
    }

    // HTML5 fallback
    const audio = new Audio(clickSfxUrl);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {}
};

// Auto-trigger preloads on module import
if (typeof window !== 'undefined') {
  preloadSfx();
  preloadAllPromptAudio();
}
