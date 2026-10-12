const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const http = require('http');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('nf'); } else { res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(b); } });
});
server.listen(8765);
const BASE = 'http://localhost:8765/';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, i) => { if (c) pass++; else { fail++; failures.push(n + (i ? ' -> ' + i : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- static checks: links, assets, i18n keys ---------- */
const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const STR = (() => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(fs.readFileSync(ROOT + '/js/i18n.js', 'utf8')); return w.STRINGS; })();
for (const f of htmlFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const refs = [...src.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|#)/.test(u));
  for (const r of refs) check(`${f}: file exists ${r}`, fs.existsSync(path.join(ROOT, r)));
  for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) check(`${f}: i18n key ${m[1]}`, !!STR[m[1]]);
  for (const m of src.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach((p) => { const k = p.split(':').slice(1).join(':').trim(); check(`${f}: i18n attr key ${k}`, !!STR[k]); });
  const title = src.match(/data-title="([^"]+)"/); check(`${f}: title key`, title && !!STR[title[1]]);
}
// keys used from JS
for (const f of fs.readdirSync(ROOT + '/js')) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  for (const m of src.matchAll(/\bt\('([a-z0-9_.]+)'/g)) if (!m[1].endsWith('.')) check(`js/${f}: t('${m[1]}') defined`, !!STR[m[1]]);
  for (const m of src.matchAll(/key: '(err\.[a-z_]+)'/g)) check(`js/${f}: key ${m[1]}`, !!STR[m[1]]);
  for (const m of src.matchAll(/'va\.status\.(\w+)'/g)) check(`status ${m[1]}`, !!STR['va.status.' + m[1]]);
}
for (const k of ['idle', 'listening', 'processing', 'speaking', 'error', 'unsupported']) check('va.status.' + k, !!STR['va.status.' + k]);
for (const [k, v] of Object.entries(STR)) check(`i18n ${k} has both languages`, v.ur && v.en);
// every linked nav target from JS
for (const t of ['dashboard.html', 'voice-assistant.html', 'help.html', 'confirmation.html', 'receipt.html', 'transactions.html', 'pay-bill.html', 'transfer-money.html', 'balance.html', 'index.html']) check('exists ' + t, fs.existsSync(path.join(ROOT, t)));

/* ---------- dynamic: load real pages ---------- */
async function open(file, opts = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (e) => errors.push('console.error: ' + e));
  const dom = await JSDOM.fromURL(BASE + (opts.query ? file + opts.query : file), {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) w.localStorage.setItem(k, v);
      if (opts.beforeParse) opts.beforeParse(w);
    }
  });
  for (let i = 0; i < 100 && dom.window.document.readyState !== 'complete'; i++) await sleep(30);
  await sleep(120);
  dom.errors = errors;
  return dom;
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const $ = (w, id) => w.document.getElementById(id);

(async () => {
  /* every page loads with no script errors and has the shared shell */
  for (const f of htmlFiles) {
    const d = await open(f);
    const doc = d.window.document;
    check(`${f}: no script errors`, d.errors.length === 0, d.errors.join(' | '));
    check(`${f}: demo banner text`, /Demo Prototype|ڈیمو پروٹوٹائپ/.test(doc.getElementById('demo-banner').textContent));
    check(`${f}: header + language buttons`, doc.querySelectorAll('.lang-btn').length === 2);
    check(`${f}: html dir=rtl lang=ur by default`, doc.documentElement.dir === 'rtl' && doc.documentElement.lang === 'ur');
    check(`${f}: title set`, doc.title && doc.title !== 'AwaazPay' || f === 'x');
    check(`${f}: no raw i18n key visible`, ![...doc.querySelectorAll('[data-i18n]')].some((e) => /^[a-z]+\.[a-z0-9_.]+$/.test(e.textContent.trim())));
    // language switch to English
    click(d.window, doc.querySelector('.lang-btn[data-lang="en"]'));
    check(`${f}: switch to English sets ltr`, doc.documentElement.dir === 'ltr' && doc.documentElement.lang === 'en');
    check(`${f}: language persists`, d.window.localStorage.getItem('awaazpay_lang') === 'en');
    d.window.close();
  }

  /* landing */
  {
    const d = await open('index.html'); const w = d.window;
    check('landing: voice + buttons CTAs link correctly', !!w.document.querySelector('a[href="voice-assistant.html"]') && !!w.document.querySelector('a[href="dashboard.html"]'));
    click(w, w.document.querySelector('[data-lang-choice="en"]'));
    check('landing: English choice pressed', w.document.querySelector('[data-lang-choice="en"]').getAttribute('aria-pressed') === 'true');
    check('landing: tagline english', /Your money, your language/.test(w.document.body.textContent));
    w.close();
  }

  /* dashboard: every card to an existing page */
  {
    const d = await open('dashboard.html');
    const hrefs = [...d.window.document.querySelectorAll('.action-card')].map((a) => a.getAttribute('href'));
    check('dashboard: 5 action cards', hrefs.length === 5);
    check('dashboard: targets', ['pay-bill.html', 'transfer-money.html', 'balance.html', 'transactions.html', 'help.html'].every((h) => hrefs.includes(h)));
    d.window.close();
  }

  /* pay-bill form flow */
  {
    const d = await open('pay-bill.html', { storage: { awaazpay_lang: 'en' } }); const w = d.window;
    click(w, $(w, 'step1Next'));
    check('bill: no category -> error shown', $(w, 'catError').classList.contains('show') && !$(w, 'step1').hidden);
    click(w, w.document.querySelector('#categoryGrid [data-id="electricity"]'));
    click(w, $(w, 'step1Next'));
    check('bill: step 2 visible', !$(w, 'step2').hidden);
    $(w, 'refInput').value = '123'; click(w, $(w, 'findBill'));
    check('bill: short ref error (E)', /8 digits/.test($(w, 'refError').textContent));
    $(w, 'refInput').value = '20020002'; click(w, $(w, 'findBill'));
    check('bill: ref of another bill rejected', $(w, 'refError').classList.contains('show') && $(w, 'billFound').hidden);
    click(w, $(w, 'useDemo'));
    check('bill: demo ref found', !$(w, 'billFound').hidden && /Demo Electric Co/.test($(w, 'billFound').textContent));
    click(w, $(w, 'step2Next'));
    check('bill: step 3 visible', !$(w, 'step3').hidden);
    click(w, $(w, 'payOther')); $(w, 'amountInput').value = '-50'; click(w, $(w, 'step3Next'));
    check('bill: negative amount blocked', /more than zero/.test($(w, 'amountError').textContent));
    $(w, 'amountInput').value = '99999'; click(w, $(w, 'step3Next'));
    check('bill: too-large amount blocked', $(w, 'amountError').classList.contains('show'));
    click(w, $(w, 'payFull'));
    check('bill: valid -> pending stored', (() => { try { click(w, $(w, 'step3Next')); } catch (e) {} const s = JSON.parse(w.localStorage.getItem('awaazpay_state_v1')); return s.pending && s.pending.amount === 3450 && s.pending.billerId === 'electricity' && s.pending.source === 'form'; })());
    w.close();
  }

  /* transfer + confirmation + receipt + history + balance (shared storage across pages) */
  {
    const d1 = await open('transfer-money.html', { storage: { awaazpay_lang: 'en' } }); let w = d1.window;
    click(w, $(w, 'step1Next'));
    check('transfer: needs recipient', $(w, 'recError').classList.contains('show'));
    click(w, w.document.querySelector('#recipientGrid [data-id="ahmed"]'));
    click(w, $(w, 'step1Next'));
    $(w, 'amountInput').value = 'abc'; click(w, $(w, 'step2Next'));
    check('transfer: non-numeric rejected', /digits only/.test($(w, 'amountError').textContent));
    click(w, w.document.querySelector('#presetChips [data-n="1000"]'));
    check('transfer: preset fills input', $(w, 'amountInput').value === '1000');
    try { click(w, $(w, 'step2Next')); } catch (e) {}
    const saved = w.localStorage.getItem('awaazpay_state_v1');
    const store = { awaazpay_lang: 'en', awaazpay_state_v1: saved };
    check('transfer: pending saved', JSON.parse(saved).pending.recipientId === 'ahmed' && JSON.parse(saved).pending.amount === 1000);
    w.close();

    // confirmation: cancel path first
    let d = await open('confirmation.html', { storage: store }); w = d.window;
    check('confirmation: review visible with amount and recipient', !$(w, 'stateReview').hidden && /1,000/.test($(w, 'summary').textContent) && /Ahmed Khan/.test($(w, 'summary').textContent));
    check('confirmation: demo + manual notes', /not move any real money/.test(w.document.body.textContent) && /never presses/.test(w.document.body.textContent));
    check('confirmation: three controls (confirm/change/cancel)', !!$(w, 'confirmBtn') && !!$(w, 'changeBtn') && !!$(w, 'cancelBtn'));
    check('confirmation: change goes back to transfer form', $(w, 'changeBtn').getAttribute('href') === 'transfer-money.html');
    // scripted (untrusted) click must NOT confirm
    click(w, $(w, 'confirmBtn'));
    check('confirmation: scripted click ignored (isTrusted guard)', JSON.parse(w.localStorage.getItem('awaazpay_state_v1')).balance === 48500);
    click(w, $(w, 'cancelBtn'));
    const s2 = JSON.parse(w.localStorage.getItem('awaazpay_state_v1'));
    check('confirmation: cancel clears pending, balance untouched', s2.pending === null && s2.balance === 48500 && !$(w, 'stateCancelled').hidden);
    w.close();

    // happy path: confirm via the module (real click events are untrusted in jsdom)
    d = await open('confirmation.html', { storage: store }); w = d.window;
    const rec = w.Payments.confirm();
    check('confirm: DEMO receipt id', /^DEMO-/.test(rec.id) && rec.amount === 1000 && rec.balanceAfter === 47500);
    const store2 = { awaazpay_lang: 'en', awaazpay_state_v1: w.localStorage.getItem('awaazpay_state_v1') };
    w.close();

    d = await open('receipt.html', { storage: store2 }); w = d.window;
    check('receipt: shows DEMO watermark, ref, amount, recipient', /DEMO/.test($(w, 'receiptCard').textContent) && /1,000/.test($(w, 'receiptList').textContent) && /Ahmed Khan/.test($(w, 'receiptList').textContent) && /DEMO-\d{8}-/.test($(w, 'receiptList').textContent));
    check('receipt: says no real money', /no real money/i.test($(w, 'receiptCard').textContent));
    w.close();
    d = await open('receipt.html', { storage: { awaazpay_lang: 'en' } });
    check('receipt: empty state when none', !d.window.document.getElementById('receiptEmpty').hidden);
    d.window.close();
    d = await open('confirmation.html', { storage: { awaazpay_lang: 'en' } });
    check('confirmation: empty state with no pending', !d.window.document.getElementById('stateEmpty').hidden);
    d.window.close();

    d = await open('balance.html', { storage: store2 }); w = d.window;
    check('balance: reflects new balance 47,500 + demo notice', /47,500/.test($(w, 'balanceValue').textContent) && /not connected to any real bank/.test(w.document.body.textContent));
    click(w, $(w, 'readBalance'));
    check('balance: read-aloud without voices does not crash', d.errors.length === 0, d.errors.join('|'));
    w.close();

    d = await open('transactions.html', { storage: store2 }); w = d.window;
    const items = w.document.querySelectorAll('.tx');
    check('history: 6 seed + 1 new', items.length === 7);
    check('history: new item first and tagged', /Sent to Ahmed Khan/.test(items[0].textContent) && /New/.test(items[0].textContent));
    check('history: failed transaction labelled with text', /Not completed/.test(w.document.body.textContent));
    click(w, w.document.querySelector('.lang-btn[data-lang="ur"]'));
    check('history: re-renders in Urdu', /مکمل نہیں ہوا/.test(w.document.body.textContent));
    w.close();
  }

  /* help */
  {
    const d = await open('help.html', { storage: { awaazpay_lang: 'en' }, query: '#human' }); const w = d.window;
    click(w, $(w, 'runCheck'));
    check('help: capability table shows results (no mic prompt)', !$(w, 'checkTable').hidden && /Not available/.test($(w, 'chkRec').textContent));
    w.document.getElementById('humanForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    check('help: human form requires choices', $(w, 'humanError').classList.contains('show') && $(w, 'humanDone').hidden);
    $(w, 'topic').value = 'bill'; $(w, 'channel').value = 'family';
    w.document.getElementById('humanForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    check('help: simulated request confirms it is NOT real', !$(w, 'humanDone').hidden && /No real request was sent/.test($(w, 'humanDone').textContent));
    check('help: no fabricated phone numbers', !/\b\d{3,}[\s-]?\d{4,}\b/.test(w.document.body.textContent));
    w.close();
  }

  /* voice assistant — unsupported speech (jsdom has none) */
  {
    const d = await open('voice-assistant.html', { storage: { awaazpay_lang: 'en' } }); let w = d.window;
    check('assistant: loads with welcome message', /I am AwaazPay/.test($(w, 'chat').textContent));
    check('assistant: unsupported-browser notice shown', !$(w, 'voiceNotice').hidden && /does not offer speech recognition/.test($(w, 'voiceNoticeText').textContent));
    click(w, $(w, 'micBtn'));
    check('assistant: mic press without support -> Case F recovery (type / buttons)', $(w, 'statusBar').dataset.state === 'error' && /not available in this browser/.test($(w, 'chat').textContent) && [...$(w, 'quick').children].some((e) => /Type instead/.test(e.textContent)));
    // typed task through the real UI
    $(w, 'textInput').value = 'Pay my electricity bill';
    $(w, 'textForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    check('assistant: processing state shown first', $(w, 'statusBar').dataset.state === 'processing');
    await sleep(500);
    check('assistant: user + bot bubbles', w.document.querySelectorAll('.msg.user').length === 1 && /reference number/.test($(w, 'chat').textContent));
    check('assistant: quick replies rendered (demo ref + back)', $(w, 'quick').children.length === 2);
    click(w, $(w, 'quick').children[0]); await sleep(500);
    click(w, [...$(w, 'quick').children].find((b) => /Yes, full amount/.test(b.textContent))); await sleep(500);
    check('assistant: review card with details + link to confirmation', /Demo Electric Co/.test($(w, 'chat').textContent) && /3,450/.test($(w, 'chat').textContent) && !!$(w, 'quick').querySelector('a[href="confirmation.html"]'));
    const stSaved = JSON.parse(w.localStorage.getItem('awaazpay_state_v1'));
    check('assistant: pending set, balance untouched, convo persisted', stSaved.pending && stSaved.pending.source === 'assistant' && stSaved.balance === 48500 && stSaved.convo.history.length > 5);
    // language switch re-renders history
    click(w, w.document.querySelector('.lang-btn[data-lang="ur"]'));
    check('assistant: history re-rendered in Urdu', /ریفرنس|بل/.test($(w, 'chat').textContent) && w.document.documentElement.dir === 'rtl');
    // cancel button
    click(w, $(w, 'cancelBtn')); await sleep(500);
    check('assistant: cancel clears pending', JSON.parse(w.localStorage.getItem('awaazpay_state_v1')).pending === null);
    // restart
    click(w, $(w, 'restartBtn')); await sleep(500);
    check('assistant: restart clears history to a single welcome', w.document.querySelectorAll('.msg').length === 1);
    const keep = w.localStorage.getItem('awaazpay_state_v1');
    w.close();
    check('assistant: no script errors in session', d.errors.length === 0, d.errors.join('|'));
  }

  /* voice assistant — mocked SpeechRecognition: success, permission denied, silence, wrong language */
  {
    const mock = { mode: 'result', text: 'مجھے بجلی کا بل ادا کرنا ہے' };
    const setup = (w) => {
      w.SpeechRecognition = function () {
        const self = this;
        this.start = () => {
          setTimeout(() => self.onstart && self.onstart(), 5);
          setTimeout(() => {
            if (mock.mode === 'result') {
              self.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: mock.text, confidence: 0.9 }], { isFinal: true })] });
              self.onend && self.onend();
            } else if (mock.mode === 'denied') { self.onerror({ error: 'not-allowed' }); self.onend && self.onend(); }
            else if (mock.mode === 'silence') { self.onend && self.onend(); }
            else if (mock.mode === 'nolang') { self.onerror({ error: 'language-not-supported' }); self.onend && self.onend(); }
          }, 20);
        };
        this.abort = () => {};
      };
    };
    let d = await open('voice-assistant.html', { storage: { awaazpay_lang: 'ur' }, beforeParse: setup }); let w = d.window;
    check('mock-voice: no unsupported notice when API exists', $(w, 'voiceNotice').hidden);
    click(w, $(w, 'micBtn')); await sleep(60);
    await sleep(500);
    check('mock-voice: Urdu utterance understood -> electricity bill flow', /بجلی/.test($(w, 'chat').textContent) && w.document.querySelectorAll('.msg.user').length === 1);
    check('mock-voice: nothing executed by voice alone', JSON.parse(w.localStorage.getItem('awaazpay_state_v1')).balance === 48500);
    check('mock-voice: no language hint when script matches', ![...$(w, 'quick').children].some((e) => /English/.test(e.textContent)));
    mock.mode = 'denied'; click(w, $(w, 'micBtn')); await sleep(80);
    check('mock-voice: permission denied -> explanation + type/buttons options', $(w, 'statusBar').dataset.state === 'error' && /اجازت/.test($(w, 'chat').textContent) && [...$(w, 'quick').children].some((e) => /لکھ کر/.test(e.textContent)));
    mock.mode = 'silence'; click(w, $(w, 'micBtn')); await sleep(80);
    check('mock-voice: silence -> "nothing heard" recovery with retry', /سنائی نہیں دی/.test($(w, 'chat').textContent) && [...$(w, 'quick').children].some((e) => /دوبارہ کوشش/.test(e.textContent)));
    check('mock-voice: second failure adds typing hint', /لکھ کر بھی/.test($(w, 'chat').textContent));
    w.close();

    mock.mode = 'result'; mock.text = 'pay my electricity bill';
    d = await open('voice-assistant.html', { storage: { awaazpay_lang: 'ur' }, beforeParse: setup }); w = d.window;
    click(w, $(w, 'micBtn')); await sleep(600);
    check('mock-voice: English speech while Urdu selected -> still understood', /بجلی/.test($(w, 'chat').textContent));
    check('mock-voice: offers to switch language', [...$(w, 'quick').children].some((e) => /English/.test(e.textContent)));
    click(w, [...$(w, 'quick').children].find((e) => /English/.test(e.textContent)));
    check('mock-voice: language switched on request', w.document.documentElement.lang === 'en');
    w.close();

    mock.mode = 'nolang';
    d = await open('voice-assistant.html', { storage: { awaazpay_lang: 'ur' }, beforeParse: setup }); w = d.window;
    click(w, $(w, 'micBtn')); await sleep(80);
    check('mock-voice: language-not-supported offers switching language', [...$(w, 'quick').children].some((e) => /English/.test(e.textContent)));
    w.close();
  }

  /* resume after confirmation page */
  {
    const d0 = await open('voice-assistant.html', { storage: { awaazpay_lang: 'en' } }); let w = d0.window;
    w.Conversation; // ensure loaded
    $(w, 'textInput').value = 'send 500 to Bilal'; $(w, 'textForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await sleep(500);
    check('assistant: one-sentence transfer goes to review', !!$(w, 'quick').querySelector('a[href="confirmation.html"]') && /Bilal Store/.test($(w, 'chat').textContent));
    const saved = w.localStorage.getItem('awaazpay_state_v1'); w.close();
    let d1 = await open('confirmation.html', { storage: { awaazpay_lang: 'en', awaazpay_state_v1: saved } }); w = d1.window;
    check('confirmation (from assistant): change link returns to assistant', $(w, 'changeBtn').getAttribute('href') === 'voice-assistant.html');
    w.Payments.confirm(); const saved2 = w.localStorage.getItem('awaazpay_state_v1'); w.close();
    const d2 = await open('voice-assistant.html', { storage: { awaazpay_lang: 'en', awaazpay_state_v1: saved2 } });
    check('assistant: after confirming elsewhere, tells user it was recorded as a demo + receipt link', /demo payment was recorded/.test($(d2.window, 'chat').textContent) && !!$(d2.window, 'quick').querySelector('a[href="receipt.html"]'));
    d2.window.close();
  }

  console.log(`\nPage tests: ${pass} passed, ${fail} failed`);
  failures.forEach((f) => console.log('  FAIL: ' + f));
  server.close();
  process.exit(fail ? 1 : 0);
})();
