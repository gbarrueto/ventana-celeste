function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

  let localTime = new Date();

  if (!datetimeSection) {
    let section = `
      <section id="datetimeSection" class="active" style="display: block;">
        <h3>Select Date & Time</h3>

        <div id="datetime-picker" style="margin-bottom: 1rem; width: 100%;"></div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
          <button class="control-button" onclick="setSpeed(0)">🟥 Stop</button>
          <button class="control-button" onclick="setSpeed(1)">🕒 Realtime</button>
          <button class="control-button" onclick="setSpeed(10)">⏩ 10x</button>
          <button class="control-button" onclick="setSpeed(60)">⏩ 60x</button>
          <button class="control-button" onclick="setSpeed(3600)">⏩ 3600x</button>
        </div>
        <p class="engine-time-mjd">Engine: <span id="engine-time-value">0</span></p>
        <p class="engine-time-utc">Engine UTC: <span id="engine-time-value-utc">0</span></p>
        <p class="timezone">TimeZone: <span id="time-zone-value">-4</span></p>
      </section>
    `;

    interactionSection.insertAdjacentHTML("beforeend", section);
  }

  else {
    datetimeSection.style.display = 'block';
    datetimeSection.classList.add('active');
  }

  updateSpeedButtons();

  setTimeout(() => {
    showTimeSelector();
    createInterval();
  }, 100);
}

function setSpeed(multiplier) {
  Protobject.Core.send({msg:"setSpeed", values: { speed: multiplier }}).to("index.html");
  timeSpeed = multiplier;
  updateSpeedButtons();
}
// Send time in MJD to engine
// date is ISO String in UTC
function updateDate(date) {

  const mjd = isoToMJD(date);

  //console.log("Sending MJD to engine:", mjd);

  Protobject.Core.send({ msg:"updateDate", values: { date: mjd } }).to("index.html");
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
    onOpen: () => (isUserTouchingCalendar = true),
    onClose: () => (isUserTouchingCalendar = false),

    onValueUpdate: function (selectedDates) {
      // console.log("Called onValueUpdate function");
      if (selectedDates.length > 0) {
        // fecha seleccionada siempre respecto al huso local
        const date = selectedDates[0];
        const dateTZ = getISOWithTZ(date);
        //console.log("Non ISO DATE onUpdate", selectedDates[0]);
        //console.log("ToISO with TZ converted DATE onUpdate", dateTZ);
        lastManualChange = Date.now();
        updateDate(dateTZ);
        updateDateTimeout = null;
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
      document.getElementById("engine-time-value").innerText = engineUTC;
      document.getElementById("engine-time-value-utc").innerText = dateTime.toISO();
      document.getElementById("time-zone-value").innerText = currentTZ;
    }
  }, 300);
}

