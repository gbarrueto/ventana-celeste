function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

  if (!datetimeSection) {
    let section = `
      <section id="datetimeSection" class="active" style="display: block;">
        <h3>Select Date & Time</h3>

        <div id="datetime-picker" style="margin-bottom: 1rem; width: 100%;"></div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
          <button class="control-button active" onclick="setSpeed(0); updateSpeedButtons(event)">🟥 Stop</button>
          <button class="control-button" onclick="setSpeed(1); updateSpeedButtons(event)">🕒 Realtime</button>
          <button class="control-button" onclick="setSpeed(10); updateSpeedButtons(event)">⏩ 10x</button>
          <button class="control-button" onclick="setSpeed(60); updateSpeedButtons(event)">⏩ 60x</button>
          <button class="control-button" onclick="setSpeed(3600); updateSpeedButtons(event)">⏩ 3600x</button>
        </div>
      </section>
    `;

    interactionSection.innerHTML = section;
  }

  else {
    datetimeSection.style.display = 'block';
    datetimeSection.classList.add('active');
  }
}

function setSpeed(multiplier) {
  Protobject.Core.send({ speed: multiplier }).to("index.html");
}


function toJulianDateIso(iso) {
  const now = new Date(iso);
  const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
  const mjd = jd - 2400000.5; // Modified Julian Date
  return mjd;
}

function updateSpeedButtons(e) {
  const activeButton = document.querySelector(
    '.control-button.active'
  )

  if (activeButton) activeButton.classList.remove('active');
  e.currentTarget.classList.add('active');
}

function fromJulianDateToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

function fromMJDToDate(mjd) {
  const jd = mjd + 2400000.5;
  return new Date((jd - 2440587.5) * 86400000);
}

function showTimeSelector() {
  const modal = document.getElementById("datetimeSection");
  const timeBtn = document.querySelector(
    '.control-button[onclick="showTimeSelector()"]'
  );

  activeFlatpickr = flatpickr("#datetime-picker", {
    enableTime: true,
    dateFormat: "Y-m-d\\TH:i:S",
    time_24hr: true,
    defaultDate: new Date(),
    inline: true,
    onOpen: () => (isUserTouchingCalendar = true),
    onClose: () => (isUserTouchingCalendar = false),

    onChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        engine.core.observer.utc = toJulianDateIso(date.toISOString());
      }
    },

    onValueUpdate: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        engine.core.observer.utc = toJulianDateIso(date.toISOString());
      }
    },

    onMonthChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        engine.core.observer.utc = toJulianDateIso(date.toISOString());
      }
    },

    onYearChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        engine.core.observer.utc = toJulianDateIso(date.toISOString());
      }
    },
  });

  modal.style.display = "block";
  timeBtn.classList.add("active");
  updateSpeedButtons();

  flatpickrSyncInterval = setInterval(() => {
    if (!activeFlatpickr || !engine?.core?.observer?.utc) return;

    const now = Date.now();
    const recentlyChanged = now - lastManualChange < 2000;

    if (!isUserTouchingCalendar && !recentlyChanged) {
      const date = fromMJDToDate(engine.core.observer.utc);
      activeFlatpickr.setDate(date, false);
    }
  }, 300);
}
