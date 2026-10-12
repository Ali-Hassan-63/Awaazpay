/* AwaazPay — conversation.js
 * A transparent, RULE-BASED dialogue engine. It is NOT AI or machine learning.
 *
 *   input text --normalize--> global commands (cancel / restart / exit / back / human)
 *              --> current dialogue step (expects category / reference / amount / recipient / yes-no)
 *              --> keyword-scored intent matching (six intents) --> reply + buttons
 *
 * Every reply carries BOTH languages ({ur, en}) so the chat can be re-rendered when the language
 * is switched. The engine never executes a payment: it only prepares a "pending" action and points
 * to the confirmation page, where the user must press the final button themselves.
 *
 * Intents: pay_bill, transfer_money, check_balance, transaction_history, help, cancel_or_restart.
 */
(function (global) {
  'use strict';

  const D = global.DEMO;
  const App = () => global.App;
  const Pay = () => global.Payments;

  /* ====================================================================== */
  /* helpers: bilingual text + buttons                                       */
  /* ====================================================================== */
  const T = (ur, en) => ({ ur, en });
  const B = (ur, en, value) => ({ ur, en, value });
  const LINK = (ur, en, href) => ({ ur, en, href });
  const UI = (ur, en, ui) => ({ ur, en, ui });
  const cat = (a, b) => ({ ur: a.ur + b.ur, en: a.en + b.en });
  const M = (n) => ({ ur: App().fmtMoney(n, 'ur'), en: App().fmtMoney(n, 'en') });
  const reply = (msg, buttons, card) => ({ msg, buttons: buttons || [], card: card || null });

  const BTN = {
    pay: B('بل ادا کریں', 'Pay a bill', 'cmd:intent:pay_bill'),
    send: B('رقم بھیجیں', 'Send money', 'cmd:intent:transfer_money'),
    sendPaise: B('پیسے بھیجیں', 'Send money', 'cmd:intent:transfer_money'),
    balance: B('بیلنس دیکھیں', 'Check balance', 'cmd:intent:check_balance'),
    history: B('لین دین دیکھیں', 'See transactions', 'cmd:intent:transaction_history'),
    help: B('مدد', 'Help', 'cmd:intent:help'),
    back: B('واپس جائیں', 'Go back', 'cmd:back'),
    cancel: B('منسوخ کریں', 'Cancel', 'cmd:cancel'),
    restart: B('نئے سرے سے شروع کریں', 'Start again', 'cmd:restart'),
    dashboard: LINK('مرکزی صفحہ', 'Main page', 'dashboard.html'),
    helpPage: LINK('مدد کا صفحہ', 'Help page', 'help.html')
  };
  const MAIN = [BTN.pay, BTN.send, BTN.balance, BTN.history, BTN.help];

  /* ====================================================================== */
  /* normalization                                                           */
  /* ====================================================================== */
  function normalize(s) {
    s = String(s == null ? '' : s).toLowerCase();
    s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');       // Arabic/Urdu diacritics
    s = s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۃة]/g, 'ہ').replace(/ۂ/g, 'ہ');
    s = s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));   // ٠-٩
    s = s.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));   // ۰-۹
    s = s.replace(/[،۔؟!?,;:'"“”‘’()[\]{}]/g, ' ');
    s = s.replace(/(^|[^\d])\.|\.($|[^\d])/g, '$1 $2');            // keep decimal points between digits
    return s.replace(/\s+/g, ' ').trim();
  }

  function detectScript(text) {
    const ar = (String(text).match(/[\u0600-\u06FF]/g) || []).length;
    const la = (String(text).match(/[a-z]/gi) || []).length;
    if (!ar && !la) return 'none';
    if (ar && la) return ar >= la ? 'ur' : 'en';
    return ar ? 'ur' : 'en';
  }

  /* count keyword hits. 'word*' = prefix, 'two words' = phrase, otherwise exact token */
  function hits(ctx, list) {
    let n = 0;
    for (const w of list) {
      if (w.endsWith('*')) { const p = w.slice(0, -1); if (ctx.tokens.some((t) => t.startsWith(p))) n++; }
      else if (w.includes(' ')) { if ((' ' + ctx.norm + ' ').includes(' ' + w + ' ')) n++; }
      else if (ctx.tokens.includes(w)) n++;
    }
    return n;
  }
  const mk = (text) => { const norm = normalize(text); return { norm, tokens: norm ? norm.split(' ') : [] }; };

  /* ====================================================================== */
  /* vocabularies                                                            */
  /* ====================================================================== */
  const CATEGORY_WORDS = {
    electricity: ['bijli', 'bijlee', 'بجلی', 'electricity', 'electric', 'light', 'wapda', 'bijli ka'],
    gas: ['gas', 'گیس', 'sui'],
    water: ['pani', 'paani', 'پانی', 'water'],
    internet: ['internet', 'انٹرنیٹ', 'انٹر نیٹ', 'wifi', 'wi-fi', 'وائی فائی', 'broadband', 'net', 'انٹرنیٹ']
  };
  const RECIPIENT_WORDS = {
    ahmed: ['ahmed', 'ahmad', 'احمد', 'beta', 'بیٹا', 'بیٹے', 'son'],
    fatima: ['fatima', 'fatimah', 'فاطمہ', 'behan', 'bahan', 'بہن', 'sister'],
    bilal: ['bilal', 'بلال', 'dukan', 'dukaan', 'دکان', 'دکاندار', 'store', 'shop', 'shopkeeper', 'grocer', 'سٹور'],
    ayesha: ['ayesha', 'aisha', 'ayeshah', 'عائشہ', 'عایشہ', 'پڑوسی', 'padosi', 'neighbour', 'neighbor']
  };
  const YES = ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'confirm', 'correct', 'right', 'haan', 'han', 'ha', 'ji', 'جی', 'ہاں', 'ٹھیک', 'theek', 'thik', 'sahi', 'صحیح', 'bilkul', 'بالکل', 'اچھا', 'acha'];
  const NO = ['no', 'nope', 'nahi', 'nahin', 'nai', 'نہیں', 'نہ', 'na', 'galat', 'غلط', 'different', 'other', 'دوسرا', 'aur', 'اور', 'کوئی اور', 'koi aur'];
  const FULL = ['full', 'pura', 'poora', 'poori', 'پورا', 'پوری', 'saara', 'sara', 'سارا', 'all'];
  const CHANGE = ['change', 'edit', 'badlo', 'badal*', 'بدل*', 'تبدیل*', 'tabdeel*'];

  const AMOUNT_MULT = { k: 1000, thousand: 1000, hazar: 1000, hazaar: 1000, hajar: 1000, 'ہزار': 1000, lakh: 100000, lac: 100000, 'لاکھ': 100000, sau: 100, 'سو': 100, hundred: 100 };
  const AMOUNT_WORDS = {
    ek: 1, 'ایک': 1, one: 1, do: 2, 'دو': 2, two: 2, teen: 3, 'تین': 3, three: 3, char: 4, 'چار': 4, four: 4,
    panch: 5, paanch: 5, 'پانچ': 5, five: 5, chhe: 6, che: 6, 'چھ': 6, six: 6, saat: 7, 'سات': 7, seven: 7,
    aath: 8, 'آٹھ': 8, eight: 8, nau: 9, 'نو': 9, nine: 9, das: 10, 'دس': 10, ten: 10,
    bees: 20, 'بیس': 20, twenty: 20, tees: 30, 'تیس': 30, thirty: 30, chalees: 40, 'چالیس': 40, forty: 40,
    pachas: 50, 'پچاس': 50, fifty: 50
  };
  const FILLER = ['rs', 'rupees', 'rupay', 'rupaye', 'روپے', 'روپیہ', 'روپئے', 'rupee'];

  const OFFTOPIC = ['weather', 'mausam', 'موسم', 'joke', 'لطیفہ', 'cricket', 'کرکٹ', 'match', 'movie', 'فلم', 'song', 'gana', 'گانا', 'news', 'khabar', 'خبر', 'خبریں', 'recipe', 'football', 'politics', 'سیاست', 'time', 'وقت'];

  /* ---------- amount parsing: digits, "5 hazar", "پانچ ہزار", "2k", "-500" ---------- */
  const isNumTok = (t) => /^-?\d+(\.\d+)?k?$/.test(t) || AMOUNT_MULT[t] !== undefined || AMOUNT_WORDS[t] !== undefined || t === 'minus' || t === 'منفی';
  function parseAmount(ctx, allowBareWords) {
    const toks = ctx.tokens.filter((t) => !FILLER.includes(t));
    // a bare number word ("do", "ek", "five") counts only when the whole reply is just a number,
    // or when it is followed by a multiplier ("do hazar"); this avoids reading "kar do" as 2.
    const onlyNumbers = toks.length > 0 && toks.every(isNumTok);
    let total = 0, current = null, found = false, negative = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === 'minus' || t === 'منفی') { negative = true; continue; }
      const m = t.match(/^(-?)(\d+(?:\.\d+)?)(k)?$/);
      if (m) {
        if (m[1]) negative = true;
        current = parseFloat(m[2]) * (m[3] ? 1000 : 1); found = true; continue;
      }
      if (AMOUNT_MULT[t] !== undefined && t !== 'k') {
        total += (current === null ? 1 : current) * AMOUNT_MULT[t];
        current = null; found = true; continue;
      }
      if (AMOUNT_WORDS[t] !== undefined) {
        const next = toks[i + 1];
        if ((allowBareWords && onlyNumbers) || (next && AMOUNT_MULT[next] !== undefined)) { current = AMOUNT_WORDS[t]; found = true; }
      }
    }
    if (!found) return null;
    total += current === null ? 0 : current;
    return { value: negative ? -total : total };
  }

  function parseCategories(ctx) { return Object.keys(CATEGORY_WORDS).filter((k) => hits(ctx, CATEGORY_WORDS[k]) > 0); }
  function parseRecipients(ctx) { return Object.keys(RECIPIENT_WORDS).filter((k) => hits(ctx, RECIPIENT_WORDS[k]) > 0); }
  const isYes = (ctx) => hits(ctx, YES) > 0 && hits(ctx, NO) === 0;
  const isNo = (ctx) => hits(ctx, NO) > 0;
  function parseRef(ctx) {
    const m = ctx.norm.match(/\d[\d\s-]*\d/);
    if (!m) return null;
    return m[0].replace(/[\s-]/g, '');
  }

  /* ====================================================================== */
  /* intent catalogue (also used by the tests and the report)                */
  /* ====================================================================== */
  const SCORE = {
    pay_bill: [
      { w: 3, k: ['bill', 'bills', 'bil', 'بل', 'بلز'] },
      { w: 2, k: ['pay', 'paying', 'payment', 'ادا*', 'ادائیگی', 'jama', 'bharna', 'bharni', 'bharo', 'بھرنا', 'بھرنی'] },
      { w: 2, k: [].concat(...Object.values(CATEGORY_WORDS)) }
    ],
    transfer_money: [
      { w: 3, k: ['send', 'transfer', 'transfer*', 'bhej*', 'bhij*', 'بھیج*', 'ٹرانسفر', 'sendmoney'] },
      { w: 1, k: ['money', 'paise', 'paisay', 'paisa', 'پیسے', 'پیسہ', 'رقم'] },
      { w: 3, k: [].concat(...Object.values(RECIPIENT_WORDS)) }
    ],
    check_balance: [
      { w: 4, k: ['balance', 'balence', 'بیلنس'] },
      { w: 3, k: ['kitne', 'kitna', 'kitni', 'کتنے', 'کتنا', 'کتنی', 'bacha*', 'باقی', 'how much'] },
      { w: 1, k: ['account', 'اکاؤنٹ', 'کھاتہ', 'کھاتے'] }
    ],
    transaction_history: [
      { w: 4, k: ['history', 'transaction*', 'ہسٹری', 'لین دین'] },
      { w: 3, k: ['statement', 'tareekh', 'تاریخ', 'kya kiya', 'pichl*', 'پچھل*'] },
      { w: 2, k: ['recent', 'record*', 'ریکارڈ', 'payments', 'ادائیگیاں', 'activity', 'kharch*', 'خرچ*'] }
    ],
    help: [
      { w: 4, k: ['help', 'madad', 'مدد', 'what can you do', 'رہنمائی', 'rehnumai'] },
      { w: 3, k: ['explain', 'how does', 'how do i', 'kya kar sakte', 'کیا کر سکتے'] },
      { w: 2, k: ['samajh*', 'سمجھ*', 'guide', 'sawal', 'سوال'] },
      { w: 1, k: ['kaise', 'کیسے'] }
    ]
  };
  const HUMAN = ['human', 'agent', 'insan*', 'انسان*', 'staff', 'representative', 'operator', 'kisi se baat', 'کسی سے بات', 'real person', 'call center'];
  const GREET = ['hello', 'hi', 'hey', 'salam', 'سلام', 'assalam*', 'السلام*', 'ہیلو', 'aoa'];
  const THANKS = ['shukriya', 'thanks', 'thank', 'شکریہ', 'meherbani', 'مہربانی'];

  const CANCEL = ['cancel', 'cancelled', 'abort', 'stop', 'nevermind', 'never mind', 'band*', 'بند*', 'mansookh*', 'منسوخ*', 'کینسل', 'ruk*', 'رک*', 'chor*', 'چھوڑ*', 'رہنے دیں', 'rehne do'];
  const RESTART = ['restart', 'reset', 'start again', 'start over', 'from the beginning', 'shuru se', 'dobara shuru', 'nai sire se', 'naye sire se', 'دوبارہ شروع', 'شروع سے', 'نئے سرے سے', 'نئے سرے', 'دوبارہ سے شروع'];
  const EXIT = ['exit', 'quit', 'bye', 'goodbye', 'alvida', 'الوداع', 'خدا حافظ', 'اللہ حافظ', 'khuda hafiz', 'allah hafiz', 'باہر نکلیں', 'باہر'];
  const BACK = ['back', 'undo', 'go back', 'wapis', 'واپس', 'پیچھے', 'peeche', 'pichay', 'pichla', 'پچھلا', 'one step back'];

  const INTENTS = {
    pay_bill: {
      purpose: 'Start a simulated bill payment (electricity, gas, water, internet).',
      examples: ['Pay my electricity bill', 'I want to pay the gas bill', 'مجھے بجلی کا بل ادا کرنا ہے', 'پانی کا بل جمع کرانا ہے', 'Mera bill pay karna hai', 'Internet ka bill bharna hai']
    },
    transfer_money: {
      purpose: 'Start a simulated transfer to a saved recipient.',
      examples: ['Send money to Ahmed', 'I want to transfer 2000 rupees', 'Paise bhejne hain', 'مجھے پیسے بھیجنے ہیں', 'احمد کو رقم بھیجیں', 'Fatima ko 1000 bhejo']
    },
    check_balance: {
      purpose: 'Show the fictional demo balance.',
      examples: ['How much money do I have?', 'Check my balance', 'میرا بیلنس بتائیں', 'میرے اکاؤنٹ میں کتنے پیسے ہیں', 'Balance batao', 'Kitne paise bache hain']
    },
    transaction_history: {
      purpose: 'Show recent fictional transactions.',
      examples: ['Show my recent transactions', 'Transaction history', 'میرا لین دین دکھائیں', 'پچھلی ادائیگیاں دکھائیں', 'Mera history dikhao', 'Statement dikhao']
    },
    help: {
      purpose: 'Explain what the assistant can do, or hand off to human help (simulated).',
      examples: ['Help me', 'What can you do?', 'مدد چاہیے', 'مجھے سمجھ نہیں آ رہا مدد کریں', 'Madad karo', 'I want to talk to a human']
    },
    cancel_or_restart: {
      purpose: 'Cancel the current task, start again, or exit.',
      examples: ['Cancel', 'Start again', 'منسوخ کریں', 'دوبارہ شروع کریں', 'Band karo', 'Exit']
    }
  };

  /* score the five content intents; cancel_or_restart is handled as a global command */
  function classify(ctx) {
    const order = ['pay_bill', 'transfer_money', 'check_balance', 'transaction_history', 'help'];
    let best = { intent: null, score: 0 };
    const scores = {};
    for (const name of order) {
      let sc = 0;
      for (const grp of SCORE[name]) if (hits(ctx, grp.k) > 0) sc += grp.w;
      scores[name] = sc;
      if (sc > best.score) best = { intent: name, score: sc };
    }
    const human = hits(ctx, HUMAN) > 0;
    if (human) { best = { intent: 'help', score: 9, human: true }; }
    best.scores = scores;
    return best;
  }

  function globalCommand(ctx) {
    if (hits(ctx, RESTART) > 0) return 'restart';
    if (hits(ctx, EXIT) > 0) return 'exit';
    if (hits(ctx, CANCEL) > 0) return 'cancel';
    if (hits(ctx, BACK) > 0) return 'back';
    return null;
  }

  /* ====================================================================== */
  /* dialogue context                                                        */
  /* ====================================================================== */
  function newCtx() { return { step: null, draft: {}, fails: 0, stack: [] }; }

  function snapshot(ctx) { return JSON.stringify({ step: ctx.step, draft: ctx.draft }); }
  function push(ctx) { ctx.stack.push(snapshot(ctx)); if (ctx.stack.length > 12) ctx.stack.shift(); }
  function go(ctx, step, patch) { push(ctx); ctx.step = step; if (patch) Object.assign(ctx.draft, patch); }
  function ok(ctx) { ctx.fails = 0; }

  /* ====================================================================== */
  /* replies                                                                 */
  /* ====================================================================== */
  function welcome() {
    return reply(T(
      'السلام علیکم! میں AwaazPay ہوں۔ میں آپ کی فرضی بل ادائیگی، رقم بھیجنے، بیلنس اور لین دین دیکھنے میں مدد کر سکتا ہوں۔ یاد رہے، یہ صرف ڈیمو ہے اور کوئی اصل رقم منتقل نہیں ہوتی۔ آپ کیا کرنا چاہتے ہیں؟',
      'Hello! I am AwaazPay. I can help you pay fictional bills, send money, and see your balance and transactions. Remember, this is only a demo and no real money moves. What would you like to do?'
    ), MAIN);
  }

  function categoryButtons() {
    return D.billerOrder.map((id) => B(D.billers[id].label.ur, D.billers[id].label.en, 'cmd:cat:' + id)).concat([BTN.back]);
  }
  function recipientButtons() {
    return D.recipients.map((r) => B(r.name.ur, r.name.en, 'cmd:rec:' + r.id)).concat([BTN.back]);
  }
  function amountButtons() {
    return [500, 1000, 2000, 5000].map((n) => B(M(n).ur, M(n).en, 'cmd:amt:' + n)).concat([BTN.back]);
  }

  function promptCategory() {
    return reply(T('آپ کون سا بل ادا کرنا چاہتے ہیں؟', 'Which bill would you like to pay?'), categoryButtons());
  }
  function promptRef(ctx) {
    const b = D.billers[ctx.draft.category];
    return reply(T(
      `ضرور! آئیے آپ کا ${b.label.ur} کا بل ادا کرنے کا طریقہ دیکھتے ہیں۔ کیا آپ کے پاس بل کا ریفرنس نمبر ہے؟ اسے بولیں یا لکھیں۔ ڈیمو کے لیے آپ فرضی نمبر ${b.ref} بھی استعمال کر سکتے ہیں۔`,
      `Sure! Let’s pay your ${b.label.en.toLowerCase()} bill. Do you have the reference number from the bill? Say it or type it. For this demo you can also use the fictional number ${b.ref}.`
    ), [B(`ڈیمو نمبر ${b.ref} استعمال کریں`, `Use demo number ${b.ref}`, 'cmd:ref_demo'), BTN.back]);
  }
  function promptBillAmount(ctx) {
    const b = D.billers[ctx.draft.category];
    if (ctx.draft.askAmount) {
      return reply(T('کتنی رقم ادا کرنی ہے؟ رقم بولیں یا لکھیں، مثلاً 1500۔', 'How much would you like to pay? Say or type the amount, for example 1500.'), [BTN.back]);
    }
    return reply(T(
      `بل مل گیا: ${b.name.ur}۔ واجب الادا رقم ${M(b.amount).ur} ہے اور آخری تاریخ ${b.due.ur} ہے۔ کیا آپ پوری رقم ادا کرنا چاہتے ہیں؟`,
      `Bill found: ${b.name.en}. The amount due is ${M(b.amount).en}, due on ${b.due.en}. Would you like to pay the full amount?`
    ), [B('جی، پوری رقم', 'Yes, full amount', 'cmd:amount_full'), B('کوئی اور رقم', 'A different amount', 'cmd:amount_other'), BTN.back]);
  }
  function promptRecipient() {
    return reply(T('ضرور! آپ رقم کسے بھیجنا چاہتے ہیں؟', 'Sure! Who would you like to send money to?'), recipientButtons());
  }
  function promptTrAmount(ctx) {
    const r = D.recipients.find((x) => x.id === ctx.draft.recipientId);
    return reply(T(
      `${r.name.ur} کو کتنی رقم بھیجنی ہے؟ رقم بولیں یا لکھیں، یا نیچے سے منتخب کریں۔`,
      `How much would you like to send to ${r.name.en}? Say or type the amount, or choose below.`
    ), amountButtons());
  }

  function summaryCard(p) {
    const d = Pay().describe(p);
    const rows = [
      { label: T('کام', 'Action'), value: d.kind === 'bill' ? T('بل کی ادائیگی', 'Bill payment') : T('رقم کی منتقلی', 'Money transfer') },
      { label: T('کس کو', 'To'), value: d.to },
      { label: T('ریفرنس نمبر', 'Reference'), value: T(d.ref, d.ref) },
      { label: T('رقم', 'Amount'), value: M(d.amount) }
    ];
    return { kind: 'summary', rows };
  }
  function promptReview(ctx) {
    const p = Pay().getPending();
    if (!p) return welcome();
    return reply(T(
      'براہِ کرم نیچے دی گئی تفصیل غور سے دیکھ لیں۔ ابھی کچھ ادا نہیں ہوا۔ آگے بڑھنے کے لیے تصدیقی صفحہ کھولیں، جہاں آخری بٹن آپ خود دبائیں گے۔',
      'Please check the details below. Nothing has been paid yet. To continue, open the confirmation page, where you press the final button yourself.'
    ), [LINK('تصدیقی صفحہ کھولیں', 'Open confirmation page', 'confirmation.html'), B('رقم بدلیں', 'Change amount', 'cmd:change'), BTN.cancel], summaryCard(p));
  }

  function prompt(ctx) {
    switch (ctx.step) {
      case 'bill_category': return promptCategory();
      case 'bill_ref': return promptRef(ctx);
      case 'bill_amount': return promptBillAmount(ctx);
      case 'tr_recipient': return promptRecipient();
      case 'tr_amount': return promptTrAmount(ctx);
      case 'review': return promptReview(ctx);
      default: return welcome();
    }
  }

  /* ---------- error / recovery replies (cases A–H) ---------- */
  function unrecognized() {      // Case A
    return reply(T(
      'معاف کیجیے، میں آپ کی بات سمجھ نہیں سکا۔ آپ بل ادا کر سکتے ہیں، پیسے بھیج سکتے ہیں، یا اپنا بیلنس دیکھ سکتے ہیں۔',
      'Sorry, I did not understand that. You can pay a bill, send money, or check your balance.'
    ), [BTN.pay, BTN.sendPaise, BTN.balance]);
  }
  function offTopic() {          // Case C
    return reply(T(
      'معاف کیجیے، میں اس بارے میں مدد نہیں کر سکتا۔ میں صرف بل ادا کرنے، رقم بھیجنے، بیلنس اور لین دین دیکھنے میں مدد کرتا ہوں۔',
      'Sorry, I cannot help with that. I only help with paying bills, sending money, and checking your balance and transactions.'
    ), [BTN.pay, BTN.send, BTN.balance, BTN.dashboard]);
  }
  function guided() {            // Case H
    return reply(T(
      'کوئی بات نہیں، آئیے اسے آسان بناتے ہیں۔ نیچے سے ایک چیز چنیں، یا مدد کا صفحہ کھولیں، یا نئے سرے سے شروع کریں۔',
      'No problem, let’s make it simpler. Choose one option below, open the help page, or start again.'
    ), [BTN.pay, BTN.sendPaise, BTN.balance, BTN.helpPage, BTN.restart]);
  }
  function inStepFail(ctx) {     // Cases D / E / H for steps that need information
    ctx.fails++;
    if (ctx.fails >= 2) { ctx.fails = 0; return [guided()]; }
    const p = prompt(ctx);
    return [reply(cat(T('معاف کیجیے، میں یہ سمجھ نہیں سکا۔ ', 'Sorry, I did not catch that. '), p.msg), p.buttons, p.card)];
  }
  function invalidValue(ctx, res, extraButtons) {   // Case E
    ctx.fails++;
    // A specific correction message is more useful than generic choices, so the guided
    // fallback (Case H) only appears on the third bad value in a row.
    if (ctx.fails >= 3) { ctx.fails = 0; return [guided()]; }
    return [reply(
      T(Pay().errorText(res, 'ur'), Pay().errorText(res, 'en')),
      extraButtons || [BTN.back]
    )];
  }

  /* ====================================================================== */
  /* flow actions                                                            */
  /* ====================================================================== */
  function resetTask(ctx) { ctx.step = null; ctx.draft = {}; ctx.stack = []; ctx.fails = 0; Pay().clearPending(); }

  function startBill(ctx, category) {
    resetTask(ctx);
    if (category) { go(ctx, 'bill_ref', { category }); return [promptRef(ctx)]; }
    go(ctx, 'bill_category');
    return [promptCategory()];
  }

  function startTransfer(ctx, recipientId, amountObj) {
    resetTask(ctx);
    if (recipientId) {
      ctx.draft.recipientId = recipientId;
      if (amountObj) {
        const v = Pay().validateAmountNumber(amountObj.value);
        if (v.ok) { ctx.draft.amount = v.value; return toReview(ctx, 'transfer'); }
        go(ctx, 'tr_amount');
        return invalidValue(ctx, v, amountButtons());
      }
      go(ctx, 'tr_amount');
      return [promptTrAmount(ctx)];
    }
    if (amountObj) {
      const v = Pay().validateAmountNumber(amountObj.value);
      if (v.ok) ctx.draft.amount = v.value;       // remember it; ask only for the missing recipient (Case D)
    }
    go(ctx, 'tr_recipient');
    return [promptRecipient()];
  }

  function toReview(ctx, kind) {
    const d = ctx.draft;
    const pending = kind === 'bill'
      ? { kind: 'bill', billerId: d.category, ref: d.ref, amount: d.amount, source: 'assistant' }
      : { kind: 'transfer', recipientId: d.recipientId, amount: d.amount, source: 'assistant' };
    Pay().setPending(pending);
    go(ctx, 'review', { kind });
    ok(ctx);
    return [promptReview(ctx)];
  }

  function acceptBillRef(ctx, ref) {
    const v = Pay().validateRef(ref, ctx.draft.category);
    if (!v.ok) {
      const demo = D.billers[ctx.draft.category];
      return invalidValue(ctx, v, [B(`ڈیمو نمبر ${demo.ref} استعمال کریں`, `Use demo number ${demo.ref}`, 'cmd:ref_demo'), BTN.back]);
    }
    ok(ctx);
    go(ctx, 'bill_amount', { ref: v.biller.ref, askAmount: false });
    return [promptBillAmount(ctx)];
  }

  function acceptBillAmount(ctx, n) {
    const v = Pay().validateAmountNumber(n);
    if (!v.ok) return invalidValue(ctx, v, [B('پوری رقم', 'Full amount', 'cmd:amount_full'), BTN.back]);
    ctx.draft.amount = v.value;
    return toReview(ctx, 'bill');
  }

  function acceptTrAmount(ctx, n) {
    const v = Pay().validateAmountNumber(n);
    if (!v.ok) return invalidValue(ctx, v, amountButtons());
    ctx.draft.amount = v.value;
    return toReview(ctx, 'transfer');
  }

  function doBack(ctx) {
    if (!ctx.stack.length) {
      const had = !!ctx.step;
      resetTask(ctx);
      return [reply(T(had ? 'ٹھیک ہے، ہم شروع میں واپس آ گئے ہیں۔ آپ کیا کرنا چاہتے ہیں؟' : 'ابھی پیچھے جانے کے لیے کچھ نہیں ہے۔ آپ کیا کرنا چاہتے ہیں؟',
        had ? 'OK, we are back at the start. What would you like to do?' : 'There is nothing to go back to yet. What would you like to do?'), MAIN)];
    }
    const prev = JSON.parse(ctx.stack.pop());
    ctx.step = prev.step; ctx.draft = prev.draft;
    Pay().clearPending();           // leaving the review step withdraws the pending action
    if (!ctx.step) return [reply(T('ٹھیک ہے، ایک قدم پیچھے آ گئے۔ آپ کیا کرنا چاہتے ہیں؟', 'OK, one step back. What would you like to do?'), MAIN)];
    const lead = T('ٹھیک ہے، ایک قدم پیچھے۔ ', 'OK, one step back. ');
    const p = prompt(ctx);
    return [reply(cat(lead, p.msg), p.buttons, p.card)];
  }

  function doCancel(ctx) {                                   // Case G
    const active = !!ctx.step || !!Pay().getPending();
    resetTask(ctx);
    return [reply(active
      ? T('ٹھیک ہے، میں نے یہ کام منسوخ کر دیا۔ کچھ نہیں بھیجا گیا اور کوئی رقم نہیں کٹی۔ اب آپ کیا کرنا چاہیں گے؟',
          'OK, I cancelled that. Nothing was sent and no money was taken. What would you like to do now?')
      : T('ابھی کوئی کام جاری نہیں تھا۔ آپ کیا کرنا چاہتے ہیں؟', 'There was no task in progress. What would you like to do?'), MAIN)];
  }

  function balanceReply() {
    const bal = App().getState().balance;
    return reply(T(
      `آپ کے ڈیمو کھاتے میں ${M(bal).ur} ہیں۔ یاد رہے، یہ فرضی رقم ہے اور کسی اصل بینک سے جڑی نہیں۔`,
      `Your demo account has ${M(bal).en}. Remember, this is fictional money and is not connected to any real bank.`
    ), [BTN.history, BTN.send, BTN.pay, BTN.dashboard]);
  }

  function historyReply() {
    const list = Pay().allTransactions().slice(0, 3);
    const line = (tx, l) => {
      const sign = tx.amount < 0 ? '−' : '+';
      const st = tx.status === 'failed' ? (l === 'ur' ? ' (مکمل نہیں ہوا)' : ' (not completed)') : '';
      return `• ${App().fmtDate(tx.date, l)} — ${tx.desc[l]} — ${sign}${App().fmtMoney(Math.abs(tx.amount), l)}${st}`;
    };
    return reply(T(
      'آپ کے تین تازہ ترین فرضی لین دین یہ ہیں:\n' + list.map((x) => line(x, 'ur')).join('\n'),
      'Your three most recent fictional transactions are:\n' + list.map((x) => line(x, 'en')).join('\n')
    ), [LINK('پوری فہرست دیکھیں', 'See the full list', 'transactions.html'), BTN.pay, BTN.send, BTN.balance]);
  }

  function helpReply(human) {
    if (human) {
      return reply(T(
        'ٹھیک ہے۔ انسانی مدد کی درخواست مدد کے صفحے پر کی جا سکتی ہے۔ یاد رہے، یہ صرف نقل ہے؛ کوئی حقیقی شخص رابطہ نہیں کرے گا۔',
        'OK. You can ask for human help on the help page. Remember, this is only a simulation; no real person will contact you.'
      ), [LINK('انسانی مدد کی درخواست (ڈیمو)', 'Request human help (demo)', 'help.html#human'), BTN.restart]);
    }
    return reply(T(
      'میں یہ کر سکتا ہوں: فرضی بل کی ادائیگی، فرضی افراد کو رقم بھیجنا، بیلنس بتانا اور لین دین دکھانا۔ آپ بول سکتے ہیں، لکھ سکتے ہیں یا بٹن دبا سکتے ہیں۔ ہر ادائیگی سے پہلے میں تفصیل دکھاتا ہوں اور آخری تصدیق آپ خود کرتے ہیں۔ یہ صرف ڈیمو ہے۔',
      'I can help with paying fictional bills, sending money to fictional contacts, telling you your balance and showing transactions. You can speak, type or press buttons. Before every payment I show the details and you make the final confirmation yourself. This is only a demo.'
    ), [BTN.pay, BTN.send, BTN.balance, BTN.helpPage, B('انسان سے مدد', 'Talk to a person', 'cmd:human')]);
  }

  function exitReply() {
    return reply(T('خدا حافظ! آپ جب چاہیں واپس آ سکتے ہیں۔', 'Goodbye! You can come back any time.'), [BTN.dashboard, BTN.restart]);
  }

  /* ====================================================================== */
  /* routing                                                                 */
  /* ====================================================================== */
  function resumeNote(ctx) {
    const p = prompt(ctx);
    return reply(cat(T('آپ کا پچھلا کام وہیں رکا ہوا ہے۔ ', 'Your earlier task is still waiting. '), p.msg), p.buttons, p.card);
  }

  function runIntent(ctx, c, name, human) {
    switch (name) {
      case 'pay_bill': {
        const cats = parseCategories(c);
        return startBill(ctx, cats.length === 1 ? cats[0] : null);
      }
      case 'transfer_money': {
        const rs = parseRecipients(c);
        const amt = parseAmount(c, false);
        return startTransfer(ctx, rs.length === 1 ? rs[0] : null, amt);
      }
      case 'check_balance': { const out = [balanceReply()]; if (ctx.step) out.push(resumeNote(ctx)); ok(ctx); return out; }
      case 'transaction_history': { const out = [historyReply()]; if (ctx.step) out.push(resumeNote(ctx)); ok(ctx); return out; }
      case 'help': { const out = [helpReply(human)]; if (ctx.step && !human) out.push(resumeNote(ctx)); ok(ctx); return out; }
      default: return [unrecognized()];
    }
  }

  /* step-specific parsing. Returns an array of replies, or null when the input does not fit the step. */
  function handleStep(ctx, c) {
    switch (ctx.step) {
      case 'bill_category': {
        const cats = parseCategories(c);
        if (cats.length === 1) { ok(ctx); go(ctx, 'bill_ref', { category: cats[0] }); return [promptRef(ctx)]; }
        if (cats.length > 1) { ctx.fails++; return [reply(T('آپ نے ایک سے زیادہ بل بتائے ہیں۔ پہلے کون سا بل ادا کرنا ہے؟', 'You mentioned more than one bill. Which one first?'), categoryButtons())]; }
        return null;
      }
      case 'bill_ref': {
        const ref = parseRef(c);
        if (ref) return acceptBillRef(ctx, ref);
        if (isNo(c)) return [reply(T('کوئی مسئلہ نہیں۔ ڈیمو کے لیے نیچے دیا گیا فرضی نمبر استعمال کریں۔', 'No problem. For the demo, use the fictional number below.'), promptRef(ctx).buttons)];
        if (isYes(c)) return [reply(T('بہت اچھا۔ براہِ کرم ریفرنس نمبر بولیں یا لکھیں۔', 'Great. Please say or type the reference number.'), promptRef(ctx).buttons)];
        return null;
      }
      case 'bill_amount': {
        const hasDigits = /\d/.test(c.norm);
        if (hits(c, FULL) > 0 && !hasDigits && !ctx.draft.askAmount) return acceptBillAmount(ctx, D.billers[ctx.draft.category].amount);
        if (isNo(c) && !hasDigits) { ctx.draft.askAmount = true; ok(ctx); return [promptBillAmount(ctx)]; }
        const amt = parseAmount(c, true);
        if (amt) return acceptBillAmount(ctx, amt.value);
        if (isYes(c)) {
          if (ctx.draft.askAmount) return [promptBillAmount(ctx)];
          return acceptBillAmount(ctx, D.billers[ctx.draft.category].amount);
        }
        return null;
      }
      case 'tr_recipient': {
        const rs = parseRecipients(c);
        if (rs.length === 1) {
          ok(ctx);
          const amt = parseAmount(c, false);
          go(ctx, 'tr_amount', { recipientId: rs[0] });
          if (amt) {
            const v = Pay().validateAmountNumber(amt.value);
            if (!v.ok) return invalidValue(ctx, v, amountButtons());
            ctx.draft.amount = v.value;
            return toReview(ctx, 'transfer');
          }
          if (ctx.draft.amount) return toReview(ctx, 'transfer');   // amount was given earlier
          return [promptTrAmount(ctx)];
        }
        if (rs.length > 1) { ctx.fails++; return [reply(T('آپ نے ایک سے زیادہ نام بتائے ہیں۔ پہلے کسے بھیجنا ہے؟', 'You mentioned more than one name. Who first?'), recipientButtons())]; }
        return null;
      }
      case 'tr_amount': {
        const amt = parseAmount(c, true);
        if (amt) return acceptTrAmount(ctx, amt.value);
        return null;
      }
      case 'review': {
        if (hits(c, CHANGE) > 0) return command(ctx, 'change');
        if (isYes(c)) {
          ok(ctx);
          return [reply(T('ٹھیک ہے۔ ادائیگی مکمل کرنے کے لیے تصدیقی صفحہ کھولیں اور وہاں آخری بٹن خود دبائیں۔ اسسٹنٹ آپ کی طرف سے یہ بٹن نہیں دباتا۔',
            'OK. To finish, open the confirmation page and press the final button yourself. The assistant never presses it for you.'),
            [LINK('تصدیقی صفحہ کھولیں', 'Open confirmation page', 'confirmation.html'), B('رقم بدلیں', 'Change amount', 'cmd:change'), BTN.cancel])];
        }
        if (isNo(c)) {
          ok(ctx);
          return [reply(T('کوئی بات نہیں۔ کیا آپ رقم بدلنا چاہتے ہیں یا یہ کام منسوخ کرنا چاہتے ہیں؟', 'No problem. Would you like to change the amount or cancel this task?'),
            [B('رقم بدلیں', 'Change amount', 'cmd:change'), BTN.cancel])];
        }
        return null;
      }
      default: return null;
    }
  }

  /* button / pseudo-commands: "cmd:..." */
  function command(ctx, cmd) {
    const [name, arg] = cmd.split(':');
    switch (name) {
      case 'intent':
        if (arg === 'pay_bill') return startBill(ctx, null);
        if (arg === 'transfer_money') return startTransfer(ctx, null, null);
        if (arg === 'check_balance') return runIntent(ctx, mk(''), 'check_balance');
        if (arg === 'transaction_history') return runIntent(ctx, mk(''), 'transaction_history');
        if (arg === 'help') return runIntent(ctx, mk(''), 'help');
        return [unrecognized()];
      case 'cat': if (D.billers[arg]) return startBill(ctx, arg); return [promptCategory()];
      case 'rec':
        if (!D.recipients.some((r) => r.id === arg)) return [promptRecipient()];
        if (ctx.step === 'tr_recipient') {                 // keep an amount given earlier (Case D)
          go(ctx, 'tr_amount', { recipientId: arg });
          if (ctx.draft.amount) return toReview(ctx, 'transfer');
          return [promptTrAmount(ctx)];
        }
        return startTransfer(ctx, arg, null);
      case 'ref_demo':
        if (!ctx.draft.category) return startBill(ctx, null);
        return acceptBillRef(ctx, D.billers[ctx.draft.category].ref);
      case 'amount_full':
        if (ctx.step !== 'bill_amount') return [prompt(ctx)];
        return acceptBillAmount(ctx, D.billers[ctx.draft.category].amount);
      case 'amount_other':
        if (ctx.step !== 'bill_amount') return [prompt(ctx)];
        ctx.draft.askAmount = true; ok(ctx); return [promptBillAmount(ctx)];
      case 'amt': {
        const n = parseInt(arg, 10);
        if (ctx.step === 'tr_amount') return acceptTrAmount(ctx, n);
        if (ctx.step === 'bill_amount') return acceptBillAmount(ctx, n);
        return [prompt(ctx)];
      }
      case 'change': {
        if (ctx.step !== 'review') return [prompt(ctx)];
        Pay().clearPending();
        if (ctx.stack.length) ctx.draft = JSON.parse(ctx.stack.pop()).draft;   // undo the review step
        delete ctx.draft.amount;
        if (ctx.draft.category) { ctx.step = 'bill_amount'; ctx.draft.askAmount = true; return [promptBillAmount(ctx)]; }
        ctx.step = 'tr_amount';
        return [promptTrAmount(ctx)];
      }
      case 'back': return doBack(ctx);
      case 'cancel': return doCancel(ctx);
      case 'human': return [helpReply(true)];
      case 'restart': resetTask(ctx); return { restart: true, replies: [welcome()] };
      default: return [unrecognized()];
    }
  }

  /* ---------- main entry ---------- */
  function respond(ctx, input) {
    const raw = String(input == null ? '' : input).trim();
    let out;
    if (!raw) {
      out = ctx.step ? [prompt(ctx)] : [welcome()];
    } else if (raw.indexOf('cmd:') === 0) {
      out = command(ctx, raw.slice(4));
    } else {
      const c = mk(raw);
      const g = globalCommand(c);
      if (g === 'restart') { resetTask(ctx); return { restart: true, replies: [welcome()] }; }
      if (g === 'exit') { resetTask(ctx); return { exit: true, replies: [exitReply()] }; }
      if (g === 'cancel') out = doCancel(ctx);
      else if (g === 'back') out = doBack(ctx);
      else {
        let stepRes = ctx.step ? handleStep(ctx, c) : null;
        if (stepRes) out = stepRes;
        else {
          const cl = classify(c);
          const strong = cl.intent && cl.score >= 2;
          if (ctx.step) {
            // input did not fit the step
            if (strong && (cl.intent === 'check_balance' || cl.intent === 'transaction_history' || cl.intent === 'help')) {
              out = runIntent(ctx, c, cl.intent, cl.human);
            } else if (strong && (cl.intent === 'pay_bill' || cl.intent === 'transfer_money') && cl.score >= 3) {
              out = runIntent(ctx, c, cl.intent);
            } else {
              out = inStepFail(ctx);
            }
          } else if (strong) {
            ok(ctx);
            out = runIntent(ctx, c, cl.intent, cl.human);
          } else if (hits(c, GREET) > 0) {
            ok(ctx); out = [welcome()];
          } else if (hits(c, THANKS) > 0) {
            ok(ctx); out = [reply(T('آپ کا شکریہ! کیا میں کچھ اور مدد کر سکتا ہوں؟', 'You are welcome! Can I help with anything else?'), MAIN)];
          } else if (hits(c, OFFTOPIC) > 0) {
            ctx.fails = 0; out = [offTopic()];
          } else {
            ctx.fails++;
            if (ctx.fails >= 2) { ctx.fails = 0; out = [guided()]; } else out = [unrecognized()];
          }
        }
      }
    }
    if (Array.isArray(out)) return { replies: out };
    return out;
  }

  global.Conversation = {
    INTENTS, newCtx, welcome, prompt, respond, classify, normalize, detectScript,
    parseAmount: (t, bare) => parseAmount(mk(t), bare), mk, globalCommand
  };
})(typeof window !== 'undefined' ? window : globalThis);
