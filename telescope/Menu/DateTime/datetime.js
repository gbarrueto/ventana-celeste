function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

  if (!datetimeSection) {
    let section = `
      <section id="datetimeSection" class="active" style="display: block">
      </section>
    `;

    interactionSection.innerHTML = section;
    return;
  }

  datetimeSection.style.display = 'block';
  datetimeSection.classList.add('active');
  showTimeSelector();
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

function showTimeSelector() {
  const modal = document.getElementById("datetimeSection");
  const timeBtn = document.querySelector(
    '.control-button[onclick="showTimeSelector()"]'
  );
  // const isVisible = modal.style.display === "block";

  // if (isVisible) {
  //   modal.style.display = "none";
  //   timeBtn.classList.remove("active");

  //   if (flatpickrSyncInterval) {
  //     clearInterval(flatpickrSyncInterval);
  //     flatpickrSyncInterval = null;
  //   }

  //   return;
  // }

  modal.innerHTML = `
<h3>Select Date & Time</h3>
<div id="datetime-picker" style="margin-bottom: 1rem; width: 100%;"></div>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
<button class="control-button" onclick="setSpeed(0)">🟥 Stop</button>
<button class="control-button" onclick="setSpeed(1)">🕒 Realtime</button>
<button class="control-button" onclick="setSpeed(10)">⏩ 10x</button>
<button class="control-button" onclick="setSpeed(60)">⏩ 60x</button>
<button class="control-button" onclick="setSpeed(3600)">⏩ 3600x</button>
</div>
`;

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
