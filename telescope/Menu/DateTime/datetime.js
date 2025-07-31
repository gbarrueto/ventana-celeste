function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

  if (!datetimeSection) {
    let section = `
      <section id="datetimeSection" class="active" style="display: grid">
        Date and Time
      </section>
    `;

    interactionSection.innerHTML = section;
    return;
  }

  datetimeSection.style.display = 'grid';
  datetimeSection.classList.add('active');
}