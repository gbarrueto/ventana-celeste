// function displayPollution(e) {
//   optionSelection(e);
// 
//   let pollutionSection = document.getElementById("pollutionSection");
// 
//   if (!pollutionSection) {
//     let section = `
//       <section id="pollutionSection" class="active" style="display: grid">
//         <input 
//           type="range"
//           min=1
//           max=9
//           value=${pollution}>
//       </section>
//     `;
// 
//     interactionSection.insertAdjacentHTML("beforeend", section);
//     pollutionInput = document.querySelector("#pollutionSection input");
//     pollutionInput.addEventListener("input", () => {
//       pollution = pollutionInput.value;
//       Protobject.Core.send({ msg:"updatePollution", values: { bortle: pollutionInput.value } }).to("index.html");
//       Protobject.Core.send({ msg:"updatePollution", values: { bortle: pollutionInput.value } }).to("Lamp.html");
//     });
//     return;
//   }
// 
//   pollutionSection.style.display = "grid";
//   pollutionSection.classList.add("active");
// }

function updatePollution() {
  if (!pollutionInput) return;

  pollutionInput.value = pollution;
}
