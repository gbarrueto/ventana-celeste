// Apuntado libre con el dedo o el ratón, para sustituir a los sensores mientras
// se prueba. Apuntar el aparato a la dirección real de un objeto no siempre es
// posible dentro de un edificio, y sin esto no hay forma de llevar la vista a un
// planeta concreto para mirar cómo se ve.
//
// No decide qué hacer con el movimiento: entrega incrementos de acimut y altura
// y cada app los escribe donde corresponda. Tampoco detiene los sensores — eso
// lo hace quien lo usa, ignorando sus lecturas mientras esté activo.

const LIMITE_PITCH = 1.5533;   // 89°, para no cruzar el cenit

/**
 * `canvas` es donde se escucha el arrastre. `getFov` devuelve el campo en
 * radianes, que fija cuánto cielo recorre un píxel. `getRotationDeg` devuelve la
 * rotación CSS del canvas: sin ella, arrastrar a la derecha mueve el cielo en la
 * dirección equivocada en las vistas rotadas.
 *
 * `onPan` recibe `{ dYaw, dPitch }` en radianes.
 */
export function createFreeLook({
  canvas,
  getFov = () => 1,
  getRotationDeg = () => 0,
  onPan = () => {},
  enabled = false,
} = {}) {
  if (!canvas) return null;

  let activo = !!enabled;
  let ultimo = null;

  const empezar = (e) => {
    if (!activo) return;
    ultimo = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  };

  const mover = (e) => {
    if (!activo || !ultimo) return;
    const dx = e.clientX - ultimo.x;
    const dy = e.clientY - ultimo.y;
    ultimo = { x: e.clientX, y: e.clientY };

    // El desplazamiento en pantalla se lleva al marco del canvas antes de
    // convertirlo en ángulo.
    const r = (getRotationDeg() * Math.PI) / 180;
    const cx = dx * Math.cos(r) + dy * Math.sin(r);
    const cy = -dx * Math.sin(r) + dy * Math.cos(r);

    // Escalado al zoom: a campo cerrado el mismo arrastre recorre menos cielo,
    // que es lo que hace que el gesto se sienta igual en todo el rango.
    const porPx = (getFov() || 1) / Math.max(1, canvas.clientHeight);
    onPan({ dYaw: -cx * porPx, dPitch: cy * porPx });
    e.preventDefault();
  };

  const soltar = () => { ultimo = null; };

  canvas.addEventListener('pointerdown', empezar);
  window.addEventListener('pointermove', mover, { passive: false });
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);

  return {
    setEnabled(on) {
      activo = !!on;
      if (!activo) ultimo = null;
      canvas.style.touchAction = activo ? 'none' : '';
    },
    isEnabled() { return activo; },
    stop() {
      canvas.removeEventListener('pointerdown', empezar);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      canvas.style.touchAction = '';
    },
  };
}

/** Acota la altura para no cruzar el cenit, donde el acimut queda indefinido. */
export function acotarPitch(pitch) {
  return Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, pitch));
}
