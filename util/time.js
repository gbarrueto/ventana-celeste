export function toJulianDateIso(iso) {
  const now = new Date(iso);
  const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
  const mjd = jd - 2400000.5; // Modified Julian Date
  return mjd;
}

export function setEngineSpeed({ speed: multiplier }) {
  engine.core.time_speed = parseInt(multiplier);
}

export function updateDate({ date }) {
  engine.core.observer.utc = date;
}

let datetimeInterval = null;

export function setDatetimeInterval() {
  datetimeInterval = setInterval(() => {
    Protobject.Core.send({
      msg: "syncTime",
      values: { engineUTC: engine.core.observer.utc },
    }).to("telescope.html");
  }, 300);
}

export function clearDatetimeInterval() {
  clearInterval(datetimeInterval);
}

