/**
 * Load configuration based on Vite environment (mode).
 * Usage: const config = await loadConfig()
 * 
 * Modes:
 * - development: Development on PC (no calibration, no blur timer, debug ON)
 * - dev-device: Development on mobile device (calibration, blur timer, debug ON)
 * - production: Production offline (calibration, blur timer, debug OFF)
 */

export async function loadConfig() {
  const mode = import.meta.env.MODE;

  console.log(`Loading config for mode: ${mode}`);

  if (mode === 'development') {
    return (await import('./config.dev.js')).default;
  } else if (mode === 'dev-device') {
    return (await import('./config.dev-device.js')).default;
  } else {
    // Default to production for any other mode (including 'production')
    return (await import('./config.prod.js')).default;
  }
}
