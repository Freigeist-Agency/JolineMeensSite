/**
 * Freigeist Consent SDK (v1.0.0)
 * Ultra-lightweight, zero-dependency, DSGVO / TDDDG § 25 compliant cookie consent tool.
 */
(function() {
  'use strict';
  if (window.__FREIGEIST_CONSENT__) return;
  window.__FREIGEIST_CONSENT__ = true;

  var doc = document, win = window, nav = navigator;
  var currentScript = doc.currentScript || (function() {
    var s = doc.getElementsByTagName('script');
    for (var i = s.length - 1; i >= 0; i--) {
      if (s[i].src && s[i].src.indexOf('freigeist-consent') !== -1) return s[i];
    }
    return null;
  })();

  var cfg = {
    cookieName: 'freigeist_consent',
    expiryDays: 180,
    siteId: (currentScript && currentScript.getAttribute('data-site')) || 'default',
    privacyUrl: (currentScript && currentScript.getAttribute('data-privacy-url')) || '',
    imprintUrl: (currentScript && currentScript.getAttribute('data-imprint-url')) || '',
    lang: (currentScript && currentScript.getAttribute('data-lang')) || ''
  };

  var I18N = {
    de: {
      b: 'DATENSCHUTZ',
      t: 'Privatsphäre-Einstellungen',
      d: 'Wir nutzen Cookies und Technologien, um unsere Website zuverlässig zu betreiben und das Nutzungserlebnis zu verbessern. Einstellungen sind jederzeit anpassbar.',
      pl: 'Datenschutz',
      il: 'Impressum',
      accept: 'Alle akzeptieren',
      deny: 'Alle ablehnen',
      custom: 'Einstellungen',
      save: 'Auswahl speichern',
      gpc: 'GPC-Signal aktiv: Marketing abgewählt',
      c: {
        n: ['Notwendig', 'Zwingend erforderlich für Betrieb und Sicherheit.'],
        a: ['Statistik & Analyse', 'Anonyme Messung (GA4) zur Optimierung der Performance.'],
        m: ['Marketing & Medien', 'Kampagnen-Attribution und externe Inhalte.']
      }
    },
    en: {
      b: 'PRIVACY',
      t: 'Privacy Preferences',
      d: 'We use cookies and technology to run our website and enhance your experience. You can update your preferences anytime.',
      pl: 'Privacy Policy',
      il: 'Legal Notice',
      accept: 'Accept All',
      deny: 'Deny All',
      custom: 'Customize',
      save: 'Save Preferences',
      gpc: 'GPC signal active: Marketing opted out',
      c: {
        n: ['Necessary', 'Required for basic site functionality and security.'],
        a: ['Analytics & Speed', 'Anonymous measurement (GA4) to improve layout and speed.'],
        m: ['Marketing & Media', 'Campaign attribution and external media embeds.']
      }
    }
  };

  function getLang() {
    if (cfg.lang && I18N[cfg.lang]) return cfg.lang;
    var hl = (doc.documentElement.lang || '').toLowerCase();
    if (hl.indexOf('de') !== -1) return 'de';
    if (hl.indexOf('en') !== -1) return 'en';
    var p = win.location.pathname.toLowerCase();
    if (p.indexOf('/de') === 0) return 'de';
    if (p.indexOf('/en') === 0) return 'en';
    return (nav.language || '').toLowerCase().indexOf('de') !== -1 ? 'de' : 'en';
  }

  function getLegalLinks(l) {
    var p = cfg.privacyUrl || ((l === 'de') ? '/datenschutz' : '/privacy-policy');
    var i = cfg.imprintUrl || '/impressum';
    if (doc.querySelector('a[href*="rechtsseiten"]')) { p = '/rechtsseiten'; i = '/rechtsseiten'; }
    else {
      if (doc.querySelector('a[href*="datenschutz"]')) p = '/datenschutz';
      else if (doc.querySelector('a[href*="privacy-policy"]')) p = '/privacy-policy';
      if (doc.querySelector('a[href*="impressum"]')) i = '/impressum';
    }
    return { p: p, i: i };
  }

  var hasGPC = (function() {
    try { return Boolean(nav.globalPrivacyControl); } catch(e) { return false; }
  })();

  function gtagPush() {
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push(arguments);
  }

  function initGtag() {
    gtagPush('consent', 'default', {
      ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied',
      ad_personalization: 'denied', functionality_storage: 'denied',
      personalization_storage: 'denied', security_storage: 'granted', wait_for_update: 500
    });
    gtagPush('set', 'ads_data_redaction', true);
  }
  initGtag();

  function updateGtag(cats) {
    var m = Boolean(cats && cats.marketing) && !hasGPC;
    var a = Boolean(cats && cats.analytics);
    gtagPush('consent', 'update', {
      ad_storage: m ? 'granted' : 'denied',
      ad_user_data: m ? 'granted' : 'denied',
      ad_personalization: m ? 'granted' : 'denied',
      analytics_storage: a ? 'granted' : 'denied',
      functionality_storage: 'granted',
      personalization_storage: m ? 'granted' : 'denied'
    });
  }

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getConsent() {
    var raw = null, n = cfg.cookieName + '=', ca = (doc.cookie || '').split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(n) === 0) { raw = c.substring(n.length); break; }
    }
    if (!raw) { try { raw = localStorage.getItem(cfg.cookieName); } catch(e) {} }
    if (!raw) return null;
    try {
      var s = JSON.parse(decodeURIComponent(raw));
      return (s && s.v === 1 && s.c) ? s : null;
    } catch(e) { return null; }
  }

  function setConsent(cats) {
    var state = {
      v: 1,
      id: uid(),
      ts: Date.now(),
      c: {
        n: true,
        a: Boolean(cats && (cats.analytics || cats.a)),
        m: hasGPC ? false : Boolean(cats && (cats.marketing || cats.m))
      },
      gpc: hasGPC
    };
    var v = encodeURIComponent(JSON.stringify(state));
    var d = new Date(); d.setTime(d.getTime() + (cfg.expiryDays * 864e5));
    var sec = (location.protocol === 'https:') ? '; Secure' : '';
    doc.cookie = cfg.cookieName + '=' + v + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax' + sec;
    try { localStorage.setItem(cfg.cookieName, v); } catch(e) {}

    updateGtag({ analytics: state.c.a, marketing: state.c.m });
    unblockScripts(state.c);
    try { win.dispatchEvent(new CustomEvent('freigeist:consent:updated', { detail: state })); } catch(e) {}
    return state;
  }

  var executed = [];
  function unblockScripts(cats) {
    var sl = doc.querySelectorAll('script[type="text/plain"]');
    for (var i = 0; i < sl.length; i++) {
      var s = sl[i];
      if (executed.indexOf(s) !== -1) continue;
      var cat = (s.getAttribute('data-fgc-category') || s.getAttribute('data-cookieconsent') || '').toLowerCase();
      var ok = false;
      if (cat === 'necessary' || cat === 'essential') ok = true;
      else if ((cat === 'analytics' || cat === 'statistics') && cats.a) ok = true;
      else if (cat === 'marketing' && cats.m && !hasGPC) ok = true;

      if (ok) {
        executed.push(s);
        var x = doc.createElement('script');
        x.type = 'text/javascript';
        if (s.src) { x.src = s.src; x.async = s.async; }
        else { x.textContent = s.textContent; }
        for (var a = 0; a < s.attributes.length; a++) {
          var at = s.attributes[a];
          if (at.name !== 'type' && at.name !== 'data-fgc-category' && at.name !== 'data-cookieconsent') {
            x.setAttribute(at.name, at.value);
          }
        }
        s.parentNode.replaceChild(x, s);
      }
    }
  }

  function injectCSS() {
    if (doc.getElementById('fgc-css')) return;
    var s = doc.createElement('style');
    s.id = 'fgc-css';
    s.textContent = '.fgc-box{position:fixed;bottom:0;left:0;right:0;z-index:2147483640;display:flex;justify-content:center;padding:16px;pointer-events:none;contain:layout style;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;box-sizing:border-box}' +
      '.fgc-card{width:100%;max-width:640px;background:#0d0e11;color:#eceff4;border:1px solid #242933;border-radius:12px;padding:20px;box-shadow:0 24px 48px rgba(0,0,0,.5);pointer-events:auto;transform:translate3d(0,120%,0);opacity:0;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .25s ease}' +
      '.fgc-open .fgc-card{transform:translate3d(0,0,0);opacity:1}' +
      '.fgc-tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:#1a1f29;color:#88c0d0;border:1px solid #2e3440;margin-bottom:8px}' +
      '.fgc-gpc{font-size:12px;color:#a3be8c;background:rgba(163,190,140,.12);padding:4px 8px;border-radius:4px;margin-top:6px;display:inline-block}' +
      '.fgc-h2{font-size:18px;font-weight:700;color:#fff;margin:0 0 6px;line-height:1.2}' +
      '.fgc-p{font-size:13px;line-height:1.5;color:#d8dee9;margin:0}' +
      '.fgc-p a{color:#88c0d0;text-decoration:underline;text-underline-offset:2px}' +
      '.fgc-acc{margin-top:14px;padding-top:12px;border-top:1px solid #242933;display:none;flex-direction:column;gap:8px}' +
      '.fgc-row{display:flex;align-items:flex-start;gap:10px;padding:8px;background:#141720;border-radius:6px;border:1px solid #222734}' +
      '.fgc-row input{margin-top:2px;width:16px;height:16px;accent-color:#88c0d0}' +
      '.fgc-row strong{display:block;font-size:13px;color:#fff}' +
      '.fgc-row span{font-size:12px;color:#9aa2b1;line-height:1.35}' +
      '.fgc-bar{display:flex;gap:8px;margin-top:16px}' +
      '.fgc-b{flex:1;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;padding:8px 14px;border:1px solid transparent;transition:all .15s ease}' +
      '.fgc-bp{background:#fff;color:#0d0e11}' +
      '.fgc-bp:hover{background:#e5e9f0}' +
      '.fgc-bs{background:transparent;color:#fff;border-color:#4c566a}' +
      '.fgc-bs:hover{border-color:#88c0d0;background:#1a1f29}' +
      '.fgc-bg{background:transparent;color:#88c0d0;flex:.8}' +
      '.fgc-bg:hover{background:rgba(136,192,208,.1)}' +
      '@media(max-width:560px){.fgc-box{padding:10px}.fgc-card{padding:16px}.fgc-bar{flex-direction:column}.fgc-b{width:100%}}';
    doc.head.appendChild(s);
  }

  var drawer = null, expanded = false;

  function buildDrawer(l) {
    var t = I18N[l] || I18N.de, lk = getLegalLinks(l);
    var el = doc.createElement('div');
    el.className = 'fgc-box';
    el.id = 'fgc-drawer';

    var gpcHtml = hasGPC ? '<div class="fgc-gpc">✔ ' + t.gpc + '</div>' : '';
    el.innerHTML = '<div class="fgc-card">' +
      '<span class="fgc-tag">' + t.b + '</span>' +
      '<h2 class="fgc-h2">' + t.t + '</h2>' +
      '<p class="fgc-p">' + t.d + ' (<a href="' + lk.p + '" target="_blank">' + t.pl + '</a> · <a href="' + lk.i + '" target="_blank">' + t.il + '</a>)</p>' +
      gpcHtml +
      '<div class="fgc-acc" id="fgc-acc">' +
        '<label class="fgc-row"><input type="checkbox" checked disabled><div><strong>' + t.c.n[0] + '</strong><span>' + t.c.n[1] + '</span></div></label>' +
        '<label class="fgc-row"><input type="checkbox" id="fgc-ca"><div><strong>' + t.c.a[0] + '</strong><span>' + t.c.a[1] + '</span></div></label>' +
        '<label class="fgc-row"><input type="checkbox" id="fgc-cm"' + (hasGPC ? ' disabled' : '') + '><div><strong>' + t.c.m[0] + (hasGPC ? ' (GPC)' : '') + '</strong><span>' + t.c.m[1] + '</span></div></label>' +
      '</div>' +
      '<div class="fgc-bar">' +
        '<button type="button" class="fgc-b fgc-bs" id="fgc-bd">' + t.deny + '</button>' +
        '<button type="button" class="fgc-b fgc-bg" id="fgc-bc">' + t.custom + '</button>' +
        '<button type="button" class="fgc-b fgc-bp" id="fgc-ba">' + t.accept + '</button>' +
      '</div>' +
    '</div>';
    return el;
  }

  function openUI() {
    if (!drawer) {
      injectCSS();
      var l = getLang();
      drawer = buildDrawer(l);
      if (doc.body) doc.body.appendChild(drawer);

      var bd = drawer.querySelector('#fgc-bd'),
          ba = drawer.querySelector('#fgc-ba'),
          bc = drawer.querySelector('#fgc-bc'),
          acc = drawer.querySelector('#fgc-acc');
      var t = I18N[l] || I18N.de;

      if (bd) bd.onclick = function() { setConsent({ a: false, m: false }); closeUI(); };
      if (ba) ba.onclick = function() { setConsent({ a: true, m: true }); closeUI(); };
      if (bc) bc.onclick = function() {
        if (!expanded) {
          if (acc) acc.style.display = 'flex';
          bc.textContent = t.save;
          expanded = true;
        } else {
          var a = Boolean(drawer.querySelector('#fgc-ca')?.checked);
          var m = Boolean(drawer.querySelector('#fgc-cm')?.checked) && !hasGPC;
          setConsent({ a: a, m: m });
          closeUI();
        }
      };
    }

    var c = getConsent();
    if (c && c.c && drawer) {
      var ca = drawer.querySelector('#fgc-ca'), cm = drawer.querySelector('#fgc-cm');
      if (ca) ca.checked = Boolean(c.c.a);
      if (cm && !hasGPC) cm.checked = Boolean(c.c.m);
    }
    setTimeout(function() { if (drawer) drawer.classList.add('fgc-open'); }, 20);
  }

  function closeUI() {
    if (drawer) drawer.classList.remove('fgc-open');
  }

  function bindReopen() {
    var triggers = doc.querySelectorAll('[data-fgc-action="reopen"], [data-cookie-action="reopen"], a[href="#cookie-settings"], a[href="#cookies"], a[href*="cookie-richtlinien"], a[href*="cookie-settings"]');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener('click', function(e) {
        e.preventDefault();
        openUI();
      });
    }
  }

  function boot() {
    var c = getConsent();
    if (c) {
      updateGtag({ analytics: c.c.a, marketing: c.c.m });
      unblockScripts(c.c);
      try { win.dispatchEvent(new CustomEvent('freigeist:consent:updated', { detail: c })); } catch(e) {}
    } else {
      openUI();
    }
    bindReopen();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  win.FreigeistConsent = { open: openUI, close: closeUI, renew: openUI, get: getConsent, set: setConsent };
  win.Cookiebot = win.Cookiebot || {};
  win.Cookiebot.renew = openUI;
})();
