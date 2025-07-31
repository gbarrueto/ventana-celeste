function displayPollution(e) {
  optionSelection(e);

  let pollutionSection = document.getElementById('pollutionSection')

  if (!pollutionSection) {
    let section = `
      <section id="pollutionSection" class="active" style="display: grid">
        Pollution
      </section>
    `;

    interactionSection.innerHTML = section;
    return;
  }

  pollutionSection.style.display = 'grid';
  pollutionSection.classList.add('active');
}