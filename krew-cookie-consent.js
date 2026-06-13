/**
 * krew-cookie-consent.js
 * ─────────────────────────────────────────────
 * Drop-in cookie consent banner for krew.cloud
 * CLO authored — Legal & Compliance, KREW
 * Version: 1.0.0 | 13.06.2026
 *
 * HOW TO USE:
 *   1. Add to the <head> of every page:
 *      <link rel="stylesheet" href="/krew-cookie-consent.css" />
 *   2. Add before </body>:
 *      <script src="/krew-cookie-consent.js"></script>
 *
 * ARCHITECTURE NOTES:
 *   - Stores consent in localStorage under 'krew_cookie_consent'
 *   - Also sets a same-name cookie (1-year expiry) as fallback
 *   - Exposes window.__krewCookieConsent API for external use
 *   - Does NOT bundle with the AI disclaimer — separate DOM element
 *   - Ready for category expansion: add categories to CONSENT_CATEGORIES
 *
 * CURRENT STATUS (June 2026):
 *   All KREW cookies are technically necessary → no consent required.
 *   Banner is informational only. Category toggles are disabled (greyed)
 *   until non-essential cookies are added. When analytics/marketing are
 *   added, flip the 'required' flag below to false and re-enable the toggle.
 * ─────────────────────────────────────────────
 */

