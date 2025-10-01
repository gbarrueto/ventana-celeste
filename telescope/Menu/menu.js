function openMenu() {
  menu.classList.add('active');
}

function closeMenu() {
  menu.classList.remove('active');
}

function optionSelection(e) {
  // Handle button option
  const activeButton = document.querySelector(
    "#menuContainer .header-container .active"
  );

  if (activeButton && activeButton != e.currentTarget) {
    activeButton.classList.toggle("active");
  }
  
  e.currentTarget.classList.toggle("active");

  // Handle interaction section
  const activeInteraction = document.querySelector("#interactionSection > .active");
  if (activeInteraction) {
    activeInteraction.classList.remove("active");
    activeInteraction.classList.add("exit");

    // clean up after transition ends
    activeInteraction.addEventListener("transitionend", () => {
      activeInteraction.classList.remove("exit");
    }, { once: true });
  }
  
  // Clear Datetime Interval
  if (engineUTC !== null) {
    Protobject.Core.send({
      msg: "setDatetimeInterval",
      values: { active: false },
    }).to("index.html");
    engineUTC = null;
  }

  if (activeButton == e.currentTarget) {
    interactionSection.style.opacity = 0;
    interactionSection.style.pointerEvents = 'none';
    e.currentTarget.style.transform = "translateY(0)";
    return 1; // End section processing
  }
  else {
    interactionSection.style.opacity = 1;
    interactionSection.style.pointerEvents = 'auto';
    return 0; // Return something false
  }

}

function displayMainMenu(e) {
  optionSelection(e);

  let mainMenuSection = document.getElementById("mainMenuSection");

  if (!mainMenuSection) {
    let section = `
      <section id="mainMenuSection" class="active" style="display: grid">
        <input 
          type="range"
          min=1
          max=9
          value=${pollution}>
      </section>
    `;

    menuInteractionSection.insertAdjacentHTML("beforeend", section);
    return;
  }

  mainMenuSection.style.display = "grid";
  mainMenuSection.classList.add("active");
}
