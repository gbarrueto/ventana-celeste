# `assets/` — binarios del motor

Copia **única** de Stellarium Web Engine (`stellarium-web-engine.js` + `.wasm`, ~1,4 MB).

Antes vivía duplicada en el `public/` de cada app. Eran idénticas byte a byte, pero nada impedía
que se separaran: dos apps corriendo builds distintos del motor sin que nadie se enterara es
exactamente el tipo de diferencia silenciosa que ya costó tiempo en este repo.

## Cómo se consume

No se copian a mano ni se referencian por ruta absoluta. Cada app importa la **URL** y se la pasa
a `initializeStellariumEngine`:

```js
import wasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import scriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';

initializeStellariumEngine({ wasmFile: wasmUrl, scriptUrl, /* ... */ });
```

`?url` hace que Vite emita el archivo como asset y devuelva su URL final, así que el
fingerprinting, el `base` de cada app y el copiado al `dist` los resuelve el bundler. No hace
falta `<script>` en el HTML: `ensureStellariumScript()` inyecta el tag cuando hace falta, y es
no-op si el motor ya está cargado.

## Por qué no es un `import` normal

El motor no es un módulo ES: es un script global que define `window.StelWebEngine`, y el `.wasm`
se descarga por URL en tiempo de ejecución. Por eso se maneja como asset y no como dependencia
de código.

## Al actualizar el motor

Reemplazar los dos archivos aquí. No hay nada más que tocar: todas las apps apuntan a esta copia.
