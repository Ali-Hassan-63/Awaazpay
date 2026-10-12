// Loads the REAL project scripts into jsdom and exercises the conversation engine.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function load() {
  const dom = new JSDOM('<!DOCTYPE html><html><body data-page="test"></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  for (const f of ['demo-data', 'i18n', 'app', 'navigation', 'speech', 'payments', 'conversation']) {
    w.eval(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'));
  }
  return w;
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, info) {
  if (cond) pass++; else { fail++; failures.push(name + (info ? '  -> ' + info : '')); }
}

const w = load();
const C = w.Conversation;
const P = w.Payments;
const A = w.App;
A.lang = 'en';

function fresh() { A.resetState(); return C.newCtx(); }
function say(ctx, text) {
  const r = C.respond(ctx, text);
  return r;
}
const lastText = (r, l = 'en') => r.replies.map((x) => x.msg[l]).join(' | ');
const hasBtn = (r, pred) => r.replies.some((x) => x.buttons.some(pred));

/* ---------- 1. every example utterance of every intent ---------- */
const expectIntent = {
  pay_bill: (r, ctx) => ['bill_category', 'bill_ref'].includes(ctx.step),
  transfer_money: (r, ctx) => ['tr_recipient', 'tr_amount', 'review'].includes(ctx.step),
  check_balance: (r) => /demo account has|ڈیمو کھاتے/.test(lastText(r)),
  transaction_history: (r) => /recent fictional transactions/.test(lastText(r)),
  help: (r) => /I can help with|human help/.test(lastText(r)),
  cancel_or_restart: (r) => r.restart || r.exit || /cancelled|no task in progress|Goodbye/.test(lastText(r))
};
for (const [intent, def] of Object.entries(C.INTENTS)) {
  check(`${intent}: has >= 4 examples`, def.examples.length >= 4, def.examples.length);
  for (const ex of def.examples) {
    const ctx = fresh();
    if (intent === 'cancel_or_restart') say(ctx, 'pay electricity bill'); // give cancel something to cancel
    const r = say(ctx, ex);
    check(`intent ${intent} <- "${ex}"`, expectIntent[intent](r, ctx), lastText(r).slice(0, 90) + ' step=' + ctx.step);
  }
}

/* ---------- 2. spec example expressions ---------- */
{
  let ctx = fresh();
  let r = say(ctx, 'مجھے بجلی کا بل ادا کرنا ہے');
  check('Urdu electricity -> bill_ref step with electricity', ctx.step === 'bill_ref' && ctx.draft.category === 'electricity');
  check('Urdu reply is in Urdu', /ریفرنس نمبر/.test(lastText(r, 'ur')));
  ctx = fresh(); r = say(ctx, 'Mera bill pay karna hai');
  check('Roman Urdu "Mera bill pay karna hai" -> asks category (Case B)', ctx.step === 'bill_category');
  ctx = fresh(); r = say(ctx, 'Paise bhejne hain');
  check('"Paise bhejne hain" -> asks recipient', ctx.step === 'tr_recipient');
  ctx = fresh(); r = say(ctx, 'How much money do I have?');
  check('"How much money do I have?" -> balance', /48,500/.test(lastText(r)));
  ctx = fresh(); r = say(ctx, 'میرا بیلنس بتائیں');
  check('Urdu balance', /48,500/.test(lastText(r)));
}

