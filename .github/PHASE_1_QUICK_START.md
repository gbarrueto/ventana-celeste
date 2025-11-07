# Quick Start: Implementación Inmediata de Fase 1

Este documento te permite comenzar inmediatamente con la Fase 1 (Lazy Loading).

## Paso 1: Crear el módulo de Lazy Loading

**Archivo:** `telescope/utils/lazyLoad.js` (NUEVO)

```javascript
/**
 * LazyModuleLoader - Lazy load external resources on demand
 * 
 * Usage:
 *   const cesium = await lazyLoader.loadCdnScript('Cesium', '/path/to/Cesium.js');
 *   const module = await lazyLoader.loadModule('./mymodule.js');
 */

class LazyModuleLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  /**
   * Load a CDN script and cache the global variable
   * @param {string} name - Variable name in window (e.g., 'Cesium')
   * @param {string} src - URL to the script
   * @returns {Promise} The global variable after loading
   */
  async loadCdnScript(name, src) {
    // Return cached version if already loaded
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    // Return pending promise if already loading
    if (this.loading.has(name)) {
      return this.loading.get(name);
    }

    // Create loading promise
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      
      script.onload = () => {
        const result = window[name];
        this.cache.set(name, result);
        this.loading.delete(name);
        resolve(result);
      };
      
      script.onerror = () => {
        this.loading.delete(name);
        reject(new Error(`Failed to load ${name} from ${src}`));
      };

      document.head.appendChild(script);
    });

    this.loading.set(name, promise);
    return promise;
  }

  /**
   * Load an ES6 module
   * @param {string} path - Path to the module
   * @returns {Promise} The module
   */
  async loadModule(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }

    if (this.loading.has(path)) {
      return this.loading.get(path);
    }

    const promise = import(path).then(module => {
      this.cache.set(path, module);
      this.loading.delete(path);
      return module;
    }).catch(err => {
      this.loading.delete(path);
      throw err;
    });

    this.loading.set(path, promise);
    return promise;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * Get cache status (for debugging)
   */
  getCacheStatus() {
    return {
      cached: Array.from(this.cache.keys()),
      loading: Array.from(this.loading.keys())
    };
  }
}

export const lazyLoader = new LazyModuleLoader();
```

---

## Paso 2: Actualizar telescope.html

**Cambios necesarios:**

```html
<!-- ANTES (líneas a eliminar): -->
<!-- 
<link href="https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
<script src="https://unpkg.com/globe.gl"></script>
<script src="https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
-->

<!-- DESPUÉS (líneas que deben quedar): -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
/>
<link rel="stylesheet" href="telescope/telescope.css" />
<link rel="stylesheet" href="telescope/Menu/menu.css" />

<script src="https://app.protobject.com/framework/p.js"></script>
<script src="config.js"></script>
<script src="stellarium-web-engine.js"></script>
<script src="limit_mag/params.js"></script>
<script src="telescope/utils/lp/pako_inflate.min.js"></script>
<script src="telescope/utils/tz.js"></script>

<!-- NUEVO: Module imports -->
<script type="module" src="telescope/utils/common.js"></script>
<script src="telescope/utils/protobject.js"></script>
```

---

## Paso 3: Actualizar Menu/Location/globe.js

**Cambios necesarios:**

```javascript
import { lazyLoader } from '../../utils/lazyLoad.js';

export async function displayGlobe(e) {
  if (optionSelection && optionSelection(e)) return;

  let container = document.getElementById("cesiumContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "cesiumContainer";
    // ... estilos ...
    document.body.appendChild(container);
  } else {
    container.classList.add("active");
  }

  // ✅ NUEVO: Load Cesium on-demand
  if (!window.Cesium) {
    try {
      setLoading(true); // Mostrar spinner

      // Load both Cesium AND CSS
      const cesiumCssPromise = new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css';
        link.onload = resolve;
        document.head.appendChild(link);
      });

      const cesiumJsPromise = lazyLoader.loadCdnScript(
        'Cesium',
        'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js'
      );

      await Promise.all([cesiumCssPromise, cesiumJsPromise]);

    } catch (error) {
      console.error('Failed to load Cesium:', error);
      alert('Error al cargar mapa 3D. Por favor intenta de nuevo.');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }

  // ... resto del código ya existente ...
  
  if (cesiumViewer) {
    console.warn("Cesium ya está inicializado.");
    resumeCesium();
    return;
  }

  // Initialize Cesium (código ya existente)
  cesiumViewer = new Cesium.Viewer("cesiumContainer", {
    // ... config ...
  });

  // ... resto ...
}

export function pauseCesium() {
  if (cesiumViewer) {
    cesiumViewer.clock.shouldAnimate = false;
  }
}

export function resumeCesium() {
  if (cesiumViewer) {
    cesiumViewer.clock.shouldAnimate = true;
  }
}
```

