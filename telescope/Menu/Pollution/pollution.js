function displayPollution(e) {
  optionSelection(e);

  let pollutionSection = document.getElementById('pollutionSection')

  if (!pollutionSection) {
    let section = `
      <section id="pollutionSection" class="active" style="display: grid">
        <input 
          type="range"
          min=1
          max=9
          value=1>
      </section>
    `;

    interactionSection.insertAdjacentHTML("beforeend", section);
    return;
  }

  pollutionSection.style.display = 'grid';
  pollutionSection.classList.add('active');
}