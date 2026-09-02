// Panel de depuración y ajustes para Ocular y Guía.
import qrcode from 'qrcode-generator';
import './ui.css';

const clave = (role) => `dual-telescope:${role}`;

// Rango de FOV (radianes).
export const FOV_MIN = 0.0005;
export const FOV_MAX = 1.5;

export const PANTALLA_GRANDE = '(min-width: 900px)';
export const UMBRAL_DINAMICO = 0.06;

export const AJUSTES_POR_DEFECTO = {
  ocular: {
    rot: 270,
    fraccion: 0.5,
    pos: 0.75,
    fov: UMBRAL_DINAMICO * 1.3,
    lado: 'arriba',
  },
  guide: {
    rot: 0,
    fraccion: 0.5,
    pos: 0.25,
    fov: 0.14,
    lado: 'abajo',
  },
};

export function cargarAjustes(role) {
  const base = AJUSTES_POR_DEFECTO[role] ?? AJUSTES_POR_DEFECTO.ocular;
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(clave(role)) ?? '{}') };
  } catch {
    return { ...base };
  }
}

function guardar(role, ajustes) {
  try { localStorage.setItem(clave(role), JSON.stringify(ajustes)); } catch { /* modo privado */ }
}

export function crearPanel({ role, ajustes, esFuente = false, onChange, onRecalibrar }) {
  const esOcular = role === 'ocular';

  const capa = document.createElement('div');
  capa.className = 'op-capa';

  const caja = document.createElement('div');
  caja.className = 'op-caja';
  capa.appendChild(caja);

  const abridor = document.createElement('button');
  abridor.className = 'op-abridor';
  abridor.textContent = '≡';
  abridor.onclick = () => capa.classList.add('abierta');
  capa.addEventListener('click', (e) => { if (e.target === capa) capa.classList.remove('abierta'); });

  const emitir = (c) => { guardar(role, ajustes); onChange(c, ajustes); };

  const fila = (etiqueta, control, valorEl) => {
    const d = document.createElement('div');
    d.className = 'op-row';
    const l = document.createElement('span');
    l.textContent = etiqueta;
    d.append(l, control, valorEl ?? document.createElement('span'));
    caja.appendChild(d);
    return d;
  };

  const deslizador = (c, { min, max, paso, formato, escala = null }) => {
    const aCrudo = escala ? escala.a : (v) => v;
    const deCrudo = escala ? escala.de : (v) => v;
    const input = document.createElement('input');
    Object.assign(input, {
      type: 'range', min: aCrudo(min), max: aCrudo(max), step: paso, value: aCrudo(ajustes[c]),
    });
    const valor = document.createElement('b');
    valor.textContent = formato(ajustes[c]);
    input.addEventListener('input', () => {
      ajustes[c] = deCrudo(parseFloat(input.value));
      valor.textContent = formato(ajustes[c]);
      emitir(c);
    });
    return { input, valor };
  };

  const pct = (v) => `${Math.round(v * 100)}%`;

  if (esOcular) {
    const ps = deslizador('pos', {
      min: ajustes.fraccion / 2, max: 1 - ajustes.fraccion / 2, paso: 0.01, formato: pct,
    });
    fila('posición', ps.input, ps.valor);
  } else {
    const fr = deslizador('fraccion', { min: 0.2, max: 1, paso: 0.05, formato: pct });
    fila('tamaño', fr.input, fr.valor);
  }

  const zm = deslizador('fov', {
    min: FOV_MIN, max: FOV_MAX, paso: 0.001,
    escala: { a: Math.log, de: Math.exp },
    formato: (v) => (v >= 0.02 ? `${((v * 180) / Math.PI).toFixed(1)}°` : `${((v * 180 * 60) / Math.PI).toFixed(0)}'`),
  });
  fila('zoom', zm.input, zm.valor);

  if (esOcular) {
    const rotBox = document.createElement('div');
    rotBox.className = 'op-rot';
    for (const g of [0, 90, 180, 270]) {
      const b = document.createElement('button');
      b.textContent = `${g}°`;
      b.className = ajustes.rot === g ? 'on' : '';
      b.onclick = () => {
        ajustes.rot = g;
        for (const o of rotBox.children) o.className = '';
        b.className = 'on';
        emitir('rot');
      };
      rotBox.appendChild(b);
    }
    fila('rotación', rotBox);
  }

  if (esFuente) {
    const recal = document.createElement('button');
    recal.className = 'op-cerrar';
    recal.textContent = 'Recalibrar giroscopio';
    recal.onclick = () => { capa.classList.remove('abierta'); onRecalibrar?.(); };
    caja.appendChild(recal);
  }

  // QR con la URL del guía.
  const qrCaja = document.createElement('div');
  qrCaja.className = 'op-qr';
  qrCaja.style.display = 'none';
  const qrImg = document.createElement('div');
  const qrUrl = document.createElement('div');
  qrUrl.className = 'op-qr-url';
  qrCaja.append(qrImg, qrUrl);

  let direcciones = [];
  let iDir = 0;
  let qrVisible = false;

  function pintarQr() {
    const mostrar = qrVisible && direcciones.length > 0;
    qrCaja.style.display = mostrar ? 'block' : 'none';
    if (!mostrar) return;
    const puerto = location.port || (location.protocol === 'https:' ? 443 : 80);
    const url = `${location.protocol}//${direcciones[iDir]}:${puerto}/guide.html`;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrImg.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    qrUrl.textContent = direcciones.length > 1
      ? `${url}   (${iDir + 1}/${direcciones.length}, toca para cambiar)`
      : url;
  }

  qrCaja.onclick = () => {
    if (direcciones.length < 2) return;
    iDir = (iDir + 1) % direcciones.length;
    pintarQr();
  };

  if (esOcular) {
    const qrBoton = document.createElement('button');
    const pintarBoton = () => {
      qrBoton.className = `op-toggle ${qrVisible ? 'on' : ''}`;
      qrBoton.textContent = qrVisible ? 'ocultar' : 'mostrar';
    };
    pintarBoton();
    qrBoton.onclick = () => {
      qrVisible = !qrVisible;
      pintarBoton();
      pintarQr();
    };
    fila('QR del guía', qrBoton);
    caja.appendChild(qrCaja);
  }

  const estado = document.createElement('div');
  estado.className = 'op-estado';
  caja.appendChild(estado);

  const barra = document.createElement('div');
  barra.className = 'op-barra';

  const lado = document.createElement('button');
  lado.className = 'op-cerrar';
  const aplicarLado = () => {
    const enArriba = ajustes.lado === 'arriba';
    lado.textContent = enArriba ? '↓ abajo' : '↑ arriba';
    caja.style.top = enArriba ? '8px' : 'auto';
    caja.style.bottom = enArriba ? 'auto' : '8px';
    abridor.style.top = enArriba ? '8px' : 'auto';
    abridor.style.bottom = enArriba ? 'auto' : '8px';
  };
  aplicarLado();
  lado.onclick = () => {
    ajustes.lado = ajustes.lado === 'arriba' ? 'abajo' : 'arriba';
    aplicarLado();
    emitir('lado');
  };

  const cerrar = document.createElement('button');
  cerrar.className = 'op-cerrar';
  cerrar.textContent = 'Cerrar';
  cerrar.onclick = () => capa.classList.remove('abierta');
  barra.append(lado, cerrar);
  caja.prepend(barra);

  document.body.append(abridor, capa);

  return {
    caja,
    setEstado(texto) { estado.textContent = texto; },
    setDirecciones(lista) {
      direcciones = lista ?? [];
      iDir = 0;
      pintarQr();
    },
  };
}
