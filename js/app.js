/* AwaazPay — app.js
 * Shared core: language handling, translation lookup, number/date formatting,
 * prototype state in localStorage (NOT secure storage), and page boot.
 * Everything here is demo-only; no network requests are made anywhere in this project.
 */
(function (global) {
  'use strict';

  const STATE_KEY = 'awaazpay_state_v1';
  const LANG_KEY = 'awaazpay_lang';

  /* ---------- storage with graceful fallback (private mode, blocked storage) ---------- */
  const mem = {};
  const store = {
    get(k) { try { return global.localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    remove(k) { try { global.localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };

  function freshState() {
    return {
      balance: global.DEMO.account.startBalance,
      transactions: [],     // only transactions created during this demo session
      pending: null,        // action waiting for confirmation
      lastReceipt: null,
      convo: null,          // assistant dialogue state + chat history
      helpRequests: 0
    };
  }

  const App = {
    lang: 'ur',
    _langListeners: [],
    _pages: {},

    /* ---------- state ---------- */
    getState() {
      let s = null;
      try { s = JSON.parse(store.get(STATE_KEY)); } catch (e) { s = null; }
      if (!s || typeof s !== 'object') s = freshState();
      return Object.assign(freshState(), s);
    },
    saveState(s) { store.set(STATE_KEY, JSON.stringify(s)); return s; },
    update(fn) { const s = App.getState(); fn(s); return App.saveState(s); },
    resetState() { store.remove(STATE_KEY); return App.saveState(freshState()); },

    /* ---------- language ---------- */
    getLang() {
      const l = store.get(LANG_KEY);
      return l === 'en' || l === 'ur' ? l : 'ur';
    },
    setLang(l) {
      if (l !== 'ur' && l !== 'en') return;
      App.lang = l;
      store.set(LANG_KEY, l);
      App.applyLangAttrs();
      App.applyI18n();
      if (global.Navigation) global.Navigation.sync();
      App._langListeners.forEach((fn) => { try { fn(l); } catch (e) { /* keep others running */ } });
    },
    onLang(fn) { App._langListeners.push(fn); },
    applyLangAttrs() {
      const d = global.document.documentElement;
      d.lang = App.lang;
      d.dir = App.lang === 'ur' ? 'rtl' : 'ltr';
    },

    /* ---------- translation ---------- */
    t(key, params, lang) {
      const entry = global.STRINGS[key];
      let s = entry ? entry[lang || App.lang] : key;
      if (s === undefined) s = key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, p) => (params[p] !== undefined ? params[p] : m));
      return s;
    },
    pick(obj, lang) { return obj[lang || App.lang]; },

    applyI18n(root) {
      const scope = root || global.document;
      scope.querySelectorAll('[data-i18n]').forEach((el) => {
        const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : null;
        el.textContent = App.t(el.dataset.i18n, params);
      });
      scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
        el.dataset.i18nAttr.split(';').forEach((pair) => {
          const [attr, key] = pair.split(':').map((x) => x.trim());
          if (attr && key) el.setAttribute(attr, App.t(key));
        });
      });
      const tk = global.document.body && global.document.body.dataset.title;
      if (tk) global.document.title = App.t(tk);
    },

    /* ---------- formatting ---------- */
    fmtNum(n) { return Number(n).toLocaleString('en-US'); },
    fmtMoney(n, lang) {
      const l = lang || App.lang;
      return l === 'ur' ? `${App.fmtNum(n)} روپے` : `Rs ${App.fmtNum(n)}`;
    },
    moneyHTML(n) { return `<bdi class="num">${App.fmtMoney(n)}</bdi>`; },
    fmtDate(iso, lang) {
      const l = lang || App.lang;
      const d = iso instanceof Date ? iso : new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(l === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    fmtDateTime(date, lang) {
      const l = lang || App.lang;
      return date.toLocaleString(l === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    fmtMonth(iso, lang) {
      const l = lang || App.lang;
      return new Date(iso + 'T12:00:00').toLocaleDateString(l === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
    },

    /* ---------- helpers ---------- */
    escapeHTML(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    icon(name, white) {
      return `<img class="icon" src="assets/icons/${name}${white ? '-white' : ''}.svg" alt="" width="28" height="28" aria-hidden="true">`;
    },
    announce(msg) {
      const live = global.document.getElementById('live-region');
      if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }
    },
    toast(msg) {
      const host = global.document.getElementById('toast-host');
      if (!host) return;
      const el = global.document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      host.appendChild(el);
      App.announce(msg);
      setTimeout(() => el.remove(), 4000);
    },

    /* ---------- boot ---------- */
    register(page, fn) { App._pages[page] = fn; },
    boot() {
      App.lang = App.getLang();
      App.applyLangAttrs();
      if (global.Navigation) global.Navigation.init();
      App.applyI18n();
      const page = global.document.body.dataset.page;
      if (App._pages[page]) App._pages[page]();
    }
  };

  global.App = App;
  global.document.addEventListener('DOMContentLoaded', App.boot);
})(window);
