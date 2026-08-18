// Panel de ajustes del ocular.
//
// Es un panel de **depuración**, no interfaz de producto. Igual que el de kiosk:
// existe para calibrar el montaje y probar hipótesis en el aparato, y no debería
// llegar a una instalación real. Que hoy sea útil no lo convierte en una
// funcionalidad.
//
// Vive en un popover: el canvas puede moverse a lo largo de la pantalla, así que
// cualquier franja fija termina chocando con él. Cerrado deja sólo un botón
// chico; abierto tapa todo, que es lo correcto porque mientras se ajusta se está
// mirando el teléfono, no el ocular.
//
// Los valores se guardan en `localStorage`, así que sobreviven a recargas y a
// apagar el equipo.

const CLAVE = 'dual-telescope:ocular';

// Fracción del alto de pantalla que ocupa la vista. Medido contra el ocular
// real, así que es constante y no un ajuste.
export const FRACCION_VISTA = 0.5;

// Rango del zoom, en radianes. Cruza el umbral de la zona dinámica (0.06) para
// poder entrar y salir de ella con el deslizador.
export const FOV_MIN = 0.0005;
export const FOV_MAX = 1.5;

export const AJUSTES_POR_DEFECTO = {
  // Fracción del error corregida por lectura. 1 = crudo.
  smooth: 0.18,
  // Rotación del canvas, en grados. 270 es la posición física del teléfono.
  rot: 270,
  // Centro vertical de la vista, como fracción del alto de pantalla.
  pos: 1 - FRACCION_VISTA / 2,
  // Campo visual en radianes.
  fov: 0.05,
  // Zona dinámica del zoom activada.
  dyn: false,
  // De qué lado del canvas se ancla el panel: 'arriba' o 'abajo'.
  lado: 'arriba',
};

export function cargarAjustes() {
  try {
    return { ...AJUSTES_POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return { ...AJUSTES_POR_DEFECTO };
  }
}

function guardar(ajustes) {
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* modo privado */ }
}

export function crearPanel({ ajustes, onChange, onPair, onRecalibrar }) {
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
  const deslizador = (clave, { min, max, paso, formato, escala = null }) => {
    const aCrudo = escala ? escala.a : (v) => v;
    const deCrudo = escala ? escala.de : (v) => v;
    const input = document.createElement('input');
    Object.assign(input, {
      type: 'range', min: aCrudo(min), max: aCrudo(max), step: paso, value: aCrudo(ajustes[clave]),
    });
    const valor = document.createElement('b');
    valor.textContent = formato(ajustes[clave]);
    input.addEventListener('input', () => {
      ajustes[clave] = deCrudo(parseFloat(input.value));
      valor.textContent = formato(ajustes[clave]);
      guardar(ajustes);
      onChange(clave, ajustes);
    });
    return { input, valor };
  };

  const sm = deslizador('smooth', { min: 0.02, max: 1, paso: 0.01, formato: (v) => v.toFixed(2) });
  fila('suavizado', sm.input, sm.valor);

  const ps = deslizador('pos', {
    min: FRACCION_VISTA / 2, max: 1 - FRACCION_VISTA / 2, paso: 0.01,
    formato: (v) => `${Math.round(v * 100)}%`,
  });
  fila('posición', ps.input, ps.valor);

  const zm = deslizador('fov', {
    min: FOV_MIN, max: FOV_MAX, paso: 0.001,
    escala: { a: Math.log, de: Math.exp },
    formato: (v) => (v >= 0.02 ? `${((v * 180) / Math.PI).toFixed(1)}°` : `${((v * 180 * 60) / Math.PI).toFixed(0)}'`),
  });
  fila('zoom', zm.input, zm.valor);

  const rotBox = document.createElement('div');
  rotBox.className = 'op-rot';
  for (const g of [0, 90, 180, 270]) {
    const b = document.createElement('button');
    b.textContent = `${g}°`;
    b.className = ajustes.rot === g ? 'on' : '';
    b.onclick = () => {
      ajustes.rot = g;
      guardar(ajustes);
      for (const o of rotBox.children) o.className = '';
      b.className = 'on';
      onChange('rot', ajustes);
    };
    rotBox.appendChild(b);
  }
  fila('rotación', rotBox);

  // La zona dinámica integra el giroscopio escalado por zoom. Con el montaje
  // rotado usa ejes sin corregir, así que va apagada por defecto.
  const dyn = document.createElement('button');
  dyn.className = `op-toggle ${ajustes.dyn ? 'on' : ''}`;
  dyn.textContent = ajustes.dyn ? 'activada' : 'apagada';
  dyn.onclick = () => {
    ajustes.dyn = !ajustes.dyn;
    dyn.className = `op-toggle ${ajustes.dyn ? 'on' : ''}`;
    dyn.textContent = ajustes.dyn ? 'activada' : 'apagada';
    guardar(ajustes);
    onChange('dyn', ajustes);
  };
  fila('zona dinám.', dyn);

  const recal = document.createElement('button');
  recal.className = 'op-cerrar';
  recal.textContent = 'Recalibrar giroscopio';
  recal.onclick = () => {
    capa.classList.remove('abierta');
    onRecalibrar?.();
  };
  caja.appendChild(recal);

  const estado = document.createElement('div');
  estado.className = 'op-estado';
  caja.appendChild(estado);

  const botonPair = document.createElement('button');
  botonPair.className = 'op-pair';
  botonPair.textContent = 'Emparejar enfocador';
  botonPair.style.display = 'none';
  botonPair.onclick = () => onPair?.(botonPair);
  caja.appendChild(botonPair);

  // Barra fija arriba de todo: con la vista en un extremo el hueco de ese lado es
  // cero y la caja se recorta al mínimo, así que estos dos botones tienen que
  // seguir alcanzables sin scrollear.
  const barra = document.createElement('div');
  barra.className = 'op-barra';

  // Cambiar de lado es lo que permite ver el canvas mientras se lo ajusta: el
  // hueco libre depende de dónde esté la vista, y con la vista al medio los dos
  // huecos son chicos.
  const lado = document.createElement('button');
  lado.className = 'op-cerrar';
  const pintarLado = () => { lado.textContent = ajustes.lado === 'arriba' ? '↓ abajo' : '↑ arriba'; };
  pintarLado();
  lado.onclick = () => {
    ajustes.lado = ajustes.lado === 'arriba' ? 'abajo' : 'arriba';
    pintarLado();
    guardar(ajustes);
    onChange('lado', ajustes);
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
    mostrarPair(mostrar) { botonPair.style.display = mostrar ? 'block' : 'none'; },

    // Ancla el panel en el hueco que deja la vista y le limita el alto a ese
    // hueco, así no puede taparla. Si no entra, scrollea adentro.
    acomodar({ arriba, abajo }) {
      const enArriba = ajustes.lado === 'arriba';
      // El mínimo deja ver la barra: desde ahí se puede mandar el panel al otro
      // lado aunque de este no quede hueco.
      const hueco = Math.max(76, enArriba ? arriba : abajo);
      caja.style.top = enArriba ? '0px' : 'auto';
      caja.style.bottom = enArriba ? 'auto' : '0px';
      caja.style.maxHeight = `${hueco}px`;
      abridor.style.top = enArriba ? '8px' : 'auto';
      abridor.style.bottom = enArriba ? 'auto' : '8px';
    },
  };
}
