import { calculate_limit_mag } from "../limit_mag/limit_magnitude.js";
import { applyPollution } from "./location.js";
import { updateStellariumBlur } from "./overlay.js";

// Enviar datos a telescope para sincronizar
export function getSynchronizeData() {
    if (!engine?.core?.observer) return;
    // 1. Obtener el tiempo actual del motor principal
    // engine.core.observer.utc devuelve el tiempo en MJD
    const time = engine.core.observer.utc;

    // 2. Obtener la ubicación actual
    // Asumiendo que guardas la ubicación en una variable global o puedes extraerla del motor
    const location =  {
        cityName: "Custom",
        lat: engine.core.observer.latitude,
        lon: engine.core.observer.longitude,
        elev: engine.core.observer.elevation,
        mag: null
    };

    const angle = {
        yaw: engine.core.observer.yaw,
        pitch: engine.core.observer.pitch,
    }

    Protobject.Core.send({
        msg: "setSynchronizedData",
        values: { data: {
            time,
            location,
            angle,
        } },
    }).to("telescope.html");
}

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
    // Atm OFF -> Disable atmospheric effects (pollution, seeing, etc)
    if (path === "atmosphere" && attr === "visible") {

        // console.log("Atmosphere toggled:", obj[attr]);
        // console.log("Current SQM:", SQM_READING);
        // obj[attr] ? applyPollution({ mag: CITY_SQM_READING }) : applyPollution({ mag: 22 });
        // TODO: Disable seeing effects

        if (!obj[attr]) { // Atmosphere turned OFF
            // setSeeingOpacity(0); -> NOTE: we need to check simple/advanced mode first
            applyPollution({ mag: 22 }); // Pristine sky
        }
        else { // Atmosphere turned ON
            // setSeeingOpacity(1);
            applyPollution({ mag: CITY_SQM_READING }); // Restore previous sky brightness
        }
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

function enableSeeingEffect(enable) {
    const seeingElement = document.getElementById('effect-canvas');
    if (!seeingElement) return;

    seeingElement.style.visibility = enable ? 'visible' : 'hidden';
}

export function enableSimpleModeSettings() {
    engine.core.planets.hints_visible = true;
    engine.core.minor_planets.hints_visible = true;
    engine.core.stars.hints_visible = true;
    engine.core.cardinals.visible = true;
    setEyepieceOverlayOpacity(0);
    setSeeingOpacity(0);
    updateStellariumBlur({ blur: 0 })
    enableSeeingEffect(false);
}

export function enableAdvancedModeSettings() {
    engine.core.planets.hints_visible = false;
    engine.core.minor_planets.hints_visible = false;
    engine.core.stars.hints_visible = false;
    engine.core.cardinals.visible = false;
    setEyepieceOverlayOpacity(1);
    setSeeingOpacity(1);
    enableSeeingEffect(true);
}