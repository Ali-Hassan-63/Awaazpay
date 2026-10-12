/* AwaazPay — navigation.js
 * Builds the shared demo banner, header (brand, menu, language switch) and footer once per page,
 * so every page has the same layout, the same safety notice and the same language control.
 */
(function (global) {
  'use strict';

  const doc = global.document;

  const Navigation = {
    init() {
      const page = doc.body.dataset.page;

      const banner = doc.getElementById('demo-banner');
      if (banner) {
        banner.className = 'demo-banner';
        banner.setAttribute('role', 'note');
        banner.innerHTML = '<span class="demo-chip" aria-hidden="true">DEMO</span><span data-i18n="demo.notice"></span>';
      }

      const header = doc.getElementById('site-header');
      if (header) {
        header.className = 'site-header';
        header.innerHTML = `
          <div class="container header-inner">
            <a class="brand" href="${page === 'landing' ? 'index.html' : 'dashboard.html'}" aria-label="AwaazPay">
              <img src="assets/icons/favicon.svg" alt="" width="40" height="40">
              <span class="brand-text">
                <span class="brand-name">AwaazPay</span>
                <span class="brand-tag" data-i18n="brand.tagline"></span>
              </span>
            </a>
            <nav class="main-nav" data-i18n-attr="aria-label:nav.label">
              <a href="dashboard.html" class="nav-link" data-nav="dashboard" data-i18n="nav.home"></a>
              <a href="voice-assistant.html" class="nav-link" data-nav="voice-assistant" data-i18n="nav.assistant"></a>
              <a href="help.html" class="nav-link" data-nav="help" data-i18n="nav.help"></a>
            </nav>
            <div class="lang-switch" role="group" data-i18n-attr="aria-label:lang.label">
              <button type="button" class="lang-btn" data-lang="ur" lang="ur">اردو</button>
              <button type="button" class="lang-btn" data-lang="en" lang="en">English</button>
            </div>
          </div>`;
        header.querySelectorAll('.lang-btn').forEach((b) => {
          b.addEventListener('click', () => global.App.setLang(b.dataset.lang));
        });
        const current = header.querySelector(`[data-nav="${page}"]`);
        if (current) current.setAttribute('aria-current', 'page');
      }

      const footer = doc.getElementById('site-footer');
      if (footer) {
        footer.className = 'site-footer';
        footer.innerHTML = `
          <div class="container">
            <p data-i18n="footer.text"></p>
            <p class="small" data-i18n="footer.storage"></p>
            <p><button type="button" class="btn btn-link" id="reset-demo" data-i18n="footer.reset"></button></p>
          </div>`;
        footer.querySelector('#reset-demo').addEventListener('click', () => {
          global.App.resetState();
          global.App.toast(global.App.t('footer.reset_done'));
          if (doc.body.dataset.page !== 'landing') {
            setTimeout(() => { global.location.href = 'dashboard.html'; }, 900);
          }
        });
      }

      if (!doc.getElementById('live-region')) {
        const live = doc.createElement('div');
        live.id = 'live-region';
        live.className = 'sr-only';
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('role', 'status');
        doc.body.appendChild(live);
      }
      if (!doc.getElementById('toast-host')) {
        const host = doc.createElement('div');
        host.id = 'toast-host';
        host.className = 'toast-host';
        doc.body.appendChild(host);
      }
      Navigation.sync();
    },

    /* keep the language buttons' pressed state in step with the chosen language */
    sync() {
      const lang = global.App.lang;
      doc.querySelectorAll('.lang-btn').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
      });
      doc.querySelectorAll('[data-lang-choice]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.langChoice === lang));
      });
    }
  };

  global.Navigation = Navigation;
})(window);
