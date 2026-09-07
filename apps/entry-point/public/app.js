// Client-side Application Logic for Ventana Celeste Dev Hub
let state = {
  hubPort: 3000,
  lanIp: '127.0.0.1',
  interfaces: [],
  apps: {},
};

let activeTabAppId = 'web-app';
let selectedIp = localStorage.getItem('vc_selected_ip') || '';
let currentModalContext = null; // { app, view }

const appLogs = {
  'web-app': [],
  'kiosk-standalone': [],
  'dual-telescope': [],
  'device-lab': [],
};

// Elements
const appsGridEl = document.getElementById('apps-grid');
const globalIpSelectEl = document.getElementById('global-ip-select');
const copyLanBtn = document.getElementById('copy-lan-btn');
const startAllBtn = document.getElementById('start-all-btn');
const stopAllBtn = document.getElementById('stop-all-btn');
const logsTabsEl = document.getElementById('logs-tabs');
const logsTerminalEl = document.getElementById('logs-terminal');
const autoscrollChk = document.getElementById('autoscroll-chk');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// Modal Elements
const qrModalEl = document.getElementById('qr-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitleEl = document.getElementById('modal-title');
const modalSubtitleEl = document.getElementById('modal-subtitle');
const modalIpSelectEl = document.getElementById('modal-ip-select');
const qrTargetEl = document.getElementById('qr-target');
const modalUrlTextEl = document.getElementById('modal-url-text');
const copyModalUrlBtn = document.getElementById('copy-modal-url-btn');
const modalOpenLinkEl = document.getElementById('modal-open-link');

// Format ANSI escape codes to basic HTML styling
function formatAnsi(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\x1b\[1m/g, '<strong>')
    .replace(/\x1b\[22m/g, '</strong>')
    .replace(/\x1b\[31m/g, '<span style="color:#f87171">')
    .replace(/\x1b\[32m/g, '<span style="color:#34d399">')
    .replace(/\x1b\[33m/g, '<span style="color:#fbbf24">')
    .replace(/\x1b\[34m/g, '<span style="color:#60a5fa">')
    .replace(/\x1b\[35m/g, '<span style="color:#c084fc">')
    .replace(/\x1b\[36m/g, '<span style="color:#38bdf8">')
    .replace(/\x1b\[37m/g, '<span style="color:#f1f5f9">')
    .replace(/\x1b\[39m/g, '</span>')
    .replace(/\x1b\[0m/g, '</span>')
    .replace(/\x1b\[[0-9;]*m/g, '');
}

// Populate IP Selectors (Global & Modal)
function updateIpDropdowns() {
  const ifaces = state.interfaces || [];
  if (ifaces.length === 0) return;

  const validIps = ifaces.map((i) => i.address);
  if (!selectedIp || !validIps.includes(selectedIp)) {
    selectedIp = state.lanIp || validIps[0] || '127.0.0.1';
    localStorage.setItem('vc_selected_ip', selectedIp);
  }

  // Populate Global Selector
  globalIpSelectEl.innerHTML = ifaces.map((iface) => `
    <option value="${iface.address}" ${iface.address === selectedIp ? 'selected' : ''}>
      ${iface.address} — ${iface.name} (${iface.type})
    </option>
  `).join('');

  // Populate Modal Selector
  modalIpSelectEl.innerHTML = ifaces.map((iface) => `
    <option value="${iface.address}" ${iface.address === selectedIp ? 'selected' : ''}>
      ${iface.address} — ${iface.name} (${iface.type})
    </option>
  `).join('');
}

// Change active network IP
function setSelectedIp(newIp) {
  selectedIp = newIp;
  localStorage.setItem('vc_selected_ip', newIp);

  if (globalIpSelectEl.value !== newIp) globalIpSelectEl.value = newIp;
  if (modalIpSelectEl.value !== newIp) modalIpSelectEl.value = newIp;

  // Re-render UI and active modal
  renderGrid();
  if (currentModalContext) {
    updateModalContent();
  }
}

// Render Applications Grid
function renderGrid() {
  if (!state.apps || Object.keys(state.apps).length === 0) return;

  appsGridEl.innerHTML = '';

  for (const [id, app] of Object.entries(state.apps)) {
    const isRunning = app.status === 'running';
    const isStarting = app.status === 'starting';
    const scheme = app.https ? 'https' : 'http';
    const networkBaseUrl = `${scheme}://${selectedIp || state.lanIp}:${app.port}`;

    const card = document.createElement('div');
    card.className = `app-card status-${app.status}`;
    card.id = `card-${id}`;

    let statusText = 'Detenido';
    if (isRunning) statusText = 'En Línea';
    else if (isStarting) statusText = 'Iniciando...';
    else if (app.status === 'error') statusText = 'Error';

    const viewsHtml = app.views.map((v) => {
      const viewLocalUrl = `${app.localUrl}${v.path === '/' ? '' : v.path}`;
      const viewNetworkUrl = `${networkBaseUrl}${v.path === '/' ? '' : v.path}`;

      return `
        <div class="view-row">
          <div>
            <div class="view-name">${v.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">${v.desc}</div>
          </div>
          <div class="view-actions">
            <a href="${viewLocalUrl}" target="_blank" class="btn btn-secondary btn-sm" ${!isRunning ? 'style="pointer-events:none; opacity:0.4;"' : ''} title="Abrir en este navegador">
              Abrir ↗
            </a>
            <button class="btn btn-secondary btn-sm qr-btn" data-app="${id}" data-view-name="${v.name}" data-path="${v.path}" ${!isRunning ? 'disabled style="opacity:0.4;"' : ''} title="Generar código QR para el móvil">
              📱 QR
            </button>
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div>
        <div class="app-card-header">
          <div class="app-info">
            <h3>${app.name}</h3>
            <span class="app-tag">${app.shortDesc}</span>
          </div>
          <div class="status-pill ${app.status}">
            <span class="status-dot"></span>
            <span>${statusText}</span>
          </div>
        </div>

        <p class="app-desc">${app.description}</p>

        <div class="app-meta">
          <div>Puerto: <strong class="port-badge">:${app.port}</strong> (HTTPS)</div>
          <div>${isRunning ? `<a href="${app.localUrl}" target="_blank" style="color:var(--accent-cyan); text-decoration:none;">${app.localUrl}</a>` : '<span style="color:var(--text-dim)">Inactivo</span>'}</div>
        </div>

        <div class="app-views">
          <div style="font-size: 0.75rem; font-weight:600; color: var(--text-muted); margin-bottom: 0.2rem; text-transform:uppercase; letter-spacing:0.04em;">Vistas y Puntos de Entrada:</div>
          ${viewsHtml}
        </div>
      </div>

      <div class="app-card-controls">
        ${isRunning ? `
          <button class="btn btn-danger btn-sm stop-btn" data-app="${id}">⏹ Detener</button>
          <button class="btn btn-secondary btn-sm restart-btn" data-app="${id}">🔄 Reiniciar</button>
          <a href="${app.localUrl}" target="_blank" class="btn btn-success btn-sm main-btn">🚀 Abrir App</a>
        ` : isStarting ? `
          <button class="btn btn-secondary btn-sm main-btn" disabled>⏳ Levantando servidor...</button>
        ` : `
          <button class="btn btn-primary btn-sm main-btn start-btn" data-app="${id}">▶ Iniciar Servidor</button>
        `}
      </div>
    `;

    appsGridEl.appendChild(card);
  }

  // Attach dynamic event handlers for QR buttons
  document.querySelectorAll('.qr-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.dataset.app;
      const viewName = btn.dataset.viewName;
      const path = btn.dataset.path;
      openQrModal(appId, viewName, path);
    });
  });

  // Attach card control handlers
  document.querySelectorAll('.start-btn').forEach((btn) => {
    btn.addEventListener('click', () => startApp(btn.dataset.app));
  });
  document.querySelectorAll('.stop-btn').forEach((btn) => {
    btn.addEventListener('click', () => stopApp(btn.dataset.app));
  });
  document.querySelectorAll('.restart-btn').forEach((btn) => {
    btn.addEventListener('click', () => restartApp(btn.dataset.app));
  });
}

// Render Tabs for Logs
function renderLogsTabs() {
  if (!state.apps) return;
  logsTabsEl.innerHTML = '';

  for (const [id, app] of Object.entries(state.apps)) {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${id === activeTabAppId ? 'active' : ''}`;
    btn.textContent = `${app.name} (${app.logs?.length || appLogs[id]?.length || 0})`;
    btn.addEventListener('click', () => {
      activeTabAppId = id;
      renderLogsTabs();
      renderActiveLogs();
    });
    logsTabsEl.appendChild(btn);
  }
}

// Render Terminal Logs
function renderActiveLogs() {
  const logs = appLogs[activeTabAppId] || [];
  if (logs.length === 0) {
    logsTerminalEl.innerHTML = `<div class="log-line" style="color: var(--text-dim);">[Hub] No hay logs recientes para ${state.apps[activeTabAppId]?.name || activeTabAppId}.</div>`;
    return;
  }

  logsTerminalEl.innerHTML = logs.map((log) => {
    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
    return `<div class="log-line"><span class="log-time">${timeStr}</span>${formatAnsi(log.text)}</div>`;
  }).join('');

  if (autoscrollChk.checked) {
    logsTerminalEl.scrollTop = logsTerminalEl.scrollHeight;
  }
}

// QR Code Modal
function openQrModal(appId, viewName, path) {
  const app = state.apps[appId];
  if (!app) return;

  currentModalContext = { appId, appName: app.name, viewName, path, port: app.port, https: app.https };
  updateModalContent();
  qrModalEl.classList.add('open');
}

function updateModalContent() {
  if (!currentModalContext) return;
  const { appName, viewName, path, port, https } = currentModalContext;

  const scheme = https ? 'https' : 'http';
  const activeIp = selectedIp || state.lanIp || '127.0.0.1';
  const url = `${scheme}://${activeIp}:${port}${path === '/' ? '' : path}`;

  modalTitleEl.textContent = `${appName} — ${viewName}`;
  modalSubtitleEl.textContent = `Escanea con la cámara de tu teléfono móvil`;
  modalUrlTextEl.textContent = url;
  modalOpenLinkEl.href = url;

  // Generate QR SVG with qrcode library
  try {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrTargetEl.innerHTML = qr.createSvgTag(6, 16);
  } catch (err) {
    qrTargetEl.innerHTML = `<p style="color:red; font-size:0.8rem;">Error generando QR: ${err.message}</p>`;
  }
}

function hideQrModal() {
  qrModalEl.classList.remove('open');
  currentModalContext = null;
}

// API Actions
async function startApp(id) {
  try {
    const res = await fetch(`/api/apps/${id}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.state) {
      state = data.state;
      updateIpDropdowns();
      renderGrid();
      renderLogsTabs();
    }
  } catch (e) {
    console.error(`Error iniciando ${id}:`, e);
  }
}

async function stopApp(id) {
  try {
    const res = await fetch(`/api/apps/${id}/stop`, { method: 'POST' });
    const data = await res.json();
    if (data.state) {
      state = data.state;
      updateIpDropdowns();
      renderGrid();
      renderLogsTabs();
    }
  } catch (e) {
    console.error(`Error deteniendo ${id}:`, e);
  }
}

async function restartApp(id) {
  try {
    const res = await fetch(`/api/apps/${id}/restart`, { method: 'POST' });
    const data = await res.json();
    if (data.state) {
      state = data.state;
      updateIpDropdowns();
      renderGrid();
      renderLogsTabs();
    }
  } catch (e) {
    console.error(`Error reiniciando ${id}:`, e);
  }
}

// SSE Connection
function connectSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    state = data;
    updateIpDropdowns();
    renderGrid();
    renderLogsTabs();
  });

  evtSource.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    if (data.state) {
      state = data.state;
      updateIpDropdowns();
      renderGrid();
      renderLogsTabs();
    }
  });

  evtSource.addEventListener('log', (e) => {
    const data = JSON.parse(e.data);
    if (data.id && data.log) {
      if (!appLogs[data.id]) appLogs[data.id] = [];
      appLogs[data.id].push(data.log);
      if (appLogs[data.id].length > 300) appLogs[data.id].shift();

      if (data.id === activeTabAppId) {
        const timeStr = data.log.timestamp ? new Date(data.log.timestamp).toLocaleTimeString() : '';
        const lineEl = document.createElement('div');
        lineEl.className = 'log-line';
        lineEl.innerHTML = `<span class="log-time">${timeStr}</span>${formatAnsi(data.log.text)}`;
        logsTerminalEl.appendChild(lineEl);

        if (autoscrollChk.checked) {
          logsTerminalEl.scrollTop = logsTerminalEl.scrollHeight;
        }
      }
      renderLogsTabs();
    }
  });

  evtSource.onerror = () => {
    console.warn('SSE desconectado. Reintentando en 3s...');
  };
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  connectSSE();

  // IP Selectors change events
  globalIpSelectEl.addEventListener('change', (e) => {
    setSelectedIp(e.target.value);
  });

  modalIpSelectEl.addEventListener('change', (e) => {
    setSelectedIp(e.target.value);
  });

  // Copy active IP button
  copyLanBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(selectedIp || state.lanIp);
    const prev = copyLanBtn.textContent;
    copyLanBtn.textContent = '✓';
    setTimeout(() => { copyLanBtn.textContent = prev; }, 1500);
  });

  // Start All / Stop All
  startAllBtn.addEventListener('click', async () => {
    await fetch('/api/actions/start-all', { method: 'POST' });
  });

  stopAllBtn.addEventListener('click', async () => {
    await fetch('/api/actions/stop-all', { method: 'POST' });
  });

  // Modal event listeners
  modalCloseBtn.addEventListener('click', hideQrModal);
  qrModalEl.addEventListener('click', (e) => {
    if (e.target === qrModalEl) hideQrModal();
  });

  copyModalUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalUrlTextEl.textContent);
    const prev = copyModalUrlBtn.textContent;
    copyModalUrlBtn.textContent = '✓ Copiado';
    setTimeout(() => { copyModalUrlBtn.textContent = prev; }, 1500);
  });

  clearLogsBtn.addEventListener('click', async () => {
    if (activeTabAppId && appLogs[activeTabAppId]) {
      appLogs[activeTabAppId] = [];
      renderActiveLogs();
      renderLogsTabs();
      await fetch(`/api/apps/${activeTabAppId}/clear-logs`, { method: 'POST' }).catch(() => {});
    }
  });
});
