/**
 * Load configuration based on Vite environment (mode).
 * Usage: const config = await loadConfig()
 *
 * Modes:
 * - development: Development on PC (no calibration, no blur timer, debug ON)
 * - dev-device: Development on mobile device (calibration, blur timer, debug ON)
 * - production: Production offline (calibration, blur timer, debug OFF)
 */
import { loadConfig as loadConfigFromMode } from '@ventanaceleste/core';

export function loadConfig() {
  return loadConfigFromMode({
    development: () => import('./config.dev.js'),
    'dev-device': () => import('./config.dev-device.js'),
    production: () => import('./config.prod.js'),
  }, { fallbackMode: 'production' });
}
