function updateStellariumView({ h, v }) {
    if (!engine?.core?.observer) return;
    engine.core.observer.yaw = -h;
    engine.core.observer.pitch = v;

    // TODO: update limit magnitude when changing view depending on distance to znenith

}

function updateStellariumFov({ fov }) {

    if (!engine?.core) return;
    engine.core.fov = fov;

    engine.core.display_limit_mag = calculate_limit_mag();
}

function stellariumOption({ path, attr }) {
    const obj = path.split(".").reduce((o, k) => o && o[k], engine.core);
    if (obj) {
        obj[attr] = !obj[attr];
    }
}