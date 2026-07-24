# Contexto del Proyecto

Ultima actualizacion: 2026-03-19

## Alcance de este contexto
Este documento resume el estado actual del proyecto para consulta rapida durante desarrollo.
Telescope.js se deja fuera de foco por ahora (se analizara despues).

## Stack y tooling
- Framework UI: Svelte 4
- Bundler/dev server: Vite 5
- Lenguaje: JavaScript (ESM)
- Scripts npm:
  - dev: vite
  - build: vite build
  - preview: vite preview

## Estructura principal
- index.html: punto de montaje del app en #app y carga de src/main.js
- src/main.js: bootstrap de Svelte, monta App.svelte
- src/App.svelte: nucleo funcional actual de la app
- public/stellarium-web-engine.js + .wasm: runtime del motor astronomico en cliente

## Flujo de arranque (actual)
1. Carga index.html y monta Svelte en #app.
2. App.svelte ejecuta onMount.
3. Se asegura carga dinamica del script de Stellarium (window.StelWebEngine).
4. Inicializa el engine con canvas y archivo wasm.
5. Configura observador (fecha UTC juliana + ubicacion por defecto en Santiago).
6. Carga multiples data sources remotos (estrellas, planetas, DSO, via lactea, skyculture, MPC, etc.).
7. Activa/ajusta visibilidad de pistas y parametros de render.
8. Inicia sistema de orientacion por sensores y setup de zoom/lentes.

## Logica funcional en App.svelte
- Render principal:
  - canvas full-screen para Stellarium
  - crosshair centrado
  - overlay de calibracion
- Control de vista:
  - updateStellariumView: yaw/pitch
  - updateStellariumFov: fov y conversion a variable de ocular
  - updateStellariumBlur: blur CSS sobre canvas
- Gestion de lentes/FOV:
  - Niveles de lentes predefinidos
  - Modo ojo humano
  - Zoom suave via interpolacion logaritmica
- Sensores y orientacion:
  - Usa Gyroscope + AbsoluteOrientationSensor
  - Calibracion inicial con muestreo de bias
  - Conmutacion dinamica de modo absolute/gyro segun FOV
  - Suavizado y deadzone para estabilidad

## Dependencias externas en runtime
- Endpoint base de datos astronomicos:
  - https://smalldata.ventanaceleste.com/
- Comentado en codigo como alternativa local:
  - http://localhost:5000/

## Controles de usuario (teclado)
- c: recalibrar sensores
- 0..7: seleccionar nivel de lente
- + / =: zoom in
- -: zoom out

## Riesgos y observaciones tecnicas
- Archivo App.svelte concentra demasiada responsabilidad (inicializacion, datos, sensores, UI y controles).
- El inicio depende de APIs de sensores no disponibles en todos los navegadores/dispositivos.
- La carga de catalogos depende de red y del host externo; latencia o caidas impactan funcionalidad.
- Hay constantes y umbrales de sensores sin capa de configuracion externa.
- La UI principal funciona como experiencia full-screen; no hay fallback visual avanzado ante fallas de motor/sensores.

## Recomendacion de arquitectura (cuando se retome)
- Separar App.svelte en modulos:
  - services/engine (carga e inicializacion Stellarium)
  - services/sensors (fusion y calibracion)
  - state/view (FOV, lente, modo orientacion)
  - ui/components (overlay, HUD, controles)
- Agregar capa de configuracion central para endpoints y umbrales.
- Incorporar manejo de errores visible para usuario (estado de carga, error de red, sensores no soportados).

## Ejes de modularizacion obligatorios
- Motor de Stellarium: inicializacion, entrypoint del engine y carga de datos del cielo.
- Telescope: datos persistentes de orientacion, distancia focal, apertura y magnificacion.
- Lectura de sensores: principalmente orientacion, calibracion y fusion de datos.
- Comunicacion con Arduino: intercambio de estado y control para la version offline simple.

La modularizacion futura debe respetar estos cuatro ejes como fronteras funcionales, no solo como carpetas tecnicas.

## Estado para la siguiente fase
- Contexto base completado sin profundizar en Telescope.js.
- Siguiente paso natural: analizar Telescope.js e integrar su rol dentro de la arquitectura modular propuesta.
