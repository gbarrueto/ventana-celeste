function displayDateTime(e) {
  if (optionSelection(e)) return;

  let datetimeSection = document.getElementById('datetimeSection')

  // let localTime = new Date();

    // datetimeSection.style.display = 'flex';
    // datetimeSection.style.transform = 'translateY(0)';
  datetimeSection.classList.add('active');

  updateSpeedButtons();

  setTimeout(() => {
    showTimeSelector();
    createInterval();
  }, 100);
}

function applyCurrentDate() {
  const dateTZ = getISOWithTZ(new Date());
  updateDate(dateTZ);
}

function setSpeed(multiplier) {
  Protobject.Core.send({msg:"setSpeed", values: { speed: multiplier }}).to("index.html");
  timeSpeed = multiplier;
  updateSpeedButtons();
}
// Send time in MJD to engine
// date is ISO String in UTC
function updateStelDate(date) {

  const mjd = isoToMJD(date);

  // console.log("Sending MJD to engine:", mjd);

  Protobject.Core.send({ msg:"updateDate", values: { date: mjd } }).to("index.html");
  // change guidescope time
  engine.core.observer.utc = mjd;
}

function createInterval() {
  Protobject.Core.send({ msg: "setDatetimeInterval", values: { active: true } }).to("index.html");
}

function isoToMJD(isoString) {
  const date = new Date(isoString);
  const jd = date.getTime() / 86400000 + 2440587.5;
  return jd - 2400000.5;
}

function fromMJDToDate(mjd) {
  const jd = mjd + 2400000.5;
  return new Date((jd - 2440587.5) * 86400000);
}

function getISOWithTZ(date) {
  const offset = currentTZ;
  const localOffset = -new Date().getTimezoneOffset() / 60;

  if (localOffset === offset) {
    return date.toISOString();
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const timeZone = `UTC${offset >= 0 ? "+" : ""}${offset}`;

  const dt = luxon.DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: timeZone }
  );
  return dt.toUTC().toISO();
}
function fromMJDToLuxon(mjd, offsetHours = 0) {
  const JD = mjd + 2400000.5;
  const unixMs = (JD - 2440587.5) * 86400000;

  // Creamos DateTime en UTC y lo movemos al offset
  const zone = `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`;
  return luxon.DateTime.fromMillis(unixMs, { zone: "UTC" }).setZone(zone);
}

function updateSpeedButtons() {
  document
    .querySelectorAll("#datetimeSection .control-button")
    .forEach((btn) => {
      const text = btn.textContent.trim();

      const match =
        (timeSpeed === 0 && text.startsWith("🟥")) ||
        (timeSpeed === 1 && text.startsWith("🕒")) ||
        (timeSpeed === 10 && text.includes("10x")) ||
        (timeSpeed === 60 && text.includes("60x")) ||
        (timeSpeed === 3600 && text.includes("3600x"));

      btn.classList.toggle("active", match);
    });
}

function showTimeSelector() {
  if (activeFlatpickr) return;

  activeFlatpickr = flatpickr("#datetime-picker", {
    enableTime: true,
    dateFormat: "Y-m-d\\TH:i:S",
    time_24hr: true,
    defaultDate: new Date(),
    inline: true,
    appendTo: document.getElementById("datetime-picker"),
    onOpen: () => (isUserTouchingCalendar = true),
    onClose: () => (isUserTouchingCalendar = false),

    onValueUpdate: function (selectedDates) {
      console.log("Called onValueUpdate function");
      if (selectedDates.length > 0) {
        // fecha seleccionada siempre respecto al huso local
        const date = selectedDates[0];
        const dateTZ = getISOWithTZ(date);
        //console.log("Non ISO DATE onUpdate", selectedDates[0]);
        
        lastManualChange = Date.now();
        // console.log("ToISO with TZ converted DATE onUpdate", dateTZ);
        updateStelDate(dateTZ);
        // updateDateTimeout = null;
      }
    },
  });

  // Sincronización periódica con el engine
  flatpickrSyncInterval = setInterval(() => {
    if (!activeFlatpickr || !engineUTC) return;

    const now = Date.now();
    const recentlyChanged = now - lastManualChange < 2000;

    if (!isUserTouchingCalendar && !recentlyChanged) {
      const dateTime = fromMJDToLuxon(engineUTC, currentTZ);
      // const time = fromMJDToDate(engineUTC);
      activeFlatpickr.setDate(dateTime.toISO(), false);
    }
  }, 300);
}

