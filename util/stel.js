import { calculate_limit_mag } from "../limit_mag/limit_magnitude.js";
import { updateStellariumBlur } from "./overlay.js";

export function updateStellariumView({ h, v }) {
    if (!engine?.core?.observer) return;
    engine.core.observer.yaw = -h;
    engine.core.observer.pitch = v;

    // TODO: update limit magnitude when changing view depending on distance to zenith

}

export function updateStellariumFov({ fov }) {

    if (!engine?.core) return;
    engine.core.fov = fov;

    const deg_fov = (fov * 180) / Math.PI;

    EYEPIECE_FL = FOCAL_LENGTH * deg_fov / 100;

    engine.core.display_limit_mag = calculate_limit_mag();
}

export function stellariumOption({ path, attr }) {
    const obj = path.split(".").reduce((o, k) => o && o[k], engine.core);
    if (obj) {
        obj[attr] = !obj[attr];
    }
}

export function setEyepieceOverlayOpacity(opacity) {
    const overlay = document.getElementById('eyepiece-overlay');
    overlay.style.opacity = opacity;
}

export function setSeeingOpacity(opacity) {
    const seeing = document.getElementById('effect-canvas');
    seeing.style.opacity = opacity;
}

export function enableSimpleModeSettings() {
    engine.core.planets.hints_visible = true;
    engine.core.minor_planets.hints_visible = true;
    engine.core.stars.hints_visible = true;
    engine.core.cardinals.visible = true;
    setEyepieceOverlayOpacity(0);
    setSeeingOpacity(0);
    updateStellariumBlur({ blur: 0 })
}

export function enableAdvancedModeSettings() {
    engine.core.planets.hints_visible = false;
    engine.core.minor_planets.hints_visible = false;
    engine.core.stars.hints_visible = false;
    engine.core.cardinals.visible = false;
    setEyepieceOverlayOpacity(1);
    setSeeingOpacity(1);
}