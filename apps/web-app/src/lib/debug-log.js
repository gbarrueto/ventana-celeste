/**
 * On-screen console for the telescope page.
 *
 * Protobject forwards the telescope's console to the viewer — but only *after*
 * a peer connection exists. Everything that happens before that (including the
 * reason a connection never happens) is invisible on a phone, and USB remote
 * debugging isn't always available. This mirrors console output into a panel
 * drawn on the page itself, so the phone can be diagnosed with no tooling.
 *
 * Enabled in dev builds, or anywhere via `?debug=1`. Never in a production
 * build unless explicitly asked for via the query param.
 */

const MAX_LINES = 200;

let panel = null;
let listEl = null;
let installed = false;

function shouldEnable() {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
  } catch {
    // URL parsing shouldn't be able to break startup
  }
  return Boolean(import.meta.env?.DEV);
}

function formatArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

const LEVEL_COLORS = {
  log: '#9fe6a0',
  info: '#7fd1ff',
  warn: '#ffd166',
  error: '#ff8a65',
};

function createPanel() {
  panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    left: '0',
    right: '0',
    bottom: '0',
    // Above the calibration overlay (999999) so it stays readable while the
    // page is still showing "Conectando…" — which is exactly when it's needed.
    zIndex: '2147483647',
    maxHeight: '45vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0, 0, 0, 0.88)',
    borderTop: '2px solid #ff7a0d',
    fontFamily: 'monospace, monospace',
    fontSize: '11px',
    color: '#e8ecf5',
    boxSizing: 'border-box',
  });

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    flexShrink: '0',
  });

  const title = document.createElement('span');
  title.textContent = 'debug';
  Object.assign(title.style, { fontWeight: '700', color: '#ff7a0d', letterSpacing: '0.08em' });

  const buttons = document.createElement('div');
  Object.assign(buttons.style, { display: 'flex', gap: '6px' });

  function makeButton(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      background: 'rgba(255,255,255,0.1)',
      color: '#e8ecf5',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 10px',
      fontFamily: 'inherit',
      fontSize: '11px',
      cursor: 'pointer',
    });
    b.addEventListener('click', onClick);
    return b;
  }

  listEl = document.createElement('div');
  Object.assign(listEl.style, {
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '6px 10px 10px',
    lineHeight: '1.45',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    flex: '1',
  });

  const clearBtn = makeButton('clear', () => { listEl.innerHTML = ''; });
  const hideBtn = makeButton('hide', () => {
    const collapsed = listEl.style.display === 'none';
    listEl.style.display = collapsed ? 'block' : 'none';
    hideBtn.textContent = collapsed ? 'hide' : 'show';
  });

  buttons.appendChild(clearBtn);
  buttons.appendChild(hideBtn);
  bar.appendChild(title);
  bar.appendChild(buttons);
  panel.appendChild(bar);
  panel.appendChild(listEl);

  const attach = () => document.body.appendChild(panel);
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
}

function append(level, args) {
  if (!listEl) return;

  const line = document.createElement('div');
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  line.textContent = `${stamp} ${args.map(formatArg).join(' ')}`;
  line.style.color = LEVEL_COLORS[level] ?? LEVEL_COLORS.log;
  if (level === 'error' || level === 'warn') line.style.fontWeight = '700';

  listEl.appendChild(line);
  while (listEl.childElementCount > MAX_LINES) listEl.removeChild(listEl.firstChild);
  listEl.scrollTop = listEl.scrollHeight;
}

export function initDebugLog() {
  if (installed || !shouldEnable()) return;
  installed = true;

  createPanel();

  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      // Never let a rendering failure here swallow the real log call.
      try { append(level, args); } catch { /* no-op */ }
    };
  }

  // Uncaught failures are the ones most likely to explain a page that just
  // sits there, and are precisely what's invisible without a console.
  window.addEventListener('error', (event) => {
    append('error', [`uncaught: ${event.message}`, `@ ${event.filename}:${event.lineno}`]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    append('error', ['unhandled rejection:', formatArg(event.reason)]);
  });

  console.info('[debug] on-screen log ready —', navigator.userAgent);
  console.info('[debug] origin:', window.location.origin, '| ptjuid:',
    new URLSearchParams(window.location.search).get('ptjuid'));
}
