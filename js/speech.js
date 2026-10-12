/* AwaazPay — speech.js
 * Thin wrapper around the browser's Web Speech API.
 *  - SpeechRecognition / webkitSpeechRecognition  -> listening
 *  - speechSynthesis                              -> speaking
 * Support varies by browser and device. Urdu recognition and Urdu voices are NOT guaranteed.
 * Design rule: the assistant is push-to-talk. Listening and speaking never run at the same time,
 * and listening never restarts by itself, so the microphone cannot hear the assistant's own voice.
 */
(function (global) {
  'use strict';

  const SR = global.SpeechRecognition || global.webkitSpeechRecognition || null;
  const synth = global.speechSynthesis || null;

  const LANG_CODES = { ur: 'ur-PK', en: 'en-US' };

  let recognition = null;
  let listening = false;
  let voices = [];

  function loadVoices() {
    if (!synth) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  }
  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
  }

  const Speech = {
    supportsRecognition: !!SR,
    supportsSynthesis: !!synth && typeof global.SpeechSynthesisUtterance === 'function',

    isListening() { return listening; },

    /* Is there a installed voice for this language? (Urdu is often missing.) */
    findVoice(lang) {
      loadVoices();
      const prefix = LANG_CODES[lang].slice(0, 2).toLowerCase();
      return voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(prefix)) || null;
    },
    hasVoiceFor(lang) { return Speech.supportsSynthesis && !!Speech.findVoice(lang); },

    /* ---------- listening ---------- */
    listen(opts) {
      // opts: { lang, onStart, onInterim(text), onResult(text, confidence), onError(code), onEnd() }
      if (!SR) { opts.onError && opts.onError('unsupported'); return false; }
      Speech.cancelSpeech();               // never listen while speaking
      Speech.stop();
      let gotResult = false;
      let failed = false;
      try {
        recognition = new SR();
        recognition.lang = LANG_CODES[opts.lang] || 'ur-PK';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => { listening = true; opts.onStart && opts.onStart(); };
        recognition.onresult = (ev) => {
          let interim = '';
          let final = '';
          let conf = 0;
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) { final += r[0].transcript; conf = r[0].confidence; }
            else interim += r[0].transcript;
          }
          if (interim && opts.onInterim) opts.onInterim(interim);
          if (final) { gotResult = true; opts.onResult && opts.onResult(final.trim(), conf); }
        };
        recognition.onerror = (ev) => {
          if (ev.error === 'aborted') return;     // we stopped it ourselves
          failed = true;
          opts.onError && opts.onError(ev.error || 'unknown');
        };
        recognition.onend = () => {
          listening = false;
          recognition = null;
          // Ended with neither a result nor an error -> nothing was heard.
          if (!gotResult && !failed) opts.onError && opts.onError('no-speech');
          opts.onEnd && opts.onEnd();
        };
        recognition.start();
        return true;
      } catch (e) {
        listening = false;
        recognition = null;
        opts.onError && opts.onError('start-failed');
        return false;
      }
    },

    stop() {
      if (recognition) {
        try { recognition.abort(); } catch (e) { /* ignore */ }
      }
      listening = false;
    },

    /* ---------- speaking ---------- */
    speak(text, lang, cb) {
      // cb: { onStart, onEnd }. Returns false if nothing will be spoken (caller shows text only).
      if (!Speech.supportsSynthesis) return false;
      const voice = Speech.findVoice(lang);
      if (!voice) return false;             // never read Urdu with a wrong-language voice
      Speech.stop();                        // never speak while listening
      Speech.cancelSpeech();
      const u = new global.SpeechSynthesisUtterance(text);
      u.lang = voice.lang;
      u.voice = voice;
      u.rate = 0.9;                         // slightly slower for clarity
      u.onstart = () => cb && cb.onStart && cb.onStart();
      u.onend = () => cb && cb.onEnd && cb.onEnd();
      u.onerror = () => cb && cb.onEnd && cb.onEnd();
      synth.speak(u);
      return true;
    },
    cancelSpeech() { if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } } },

    /* Map raw error codes to the app's recovery categories. */
    classifyError(code) {
      switch (code) {
        case 'not-allowed':
        case 'service-not-allowed': return 'permission';
        case 'no-speech': return 'nospeech';
        case 'audio-capture': return 'nomic';
        case 'network': return 'network';
        case 'language-not-supported': return 'language';
        case 'unsupported': return 'unsupported';
        default: return 'other';
      }
    }
  };

  global.Speech = Speech;
})(typeof window !== 'undefined' ? window : globalThis);
