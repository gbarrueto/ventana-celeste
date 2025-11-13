// Centralized throttle / timing configuration for messaging and UI update rates
// Los sliders no necesitan ser menores a 100 ms, se pueden aumentar mas para optimizar rendimiento

const ZOOM_THROTTLE_MS = 100; // throttle for zoom slider handler (~60fps)
const FOV_SEND_MS = 50; // outgoing updateFov message throttle
const BLUR_SEND_MS = 100; // outgoing blur message throttle
const ORIENTATION_SEND_MS = 50;
const SEEING_THROTTLE_MS = 100; // seeing slider debounce default
const POLLUTION_THROTTLE_MS = 100;
const LOCATION_SEND_MS = 50; // location update throttle
