/* AwaazPay — payments.js
 * SIMULATED payment logic only. Nothing leaves the browser; no real money, account or biller is involved.
 * Handles validation, the "pending" action that waits for confirmation, and the fictional receipt.
 */
(function (global) {
  'use strict';

  const D = global.DEMO;

  const Payments = {
    /* ---------- validation ---------- */

    /* Reference number for a given bill category. Returns {ok, key, params, biller}. */
    validateRef(raw, categoryId) {
      const ref = String(raw == null ? '' : raw).trim();
      if (!ref) return { ok: false, key: 'err.ref_empty' };
      if (!/^\d+$/.test(ref)) return { ok: false, key: 'err.ref_digits' };
      if (ref.length !== D.limits.refLength) return { ok: false, key: 'err.ref_length', params: { n: D.limits.refLength } };
      const biller = D.billerOrder.map((id) => D.billers[id]).find((b) => b.ref === ref);
      if (!biller) return { ok: false, key: 'err.ref_unknown' };
      if (categoryId && biller.id !== categoryId) {
        return { ok: false, key: 'err.ref_other', params: { label: D.billers[categoryId].label }, labelObj: D.billers[categoryId].label };
      }
      return { ok: true, biller };
    },

    /* Amount typed as text (digits only, whole rupees). Returns {ok, value, key, params}. */
    validateAmount(raw) {
      const s = String(raw == null ? '' : raw).trim().replace(/,/g, '');
      const balance = global.App.getState().balance;
      if (!s) return { ok: false, key: 'err.amount_empty' };
      if (/^-/.test(s)) return { ok: false, key: 'err.amount_min' };
      if (/^\d+\.\d+$/.test(s)) {
        // "1500.00" is acceptable; "1500.5" is not (whole rupees only in this demo)
        if (!/^\d+\.0+$/.test(s)) return { ok: false, key: 'err.amount_whole' };
      } else if (!/^\d+$/.test(s)) {
        return { ok: false, key: 'err.amount_nan' };
      }
      const value = Math.round(Number(s));
      if (!(value > 0)) return { ok: false, key: 'err.amount_min' };
      if (value > D.limits.maxAmount) return { ok: false, key: 'err.amount_max', params: { max: D.limits.maxAmount } };
      if (value > balance) return { ok: false, key: 'err.amount_balance', params: { balance } };
      return { ok: true, value };
    },

    /* Same check for a number that is already parsed (used by the assistant). */
    validateAmountNumber(n) {
      if (!Number.isFinite(n)) return { ok: false, key: 'err.amount_nan' };
      if (n <= 0) return { ok: false, key: 'err.amount_min' };
      if (!Number.isInteger(n)) return { ok: false, key: 'err.amount_whole' };
      return Payments.validateAmount(String(n));
    },

    /* Turn an error object into text in a given language, with money formatted. */
    errorText(res, lang) {
      const l = lang || global.App.lang;
      const p = Object.assign({}, res.params);
      if (res.labelObj) p.label = res.labelObj[l];
      if (p.balance !== undefined) p.balance = global.App.fmtMoney(p.balance, l);
      if (p.max !== undefined) p.max = global.App.fmtMoney(p.max, l);
      return global.App.t(res.key, p, l);
    },

    /* ---------- pending action (waits for the user's final confirmation) ---------- */
    setPending(p) { global.App.update((s) => { s.pending = p; }); return p; },
    getPending() { return global.App.getState().pending; },
    clearPending() { global.App.update((s) => { s.pending = null; }); },

    /* Human-readable description of a pending action, in both languages. */
    describe(p) {
      if (!p) return null;
      if (p.kind === 'bill') {
        const b = D.billers[p.billerId];
        return { kind: 'bill', to: b.name, ref: p.ref, amount: p.amount, category: b.label, icon: b.icon };
      }
      const r = D.recipients.find((x) => x.id === p.recipientId);
      return { kind: 'transfer', to: r.name, relation: r.relation, ref: r.account, amount: p.amount, icon: 'send' };
    },

    /* Cancel before commitment: nothing is recorded and no balance changes. */
    cancel() {
      global.App.update((s) => {
        s.pending = null;
        if (s.convo) { s.convo.ctx = null; }   // the assistant also forgets the half-finished task
      });
    },

    /* ---------- final confirmation -> fictional receipt ---------- */
    confirm() {
      const state = global.App.getState();
      const p = state.pending;
      if (!p) return null;                           // nothing to confirm (e.g. double click)
      const v = Payments.validateAmount(String(p.amount));
      if (!v.ok) return { error: v };                // balance may have changed since review
      const d = Payments.describe(p);
      const now = new Date();
      const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const receipt = {
        id: `DEMO-${ymd}-${code}`,
        kind: p.kind,
        to: d.to,
        ref: d.ref,
        amount: p.amount,
        whenISO: now.toISOString(),
        balanceAfter: state.balance - p.amount
      };
      global.App.update((s) => {
        s.balance = receipt.balanceAfter;
        s.lastReceipt = receipt;
        s.pending = null;
        if (s.convo) s.convo.ctx = null;
        s.transactions.unshift({
          id: receipt.id,
          date: now.toISOString().slice(0, 10),
          type: p.kind,
          amount: -p.amount,
          status: 'completed',
          isNew: true,
          desc: p.kind === 'bill'
            ? { ur: `${D.billers[p.billerId].label.ur} کا بل — ${d.to.ur}`, en: `${D.billers[p.billerId].label.en} bill — ${d.to.en}` }
            : { ur: `${d.to.ur} کو رقم بھیجی`, en: `Sent to ${d.to.en}` }
        });
      });
      return receipt;
    },

    /* All transactions, newest first: session ones first, then seed data. */
    allTransactions() {
      return global.App.getState().transactions.concat(D.transactions);
    }
  };

  global.Payments = Payments;
})(typeof window !== 'undefined' ? window : globalThis);
