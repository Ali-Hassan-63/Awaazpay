/* AwaazPay — pages.js
 * Page controllers for every page except the voice assistant (assistant-ui.js).
 * All behaviour is SIMULATED. Nothing is sent anywhere.
 */
(function (global) {
  'use strict';

  const doc = global.document;
  const $ = (id) => doc.getElementById(id);
  const D = global.DEMO;
  const A = () => global.App;
  const P = () => global.Payments;

  function showError(errEl, inputEl, msg) {
    errEl.textContent = msg;
    errEl.classList.add('show');
    if (inputEl) { inputEl.setAttribute('aria-invalid', 'true'); inputEl.focus(); }
  }
  function clearError(errEl, inputEl) {
    errEl.textContent = '';
    errEl.classList.remove('show');
    if (inputEl) inputEl.removeAttribute('aria-invalid');
  }
  function iconImg(name) { return A().icon(name); }

  /* "Cancel" links: clear any half-finished action before leaving. */
  function wireCancelLinks() {
    doc.querySelectorAll('[data-cancel]').forEach((a) => {
      a.addEventListener('click', () => { P().cancel(); });
    });
  }

  function updateStepper(current, total) {
    const items = doc.querySelectorAll('#stepper li');
    items.forEach((li, i) => {
      li.classList.toggle('done', i + 1 < current);
      if (i + 1 === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('stepCount').textContent = A().t('pb.step', { n: current, total });
  }

  /* ================================================================== */
  /* landing                                                             */
  /* ================================================================== */
  A().register('landing', function () {
    doc.querySelectorAll('[data-lang-choice]').forEach((b) => {
      b.addEventListener('click', () => A().setLang(b.dataset.langChoice));
    });
    global.Navigation.sync();
  });

  /* ================================================================== */
  /* dashboard (static content; nothing to wire)                         */
  /* ================================================================== */
  A().register('dashboard', function () {});

  /* ================================================================== */
  /* pay bill                                                            */
  /* ================================================================== */
  A().register('pay-bill', function () {
    const st = { step: 1, category: null, ref: '', found: false, mode: 'full', amount: null };

    // Returning from "Change details" on the confirmation page: restore what the user had entered.
    const pend = P().getPending();
    if (pend && pend.kind === 'bill' && pend.source === 'form') {
      st.category = pend.billerId; st.ref = pend.ref; st.found = true;
      st.mode = pend.amount === D.billers[pend.billerId].amount ? 'full' : 'other';
      st.amount = pend.amount; st.step = 3;
    }

    const total = 3;
    const els = {
      grid: $('categoryGrid'), catError: $('catError'), refInput: $('refInput'), refLabel: $('refLabel'),
      refHint: $('refHint'), refError: $('refError'), useDemo: $('useDemo'), billFound: $('billFound'),
      findBill: $('findBill'), step2Next: $('step2Next'), payFull: $('payFull'), payOther: $('payOther'),
      payFullText: $('payFullText'), otherWrap: $('otherWrap'), amountInput: $('amountInput'), amountError: $('amountError')
    };

    function renderCategories() {
      els.grid.innerHTML = D.billerOrder.map((id) => {
        const b = D.billers[id];
        return `<button type="button" class="choice" data-id="${id}" aria-pressed="${st.category === id}">
          <span class="badge-ic">${iconImg(b.icon)}</span>
          <span><span class="t">${A().escapeHTML(b.label[A().lang])}</span><span class="d">${A().escapeHTML(b.name[A().lang])}</span></span>
          <span class="tick" aria-hidden="true">✓</span></button>`;
      }).join('');
      els.grid.querySelectorAll('.choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (st.category !== btn.dataset.id) { st.ref = ''; st.found = false; }
          st.category = btn.dataset.id;
          clearError(els.catError);
          renderCategories();
        });
      });
    }

    function renderBillFound() {
      if (!st.found) { els.billFound.hidden = true; return; }
      const b = D.billers[st.category];
      const l = A().lang;
      els.billFound.hidden = false;
      els.billFound.innerHTML = `<span class="mark" aria-hidden="true">✓</span><span><strong>${A().t('pb.found')}</strong><br>
        ${A().t('pb.biller')}: ${A().escapeHTML(b.name[l])}<br>
        ${A().t('pb.ref')}: <span class="ltr">${b.ref}</span><br>
        ${A().t('pb.due')}: ${A().escapeHTML(b.due[l])}<br>
        ${A().t('pb.amount_due')}: ${A().moneyHTML(b.amount)}</span>`;
    }

    function render() {
      ['step1', 'step2', 'step3'].forEach((id, i) => { $(id).hidden = st.step !== i + 1; });
      updateStepper(st.step, total);
      renderCategories();
      if (st.category) {
        const b = D.billers[st.category];
        els.refLabel.textContent = A().t('pb.ref_label', { n: D.limits.refLength });
        els.refHint.textContent = '';
        els.useDemo.textContent = A().t('pb.ref_demo', { ref: b.ref });
        els.refInput.value = st.ref;
        els.payFullText.innerHTML = A().t('pb.pay_full', { amount: A().moneyHTML(b.amount) });
        renderBillFound();
        els.findBill.hidden = st.found;
        els.step2Next.hidden = !st.found;
      }
      els.payFull.setAttribute('aria-pressed', String(st.mode === 'full'));
      els.payOther.setAttribute('aria-pressed', String(st.mode === 'other'));
      els.otherWrap.hidden = st.mode !== 'other';
      if (st.mode === 'other' && st.amount != null && !els.amountInput.value) els.amountInput.value = st.amount;
    }

    function go(step) { st.step = step; render(); const h = $('step' + step).querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }

    $('step1Next').addEventListener('click', () => {
      if (!st.category) { showError(els.catError, null, A().t('err.biller')); return; }
      clearError(els.catError); go(2);
    });
    $('step2Back').addEventListener('click', () => go(1));

    function findBill() {
      st.ref = els.refInput.value.replace(/[\s-]/g, '');
      const res = P().validateRef(st.ref, st.category);
      if (!res.ok) { st.found = false; showError(els.refError, els.refInput, P().errorText(res)); render(); els.refInput.focus(); return false; }
      clearError(els.refError, els.refInput);
      st.found = true; render(); els.step2Next.focus();
      A().announce(A().t('pb.found'));
      return true;
    }
    els.findBill.addEventListener('click', findBill);
    els.refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findBill(); } });
    els.refInput.addEventListener('input', () => { if (st.found) { st.found = false; render(); } clearError(els.refError, els.refInput); });
    els.useDemo.addEventListener('click', () => { els.refInput.value = D.billers[st.category].ref; findBill(); });
    $('step2Next').addEventListener('click', () => go(3));
    $('step3Back').addEventListener('click', () => go(2));

    els.payFull.addEventListener('click', () => { st.mode = 'full'; clearError(els.amountError, els.amountInput); render(); });
    els.payOther.addEventListener('click', () => { st.mode = 'other'; render(); els.amountInput.focus(); });

    $('step3Next').addEventListener('click', () => {
      const b = D.billers[st.category];
      let amount;
      if (st.mode === 'full') {
        const v = P().validateAmount(String(b.amount));
        if (!v.ok) { showError(els.amountError, null, P().errorText(v)); return; }
        amount = v.value;
      } else {
        const v = P().validateAmount(els.amountInput.value);
        if (!v.ok) { showError(els.amountError, els.amountInput, P().errorText(v)); return; }
        amount = v.value;
      }
      P().setPending({ kind: 'bill', billerId: st.category, ref: b.ref, amount, source: 'form' });
      global.location.href = 'confirmation.html';
    });

    wireCancelLinks();
    A().onLang(() => { render(); });
    render();
  });

  /* ================================================================== */
  /* transfer money                                                      */
  /* ================================================================== */
  A().register('transfer-money', function () {
    const st = { step: 1, recipientId: null, amount: '' };
    const pend = P().getPending();
    if (pend && pend.kind === 'transfer' && pend.source === 'form') {
      st.recipientId = pend.recipientId; st.amount = String(pend.amount); st.step = 2;
    }
    const total = 2;
    const presets = [500, 1000, 2000, 5000];

    function stepCount() {
      doc.querySelectorAll('#stepper li').forEach((li, i) => {
        li.classList.toggle('done', i + 1 < st.step);
        if (i + 1 === st.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      $('stepCount').textContent = A().t('pb.step', { n: st.step, total });
    }

    function renderRecipients() {
      $('recipientGrid').innerHTML = D.recipients.map((r) => `
        <button type="button" class="choice" data-id="${r.id}" aria-pressed="${st.recipientId === r.id}">
          <span class="badge-ic">${iconImg('send')}</span>
          <span><span class="t">${A().escapeHTML(r.name[A().lang])}</span><span class="d">${A().escapeHTML(r.relation[A().lang])}</span></span>
          <span class="tick" aria-hidden="true">✓</span></button>`).join('');
      $('recipientGrid').querySelectorAll('.choice').forEach((b) => {
        b.addEventListener('click', () => { st.recipientId = b.dataset.id; clearError($('recError')); renderRecipients(); });
      });
    }

    function renderStep2() {
      const r = D.recipients.find((x) => x.id === st.recipientId);
      if (r) $('toWho').textContent = `${A().t('tm.sending_to')}: ${r.name[A().lang]} (${r.relation[A().lang]})`;
      $('presetChips').innerHTML = presets.map((n) =>
        `<button type="button" class="chip" data-n="${n}" aria-pressed="${st.amount === String(n)}"><bdi class="num">${A().fmtMoney(n)}</bdi></button>`).join('');
      $('presetChips').querySelectorAll('.chip').forEach((c) => {
        c.addEventListener('click', () => {
          st.amount = c.dataset.n; $('amountInput').value = st.amount; clearError($('amountError'), $('amountInput')); renderStep2();
        });
      });
    }

    function render() {
      $('step1').hidden = st.step !== 1;
      $('step2').hidden = st.step !== 2;
      stepCount(); renderRecipients();
      if (st.recipientId) renderStep2();
      $('amountInput').value = st.amount;
    }
    function go(n) { st.step = n; render(); const h = $('step' + n).querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus(); }

    $('step1Next').addEventListener('click', () => {
      if (!st.recipientId) { showError($('recError'), null, A().t('err.recipient')); return; }
      clearError($('recError')); go(2);
    });
    $('step2Back').addEventListener('click', () => go(1));
    $('amountInput').addEventListener('input', (e) => { st.amount = e.target.value.trim(); clearError($('amountError'), $('amountInput')); renderStep2(); });
    $('amountInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('step2Next').click(); } });
    $('step2Next').addEventListener('click', () => {
      const v = P().validateAmount($('amountInput').value);
      if (!v.ok) { showError($('amountError'), $('amountInput'), P().errorText(v)); return; }
      P().setPending({ kind: 'transfer', recipientId: st.recipientId, amount: v.value, source: 'form' });
      global.location.href = 'confirmation.html';
    });

    wireCancelLinks();
    A().onLang(render);
    render();
  });

  /* ================================================================== */
  /* confirmation                                                        */
  /* ================================================================== */
  A().register('confirmation', function () {
    let cancelled = new URLSearchParams(global.location.search).get('status') === 'cancelled';
    let busy = false;

    function show(which) {
      $('stateReview').hidden = which !== 'review';
      $('stateCancelled').hidden = which !== 'cancelled';
      $('stateEmpty').hidden = which !== 'empty';
    }

    function render() {
      const p = P().getPending();
      if (cancelled) { show('cancelled'); return; }
      if (!p) { show('empty'); return; }
      const d = P().describe(p);
      const l = A().lang;
      const bal = A().getState().balance;
      const rows = [
        [A().t('cf.type'), d.kind === 'bill' ? A().t('cf.type_bill') : A().t('cf.type_transfer')],
        [A().t('cf.to'), A().escapeHTML(d.to[l]) + (d.relation ? ` (${A().escapeHTML(d.relation[l])})` : '')],
        [A().t('cf.ref'), `<span class="ltr">${A().escapeHTML(d.ref)}</span>`],
        [A().t('cf.amount'), A().moneyHTML(d.amount), 'big'],
        [A().t('cf.balance_after'), A().moneyHTML(bal - d.amount)]
      ];
      $('summary').innerHTML = rows.map((r) => `<div class="${r[2] || ''}"><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('');
      $('changeBtn').href = p.source === 'assistant' ? 'voice-assistant.html' : (p.kind === 'bill' ? 'pay-bill.html' : 'transfer-money.html');
      show('review');
    }

    $('confirmBtn').addEventListener('click', (ev) => {
      if (!ev.isTrusted || busy) return;          // only a real user click can confirm; ignore scripted clicks and double clicks
      busy = true;
      $('confirmBtn').disabled = true;
      A().announce(A().t('cf.processing'));
      const r = P().confirm();
      if (!r) { busy = false; render(); return; }
      if (r.error) {
        busy = false; $('confirmBtn').disabled = false;
        $('confirmError').textContent = P().errorText(r.error); $('confirmError').classList.add('show');
        return;
      }
      global.location.href = 'receipt.html';
    });
    $('cancelBtn').addEventListener('click', () => {
      P().cancel(); cancelled = true; render();
      const h = $('stateCancelled').querySelector('h1'); h.setAttribute('tabindex', '-1'); h.focus();
    });

    A().onLang(render);
    render();
  });

  /* ================================================================== */
  /* receipt                                                             */
  /* ================================================================== */
  A().register('receipt', function () {
    function render() {
      const r = A().getState().lastReceipt;
      $('receiptBox').hidden = !r;
      $('receiptEmpty').hidden = !!r;
      if (!r) return;
      const l = A().lang;
      const when = new Date(r.whenISO);
      const rows = [
        [A().t('rc.ref'), `<span class="ltr">${A().escapeHTML(r.id)}</span>`],
        [A().t('cf.type'), r.kind === 'bill' ? A().t('cf.type_bill') : A().t('cf.type_transfer')],
        [A().t('cf.to'), A().escapeHTML(r.to[l])],
        [A().t('cf.ref'), `<span class="ltr">${A().escapeHTML(r.ref)}</span>`],
        [A().t('cf.amount'), A().moneyHTML(r.amount), 'big'],
        [A().t('rc.date'), `<bdi class="num">${A().fmtDateTime(when)}</bdi>`],
        [A().t('rc.status'), `<span class="badge badge-ok">${A().t('rc.status_ok')}</span>`],
        [A().t('rc.balance_new'), A().moneyHTML(r.balanceAfter)]
      ];
      $('receiptList').innerHTML = rows.map((x) => `<div class="${x[2] || ''}"><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`).join('');
    }
    $('printBtn').addEventListener('click', () => global.print());
    A().onLang(render);
    render();
  });

  /* ================================================================== */
  /* balance                                                             */
  /* ================================================================== */
  A().register('balance', function () {
    function render() {
      const s = A().getState();
      $('balanceValue').innerHTML = A().moneyHTML(s.balance);
      $('acctNo').textContent = D.account.number;
    }
    $('readBalance').addEventListener('click', () => {
      const text = A().t('bl.spoken', { amount: A().fmtMoney(A().getState().balance) });
      const spoken = global.Speech.speak(text, A().lang, {});
      if (!spoken) A().toast(A().t('bl.no_voice'));
    });
    A().onLang(() => { global.Speech.cancelSpeech(); render(); });
    render();
  });

  /* ================================================================== */
  /* transactions                                                        */
  /* ================================================================== */
  A().register('transactions', function () {
    function render() {
      const l = A().lang;
      const list = P().allTransactions().slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      const groups = {};
      list.forEach((tx) => { const k = tx.date.slice(0, 7); (groups[k] = groups[k] || []).push(tx); });
      $('txHost').innerHTML = Object.keys(groups).sort().reverse().map((k) => `
        <section class="tx-group" aria-label="${A().escapeHTML(A().fmtMonth(k + '-01'))}">
          <h2>${A().escapeHTML(A().fmtMonth(k + '-01'))}</h2>
          <ul class="tx-list">${groups[k].map((tx) => {
            const out = tx.amount < 0;
            const failed = tx.status === 'failed';
            return `<li class="tx ${out ? 'out' : 'in'}">
              <span class="arrow" aria-hidden="true">${out ? '↑' : '↓'}</span>
              <span><span class="what">${A().escapeHTML(tx.desc[l])}</span>
                <span class="when"><bdi class="num">${A().fmtDate(tx.date)}</bdi>
                  <span class="badge ${failed ? 'badge-fail' : 'badge-ok'}">${A().t(failed ? 'tx.failed' : 'tx.completed')}</span>
                  <span class="badge badge-demo">${A().t('tx.demo_tag')}</span>
                  ${tx.isNew ? `<span class="badge badge-new">${A().t('tx.new_tag')}</span>` : ''}</span></span>
              <span class="amt"><bdi class="num">${out ? '−' : '+'}${A().fmtMoney(Math.abs(tx.amount))}</bdi><small>${A().t(out ? 'tx.out' : 'tx.in')}</small></span>
            </li>`;
          }).join('')}</ul></section>`).join('');
    }
    A().onLang(render);
    render();
  });

  /* ================================================================== */
  /* help                                                                */
  /* ================================================================== */
  A().register('help', function () {
    let checked = false;
    function renderCheck() {
      if (!checked) return;
      const S = global.Speech;
      const mark = (v) => `<strong>${A().t(v ? 'hp.yes' : 'hp.no')}</strong>`;
      $('chkRec').innerHTML = mark(S.supportsRecognition);
      $('chkSyn').innerHTML = mark(S.supportsSynthesis);
      $('chkUr').innerHTML = mark(S.hasVoiceFor('ur'));
      $('checkTable').hidden = false;
    }
    $('runCheck').addEventListener('click', () => { checked = true; renderCheck(); });

    $('humanForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const topic = $('topic'), channel = $('channel');
      if (!topic.value || !channel.value) {
        showError($('humanError'), topic.value ? channel : topic, A().t('hp.human_choose'));
        return;
      }
      clearError($('humanError'));
      A().update((s) => { s.helpRequests = (s.helpRequests || 0) + 1; });   // counter only; no personal data collected
      $('humanDone').hidden = false;
      $('humanDone').focus();
    });

    if (global.location.hash === '#human') {
      const h = $('human'); h.scrollIntoView(); h.focus();
    }
    A().onLang(renderCheck);
  });
})(window);
