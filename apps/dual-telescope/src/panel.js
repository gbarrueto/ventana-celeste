// Panel de ajustes, compartido por los dos roles.
//
// Es un panel de **depuración**, no interfaz de producto. Igual que el de kiosk:
// existe para calibrar el montaje y probar hipótesis en el aparato, y no debería
// llegar a una instalación real. Que hoy sea útil no lo convierte en una
// funcionalidad.
//
// Los dos roles necesitan lo mismo con otra configuración, así que el panel se
// arma según el rol en vez de existir dos veces. Qué controles aparecen depende
// de qué puede cambiar cada uno:
//
//   ocular — montado en el tubo: rotación y posición de la vista, tamaño fijo.
//   guía   — se mira de frente: tamaño de la vista, siempre arriba, sin rotación.
//
// Los que dependen de los sensores (suavizado, zona dinámica, recalibrar) sólo
// se arman en el rol que efectivamente los lleva, que lo decide el servidor.
import qrcode from 'qrcode-generator';
import './ui.css';

// Una clave por rol: en desarrollo las dos páginas se abren en el mismo
// navegador, o sea el mismo origen y el mismo localStorage.
const clave = (role) => `dual-telescope:${role}`;

// Rango del zoom, en radianes. Cruza el umbral de la zona dinámica (0.06) para
// poder entrar y salir de ella con el deslizador.
export const FOV_MIN = 0.0005;
export const FOV_MAX = 1.5;

// Ancho a partir del cual se considera pantalla de escritorio. Por debajo, la
// vista se recorta como en el teléfono.
export const PANTALLA_GRANDE = '(min-width: 900px)';

// Sólo lo que el panel ajusta. El suavizado y el umbral de la zona dinámica
// quedaron fijados en código (ver sky.js): tenerlos acá los guardaría en
// localStorage, y un valor viejo guardado le ganaría al del código.
export const AJUSTES_POR_DEFECTO = {
  ocular: {
    // 270 es la posición física del teléfono dentro del tubo.
    rot: 270,
    // Medido contra el ocular real, así que no se expone como control.
    fraccion: 0.5,
    // Centro vertical de la vista, como fracción del alto de pantalla. Abajo.
    pos: 0.75,
    fov: 0.05,
    lado: 'arriba',
  },
  guide: {
    rot: 0,
    fraccion: 0.5,
    // Arriba. Se recalcula al cambiar el tamaño; el guía no mueve la vista.
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

  // `escala` permite deslizadores logarítmicos: el zoom abarca tres órdenes de
  // magnitud y en lineal el extremo cerrado sería inmanejable.
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

  // El ocular tiene tamaño fijo y posición móvil; el guía al revés.
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

  // Emparejamiento: QR con la URL del guía.
  //
  // La dirección la reporta el relay, porque una página no puede conocer la IP
  // de LAN del equipo que la sirve. El protocolo y el puerto salen de `location`,
  // así que la URL queda bien tanto en desarrollo, sobre Vite, como en
  // producción, sin que el servidor tenga que saber en cuál de los dos está.
  const qrCaja = document.createElement('div');
  qrCaja.className = 'op-qr';
  qrCaja.style.display = 'none';
  const qrImg = document.createElement('div');
  const qrUrl = document.createElement('div');
  qrUrl.className = 'op-qr-url';
  qrCaja.append(qrImg, qrUrl);

  let direcciones = [];
  let iDir = 0;
  // Arranca oculto: un QR legible ocupa casi todo el panel y taparía el canvas,
  // y el emparejamiento se hace una vez por sesión de montaje. El SVG tampoco se
  // genera hasta que se muestra.
  let qrVisible = false;

  function pintarQr() {
    const mostrar = qrVisible && direcciones.length > 0;
    qrCaja.style.display = mostrar ? 'block' : 'none';
    if (!mostrar) return;
    const puerto = location.port || (location.protocol === 'https:' ? 443 : 80);
    const url = `${location.protocol}//${direcciones[iDir]}:${puerto}/guide.html`;
    // Tipo 0 deja que la librería elija la versión mínima que entre.
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrImg.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    qrUrl.textContent = direcciones.length > 1
      ? `${url}   (${iDir + 1}/${direcciones.length}, toca para cambiar)`
      : url;
  }

  // Un teléfono puede tener a la vez la interfaz del punto de acceso y una de
  // wifi. Cuál alcanza al guía depende de a cuál esté conectado, así que se
  // pueden recorrer en vez de adivinar.
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
    // El interruptor va antes del QR, así no se mueve de lugar al abrirlo.
    fila('QR del guía', qrBoton);
    caja.appendChild(qrCaja);
  }

  const estado = document.createElement('div');
  estado.className = 'op-estado';
  caja.appendChild(estado);

  // Barra fija arriba de todo: con la vista en un extremo el hueco de ese lado es
  // cero y la caja se recorta al mínimo, así que estos dos botones tienen que
  // seguir alcanzables sin scrollear.
  const barra = document.createElement('div');
  barra.className = 'op-barra';

  // Anclaje manual arriba o abajo. Antes el alto se recortaba solo al hueco que
  // dejaba la vista, lo cual en pantalla completa daba hueco cero y aplastaba el
  // panel. Mover de lado alcanza: la caja mide lo que mide su contenido y deja
  // ver el canvas del otro lado.
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
