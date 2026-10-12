/* AwaazPay — assistant-ui.js
 * Connects the rule-based engine (conversation.js) and the browser speech wrapper (speech.js)
 * to the voice-assistant page. Push-to-talk: the microphone never opens by itself and never
 * runs while the assistant is speaking.
 */
(function (global) {
  'use strict';

  const doc = global.document;
  const $ = (id) => doc.getElementById(id);
  const A = () => global.App;
  const S = () => global.Speech;
  const C = () => global.Conversation;
  const P = () => global.Payments;

  const T = (ur, en) => ({ ur, en });

  A().register('voice-assistant', function () {
    /* ---------- state ---------- */
    let convo = A().getState().convo;
    if (!convo || !convo.history) convo = { ctx: null, history: [] };
    if (!convo.ctx) convo.ctx = C().newCtx();
    let status = 'idle';
    let speechFails = 0;
    let langHintShown = false;
    let noticeShown = {};

    const save = () => A().update((s) => { s.convo = convo; });

    /* ---------- status + notices ---------- */
    function setStatus(state) {
      status = state;
      const bar = $('statusBar');
      bar.dataset.state = state;
      $('statusText').textContent = A().t('va.status.' + state);
      const listening = state === 'listening';
      const mic = $('micBtn');
      mic.setAttribute('aria-pressed', String(listening));
      $('micLabel').textContent = A().t(listening ? 'va.mic.stop' : 'va.mic.start');
      mic.setAttribute('aria-label', A().t(listening ? 'va.mic.stop' : 'va.mic.start'));
      $('stopBtn').disabled = !listening;
    }
    function showNotice(key) {
      $('voiceNoticeText').textContent = A().t(key);
      $('voiceNotice').hidden = false;
      $('voiceNotice').dataset.key = key;
    }

    /* ---------- rendering ---------- */
    function msgNode(item) {
      const l = A().lang;
      const div = doc.createElement('div');
      div.className = 'msg ' + (item.role === 'user' ? 'user' : 'bot');
      const who = doc.createElement('span');
      who.className = 'who';
      who.textContent = A().t(item.role === 'user' ? 'va.who_user' : 'va.who_bot');
      const bubble = doc.createElement('div');
      bubble.className = 'bubble';
      if (item.role === 'user') {
        bubble.textContent = item.label ? item.label[l] : item.text;
        if (!item.label) bubble.setAttribute('dir', 'auto');
      } else {
        bubble.textContent = item.msg[l];
        if (item.card && item.card.kind === 'summary') {
          const box = doc.createElement('div');
          box.className = 'mini-summary';
          const dl = doc.createElement('dl');
          dl.className = 'summary';
          item.card.rows.forEach((r) => {
            const row = doc.createElement('div');
            const dt = doc.createElement('dt'); dt.textContent = r.label[l];
            const dd = doc.createElement('dd'); dd.textContent = r.value[l];
            dd.classList.add('ltr-iso');
            row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
          });
          box.appendChild(dl);
          bubble.appendChild(box);
        }
      }
      div.appendChild(who); div.appendChild(bubble);
      return div;
    }

    function renderChat() {
      const chat = $('chat');
      chat.innerHTML = '';
      convo.history.forEach((it) => chat.appendChild(msgNode(it)));
      chat.scrollTop = chat.scrollHeight;
      renderQuick();
    }

    function lastBot() {
      for (let i = convo.history.length - 1; i >= 0; i--) if (convo.history[i].role === 'bot') return convo.history[i];
      return null;
    }

    function renderQuick() {
      const q = $('quick');
      q.innerHTML = '';
      const last = convo.history[convo.history.length - 1];
      if (!last || last.role !== 'bot') return;
      (last.buttons || []).forEach((b, i) => {
        let el;
        if (b.href) {
          el = doc.createElement('a'); el.href = b.href;
          el.className = 'btn' + (b.href === 'confirmation.html' ? ' btn-primary' : '');
        } else {
          el = doc.createElement('button'); el.type = 'button';
          el.className = 'btn' + (b.value === 'cmd:cancel' ? ' btn-danger' : '');
          el.addEventListener('click', () => onQuick(b));
        }
        el.textContent = b[A().lang];
        q.appendChild(el);
      });
    }

    function pushBot(r) {
      convo.history.push({ role: 'bot', msg: r.msg, buttons: r.buttons || [], card: r.card || null });
      if (r.card && r.card.kind === 'summary') convo.reviewAt = new Date().toISOString();
    }
    function pushUser(text, label) { convo.history.push({ role: 'user', text, label: label || null }); }

    /* ---------- speaking ---------- */
    function textOf(r) {
      const l = A().lang;
      let t = r.msg[l];
      if (r.card && r.card.rows) t += '. ' + r.card.rows.map((x) => `${x.label[l]}: ${x.value[l]}`).join('. ');
      return t;
    }
    function speakReplies(replies) {
      if (!$('voiceToggle').checked) return;
      if (!S().supportsSynthesis) { notice('va.notice.nosynth'); return; }
      const text = replies.map(textOf).join(' ');
      const ok = S().speak(text, A().lang, {
        onStart: () => setStatus('speaking'),
        onEnd: () => { if (status === 'speaking') setStatus('idle'); }
      });
      if (!ok) notice('va.notice.novoice');
    }
    function notice(key) { if (!noticeShown[key]) { noticeShown[key] = true; showNotice(key); } }

    /* ---------- core: send input to the engine ---------- */
    function handleInput(rawInput, opts) {
      opts = opts || {};
      S().stop(); S().cancelSpeech();               // never listen and speak at once
      setStatus('processing');
      pushUser(rawInput, opts.label || null);
      const thinking = { role: 'bot', msg: T(A().t('va.thinking', null, 'ur'), A().t('va.thinking', null, 'en')), buttons: [], card: null, thinking: true };
      convo.history.push(thinking);
      renderChat();
      // A short, visible "processing" state; the rule-based engine itself answers instantly.
      setTimeout(() => {
        convo.history.pop();                       // remove the "thinking" bubble
        const res = C().respond(convo.ctx, rawInput);
        if (res.restart) { convo.history = []; convo.reviewAt = null; }
        res.replies.forEach(pushBot);
        if (res.exit) { /* stays on page; user may use the Exit link */ }
        save(); renderChat();
        setStatus('idle');
        speakReplies(res.replies);
        $('liveTranscript').textContent = '';
        if (opts.fromVoice) maybeLangHint(rawInput);
      }, 350);
    }

    /* The speech engine was set for one language but the transcript looks like the other. */
    function maybeLangHint(text) {
      if (langHintShown) return;
      const script = C().detectScript(text);
      const lang = A().lang;
      if (script === 'none' || script === lang) return;
      langHintShown = true;
      const other = lang === 'ur' ? 'en' : 'ur';
      const msg = lang === 'ur'
        ? T('آپ نے انگریزی میں بات کی، جبکہ اردو منتخب ہے۔ میں سمجھ سکتا ہوں، لیکن آواز کی شناخت اردو کے لیے سیٹ ہے۔ کیا آپ زبان انگریزی کر دیں؟',
            'You spoke English while Urdu is selected. I can understand, but listening is set to Urdu. Would you like to switch to English?')
        : T('آپ نے اردو میں بات کی، جبکہ انگریزی منتخب ہے۔ میں سمجھ سکتا ہوں، لیکن آواز کی شناخت انگریزی کے لیے سیٹ ہے۔ کیا آپ زبان اردو کر دیں؟',
            'You spoke Urdu while English is selected. I can understand, but listening is set to English. Would you like to switch to Urdu?');
      const r = {
        msg,
        buttons: [
          { ur: lang === 'ur' ? 'English منتخب کریں' : 'اردو منتخب کریں', en: lang === 'ur' ? 'Switch to English' : 'Switch to Urdu (اردو)', ui: 'switch:' + other },
          { ur: 'ایسے ہی جاری رکھیں', en: 'Keep this language', ui: 'dismiss' }
        ]
      };
      pushBot(r); save(); renderChat();
    }

    /* ---------- quick-reply buttons ---------- */
    function onQuick(b) {
      if (b.ui) {
        if (b.ui.indexOf('switch:') === 0) { A().setLang(b.ui.split(':')[1]); return; }
        if (b.ui === 'retry') { startListening(); return; }
        if (b.ui === 'type') { $('textInput').focus(); return; }
        if (b.ui === 'dismiss') { $('quick').innerHTML = ''; return; }
      }
      if (b.value) handleInput(b.value, { label: { ur: b.ur, en: b.en } });
    }

    /* ---------- listening ---------- */
    function speechErrorReply(code) {
      const kind = S().classifyError(code);
      speechFails++;
      const more = speechFails >= 2
        ? T(' آپ نیچے لکھ کر بھی بتا سکتے ہیں۔', ' You can also type below.') : T('', '');
      const base = {
        permission: T('مائیکروفون کی اجازت نہیں ملی۔ براؤزر کی ایڈریس بار میں مائیکروفون کی اجازت دے کر دوبارہ کوشش کریں، یا لکھ کر اور بٹنوں سے جاری رکھیں۔',
          'Microphone permission was not granted. Allow the microphone in the browser’s address bar and try again, or continue by typing and with buttons.'),
        nospeech: T('مجھے کوئی آواز سنائی نہیں دی۔ مائیکروفون کے قریب ہو کر دوبارہ بولیں، یا لکھ کر بتائیں۔',
          'I did not hear anything. Move closer to the microphone and speak again, or type instead.'),
        nomic: T('مائیکروفون نہیں ملا۔ دیکھ لیں کہ وہ لگا ہوا ہے، یا لکھ کر اور بٹنوں سے جاری رکھیں۔',
          'No microphone was found. Check that one is connected, or continue by typing and with buttons.'),
        network: T('آواز کی شناخت کے لیے انٹرنیٹ درکار ہو سکتا ہے اور ابھی رابطہ نہیں ہو سکا۔ لکھ کر یا بٹن دبا کر جاری رکھیں۔',
          'Speech recognition may need an internet connection and it could not connect. Continue by typing or with buttons.'),
        language: T('اس براؤزر میں اس زبان کی آواز کی شناخت دستیاب نہیں۔ آپ دوسری زبان آزما سکتے ہیں، یا لکھ کر بتا سکتے ہیں۔',
          'Voice recognition for this language is not available in this browser. You can try the other language, or type instead.'),
        unsupported: T('اس براؤزر میں آواز کی شناخت دستیاب نہیں۔ آپ لکھ کر یا بٹن دبا کر وہی سب کر سکتے ہیں۔',
          'Voice recognition is not available in this browser. You can do everything by typing or with buttons.'),
        other: T('آواز کام نہیں کر سکی۔ آپ دوبارہ کوشش کر سکتے ہیں، یا لکھ کر اور بٹنوں سے جاری رکھ سکتے ہیں۔',
          'The voice input did not work. You can try again, or continue by typing and with buttons.')
      }[kind];
      const buttons = [];
      if (kind !== 'unsupported' && kind !== 'permission' && kind !== 'nomic') buttons.push({ ur: 'دوبارہ کوشش کریں', en: 'Try again', ui: 'retry' });
      buttons.push({ ur: 'لکھ کر بتائیں', en: 'Type instead', ui: 'type' });
      if (kind === 'language') buttons.push({ ur: A().lang === 'ur' ? 'English منتخب کریں' : 'اردو منتخب کریں', en: A().lang === 'ur' ? 'Switch to English' : 'Switch to Urdu (اردو)', ui: 'switch:' + (A().lang === 'ur' ? 'en' : 'ur') });
      buttons.push({ ur: 'بٹنوں سے کام کریں', en: 'Use buttons instead', href: 'dashboard.html' });
      return { msg: T(base.ur + more.ur, base.en + more.en), buttons };
    }

    function startListening() {
      if (!S().supportsRecognition) {
        setStatus('error');
        notice('va.notice.nomic');
        pushBot(speechErrorReply('unsupported')); save(); renderChat();
        $('textInput').focus();
        return;
      }
      $('liveTranscript').textContent = '';
      S().listen({
        lang: A().lang,
        onStart: () => setStatus('listening'),
        onInterim: (t) => { $('liveTranscript').innerHTML = ''; const s = doc.createElement('strong'); s.textContent = A().t('va.you_said') + ' '; $('liveTranscript').appendChild(s); $('liveTranscript').appendChild(doc.createTextNode(t)); },
        onResult: (t) => { speechFails = 0; handleInput(t, { fromVoice: true }); },
        onError: (code) => {
          setStatus('error');
          pushBot(speechErrorReply(code)); save(); renderChat();
        },
        onEnd: () => { if (status === 'listening') setStatus('idle'); }
      });
    }
    function stopListening() { S().stop(); if (status === 'listening') setStatus('idle'); }

    /* ---------- wiring ---------- */
    $('micBtn').addEventListener('click', () => { if (S().isListening()) stopListening(); else startListening(); });
    $('stopBtn').addEventListener('click', stopListening);
    $('repeatBtn').addEventListener('click', () => {
      const b = lastBot();
      if (!b) return;
      const l = A().lang;
      S().stop();
      const ok = S().supportsSynthesis && S().speak(textOf(b), l, { onStart: () => setStatus('speaking'), onEnd: () => { if (status === 'speaking') setStatus('idle'); } });
      if (!ok) { A().toast(b.msg[l]); notice(S().supportsSynthesis ? 'va.notice.novoice' : 'va.notice.nosynth'); }
    });
    $('voiceToggle').addEventListener('change', () => { if (!$('voiceToggle').checked) S().cancelSpeech(); if (status === 'speaking') setStatus('idle'); });

    $('textForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('textInput').value.trim();
      if (!v) { $('textInput').focus(); return; }
      $('textInput').value = '';
      handleInput(v);
    });
    $('undoBtn').addEventListener('click', () => handleInput('cmd:back', { label: { ur: A().t('va.undo', null, 'ur'), en: A().t('va.undo', null, 'en') } }));
    $('cancelBtn').addEventListener('click', () => handleInput('cmd:cancel', { label: { ur: A().t('va.cancel', null, 'ur'), en: A().t('va.cancel', null, 'en') } }));
    $('restartBtn').addEventListener('click', () => handleInput('cmd:restart', { label: { ur: A().t('va.restart', null, 'ur'), en: A().t('va.restart', null, 'en') } }));
    $('exitBtn').addEventListener('click', () => { S().stop(); S().cancelSpeech(); });
    global.addEventListener('pagehide', () => { S().stop(); S().cancelSpeech(); });

    A().onLang(() => {
      S().stop(); S().cancelSpeech();
      setStatus('idle');
      renderChat();
      if (!$('voiceNotice').hidden && $('voiceNotice').dataset.key) $('voiceNoticeText').textContent = A().t($('voiceNotice').dataset.key);
    });

    /* ---------- initial state ---------- */
    // Came back from the confirmation page? Tell the user what happened to the task.
    if (convo.reviewAt && !P().getPending()) {
      const rc = A().getState().lastReceipt;
      const done = rc && rc.whenISO >= convo.reviewAt;
      pushBot(done
        ? { msg: T('آپ کی ڈیمو ادائیگی ریکارڈ ہو گئی ہے۔ یہ صرف ڈیمو ہے، کوئی اصل رقم منتقل نہیں ہوئی۔ رسید دیکھ سکتے ہیں۔', 'Your demo payment was recorded. This is only a demo; no real money moved. You can view the receipt.'),
            buttons: [{ ur: 'ڈیمو رسید دیکھیں', en: 'View demo receipt', href: 'receipt.html' }, { ur: 'نیا کام', en: 'New task', value: 'cmd:restart' }] }
        : { msg: T('وہ کام منسوخ ہو گیا تھا۔ کچھ نہیں بھیجا گیا۔ اب آپ کیا کرنا چاہتے ہیں؟', 'That task was cancelled. Nothing was sent. What would you like to do now?'),
            buttons: C().welcome().buttons });
      convo.reviewAt = null;
      convo.ctx = C().newCtx();
    }
    if (!convo.history.length) pushBot(C().welcome());
    save();
    if (!S().supportsRecognition) notice('va.notice.nomic');   // mic stays clickable: pressing it explains the fallback
    setStatus('idle');
    renderChat();
  });
})(window);
