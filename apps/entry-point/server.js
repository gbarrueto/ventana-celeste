import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, exec } from 'node:child_process';
import os from 'node:os';
import EventEmitter from 'node:events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const APPS_CONFIG = {
  'web-app': {
    id: 'web-app',
    name: 'Web App',
    shortDesc: 'Visor + Control Remoto (WebRTC)',
    description: 'Renderiza el cielo en pantalla grande y usa el teléfono como mando a distancia sincronizado en tiempo real.',
    folder: path.join(ROOT_DIR, 'apps', 'web-app'),
    port: 5173,
    https: true,
    pnpmFilter: '@ventanaceleste/web-app',
    views: [
      { name: 'Visor (Pantalla)', path: '/', desc: 'Vista principal del telescopio' },
      { name: 'Control (Teléfono)', path: '/telescope.html', desc: 'Panel de control con sensores para móvil' },
    ],
  },
  'kiosk-standalone': {
    id: 'kiosk-standalone',
    name: 'Kiosk Standalone',
    shortDesc: 'Dispositivo Autónomo',
    description: 'Modo kiosco todo-en-uno: pantalla táctil y sensores de orientación en el mismo dispositivo físico.',
    folder: path.join(ROOT_DIR, 'apps', 'kiosk-standalone'),
    port: 5174,
    https: true,
    pnpmFilter: '@ventanaceleste/kiosk-standalone',
    views: [
      { name: 'Pantalla Kiosk', path: '/', desc: 'Interfaz interactiva táctil autónoma' },
    ],
  },
  'dual-telescope': {
    id: 'dual-telescope',
    name: 'Dual Telescope',
    shortDesc: 'Dos Teléfonos (WebSocket Relay)',
    description: 'Dos teléfonos sincronizados: uno actúa de Ocular en el tubo y otro de Guía para búsqueda celeste.',
    folder: path.join(ROOT_DIR, 'apps', 'dual-telescope'),
    port: 5175,
    https: true,
    pnpmFilter: '@ventanaceleste/dual-telescope',
    views: [
      { name: 'Ocular', path: '/', desc: 'Pantalla del tubo / visor principal' },
      { name: 'Guía', path: '/guide.html', desc: 'Pantalla de guiado y calibración' },
    ],
  },
  'device-lab': {
    id: 'device-lab',
    name: 'Device Lab',
    shortDesc: 'Banco de Pruebas & Sensores',
    description: 'Entorno de diagnóstico y calibración para sensores de orientación, hardware I/O y Stellarium.',
    folder: path.join(ROOT_DIR, 'apps', 'device-lab'),
    port: 5176,
    https: true,
    pnpmFilter: '@ventanaceleste/device-lab',
    views: [
      { name: 'Banco Principal', path: '/', desc: 'Suite de diagnóstico y calibración' },
      { name: 'Solo Cielo', path: '/sky.html', desc: 'Renderizado puro del cielo' },
      { name: 'Hardware I/O', path: '/io.html', desc: 'Diagnóstico de periféricos y teclas' },
    ],
  },
};

