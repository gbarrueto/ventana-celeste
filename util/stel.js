function updateStellariumView({ h, v }) {
    if (!engine?.core?.observer) return;
    engine.core.observer.yaw = -h;
    engine.core.observer.pitch = v;
}

function updateStellariumFov({ fov }) {

    if (!engine?.core) return;
    engine.core.fov = fov;

    engine.core.display_limit_mag = limitingMag(engine.core.bortle_index, fov);
}

function stellariumOption({ path, attr }) {
    const obj = path.split(".").reduce((o, k) => o && o[k], engine.core);
    if (obj) {
        obj[attr] = !obj[attr];
    }
}