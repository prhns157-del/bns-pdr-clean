/* ===================================================================
   TTKPay — Modal Universal de Checkout PIX para Páginas UP
   Integração com:
   - /checkout-route/pagamento-router.php (gateway ativo)
   - /checkout-route/verificar.php?id=...
   - QRCode.js (/checkout/qrcode.min.js)
   - sessionStorage lead_data / cache PIX
   =================================================================== */
(function() {
  'use strict';

  // Injetar estilos do Modal e Toast
  var styles = document.createElement('style');
  styles.id = 'ttk-checkout-styles';
  styles.textContent = `
    .ttk-modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.65);
      display: flex; align-items: flex-end; justify-content: center;
      z-index: 999999;
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
      -webkit-overflow-scrolling: touch;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 'Inter', sans-serif;
    }
    .ttk-modal-overlay.active { opacity: 1; pointer-events: all; }
    .ttk-modal {
      background: #ffffff;
      border-radius: 24px 24px 0 0;
      padding: 24px 20px 32px;
      width: 100%; max-width: 460px;
      position: relative; text-align: center;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      overflow-y: auto; max-height: 90vh;
      -webkit-overflow-scrolling: touch;
      box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
    }
    .ttk-modal-overlay.active .ttk-modal { transform: translateY(0); }
    body.ttk-modal-open { overflow: hidden !important; }
    
    .ttk-modal-handle {
      width: 42px; height: 4px; background: #e2e8f0; border-radius: 4px; margin: 0 auto 16px;
    }
    .ttk-modal-close {
      position: absolute; top: 16px; right: 16px;
      width: 32px; height: 32px; background: #f1f5f9; border: none; border-radius: 50%;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: #64748b; line-height: 1; transition: all 0.15s;
    }
    .ttk-modal-close:hover { background: #e2e8f0; color: #0f172a; }
    
    .ttk-modal-check {
      width: 52px; height: 52px; border-radius: 50%;
      border: 2.5px solid #00b37e; background: #e6faf4;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px;
    }
    .ttk-modal-title { font-size: 19px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .ttk-modal-subtitle { font-size: 13px; color: #64748b; margin-bottom: 4px; }
    .ttk-modal-expiry { font-size: 11.5px; color: #94a3b8; margin-bottom: 8px; }
    .ttk-modal-value { font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 14px; letter-spacing: -0.5px; }
    
    .ttk-timer-wrap {
      display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px;
    }
    .ttk-timer-label { font-size: 12px; color: #64748b; font-weight: 500; }
    .ttk-timer-count { font-size: 18px; font-weight: 800; color: #00b37e; font-variant-numeric: tabular-nums; }
    .ttk-timer-count.urgent { color: #fe2c55; }
    
    .ttk-timer-bar-wrap {
      width: 100%; height: 4px; background: #f1f5f9; border-radius: 4px; margin-bottom: 16px; overflow: hidden;
    }
    .ttk-timer-bar { height: 100%; background: #00b37e; border-radius: 4px; transition: width 1s linear, background 0.3s; }
    .ttk-timer-bar.urgent { background: #fe2c55; }
    
    .ttk-modal-tabs {
      display: flex; gap: 6px; background: #f1f5f9; border-radius: 12px; padding: 4px; margin-bottom: 16px;
    }
    .ttk-modal-tab {
      flex: 1; padding: 9px 8px; border: none; border-radius: 9px;
      background: none; font-size: 13px; font-weight: 700;
      color: #64748b; cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .ttk-modal-tab.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    
    .ttk-tab-panel { display: none; }
    .ttk-tab-panel.active { display: block; }
    
    .ttk-how-to { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 14px; }
    .ttk-how-step { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
    .ttk-how-step-icon {
      width: 32px; height: 32px; border-radius: 50%;
      background: #f0faf6; border: 1.5px solid #c8edd9;
      display: flex; align-items: center; justify-content: center;
    }
    .ttk-how-step-text { font-size: 9.5px; font-weight: 600; color: #475569; text-align: center; line-height: 1.25; }
    .ttk-how-arrow { color: #cbd5e1; font-size: 14px; margin-bottom: 12px; }
    
    .ttk-qr-wrap {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px; margin-bottom: 16px;
      display: flex; align-items: center; justify-content: center; min-height: 200px;
    }
    .ttk-qr-placeholder {
      width: 180px; height: 180px; background: #ffffff;
      border: 1px solid #e2e8f0; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    
    .ttk-how-to-copy { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; text-align: left; }
    .ttk-how-step-row { display: flex; align-items: center; gap: 10px; }
    .ttk-how-step-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: #f0faf6; border: 1.5px solid #c8edd9;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: #00b37e; flex-shrink: 0;
    }
    .ttk-how-step-desc { font-size: 12.5px; color: #475569; font-weight: 500; line-height: 1.35; }
    .ttk-how-step-desc strong { color: #0f172a; }
    
    .ttk-pix-code-row {
      display: flex; align-items: center; gap: 8px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 10px 12px; margin-bottom: 12px;
    }
    .ttk-pix-code-text {
      flex: 1; font-size: 12px; color: #334155;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      text-align: left; font-family: monospace;
    }
    .ttk-copy-btn {
      background: none; border: none; cursor: pointer; color: #64748b;
      padding: 4px; flex-shrink: 0; display: flex; align-items: center;
    }
    .ttk-copy-btn:hover { color: #00b37e; }
    
    .ttk-btn-copiar-pix {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 15px;
      background: #00b37e; color: #ffffff;
      border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700;
      cursor: pointer; margin-bottom: 12px;
      transition: background 0.15s, transform 0.1s;
    }
    .ttk-btn-copiar-pix:hover { background: #009e6e; }
    .ttk-btn-copiar-pix:active { transform: scale(0.99); }
    .ttk-btn-copiar-pix.copied { background: #057a55; }
    
    .ttk-modal-status-text {
      font-size: 12px; color: #00b37e; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-bottom: 8px;
    }
    .ttk-mini-spin {
      width: 14px; height: 14px; border: 2px solid #c8edd9;
      border-top-color: #00b37e; border-radius: 50%;
      animation: ttkSpin 0.7s linear infinite; display: inline-block;
    }
    @keyframes ttkSpin { to { transform: rotate(360deg); } }
    
    .ttk-modal-note { font-size: 11.5px; color: #94a3b8; line-height: 1.45; }
    
    #ttkToast {
      position: fixed; top: 20px; left: 50%;
      transform: translateX(-50%) translateY(-120px);
      background: #0f172a; color: #ffffff;
      padding: 13px 20px; border-radius: 12px;
      font-size: 13.5px; font-weight: 600;
      z-index: 1000000;
      transition: transform 0.3s ease;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      width: calc(100% - 32px); max-width: 400px;
    }
    #ttkToast.show { transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(styles);

  // Injetar dependência do QRCode se necessário
  function carregarQRCode(callback) {
    if (typeof QRCode !== 'undefined') {
      if (callback) callback();
      return;
    }
    var script = document.createElement('script');
    script.src = '/checkout/qrcode.min.js';
    script.onload = function() { if (callback) callback(); };
    document.head.appendChild(script);
  }

  // Toast
  var toastTimeout;
  function showToast(msg) {
    var el = document.getElementById('ttkToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ttkToast';
      el.innerHTML = '<span id="ttkToastMsg"></span>';
      document.body.appendChild(el);
    }
    document.getElementById('ttkToastMsg').textContent = msg;
    clearTimeout(toastTimeout);
    el.classList.remove('show');
    setTimeout(function() {
      el.classList.add('show');
      toastTimeout = setTimeout(function() { el.classList.remove('show'); }, 3000);
    }, 10);
  }

  // Criação do Modal no DOM
  function criarModalDOM() {
    if (document.getElementById('ttkPixModal')) return;

    var modalHtml = `
      <div id="ttkToast"><span id="ttkToastMsg"></span></div>
      <div class="ttk-modal-overlay" id="ttkPixModal">
        <div class="ttk-modal">
          <div class="ttk-modal-handle"></div>
          <button class="ttk-modal-close" id="ttkModalClose" title="Fechar">✕</button>
          
          <div class="ttk-modal-check">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          
          <h2 class="ttk-modal-title">Pagamento Gerado!</h2>
          <p class="ttk-modal-subtitle">Olá, <strong id="ttkNomeModal">Cliente</strong>! Escaneie ou copie o código PIX.</p>
          <p class="ttk-modal-expiry">Expira em: <span id="ttkExpiryTime">--/--/---- --:--:--</span></p>
          <p class="ttk-modal-value" id="ttkPriceModal">R$ 0,00</p>
          
          <div class="ttk-timer-wrap">
            <span class="ttk-timer-label">Tempo restante:</span>
            <span class="ttk-timer-count" id="ttkTimerCount">10:00</span>
          </div>
          <div class="ttk-timer-bar-wrap">
            <div class="ttk-timer-bar" id="ttkTimerBar" style="width:100%"></div>
          </div>
          
          <div class="ttk-modal-tabs">
            <button class="ttk-modal-tab" id="ttkTabQr">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01"/>
              </svg> QR Code
            </button>
            <button class="ttk-modal-tab active" id="ttkTabCopy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg> Copia e Cola
            </button>
          </div>
          
          <div class="ttk-tab-panel" id="ttkPanelQr">
            <div class="ttk-how-to">
              <div class="ttk-how-step"><div class="ttk-how-step-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div><span class="ttk-how-step-text">Abra seu app</span></div>
              <span class="ttk-how-arrow">›</span>
              <div class="ttk-how-step"><div class="ttk-how-step-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div><span class="ttk-how-step-text">Vá em Pix</span></div>
              <span class="ttk-how-arrow">›</span>
              <div class="ttk-how-step"><div class="ttk-how-step-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div><span class="ttk-how-step-text">Pague o QR</span></div>
              <span class="ttk-how-arrow">›</span>
              <div class="ttk-how-step"><div class="ttk-how-step-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><span class="ttk-how-step-text">Confirme</span></div>
            </div>
            <div class="ttk-qr-wrap">
              <div class="ttk-qr-placeholder" id="ttkQrContainer"></div>
            </div>
          </div>
          
          <div class="ttk-tab-panel active" id="ttkPanelCopy">
            <div class="ttk-how-to-copy">
              <div class="ttk-how-step-row"><div class="ttk-how-step-num">1</div><p class="ttk-how-step-desc">Abra o app do seu banco e vá em <strong>Pix</strong></p></div>
              <div class="ttk-how-step-row"><div class="ttk-how-step-num">2</div><p class="ttk-how-step-desc">Escolha a opção <strong>Pix Copia e Cola</strong></p></div>
              <div class="ttk-how-step-row"><div class="ttk-how-step-num">3</div><p class="ttk-how-step-desc">Clique em <strong>Copiar Código PIX</strong> abaixo e cole no seu banco</p></div>
              <div class="ttk-how-step-row"><div class="ttk-how-step-num">4</div><p class="ttk-how-step-desc">Confira o valor e confirme a transação</p></div>
            </div>
          </div>
          
          <div class="ttk-pix-code-row">
            <span class="ttk-pix-code-text" id="ttkPixCodeText">Gerando código...</span>
            <button class="ttk-copy-btn" id="ttkCopyCodeBtn" title="Copiar código">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
          
          <button class="ttk-btn-copiar-pix" id="ttkBtnCopiarPix">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copiar Código PIX
          </button>
          
          <div class="ttk-modal-status-text" id="ttkStatusText">
            <div class="ttk-mini-spin"></div> Aguardando pagamento...
          </div>
          
          <p class="ttk-modal-note">Ao pagar, a confirmação será reconhecida automaticamente.</p>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Eventos de abas
    document.getElementById('ttkTabQr').addEventListener('click', function() {
      this.classList.add('active');
      document.getElementById('ttkTabCopy').classList.remove('active');
      document.getElementById('ttkPanelQr').classList.add('active');
      document.getElementById('ttkPanelCopy').classList.remove('active');
    });
    document.getElementById('ttkTabCopy').addEventListener('click', function() {
      this.classList.add('active');
      document.getElementById('ttkTabQr').classList.remove('active');
      document.getElementById('ttkPanelCopy').classList.add('active');
      document.getElementById('ttkPanelQr').classList.remove('active');
    });

    // Copiar PIX
    function copiarPix() {
      var code = window.__currentPixCode || document.getElementById('ttkPixCodeText').textContent;
      if (!code || code === 'Gerando código...') return;
      navigator.clipboard.writeText(code).then(function() {
        var btn = document.getElementById('ttkBtnCopiarPix');
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Código Copiado!';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar Código PIX';
        }, 2500);
      });
    }
    document.getElementById('ttkBtnCopiarPix').addEventListener('click', copiarPix);
    document.getElementById('ttkCopyCodeBtn').addEventListener('click', copiarPix);

    // Fechar Modal
    document.getElementById('ttkModalClose').addEventListener('click', function() {
      if (window.__ttkPollingInterval) {
        if (!confirm('Atenção: seu pagamento ainda está pendente de confirmação. Deseja fechar a tela?')) return;
        clearInterval(window.__ttkPollingInterval);
        window.__ttkPollingInterval = null;
      }
      fecharModalPix();
    });
    document.getElementById('ttkPixModal').addEventListener('click', function(e) {
      if (e.target === this && !window.__ttkPollingInterval) {
        fecharModalPix();
      }
    });
  }

  function fecharModalPix() {
    var m = document.getElementById('ttkPixModal');
    if (m) m.classList.remove('active');
    document.body.classList.remove('ttk-modal-open');
    if (window.__ttkTimerInterval) { clearInterval(window.__ttkTimerInterval); window.__ttkTimerInterval = null; }
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function startTimer(totalSecs) {
    if (window.__ttkTimerInterval) clearInterval(window.__ttkTimerInterval);
    var countEl = document.getElementById('ttkTimerCount');
    var barEl = document.getElementById('ttkTimerBar');
    var remaining = totalSecs;

    window.__ttkTimerInterval = setInterval(function() {
      remaining--;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(window.__ttkTimerInterval);
      }
      var m = Math.floor(remaining / 60), s = remaining % 60;
      countEl.textContent = pad(m) + ':' + pad(s);
      var urgent = remaining < 300;
      countEl.classList.toggle('urgent', urgent);
      barEl.classList.toggle('urgent', urgent);
      barEl.style.width = ((remaining / totalSecs) * 100) + '%';
    }, 1000);
  }

  function showSuccessScreen(nextUrl, valor, paymentCode, titulo) {
    if (window.__ttkLastPaidCode === paymentCode) return;
    window.__ttkLastPaidCode = paymentCode;
    var v = parseFloat(valor) || 0;
    // Disparar eventos de conversão no TikTok Pixel com deduplicação por event_id
    if (typeof ttq !== 'undefined' && typeof ttq.track === 'function') {
      try {
        var cid = String(titulo || 'taxa_pix').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'taxa_pix';
        var cName = titulo || 'Taxa Pix';
        ttq.track('CompletePayment', {
          content_id: cid,
          content_type: 'product',
          content_name: cName,
          contents: [{ content_id: cid, content_type: 'product', content_name: cName, quantity: 1, price: v }],
          value: v,
          currency: 'BRL'
        }, {
          event_id: paymentCode
        });
        ttq.track('Purchase', {
          content_id: cid,
          content_type: 'product',
          content_name: cName,
          contents: [{ content_id: cid, content_type: 'product', content_name: cName, quantity: 1, price: v }],
          value: v,
          currency: 'BRL'
        }, {
          event_id: paymentCode + '_purchase'
        });
        console.log('[TikTok Pixel] ✅ Conversão aprovada disparada no modal:', v, paymentCode);
      } catch(e) {
        console.error('[TikTok Pixel err]', e);
      }
    }

    var modal = document.querySelector('.ttk-modal');
    if (!modal) return;
    modal.innerHTML = `
      <div style="padding:40px 20px;text-align:center">
        <div style="width:64px;height:64px;border-radius:50%;background:#e6faf4;border:2.5px solid #00b37e;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00b37e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:8px">Pagamento Confirmado!</h2>
        <p style="font-size:14px;color:#64748b">Redirecionando para a próxima etapa em instantes...</p>
      </div>
    `;
    setTimeout(function() {
      var dest = new URL(nextUrl, window.location.href);
      new URLSearchParams(window.location.search).forEach(function(v, k) {
        dest.searchParams.set(k, v);
      });
      window.location.href = dest.toString();
    }, 2000);
  }

  var __ttkActivePoll = null;
  function checkUpPixOnce(paymentCode, nextUrl, valor, titulo) {
    if (!paymentCode || window.__ttkLastPaidCode === paymentCode) return;
    fetch('/checkout-route/verificar.php?id=' + encodeURIComponent(paymentCode), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data) return;
        if (data.paid === true || data.status === 'approved' || data.status === 'paid') {
          if (window.__ttkPollingInterval) {
            clearInterval(window.__ttkPollingInterval);
            window.__ttkPollingInterval = null;
          }
          __ttkActivePoll = null;
          var finalAmount = data.amount || valor;
          showSuccessScreen(nextUrl, finalAmount, paymentCode, titulo);
        }
      })
      .catch(function() {});
  }

  function startPolling(paymentCode, nextUrl, valor, titulo) {
    __ttkActivePoll = { paymentCode: paymentCode, nextUrl: nextUrl, valor: valor, titulo: titulo };
    if (window.__ttkPollingInterval) clearInterval(window.__ttkPollingInterval);
    checkUpPixOnce(paymentCode, nextUrl, valor, titulo);
    window.__ttkPollingInterval = setInterval(function() {
      checkUpPixOnce(paymentCode, nextUrl, valor, titulo);
    }, 3000);
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && __ttkActivePoll) {
      checkUpPixOnce(__ttkActivePoll.paymentCode, __ttkActivePoll.nextUrl, __ttkActivePoll.valor, __ttkActivePoll.titulo);
    }
  });
  window.addEventListener('focus', function() {
    if (__ttkActivePoll) {
      checkUpPixOnce(__ttkActivePoll.paymentCode, __ttkActivePoll.nextUrl, __ttkActivePoll.valor, __ttkActivePoll.titulo);
    }
  });

  function getLeadInfo() {
    var nome = 'Cliente';
    var email = '';
    var phone = '';
    var cpf = '';
    try {
      var lead = JSON.parse(sessionStorage.getItem('lead_data') || localStorage.getItem('lead_data') || '{}');
      if (lead.nome) nome = lead.nome;
      if (lead.email) email = lead.email;
      if (lead.phone) phone = lead.phone;
    } catch(e) {}
    var ttk = (typeof window.getTtkTracking === 'function') ? window.getTtkTracking() : {};
    if (!email && ttk.email) email = ttk.email;
    if (!phone && ttk.phone) phone = ttk.phone;
    if (!cpf && ttk.cpf) cpf = ttk.cpf;
    if (nome === 'Cliente' && ttk.name) nome = ttk.name;
    var params = new URLSearchParams(window.location.search);
    if (!email && params.get('email')) email = params.get('email');
    if (nome === 'Cliente' && params.get('nome')) nome = params.get('nome');
    return { nome: nome, email: email, phone: phone, cpf: cpf };
  }

  function getLeadId() {
    var params = new URLSearchParams(window.location.search);
    try {
      var ck = document.cookie.split(';').find(function(c) { return c.trim().startsWith('xtracky_lead='); });
      if (ck) return ck.split('=')[1].trim();
    } catch(e) {}
    return params.get('src') || params.get('utm_source') || '';
  }

  /* ===================================================================
     Função Principal Aberta: window.abrirCheckoutPix(options)
     options: {
       valor: 17.12,
       titulo: 'Taxa de Liberação IOF',
       proximoUrl: '../up2/index.html'
     }
     =================================================================== */
  window.abrirCheckoutPix = function(opts) {
    opts = opts || {};
    var valor = parseFloat(opts.valor) || 10.0;
    var titulo = opts.titulo || 'Taxa Administrativa';
    var proximoUrl = opts.proximoUrl || '../up2/index.html';

    criarModalDOM();
    carregarQRCode();

    var lead = getLeadInfo();
    var primeiroNome = lead.nome.split(' ')[0] || 'Cliente';
    document.getElementById('ttkNomeModal').textContent = primeiroNome;
    document.getElementById('ttkPriceModal').textContent = 'R$ ' + valor.toFixed(2).replace('.', ',');

    // Cache por oferta/página
    var cacheKey = 'pix_cache_' + (window.location.pathname.replace(/\//g, '_') || 'up');
    var saved = sessionStorage.getItem(cacheKey);
    if (saved) {
      try {
        var ps = JSON.parse(saved);
        if (ps.expires_at && Date.now() < ps.expires_at && ps.amount === valor && ps.payment_code) {
          window.__currentPixCode = ps.pix_code;
          abrirModalPronto(ps.payment_code, ps.pix_code, ps.expires_at, proximoUrl, valor, titulo);
          return;
        }
      } catch(e) {}
      sessionStorage.removeItem(cacheKey);
    }

    // Trava contra clique repetido: gerar o PIX pode levar alguns segundos (a LulaPay leva ~10s) e o botão
    // volta a ficar ativo logo depois do clique. Sem esta trava, cada clique a mais criava OUTRA cobrança.
    if (window.__ttkPixEmAndamento) {
      showToast('Gerando PIX seguro... aguarde um instante.');
      return;
    }
    window.__ttkPixEmAndamento = true;
    // Rede de segurança: se a resposta nunca voltar, libera a trava depois de 60s.
    setTimeout(function() { window.__ttkPixEmAndamento = false; }, 60000);

    // Gerar PIX via API
    showToast('Gerando PIX seguro...');
    var params = new URLSearchParams(window.location.search);
    var ttkTrack = (typeof window.getTtkTracking === 'function') ? window.getTtkTracking() : {};
    var payload = {
      name: lead.nome,
      nome: lead.nome,
      email: lead.email,
      phone: lead.phone || ttkTrack.phone || '',
      cpf: lead.cpf || ttkTrack.cpf || '',
      amount: valor,
      offer: titulo,
      description: titulo + ' TikTok',
      ttclid: ttkTrack.ttclid || params.get('ttclid') || '',
      ttp: ttkTrack.ttp || '',
      src: getLeadId() || ttkTrack.src || '',
      utm_source: params.get('utm_source') || ttkTrack.utm_source || getLeadId(),
      utm_medium: params.get('utm_medium') || ttkTrack.utm_medium || '',
      utm_campaign: params.get('utm_campaign') || ttkTrack.utm_campaign || '',
      utm_term: params.get('utm_term') || ttkTrack.utm_term || '',
      utm_content: params.get('utm_content') || ttkTrack.utm_content || '',
      url_full: window.location.href
    };

    fetch('/checkout-route/pagamento-router.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      window.__ttkPixEmAndamento = false;
      if (data.error || !data.payment_code) {
        showToast('❌ Erro ao gerar PIX. Tente novamente.');
        return;
      }
      var paymentCode = data.payment_code;
      var pixCode = data.pix_code || data.pix_copy_paste || data.qrCodeText || '';
      window.__currentPixCode = pixCode;
      var expiresAt = Date.now() + (10 * 60 * 1000);

      sessionStorage.setItem(cacheKey, JSON.stringify({
        payment_code: paymentCode,
        pix_code: pixCode,
        expires_at: expiresAt,
        amount: valor
      }));

      abrirModalPronto(paymentCode, pixCode, expiresAt, proximoUrl, valor, titulo);
    })
    .catch(function() {
      window.__ttkPixEmAndamento = false;
      showToast('❌ Falha na conexão com o servidor de pagamento.');
    });
  };

  function abrirModalPronto(paymentCode, pixCode, expiresAt, proximoUrl, valor, titulo) {
    var ed = new Date(expiresAt);
    document.getElementById('ttkExpiryTime').textContent = 
      pad(ed.getDate()) + '/' + pad(ed.getMonth() + 1) + '/' + ed.getFullYear() + ' ' + 
      pad(ed.getHours()) + ':' + pad(ed.getMinutes()) + ':' + pad(ed.getSeconds());

    document.getElementById('ttkPixCodeText').textContent = pixCode;
    var qrContainer = document.getElementById('ttkQrContainer');
    qrContainer.innerHTML = '';

    carregarQRCode(function() {
      if (pixCode && typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
          text: pixCode,
          width: 180,
          height: 180,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    });

    var remaining = Math.floor((expiresAt - Date.now()) / 1000);
    var totalSecs = remaining > 0 ? remaining : 600;

    document.getElementById('ttkPixModal').classList.add('active');
    document.body.classList.add('ttk-modal-open');

    startTimer(totalSecs);
    startPolling(paymentCode, proximoUrl, valor, titulo);
  }

  // Inicializar estrutura quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', criarModalDOM);
  } else {
    criarModalDOM();
  }

})();
