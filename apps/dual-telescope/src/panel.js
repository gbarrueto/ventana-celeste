// Panel de ajustes del ocular.
//
// Va en la mitad **superior** de la pantalla, que es justamente la que no se ve
// a través del ocular cuando el teléfono está dentro del tubo: ahí no estorba, y
// sigue siendo accesible mientras se arma o se calibra.
//
// Reemplaza a los parámetros por URL. En un teléfono de pruebas, sin conexión y
// sin forma cómoda de recibir un link, escribir `?smooth=0.12&canvas=0.45` a mano
// es peor que un par de deslizadores.
//
// Los valores se guardan en `localStorage`, así que sobreviven a recargas y a
// apagar el equipo: se ajusta una vez y queda.

const CLAVE = 'dual-telescope:ocular';

export const AJUSTES_POR_DEFECTO = {
  // Fracción del error corregida por lectura. 1 = crudo.
  smooth: 0.18,
  // Fracción del alto de pantalla que ocupa la vista, abajo.
  canvas: 0.5,
  // Rotación del canvas, en grados.
  rot: 90,
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

export function crearPanel({ ajustes, onChange, onPair }) {
  const raiz = document.createElement('div');
  raiz.className = 'ocular-panel';

  const fila = (etiqueta, control, valorEl) => {
    const d = document.createElement('div');
    d.className = 'op-row';
    const l = document.createElement('span');
    l.textContent = etiqueta;
    d.append(l, control, valorEl);
    return d;
  };

  const deslizador = (clave, min, max, paso, formato) => {
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min, max, step: paso, value: ajustes[clave] });
    const valor = document.createElement('b');
    valor.textContent = formato(ajustes[clave]);
    input.addEventListener('input', () => {
      ajustes[clave] = parseFloat(input.value);
      valor.textContent = formato(ajustes[clave]);
      guardar(ajustes);
      onChange(clave, ajustes);
    });
    return { input, valor };
  };

  // Suavizado: el punto entre realismo y usabilidad se encuentra moviéndolo con
  // el telescopio apuntando a algo, no razonando.
  const sm = deslizador('smooth', 0.02, 1, 0.01, (v) => v.toFixed(2));
  raiz.appendChild(fila('suavizado', sm.input, sm.valor));

  // Cuánto de la pantalla ocupa la vista: depende del ocular y del calce físico.
  const cv = deslizador('canvas', 0.2, 0.9, 0.05, (v) => `${Math.round(v * 100)}%`);
  raiz.appendChild(fila('vista', cv.input, cv.valor));

  // Las cuatro rotaciones, para encontrar la que coincide con el montaje.
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
  raiz.appendChild(fila('rotación', rotBox, document.createElement('span')));

  const estado = document.createElement('div');
  estado.className = 'op-estado';
  raiz.appendChild(estado);

  // El emparejamiento del enfocador sólo hace falta una vez, y sólo aparece si
  // todavía no hay nada autorizado para este origen.
  const botonPair = document.createElement('button');
  botonPair.className = 'op-pair';
  botonPair.textContent = 'Emparejar enfocador';
  botonPair.style.display = 'none';
  botonPair.onclick = () => onPair?.(botonPair);
  raiz.appendChild(botonPair);

  document.body.appendChild(raiz);

  return {
    raiz,
    setEstado(texto) { estado.textContent = texto; },
    mostrarPair(mostrar) { botonPair.style.display = mostrar ? 'block' : 'none'; },
    // El panel ocupa lo que no ocupa la vista.
    acomodar(fraccionVista) { raiz.style.height = `${(1 - fraccionVista) * 100}%`; },
  };
}