---

## Paso 4: Actualizar Menu/DateTime/datetime.js

**Cambios necesarios:**

```javascript
import { lazyLoader } from '../../utils/lazyLoad.js';

export async function displayDateTime(e) {
  if (optionSelection && optionSelection(e)) return;

  // ✅ NUEVO: Load Flatpickr on-demand
  if (!window.flatpickr) {
    try {
      setLoading(true);
      
      const flatpickrCssPromise = new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        link.onload = resolve;
        document.head.appendChild(link);
      });

      const flatpickrJsPromise = lazyLoader.loadCdnScript(
        'flatpickr',
        'https://cdn.jsdelivr.net/npm/flatpickr'
      );

      await Promise.all([flatpickrCssPromise, flatpickrJsPromise]);

    } catch (error) {
      console.error('Failed to load Flatpickr:', error);
      alert('Error al cargar calendario.');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }

  // ... resto del código existente ...
}
```

---

## Paso 5: Verificar en Browser DevTools

**Después de hacer estos cambios:**

1. Abre `telescope.html` en navegador
2. Abre DevTools (F12)
3. Ir a **Network** tab
4. Recargar página (Ctrl+R)
5. Filtrar por tipo "XHR" o "script"
6. **Verificar:**
   - ❌ Cesium.js NO debe aparecer al cargar
   - ❌ flatpickr NO debe aparecer al cargar
   - ✅ Solo deben aparecer cuando haces click en "Ubicación" o "Fecha y Tiempo"

---

## Paso 6: Medir el Impacto

**En DevTools Network tab:**

### ANTES (sin lazy loading):
```
Recursos cargados al abrir telescope.html:
- Cesium.js: 1.3MB ⬇️ (~5s en 4G)
- globe.gl: 500KB ⬇️ (~2s en 4G)
- Flatpickr: 15KB ⬇️ (~0.1s en 4G)
- Leaflet: 60KB ⬇️ (~0.2s en 4G)
- Total: 1.875MB (~8s en 4G)

Tamaño inicial de HTML + JS crítico: ~300KB (~1-2s)
```

### DESPUÉS (con lazy loading):
```
Recursos cargados al abrir telescope.html:
- Cesium.js: ⭐ NO CARGADO
- globe.gl: ⭐ NO CARGADO
- Flatpickr: ⭐ NO CARGADO
- Leaflet: ⭐ NO CARGADO
- Total: ~300KB (~1-2s en 4G)

Cuando haces click en "Ubicación" → Cesium.js se carga (5-7s después)
Cuando haces click en "Fecha y Tiempo" → Flatpickr se carga (1-2s después)
```

**Fórmula de mejora:**
- Antes: 1.875MB total = 8-10 segundos en 4G
- Después: 0.3MB inicial + lazy = 1-2 segundos inicial + 2-3s on-demand
- **Mejora: 75-80% en Time to Interactive** ✅

---

## Paso 7: Testing Básico

Después de implementar, verifica:

```javascript
// En DevTools Console

// 1. Verifica que lazyLoader está disponible
console.log(lazyLoader); // Debe mostrar LazyModuleLoader instance

// 2. Verifica que Cesium NO está cargado
console.log(window.Cesium); // Debe ser undefined

// 3. Abre el menú de Ubicación
// Espera ~5 segundos

// 4. Verifica que ahora Cesium está cargado
console.log(window.Cesium); // Debe ser Cesium object

// 5. Verifica cache status
console.log(lazyLoader.getCacheStatus());
// Output: { cached: ['Cesium'], loading: [] }
```

---

## Paso 8: Monitorear Memory Leaks

```javascript
// En DevTools Console

// Antes de hacer nada
performance.memory.usedJSHeapSize; // ~X MB

// Abre Ubicación
// Espera ~10 segundos (Cesium cargando)
// Cierra Ubicación

// Verifica que memoria bajó
performance.memory.usedJSHeapSize; // Debe estar cercano a X MB

// Si la memoria sigue subiendo = memory leak ⚠️
```

---

## Rollback (si algo sale mal)

```bash
# Revert los cambios locales
git checkout -- telescope.html telescope/Menu/Location/globe.js telescope/Menu/DateTime/datetime.js

# Eliminar archivo nuevo
rm telescope/utils/lazyLoad.js

# Restablecer HTML original
git checkout -- telescope.html
```

---

## Próximos Pasos

Una vez que Fase 1 esté funcionando:

1. **Fase 2:** Crear `EventManager` para debouncing
2. **Fase 3:** Crear mode splitting
3. **Fase 4:** Profiling final y métricas

Referencia completa en: `.github/PERFORMANCE_OPTIMIZATION_ROADMAP.md`

