
function toJulianDateIso(iso) {
    const now = new Date(iso);
    const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
    const mjd = jd - 2400000.5; // Modified Julian Date
    return mjd;
}

function setSpeed({ speed: multiplier }) {
    engine.core.time_speed = parseInt(multiplier);
}

function updateDate({ date }) {
    engine.core.observer.utc = date;
}

let datetimeInterval = null;

function setDatetimeInterval() {
    datetimeInterval = setInterval(() => {
        Protobject.Core.send({ engineUTC: engine.core.observer.utc }).to(
            "telescope.html"
        );
    }, 300);
}

function clearDatetimeInterval() {
    clearInterval(datetimeInterval);
}