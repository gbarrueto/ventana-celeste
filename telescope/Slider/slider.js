const FACTOR = 5;
const MAX_SLIDER = 150;

// Función para mapear el valor del slider (0-150) a FOV (MIN_FOV a MAX_FOV)
export function sliderToFov(sliderValue) {
  // Normalizar el valor del slider de 0-150 a 0-1
  const normalized = sliderValue / MAX_SLIDER;

  // 2. Curva exponencial: de [0, 1] a [0, 1]
  const minExp = 0;
  const maxExp = Math.exp(FACTOR) - 1;
  const exponential = (Math.exp(normalized * FACTOR) - 1) / maxExp;
  
  // 3. Mapear al rango FOV
  return MIN_FOV + (exponential * (MAX_FOV - MIN_FOV));
}

// Función inversa para obtener el valor del slider dado un FOV
export function fovToSlider(fov) {
  // 1. Normalizar FOV a 0-1
  const normalizedFov = (fov - MIN_FOV) / (MAX_FOV - MIN_FOV);
    
  // 2. Inversa de la exponencial (Logarítmica)
  const maxExp = Math.exp(FACTOR) - 1;
  const logValue = Math.log(normalizedFov * maxExp + 1) / FACTOR;
  
  // 3. Mapear a 0-150
  return logValue * MAX_SLIDER;
}