/* ---------- 3. error cases ---------- */
{
  // A: unrecognized
  let ctx = fresh(); let r = say(ctx, 'blorp zzz qq');
  check('Case A unrecognized -> 3 quick buttons', r.replies[0].buttons.length === 3 && /did not understand/.test(lastText(r)));
  // H: repeated misunderstanding -> guided choices
  r = say(ctx, 'asdf qwer');
  check('Case H after 2 fails -> guided + help page + restart', /simpler/.test(lastText(r)) && hasBtn(r, (b) => b.href === 'help.html') && hasBtn(r, (b) => b.value === 'cmd:restart'));
  // B: ambiguous
  ctx = fresh(); r = say(ctx, 'I need to pay');
  check('Case B ambiguous "I need to pay" -> four bill options', ctx.step === 'bill_category' && r.replies[0].buttons.filter((b) => /cmd:cat:/.test(b.value)).length === 4);
  // C: off-topic
  ctx = fresh(); r = say(ctx, "what's the weather today");
  check('Case C off-topic -> polite + dashboard route', /cannot help with that/.test(lastText(r)) && hasBtn(r, (b) => b.href === 'dashboard.html'));
  // D: missing info keeps what was given
  ctx = fresh(); say(ctx, 'send 2000 rupees');
  check('Case D amount remembered, recipient requested', ctx.step === 'tr_recipient' && ctx.draft.amount === 2000);
  r = say(ctx, 'Ahmed');
  check('Case D then recipient -> straight to review with 2000', ctx.step === 'review' && P.getPending().amount === 2000 && P.getPending().recipientId === 'ahmed');
  // E: invalid amount / reference
  ctx = fresh(); say(ctx, 'send money to Fatima'); r = say(ctx, '-500');
  check('Case E negative amount rejected', /more than zero/.test(lastText(r)) && ctx.step === 'tr_amount');
  r = say(ctx, '999999');
  check('Case E over limit', /most allowed|not enough/.test(lastText(r)));
  r = say(ctx, 'abc');
  check('Case E third bad value in a row -> guided choices (Case H)', /simpler/.test(lastText(r)));
  ctx = fresh(); say(ctx, 'pay gas bill'); r = say(ctx, '123');
  check('Case E short reference', /8 digits/.test(lastText(r)));
  ctx = fresh(); say(ctx, 'pay gas bill'); r = say(ctx, '10010001');
  check('Case E reference of another bill type', /different bill type/.test(lastText(r)));
  // G: cancel
  ctx = fresh(); say(ctx, 'pay electricity bill'); say(ctx, 'cmd:ref_demo'); say(ctx, 'cmd:amount_full');
  check('review reached with pending action', ctx.step === 'review' && !!P.getPending());
  r = say(ctx, 'cancel');
  check('Case G cancel clears pending + draft', P.getPending() === null && ctx.step === null && /Nothing was sent/.test(lastText(r)));
  check('cancel never changed the balance', A.getState().balance === 48500 && A.getState().transactions.length === 0);
}

/* ---------- 4. full happy paths ---------- */
{
  let ctx = fresh();
  say(ctx, 'Pay my electricity bill');
  let r = say(ctx, '10010001');
  check('bill ref accepted -> amount step', ctx.step === 'bill_amount');
  r = say(ctx, 'yes');
  check('full amount -> review', ctx.step === 'review' && P.getPending().amount === 3450 && P.getPending().billerId === 'electricity');
  r = say(ctx, 'haan');
  check('saying "yes" at review does NOT execute payment', A.getState().balance === 48500 && /press the final button yourself/.test(lastText(r)));
  const rec = P.confirm();
  check('confirm() produces DEMO receipt and updates balance', /^DEMO-\d{8}-[A-Z0-9]{6}$/.test(rec.id) && A.getState().balance === 48500 - 3450);
  check('confirm() cleared pending', P.getPending() === null);
  check('second confirm() is a no-op (no double payment)', P.confirm() === null && A.getState().balance === 45050);
  check('transaction recorded as new', A.getState().transactions.length === 1 && A.getState().transactions[0].amount === -3450);

  ctx = fresh();
  r = say(ctx, 'Fatima ko 1000 bhejo');
  check('"Fatima ko 1000 bhejo" -> review in one step', ctx.step === 'review' && P.getPending().recipientId === 'fatima' && P.getPending().amount === 1000);

  ctx = fresh(); say(ctx, 'send money'); say(ctx, 'Bilal'); r = say(ctx, 'پانچ ہزار');
  check('Urdu number words "پانچ ہزار" = 5000', ctx.step === 'review' && P.getPending().amount === 5000);
  ctx = fresh(); say(ctx, 'send money'); say(ctx, 'بلال'); r = say(ctx, '2k');
  check('"2k" = 2000', P.getPending() && P.getPending().amount === 2000);
  ctx = fresh(); say(ctx, 'send money'); say(ctx, 'ahmed'); r = say(ctx, '۱۵۰۰');
  check('Urdu digits ۱۵۰۰ = 1500', P.getPending() && P.getPending().amount === 1500);
  ctx = fresh(); say(ctx, 'send money'); say(ctx, 'ahmed'); r = say(ctx, 'do hazar rupay');
  check('Roman "do hazar rupay" = 2000', P.getPending() && P.getPending().amount === 2000);
  ctx = fresh(); say(ctx, 'pay gas bill'); say(ctx, 'cmd:ref_demo'); r = say(ctx, 'pura bill kar do');
  check('"pura bill kar do" is full amount, not 2', P.getPending() && P.getPending().amount === 1280);
  ctx = fresh(); say(ctx, 'pay water bill'); say(ctx, 'cmd:ref_demo'); say(ctx, 'no'); r = say(ctx, '300');
  check('partial bill amount 300', P.getPending() && P.getPending().amount === 300);
}

