import { toJulianDateIso } from "./time.js";
import { applyLocation } from "./location.js";
import { getObjAltAz } from "./getObject.js";

// Llamar la función con el parámetro apropiado
// Para index.html: initializeStelEngine(false);
// Para telescope.html: initializeStelEngine(true);
export function initializeStelEngine(isTelescope = false) {
  StelWebEngine({
    wasmFile: "stellarium-web-engine.wasm",
    canvas: document.getElementById("stel-canvas"),
    async onReady(stel) {
      engine = stel;
      const core = stel.core;

      core.observer.utc = toJulianDateIso(new Date().toISOString());

      const defaultLocation = {
        cityName: "Santiago",
        lat: -33.4489,
        lon: -70.6693,
        elev: 570,
        mag: 17.13,
      };

      const baseUrl = "https://vtdata-telescope.alessiobellino.com/";
      const baseUrlBig = "https://vtdatabig-telescope.alessiobellino.com/";

      // Array para almacenar todas las promesas de carga de datos
      const dataSourcePromises = [];

      // Data sources básicas (siempre se cargan)
      dataSourcePromises.push(
        core.stars.addDataSource({
          url:
            baseUrl +
            "swe-data-packs/minimal/2020-09-01/minimal_2020-09-01_186e7ee2/stars",
          key: "minimal",
        })
      );
      dataSourcePromises.push(
        core.stars.addDataSource({
          url:
            baseUrl +
            "swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/stars",
          key: "base",
        })
      );
      dataSourcePromises.push(
        core.landscapes.addDataSource({
          url: baseUrl + "landscapes/v1/guereins",
          key: "guereins",
        })
      );

      [
        "moon",
        "sun",
        "jupiter",
        "mercury",
        "venus",
        "mars",
        "saturn",
        "uranus",
        "neptune",
        "io",
        "europa",
        "ganymede",
        "callisto",
        "moon-normal",
      ].forEach((p) => {
        dataSourcePromises.push(
          core.planets.addDataSource({
            url: baseUrl + `surveys/sso/${p}/v1`,
            key: p,
          })
        );
      });

      // Data sources adicionales solo para index (no telescope)
      if (!isTelescope) {
        dataSourcePromises.push(
          core.stars.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/stars",
            key: "extended",
          })
        );
        dataSourcePromises.push(
          core.dss.addDataSource({
            url: baseUrlBig + "surveys/gaia/v1",
            key: "gaia",
          })
        );

        dataSourcePromises.push(
          core.skycultures.addDataSource({
            url: baseUrl + "skycultures/v3/western",
            key: "western",
          })
        );

        dataSourcePromises.push(
          core.dsos.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso",
          })
        );
        dataSourcePromises.push(
          core.dsos.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/dso",
          })
        );

        dataSourcePromises.push(
          core.milkyway.addDataSource({ url: baseUrl + "surveys/milkyway/v1" })
        );
        dataSourcePromises.push(
          core.dss.addDataSource({ url: baseUrlBig + "surveys/dss/v1" })
        );
        dataSourcePromises.push(
          core.minor_planets.addDataSource({
            url: baseUrl + "mpc/v1/mpcorb.dat",
            key: "mpc_asteroids",
          })
        );
        dataSourcePromises.push(
          core.comets.addDataSource({
            url: baseUrl + "mpc/v1/CometEls.txt?v=2019-12-17",
            key: "mpc_comets",
          })
        );
        // dataSourcePromises.push(
        //     core.satellites.addDataSource({
        //         url: baseUrl + "skysources/v1/tle_satellite.jsonl.gz?v=2019-09-16",
        //         key: "jsonl/sat",
        //     })
        // );
      }

      // Esperar a que todas las fuentes de datos se carguen
      try {
        await Promise.all(dataSourcePromises);
        //console.log("All data sources loaded successfully");

        // Ocultar hints después de que se carguen los datos
        core.planets.hints_visible = false;
        core.dsos.hints_visible = false;
        core.minor_planets.hints_visible = false;
        core.dss.hints_visible = false;
        core.stars.hints_visible = false;
        core.comets.hints_visible = false;
        core.cardinals.visible = false;

        // EDIT: en la modalidad simple se deberia ver como stellarium, y ahora no se ve asi. exposure_scale = 2 mejora (por lo menos se ven colores, y cosas mas lindas en vez que solo luntos), pero no es igual a stellarium
        // en la modalidad avanzada tal vez uno podria seleccionar el tipo de telescopio ej., economico, profesional, y cientifico, y ver las diferencias.
        
        core.exposure_scale = 2;
      } catch (error) {
        console.error("Error loading data sources:", error);
      }

      // Funcionalidad exclusiva de index (no telescope)
      if (!isTelescope) {
        // On object click listener
        stel.change((obj, attr) => {
          if (attr === "hovered") return;

          const info = document.getElementById("info-card");
          if (stel.core.selection) {
            const s = stel.core.selection;
            const name = s.designations()[0].replace(/^NAME /, "");
            const radec = stel.convertFrame(
              core.observer,
              "ICRF",
              "CIRS",
              s.getInfo("radec")
            );
            const coords = stel.c2s(radec);
            const ra = stel.anp(coords[0]);
            const dec = stel.anpm(coords[1]);
            const mag = s.getInfo("vmag");

            const altaz = getObjAltAz(s);

            info.innerHTML = `
                          <h3>${name}</h3>
                          <p><strong>Magnitude:</strong> ${
                            mag !== undefined ? mag.toFixed(2) : "Unknown"
                          }</p>
                          <p><strong>Ra:</strong> ${ra.toFixed(3)}</p>
                          <p><strong>Dec:</strong> ${dec.toFixed(3)}</p>
                          <p><strong>Alt:</strong> ${altaz.alt.toFixed(3)}°</p>
                          <p><strong>Az:</strong> ${altaz.az.toFixed(3)}°</p>`;
            info.style.display = "block";
          } else {
            info.style.display = "none";
          }
        });

        initializeSeeingOverlay();
      }

      applyLocation(defaultLocation);
    },
  });
}


export function removeStelEngine() {
  if (!engine) return;

  // 1. Detener cualquier render loop o proceso activo
  if (engine.stop) engine.stop();
  if (engine.core && engine.core.clock) engine.core.clock.running = false;

  // 2. Liberar referencias de observador y selección
  engine.core.selection = null;
  engine.core.observer = null;

  // 3. Intentar limpiar el contexto WebGL
  const oldCanvas = engine.canvas;
  const gl = oldCanvas.getContext("webgl2") || oldCanvas.getContext("webgl");
  if (gl && gl.getExtension("WEBGL_lose_context")) {
    gl.getExtension("WEBGL_lose_context").loseContext();
  }

  // 4. Quitar el contenido del canvas
  // Reemplazar el canvas por uno nuevo
  const newCanvas = document.createElement("canvas");
  newCanvas.id = "stel-canvas";
  oldCanvas.replaceWith(newCanvas);

  engine = null;
}
