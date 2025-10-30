// function getSunAltAz() {
//     if (!engine) return;
//     const sun = engine.getObj("NAME Sun");
//     const pvo = sun.getInfo('pvo', engine.observer);
//     const altaz = engine.convertFrame(engine.observer, 'ICRF', 'OBSERVED', pvo[0]);
    
//     const az = engine.anp(engine.c2s(altaz)[0]);
//     const alt = engine.anp(engine.c2s(altaz)[1]);

//     return {alt, az};
// }

export function getObjAltAz(obj) {
    if (!engine) return;

    const pvo = obj.getInfo('pvo', engine.observer);
    const altaz = engine.convertFrame(engine.observer, 'ICRF', 'OBSERVED', pvo[0]);
    
    const az = radToDeg(engine.anp(engine.c2s(altaz)[0]));
    let alt = radToDeg(engine.anp(engine.c2s(altaz)[1]));

    if (alt > 90) alt = (alt - 360);

    return {alt, az};

}

export function isNightime() {
    if (!engine) return;
    const sun = engine.getObj("NAME Sun");
    const sunPos = getObjAltAz(sun);

    if (sunPos && sunPos.alt > -3) {
        return false;
    }
    return true;
}

function radToDeg(val) {
   return val * (180 / Math.PI);
}