/* ---------- 5. undo / change / restart / mid-flow ---------- */
{
  let ctx = fresh();
  say(ctx, 'pay internet bill'); say(ctx, 'cmd:ref_demo'); say(ctx, 'cmd:amount_full');
  let r = say(ctx, 'cmd:change');
  check('Change at review -> amount step, pending withdrawn', ctx.step === 'bill_amount' && P.getPending() === null);
  r = say(ctx, '1000');
  check('new amount -> review again with 1000', ctx.step === 'review' && P.getPending().amount === 1000);
  r = say(ctx, 'back');
  check('Undo from review returns to amount step', ctx.step === 'bill_amount' && P.getPending() === null);
  r = say(ctx, 'wapis'); r = say(ctx, 'wapis');
  check('Repeated undo walks back to the start without error', ctx.step === null || ctx.step === 'bill_category');

  ctx = fresh(); say(ctx, 'pay gas bill');
  r = say(ctx, 'start again');
  check('Restart flag + welcome', r.restart === true && ctx.step === null);
  r = say(ctx, 'exit');
  check('Exit flag', r.exit === true);

  ctx = fresh(); say(ctx, 'send money to ahmed');
  r = say(ctx, "what's my balance");
  check('Balance during transfer answered AND task resumed', ctx.step === 'tr_amount' && /48,500/.test(lastText(r)) && /still waiting/.test(lastText(r)));
  r = say(ctx, 'pay electricity bill');
  check('Switching from transfer to bill replaces the task', ctx.step === 'bill_ref' && P.getPending() === null);
  ctx = fresh(); say(ctx, 'I want to talk to a human');
  r = say(ctx, 'I want to talk to a human');
  check('Human handoff -> help page anchor', hasBtn(r, (b) => b.href === 'help.html#human'));
}

/* ---------- 6. normalization + script detection ---------- */
check('normalize Arabic yeh/kaf', C.normalize('كيا') === 'کیا');
check('detectScript en', C.detectScript('pay bill') === 'en');
check('detectScript ur', C.detectScript('بجلی کا بل') === 'ur');
check('both languages present in every reply', (() => {
  const ctx = fresh();
  const all = [];
  for (const t of ['hello', 'pay bill', 'cmd:ref_demo', 'cmd:amount_full', 'help', 'history', 'balance', 'asdf', 'weather']) all.push(...say(ctx, t).replies);
  return all.every((x) => x.msg.ur && x.msg.en && x.buttons.every((b) => b.ur && b.en));
})());

/* ---------- 7. validators ---------- */
{
  fresh();
  check('amount "abc" invalid', P.validateAmount('abc').key === 'err.amount_nan');
  check('amount "" invalid', P.validateAmount('').key === 'err.amount_empty');
  check('amount "0" invalid', P.validateAmount('0').key === 'err.amount_min');
  check('amount "15.5" invalid', P.validateAmount('15.5').key === 'err.amount_whole');
  check('amount "1,500" ok', P.validateAmount('1,500').value === 1500);
  check('amount above balance invalid', P.validateAmount('60000').key === 'err.amount_balance');
  check('ref letters invalid', P.validateRef('ABC12345', 'gas').key === 'err.ref_digits');
  check('ref unknown 8 digits invalid', P.validateRef('99999999', 'gas').key === 'err.ref_unknown');
  check('ref demo valid', P.validateRef('20020002', 'gas').ok === true);
}

console.log(`\nEngine tests: ${pass} passed, ${fail} failed`);
failures.forEach((f) => console.log('  FAIL: ' + f));
process.exit(fail ? 1 : 0);
