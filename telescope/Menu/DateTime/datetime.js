function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

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
  Protobject.Core.send({ speed: multiplier }).to("index.html");
  timeSpeed = multiplier;
  updateSpeedButtons();
}
// Send time in MJD to engine
function updateDate(date, offsetHours = 0) {
  const zone = `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`;

  // Creamos DateTime desde el Date del flatpickr en la zona actual

  console.log("Passed date: ", date, { zone: zone });

  const dateTime = luxon.DateTime.fromISO(date);
  const utc = dateTime.toUTC();

  //console.log("Converted to UTC: ", utc.toISO());

  const jd = utc.toMillis() / 86400000 + 2440587.5;
  const mjd = jd - 2400000.5;

  console.log("Sending MJD to engine:", mjd);

  Protobject.Core.send({ date: mjd }).to("index.html");
}

function createInterval() {
  Protobject.Core.send({ setDatetimeInterval: true }).to("index.html");
}

function fromMJDToLuxon(mjd, offsetHours = 0) {
  const JD = mjd + 2400000.5;
  const unixMs = (JD - 2440587.5) * 86400000;

  // Creamos DateTime en UTC y lo movemos al offset
  const zone = `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`;
  return luxon.DateTime.fromMillis(unixMs, { zone: "UTC" }).setZone(zone);
}

function toJulianDateIso(iso) {
  const now = new Date(iso);
  const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
  const mjd = jd - 2400000.5; // Modified Julian Date
  return mjd;
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

function fromJulianDateToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

function fromMJDToDate(mjd) {
  const jd = mjd + 2400000.5;
  return new Date((jd - 2440587.5) * 86400000);
}

let updateDateTimeout = null;

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
      console.log("Called function");
      if (selectedDates.length > 0) {
        console.log("Called with timeout: ", updateDateTimeout);
        
        // Cancelar timeout anterior si existe
        if (updateDateTimeout) {
          clearTimeout(updateDateTimeout);
        }
        
        // Crear nuevo timeout con delay
        updateDateTimeout = setTimeout(() => {
          const date = selectedDates[0].toISOString();
          lastManualChange = Date.now();
          updateDate(date, currentTZ);
          updateDateTimeout = null;
        }, 30000); // 000ms de delay para evitar llamadas dobles
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
      // console.log("Current dateTime: ", dateTime.toISO());
      // console.log("CurrentDateTime in JS: ", dateTime.toJSDate());
      activeFlatpickr.setDate(dateTime.toISO(), false);
    }
  }, 300);
}

