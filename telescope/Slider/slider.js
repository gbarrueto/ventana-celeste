// Función para mapear el valor del slider (0-150) a FOV (MIN_FOV a MAX_FOV)
export function sliderToFov(sliderValue) {
  // Normalizar el valor del slider de 0-150 a 0-1
  const normalized = sliderValue / 150;

  // Usar una curva exponencial para el mapeo
  // exp(x*factor) da una curva que crece lento al inicio y rápido al final
  const factor = 8; // Ajusta este valor para controlar la curvatura
  const exponential = Math.exp(normalized * factor);

  // Mapear de [1, exp(factor)] a [MIN_FOV, MAX_FOV]
  const minExp = 1;
  const maxExp = Math.exp(factor);
  const fovRange = MAX_FOV - MIN_FOV;

  return MIN_FOV + ((exponential - minExp) / (maxExp - minExp)) * fovRange;
}

// Función inversa para obtener el valor del slider dado un FOV
export function fovToSlider(fov) {
  const fovRange = MAX_FOV - MIN_FOV;
  const normalized = (fov - MIN_FOV) / fovRange;

  const factor = 5;
  const minExp = 1;
  const maxExp = Math.exp(factor);

  const exponential = normalized * (maxExp - minExp) + minExp;
  const logValue = Math.log(exponential) / factor;

  return logValue * 150;
}