;(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────── */

  const STORAGE_KEY   = 'krew_cookie_consent';
  const COOKIE_NAME   = 'krew_cookie_consent';
  const POLICY_URL    = '/cookies';
  const EXPIRY_DAYS   = 365;
  const VERSION       = '1.0';

  /**
   * Cookie categories.
   * required: true  → exempt from consent, toggle disabled, always on
   * required: false → consent needed, toggle enabled
   *
   * To add analytics: copy the 'analytics' stub below, set required: false.
   * The UI will automatically render a toggle for it.
   */
  const CONSENT_CATEGORIES = [
    {
      id:       'necessary',
      label:    'Necessary',
      desc:     'Authentication, session management, CDN performance, and this consent preference. Cannot be disabled.',
      required: true,
      default:  true,
    },
    // STUB — enable when analytics are added:
    // {
    //   id:       'analytics',
    //   label:    'Analytics',
    //   desc:     'Anonymous usage statistics to help us improve the platform. No personal identifiers.',
    //   required: false,
    //   default:  false,
    // },
  ];

  /* ── STORAGE UTILS ───────────────────────────────── */

  function saveConsent(prefs) {
    const record = {
      version:   VERSION,
      timestamp: new Date().toISOString(),
      prefs,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (_) {}
    // Cookie fallback (httpOnly not applicable here — this is preference only)
    const expires = new Date();
    expires.setDate(expires.getDate() + EXPIRY_DAYS);
    document.cookie = [
      COOKIE_NAME + '=1',
      'expires=' + expires.toUTCString(),
      'path=/',
      'SameSite=Lax',
      location.protocol === 'https:' ? 'Secure' : '',
    ].filter(Boolean).join('; ');
  }

  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      // Re-prompt if version changed (policy update)
      if (record.version !== VERSION) return null;
      return record;
    } catch (_) {
      return null;
    }
  }

  function clearConsent() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    document.cookie = COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /* ── BUILD DEFAULT PREFS ─────────────────────────── */

  function defaultPrefs() {
    const prefs = {};
    CONSENT_CATEGORIES.forEach(function (c) {
      prefs[c.id] = c.default || c.required;
    });
    return prefs;
  }

  /* ── CSS INJECTION ───────────────────────────────── */

  function injectStyles() {
    const id = 'krew-cookie-styles';
    if (document.getElementById(id)) return;

    const css = `
      /* ── KREW Cookie Banner ── */
      #krew-cookie-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        background: #060A0F;
        border-top: 1px solid #141E28;
        font-family: 'IBM Plex Mono', 'Courier New', monospace;
        font-size: 12px;
        color: #B8C8D8;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        transform: translateY(100%);
        transition: transform 0.3s ease;
      }

      #krew-cookie-banner.krew-cb-visible {
        transform: translateY(0);
      }

      .krew-cb-text {
        flex: 1;
        line-height: 1.5;
      }

      .krew-cb-text a {
        color: #00FFB2;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .krew-cb-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .krew-cb-btn {
        font-family: 'IBM Plex Mono', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 8px 16px;
        border: none;
        cursor: pointer;
        white-space: nowrap;
      }

      .krew-cb-btn-accept {
        background: #00FFB2;
        color: #060A0F;
      }

      .krew-cb-btn-accept:hover {
        background: #00E0A0;
      }

      .krew-cb-btn-manage {
        background: transparent;
        color: #B8C8D8;
        border: 1px solid #141E28;
      }

      .krew-cb-btn-manage:hover {
        border-color: #4A6070;
        color: #E0ECF8;
      }

      /* ── Preferences Modal ── */
      #krew-cookie-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(6, 10, 15, 0.85);
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      #krew-cookie-modal.krew-modal-open {
        display: flex;
      }

      .krew-modal-box {
        background: #060A0F;
        border: 1px solid #1A2530;
        max-width: 520px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      }

      .krew-modal-header {
        background: #060A0F;
        border-bottom: 1px solid #141E28;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .krew-modal-title {
        font-family: 'IBM Plex Mono', monospace;
        font-weight: 700;
        font-size: 14px;
        color: #E0ECF8;
        letter-spacing: 0.04em;
      }

      .krew-modal-close {
        background: none;
        border: none;
        color: #667788;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 0;
      }

      .krew-modal-close:hover { color: #E0ECF8; }

      .krew-modal-body {
        padding: 20px 24px;
      }

      .krew-modal-intro {
        font-size: 12px;
        color: #B8C8D8;
        line-height: 1.6;
        margin-bottom: 20px;
      }

      .krew-modal-intro a {
        color: #00FFB2;
        text-decoration: underline;
      }

      .krew-category {
        border: 1px solid #141E28;
        padding: 14px 16px;
        margin-bottom: 10px;
      }

      .krew-category-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .krew-category-name {
        font-family: 'IBM Plex Mono', monospace;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #E0ECF8;
      }

      .krew-category-desc {
        font-size: 11px;
        color: #667788;
        line-height: 1.5;
      }

      /* Toggle switch */
      .krew-toggle {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
        flex-shrink: 0;
      }

      .krew-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .krew-toggle-slider {
        position: absolute;
        inset: 0;
        background: #1A2530;
        cursor: pointer;
        transition: 0.2s;
      }

      .krew-toggle input:checked + .krew-toggle-slider {
        background: #00FFB2;
      }

      .krew-toggle input:disabled + .krew-toggle-slider {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .krew-toggle-slider::before {
        content: '';
        position: absolute;
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background: #E0ECF8;
        transition: 0.2s;
      }

      .krew-toggle input:checked + .krew-toggle-slider::before {
        transform: translateX(16px);
        background: #060A0F;
      }

      .krew-tag-required {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #667788;
        border: 1px solid #1A2530;
        padding: 1px 6px;
      }

      .krew-modal-footer {
        border-top: 1px solid #141E28;
        padding: 16px 24px;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      /* Manage trigger (in footer of every page) */
      .krew-manage-trigger {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        color: #667788;
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        padding: 0;
      }

      .krew-manage-trigger:hover { color: #B8C8D8; }

      @media (max-width: 640px) {
        #krew-cookie-banner {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .krew-cb-actions { width: 100%; }
        .krew-cb-btn { flex: 1; text-align: center; }
      }
    `;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── BUILD BANNER HTML ───────────────────────────── */

  function buildBanner() {
    const banner = document.createElement('div');
    banner.id = 'krew-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');

    banner.innerHTML = [
      '<div class="krew-cb-text">',
        'krew.cloud uses technically necessary cookies for authentication and CDN performance.',
        ' No tracking, no advertising. &nbsp;<a href="' + POLICY_URL + '">Cookie policy</a>',
      '</div>',
      '<div class="krew-cb-actions">',
        '<button class="krew-cb-btn krew-cb-btn-manage" id="krew-cb-manage-btn" aria-haspopup="dialog">',
          'Manage',
        '</button>',
        '<button class="krew-cb-btn krew-cb-btn-accept" id="krew-cb-accept-btn">',
          'Got it',
        '</button>',
      '</div>',
    ].join('');

    return banner;
  }

  /* ── BUILD MODAL HTML ────────────────────────────── */

  function buildModal(currentPrefs) {
    const modal = document.createElement('div');
    modal.id = 'krew-cookie-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'krew-modal-title');

    const categoriesHtml = CONSENT_CATEGORIES.map(function (c) {
      const isOn = currentPrefs ? currentPrefs[c.id] : (c.default || c.required);
      const toggleHtml = c.required
        ? '<span class="krew-tag-required">Always on</span>'
        : [
            '<label class="krew-toggle">',
              '<input type="checkbox" data-category="' + c.id + '"' + (isOn ? ' checked' : '') + '>',
              '<span class="krew-toggle-slider"></span>',
            '</label>',
          ].join('');

      return [
        '<div class="krew-category">',
          '<div class="krew-category-header">',
            '<span class="krew-category-name">' + c.label + '</span>',
            toggleHtml,
          '</div>',
          '<div class="krew-category-desc">' + c.desc + '</div>',
        '</div>',
      ].join('');
    }).join('');

    modal.innerHTML = [
      '<div class="krew-modal-box">',
        '<div class="krew-modal-header">',
          '<span class="krew-modal-title" id="krew-modal-title">Cookie preferences</span>',
          '<button class="krew-modal-close" id="krew-modal-close-btn" aria-label="Close">&times;</button>',
        '</div>',
        '<div class="krew-modal-body">',
          '<p class="krew-modal-intro">',
            'Select which cookies you allow. Necessary cookies cannot be disabled — they are required to operate the platform. ',
            '<a href="' + POLICY_URL + '">Full cookie policy</a>',
          '</p>',
          categoriesHtml,
        '</div>',
        '<div class="krew-modal-footer">',
          '<button class="krew-cb-btn krew-cb-btn-manage" id="krew-modal-save-btn">Save preferences</button>',
          '<button class="krew-cb-btn krew-cb-btn-accept" id="krew-modal-accept-all-btn">Accept all</button>',
        '</div>',
      '</div>',
    ].join('');

    return modal;
  }

  /* ── MAIN CONTROLLER ─────────────────────────────── */

  function init() {
    injectStyles();

    const existing = loadConsent();

    // ── Public API
    window.__krewCookieConsent = {
      openPreferences: openModal,
      getConsent:      function () { return loadConsent(); },
      clearConsent:    function () {
        clearConsent();
        location.reload();
      },
      hasConsented: function () { return !!loadConsent(); },
    };

    // If already consented (and version matches), do not show banner
    if (existing) return;

    // Build and inject banner
    const banner = buildBanner();
    document.body.appendChild(banner);

    // Animate in on next tick
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('krew-cb-visible');
      });
    });

    // Build and inject modal (hidden)
    const modal = buildModal(null);
    document.body.appendChild(modal);

    // ── Event: Accept all
    document.getElementById('krew-cb-accept-btn').addEventListener('click', function () {
      acceptAll();
    });

    // ── Event: Open manage
    document.getElementById('krew-cb-manage-btn').addEventListener('click', function () {
      openModal();
    });

    wireModal(modal);
  }

  function acceptAll() {
    const prefs = {};
    CONSENT_CATEGORIES.forEach(function (c) { prefs[c.id] = true; });
    saveConsent(prefs);
    hideBanner();
    closeModal();
  }

  function saveSelectedPrefs(modal) {
    const prefs = {};
    CONSENT_CATEGORIES.forEach(function (c) {
      if (c.required) {
        prefs[c.id] = true;
        return;
      }
      const toggle = modal.querySelector('input[data-category="' + c.id + '"]');
      prefs[c.id] = toggle ? toggle.checked : c.default;
    });
    saveConsent(prefs);
    hideBanner();
    closeModal();
  }

  function hideBanner() {
    const banner = document.getElementById('krew-cookie-banner');
    if (!banner) return;
    banner.classList.remove('krew-cb-visible');
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 350);
  }

  function openModal() {
    // Rebuild modal with current prefs if consented already
    let modal = document.getElementById('krew-cookie-modal');
    if (!modal) {
      modal = buildModal(loadConsent() ? loadConsent().prefs : null);
      document.body.appendChild(modal);
      wireModal(modal);
    }
    modal.classList.add('krew-modal-open');
    // Focus trap: focus first focusable
    const first = modal.querySelector('button, [tabindex]');
    if (first) first.focus();
  }

  function closeModal() {
    const modal = document.getElementById('krew-cookie-modal');
    if (modal) modal.classList.remove('krew-modal-open');
  }

  function wireModal(modal) {
    // Close button
    var closeBtn = document.getElementById('krew-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Save preferences
    var saveBtn = document.getElementById('krew-modal-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveSelectedPrefs(modal);
    });

    // Accept all from modal
    var acceptBtn = document.getElementById('krew-modal-accept-all-btn');
    if (acceptBtn) acceptBtn.addEventListener('click', function () {
      acceptAll();
    });

    // ESC to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ── INIT ON DOM READY ───────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