class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.apps = {};
    for (const [id, config] of Object.entries(APPS_CONFIG)) {
      this.apps[id] = {
        ...config,
        status: 'stopped', // 'stopped' | 'starting' | 'running' | 'error'
        process: null,
        pid: null,
        logs: [],
        startedAt: null,
        error: null,
      };
    }
  }

  getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const list = [];
    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets || []) {
        if (net.family === 'IPv4') {
          let type = 'LAN';
          const lower = name.toLowerCase();
          if (net.internal || net.address === '127.0.0.1') {
            type = 'Localhost';
          } else if (lower.includes('tailscale') || net.address.startsWith('100.')) {
            type = 'Tailscale (VPN)';
          } else if (lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless')) {
            type = 'Wi-Fi (LAN)';
          } else if (lower.includes('ethernet') || lower.includes('eth')) {
            type = 'Ethernet (LAN)';
          } else if (lower.includes('vethernet') || lower.includes('wsl')) {
            type = 'Virtual / WSL';
          }

          list.push({
            name,
            address: net.address,
            type,
            internal: net.internal,
            label: `${net.address} — ${name} (${type})`,
          });
        }
      }
    }

    // Sort: Non-internal first, prioritizing Tailscale & Wi-Fi, then localhost
    list.sort((a, b) => {
      if (a.internal && !b.internal) return 1;
      if (!a.internal && b.internal) return -1;
      return 0;
    });

    if (list.length === 0) {
      list.push({
        name: 'Loopback',
        address: '127.0.0.1',
        type: 'Localhost',
        internal: true,
        label: '127.0.0.1 — Loopback (Localhost)',
      });
    }

    return list;
  }

  getPrimaryLanIp() {
    const ifaces = this.getNetworkInterfaces();
    return ifaces.find((i) => !i.internal)?.address || '127.0.0.1';
  }

  getStateSummary() {
    const interfaces = this.getNetworkInterfaces();
    const defaultLanIp = this.getPrimaryLanIp();
    const result = {};

    for (const [id, app] of Object.entries(this.apps)) {
      const scheme = app.https ? 'https' : 'http';
      const localUrl = `${scheme}://localhost:${app.port}`;
      const networkUrl = `${scheme}://${defaultLanIp}:${app.port}`;

      result[id] = {
        id: app.id,
        name: app.name,
        shortDesc: app.shortDesc,
        description: app.description,
        port: app.port,
        https: app.https,
        status: app.status,
        startedAt: app.startedAt,
        error: app.error,
        localUrl,
        networkUrl,
        views: app.views.map((v) => ({
          name: v.name,
          desc: v.desc,
          path: v.path,
          localUrl: `${localUrl}${v.path === '/' ? '' : v.path}`,
          networkUrl: `${networkUrl}${v.path === '/' ? '' : v.path}`,
        })),
        logCount: app.logs.length,
      };
    }

    return {
      hubPort: PORT,
      lanIp: defaultLanIp,
      interfaces,
      apps: result,
    };
  }

  appendLog(id, line) {
    const app = this.apps[id];
    if (!app) return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      text: line,
    };
    app.logs.push(logEntry);
    if (app.logs.length > 300) {
      app.logs.shift();
    }
    this.emit('log', { id, log: logEntry });
  }

  setStatus(id, status, error = null) {
    const app = this.apps[id];
    if (!app) return;
    app.status = status;
    app.error = error;
    if (status === 'running') {
      app.startedAt = new Date().toISOString();
    } else if (status === 'stopped') {
      app.startedAt = null;
      app.pid = null;
      app.process = null;
    }
    this.emit('status-change', { id, status, error, state: this.getStateSummary() });
  }

  async startApp(id) {
    const app = this.apps[id];
    if (!app) throw new Error(`App no encontrada: ${id}`);
    if (app.status === 'running' || app.status === 'starting') {
      return { message: `App ${id} ya está ${app.status}` };
    }

    this.setStatus(id, 'starting');
    this.appendLog(id, `[Hub] Iniciando ${app.name} en puerto ${app.port}...`);

    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
    const args = ['--filter', app.pnpmFilter, 'run', 'dev'];

    try {
      const child = spawn(npmCmd, args, {
        cwd: ROOT_DIR,
        shell: isWindows,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      app.process = child;
      app.pid = child.pid;

      let detectedReady = false;

      const markReady = () => {
        if (!detectedReady) {
          detectedReady = true;
          this.setStatus(id, 'running');
          this.appendLog(id, `[Hub] ${app.name} está lista y respondiendo en el puerto ${app.port}.`);
        }
      };

      // Fallback timer: assume running after 4 seconds if no error
      const readyTimer = setTimeout(() => {
        if (app.status === 'starting') {
          markReady();
        }
      }, 4000);

      child.stdout.on('data', (data) => {
        const str = data.toString();
        const lines = str.split(/\r?\n/).filter((l) => l.length > 0);
        for (const line of lines) {
          this.appendLog(id, line);
          if (line.includes('Local:') || line.includes('ready in') || line.includes('Network:')) {
            clearTimeout(readyTimer);
            markReady();
          }
        }
      });

      child.stderr.on('data', (data) => {
        const str = data.toString();
        const lines = str.split(/\r?\n/).filter((l) => l.length > 0);
        for (const line of lines) {
          this.appendLog(id, `[STDERR] ${line}`);
        }
      });

      child.on('error', (err) => {
        clearTimeout(readyTimer);
        this.appendLog(id, `[Error] Fallo al iniciar proceso: ${err.message}`);
        this.setStatus(id, 'error', err.message);
      });

      child.on('close', (code) => {
        clearTimeout(readyTimer);
        const wasIntentional = app.status === 'stopped';
        if (!wasIntentional) {
          if (code === 0) {
            this.appendLog(id, `[Hub] Proceso terminado con código 0.`);
            this.setStatus(id, 'stopped');
          } else {
            this.appendLog(id, `[Hub] Proceso cerrado inesperadamente con código ${code}.`);
            this.setStatus(id, 'error', `Exit code: ${code}`);
          }
        }
      });

      return { message: `Iniciando ${app.name}...` };
    } catch (err) {
      this.setStatus(id, 'error', err.message);
      throw err;
    }
  }

  async stopApp(id) {
    const app = this.apps[id];
    if (!app) throw new Error(`App no encontrada: ${id}`);
    if (app.status === 'stopped') {
      return { message: `App ${id} ya está detenida` };
    }

    this.appendLog(id, `[Hub] Deteniendo ${app.name}...`);
    const pid = app.pid;
    this.setStatus(id, 'stopped');

    if (pid) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${pid} /T /F`, (err) => {
            if (err) {
              // El proceso pudo haber terminado ya
            }
          });
        } else {
          try {
            process.kill(pid, 'SIGTERM');
          } catch (e) {
            // Ignorar si ya terminó
          }
        }
      } catch (err) {
        this.appendLog(id, `[Hub] Aviso al detener proceso PID ${pid}: ${err.message}`);
      }
    }

    if (app.process) {
      try {
        app.process.kill();
      } catch (e) {}
    }

    app.process = null;
    app.pid = null;
    return { message: `App ${app.name} detenida.` };
  }

  async restartApp(id) {
    await this.stopApp(id);
    await new Promise((r) => setTimeout(r, 600));
    return this.startApp(id);
  }

  async startAll() {
    const promises = Object.keys(this.apps).map((id) => this.startApp(id));
    return Promise.allSettled(promises);
  }

  async stopAll() {
    const promises = Object.keys(this.apps).map((id) => this.stopApp(id));
    return Promise.allSettled(promises);
  }

  cleanupAll() {
    for (const [id, app] of Object.entries(this.apps)) {
      if (app.pid) {
        if (process.platform === 'win32') {
          try {
            exec(`taskkill /pid ${app.pid} /T /F`);
          } catch (e) {}
        } else {
          try {
            process.kill(app.pid, 'SIGKILL');
          } catch (e) {}
        }
      }
      if (app.process) {
        try {
          app.process.kill('SIGKILL');
        } catch (e) {}
      }
    }
  }
}

const manager = new ProcessManager();

// Manejo de salida limpia del servidor
const handleExit = () => {
  console.log('\n[Hub] Cerrando servidor y deteniendo todos los procesos...');
  manager.cleanupAll();
  process.exit(0);
};
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', () => manager.cleanupAll());

// Servidor HTTP
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const sseClients = new Set();

manager.on('status-change', (data) => {
  const payload = `event: status\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
});

manager.on('log', (data) => {
  const payload = `event: log\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manager.getStateSummary()));
    return;
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`event: init\ndata: ${JSON.stringify(manager.getStateSummary())}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/actions/start-all' && req.method === 'POST') {
    await manager.startAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, state: manager.getStateSummary() }));
    return;
  }

  if (pathname === '/api/actions/stop-all' && req.method === 'POST') {
    await manager.stopAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, state: manager.getStateSummary() }));
    return;
  }

  // Match /api/apps/:id/:action
  const appMatch = pathname.match(/^\/api\/apps\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (appMatch) {
    const [, appId, action] = appMatch;
    const app = manager.apps[appId];
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `App ${appId} no encontrada` }));
      return;
    }

    try {
      if (action === 'start' && req.method === 'POST') {
        const result = await manager.startApp(appId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result, state: manager.getStateSummary() }));
        return;
      }
      if (action === 'stop' && req.method === 'POST') {
        const result = await manager.stopApp(appId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result, state: manager.getStateSummary() }));
        return;
      }
      if (action === 'restart' && req.method === 'POST') {
        const result = await manager.restartApp(appId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result, state: manager.getStateSummary() }));
        return;
      }
      if (action === 'logs' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: appId, logs: app.logs }));
        return;
      }
      if (action === 'clear-logs' && req.method === 'POST') {
        app.logs = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: appId }));
        return;
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // Static files in public/
  const publicDir = path.join(__dirname, 'public');
  let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safeFilePath = path.normalize(path.join(publicDir, relativeFilePath));

  if (!safeFilePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safeFilePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(safeFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(safeFilePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ifaces = manager.getNetworkInterfaces();
  console.log('\n🌌 ========================================================');
  console.log('   🔭 VENTANA CELESTE - DEV ENTRY POINT & HUB');
  console.log('========================================================');
  console.log(`   ➜  Local:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  for (const iface of ifaces) {
    if (!iface.internal) {
      console.log(`   ➜  ${iface.type.padEnd(16)}: \x1b[32mhttp://${iface.address}:${PORT}\x1b[0m (\x1b[90m${iface.name}\x1b[0m)`);
    }
  }
  console.log('========================================================\n');
});


