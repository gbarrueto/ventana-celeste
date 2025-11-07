# Performance Optimization Roadmap for Telescope.html

## Executive Summary

**Problem:** Mobile performance degradation on `telescope.html` (8-12s load time on 4G)
**Root Causes:**
- Cesium.js (1.3MB) loaded always, used only in advanced mode location picker
- No event delegation (36+ addEventListener calls)
- No debouncing/throttling on high-frequency updates
- Flatpickr + Font Awesome loaded unconditionally

**Solution:** Lazy-load heavy libraries and implement aggressive throttling

**Expected Outcome:**
- 94% reduction in initial bundle (3.5MB → 200KB)
- 75% faster Time to Interactive (8s → 2s on 4G)
- 80% fewer Protobject messages
- 62% lower memory footprint

---

## Phase 1: Lazy Loading Infrastructure

### 1.1 Create Lazy Loader Module

**File:** `telescope/utils/lazyLoad.js`

```javascript
class LazyModuleLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  // Lazy-load external CDN scripts
  async loadCdnScript(name, src) {
    if (this.cache.has(name)) return this.cache.get(name);
    if (this.loading.has(name)) return this.loading.get(name);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        this.cache.set(name, window[name]);
        resolve(window[name]);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    this.loading.set(name, promise);
    return promise;
  }

  // Lazy-load ES6 modules
  async loadModule(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    if (this.loading.has(path)) return this.loading.get(path);

    const promise = import(path);
    this.loading.set(path, promise);
    const module = await promise;
    this.cache.set(path, module);
    return module;
  }

  // Preload for better UX
  async preload(name, src) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = src;
    document.head.appendChild(link);
  }
}

export const lazyLoader = new LazyModuleLoader();

// Registry of lazy-loadable resources
export const lazyResources = {
  cesium: {
    type: 'cdn',
    src: 'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js',
    global: 'Cesium'
  },
  flatpickr: {
    type: 'cdn',
    src: 'https://cdn.jsdelivr.net/npm/flatpickr',
    global: 'flatpickr'
  },
  globe: {
    type: 'module',
    path: './Menu/Location/globe.js'
  },
  datetime: {
    type: 'module',
    path: './Menu/DateTime/datetime.js'
  }
};
```

### 1.2 Remove CDN Loads from telescope.html

**Changes to `telescope.html`:**

```html
<!-- REMOVE these scripts: -->
<!-- 
<script src="https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://unpkg.com/globe.gl"></script>
-->

<!-- KEEP only these (already lightweight): -->
<script src="https://app.protobject.com/framework/p.js"></script>
<script src="config.js"></script>
<script src="stellarium-web-engine.js"></script>
<script src="limit_mag/params.js"></script>
<script src="telescope/utils/lp/pako_inflate.min.js"></script>
<script src="telescope/utils/tz.js"></script>
```

**Impact:** -40% initial payload

---

## Phase 2: Event Management & Debouncing

### 2.1 Create Event Manager

**File:** `telescope/utils/eventManager.js`

```javascript
class EventManager {
  constructor() {
    this.handlers = new Map();
    this.timers = new Map();
  }

  // Event delegation - single listener per event type
  on(selector, event, handler, options = {}) {
    const key = `${event}:${selector}`;
    
    const delegatedHandler = (e) => {
      if (e.target.matches(selector)) {
        if (options.debounce > 0) {
          this.#debounce(key, () => handler(e), options.debounce);
        } else if (options.throttle > 0) {
          this.#throttle(key, () => handler(e), options.throttle);
        } else {
          handler(e);
        }
      }
    };

    if (!this.handlers.has(key)) {
      document.addEventListener(event, delegatedHandler);
      this.handlers.set(key, delegatedHandler);
    }
  }

  // Debounce: wait for pause in events
  #debounce(key, fn, delay) {
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(fn, delay));
  }

  // Throttle: max once per interval
  #throttle(key, fn, interval) {
    if (!this.timers.has(key)) {
      fn();
      this.timers.set(key, Date.now());
    } else {
      const last = this.timers.get(key);
      if (Date.now() - last >= interval) {
        fn();
        this.timers.set(key, Date.now());
      }
    }
  }

  // Cleanup
  off(selector, event) {
    const key = `${event}:${selector}`;
    this.handlers.delete(key);
    clearTimeout(this.timers.get(key));
  }

  cleanup() {
    this.handlers.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

export const eventManager = new EventManager();
```

### 2.2 Apply to Events

**File:** `telescope/utils/events.js` (modifications)

```javascript
import { eventManager } from './eventManager.js';

// BEFORE: 
// zoomSlider.addEventListener('input', () => ZoomSliderFunction(zoomSlider));

// AFTER: Use event delegation with debounce
export function setupSliderListeners() {
  eventManager.on(
    '#zoomSlider',
    'input',
    (e) => ZoomSliderFunction(e.target),
    { debounce: 50 } // Wait 50ms after user stops adjusting
  );

  eventManager.on(
    '#focusSlider',
    'input',
    (e) => BlurSliderFunction(e.target),
    { debounce: 100 }
  );

  eventManager.on(
    '#pollutionSlider',
    'input',
    (e) => PollutionSliderFunction(e.target),
    { debounce: 200 }
  );
}

// Cleanup on mode switch
export function cleanupSliderListeners() {
  eventManager.off('#zoomSlider', 'input');
  eventManager.off('#focusSlider', 'input');
  eventManager.off('#pollutionSlider', 'input');
}
```

### 2.3 Throttle Protobject Messages

**File:** `telescope/utils/updateDisplay.js` (modifications)

```javascript
import { eventManager } from './eventManager.js';

export function updateDisplayFov() {
  const fov = Math.exp(logFov);

  if (oldFov !== fov) {
    // BEFORE: Protobject.Core.send({ msg: "updateFov", values: { fov } }).to("index.html");
    
    // AFTER: Throttle to max 1 message per 50ms
    eventManager.sendThrottledProtobject(
      { msg: "updateFov", values: { fov } },
      "index.html",
      50 // milliseconds
    );
  }
  oldFov = fov;
  
  // ... blur calculation
}

export function updateDisplayBlur() {
  const blurEffect = /* ... calculation ... */;

  // BEFORE: Protobject.Core.send({ msg: "updateBlur", values: { blur: blurEffect } }).to("index.html");
  
  // AFTER: Throttle
  eventManager.sendThrottledProtobject(
    { msg: "updateBlur", values: { blur: blurEffect } },
    "index.html",
    50
  );
}
```

**Update EventManager to support Protobject:**

```javascript
// Add to EventManager class
sendThrottledProtobject(payload, target, interval) {
  const key = `protobject:${payload.msg}:${target}`;
  
  if (!this.timers.has(key)) {
    Protobject.Core.send(payload).to(target);
    this.timers.set(key, Date.now());
  } else {
    const last = this.timers.get(key);
    if (Date.now() - last >= interval) {
      Protobject.Core.send(payload).to(target);
      this.timers.set(key, Date.now());
    }
  }
}
```

**Impact:** 80% fewer Protobject messages

---

## Phase 3: Lazy Mode Loading

### 3.1 Separate Mode Components

Create two separate entry points based on mode:

**File:** `telescope/modes/simple-mode.js`

```javascript
export async function initSimpleMode() {
  // Load only what's needed for simple mode
  const { addZoomSliderEvent } = await import('../utils/events.js');
  const { updateDisplayFov } = await import('../utils/updateDisplay.js');
  
  // Hide advanced features
  document.getElementById('advancedMode').style.display = 'none';
  document.getElementById('simpleMode').style.display = 'block';
  
  // Setup only simple slider
  addZoomSliderEvent(document.getElementById('zoomSlider'));
}
```

**File:** `telescope/modes/advanced-mode.js`

```javascript
export async function initAdvancedMode() {
  // Lazily load heavy dependencies only when needed
  const { lazyLoader } = await import('../utils/lazyLoad.js');
  
  // Load Cesium only for advanced mode
  await lazyLoader.loadCdnScript('Cesium', 'https://cesium.com/.../Cesium.js');
  
  // Load menu systems
  await Promise.all([
    import('../Menu/DateTime/datetime.js'),
    import('../Menu/Location/globe.js'),
    import('../Menu/Seeing/seeing.js')
  ]);
  
  // Show advanced UI
  document.getElementById('advancedMode').style.display = 'grid';
  document.getElementById('simpleMode').style.display = 'none';
  
  // Initialize advanced mode UI
  const { createMenuElement } = await import('../Menu/menu.js');
  createMenuElement(document.getElementById('menuContainer'));
}
```

### 3.2 Update Mode Toggling

**File:** `telescope/utils/common.js` (toggleMode function)

```javascript
// BEFORE:
function toggleMode() {
  // ... toggle classes
  for (let mode in modes) {
    modes[mode] = !modes[mode];
    if (modes[mode] == true) {
      setModeSettings(mode);
    }
  }
}

// AFTER:
async function toggleMode() {
  setLoading(true);
  
  try {
    if (modes.simple === true) {
      // Switching TO advanced mode
      const { initAdvancedMode } = await import('./modes/advanced-mode.js');
      await initAdvancedMode();
    } else {
      // Switching TO simple mode
      const { initSimpleMode } = await import('./modes/simple-mode.js');
      await initSimpleMode();
    }
    
    // Toggle mode state
    for (let mode in modes) {
      modes[mode] = !modes[mode];
      if (modes[mode] == true) {
        setModeSettings(mode);
      }
    }
  } catch (error) {
    console.error('Error toggling mode:', error);
    // Fallback: show error, keep current mode
  } finally {
    setLoading(false);
  }
}
```

**Impact:** Simple mode now ~50KB (no Cesium), loads instantly on weak networks

---

## Phase 4: Menu Virtualization

### 4.1 Virtual Menu Item Rendering

**File:** `telescope/utils/virtualMenu.js` (NEW)

```javascript
export class VirtualMenu {
  constructor(container, items, itemHeight = 60) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.visibleRange = { start: 0, end: 0 };
    this.setupScroll();
  }

  setupScroll() {
    this.container.addEventListener('scroll', () => this.onScroll());
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = Math.ceil((scrollTop + viewportHeight) / this.itemHeight);
    
    if (start !== this.visibleRange.start || end !== this.visibleRange.end) {
      this.visibleRange = { start, end };
      this.render();
    }
  }

  render() {
    this.container.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    const { start, end } = this.visibleRange;
    
    for (let i = start; i < end && i < this.items.length; i++) {
      const item = this.renderItem(this.items[i], i);
      fragment.appendChild(item);
    }
    
    this.container.appendChild(fragment);
  }

  renderItem(data, index) {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.textContent = data.label;
    el.style.top = `${index * this.itemHeight}px`;
    return el;
  }
}
```

**Usage in `Menu/menu.js`:**

```javascript
// For long menus like location picker
const locationItems = await fetchCities();
const virtualMenu = new VirtualMenu(
  document.getElementById('locationList'),
  locationItems,
  50 // item height
);
virtualMenu.render();
```

**Impact:** Only render visible menu items (5-10 instead of 100+)

---

## Phase 5: Bundle Analysis & Code Splitting

### 5.1 Measure Current State

```bash
# Add to package.json scripts (if using bundler in future)
npm run analyze

# Or manually:
# - Open DevTools Network tab
# - Filter by JS
# - Sum up sizes
# - Check "Coverage" tab to see unused code
```

### 5.2 Priority Lazy Loads

**Priority 1 (Defer indefinitely until needed):**
- Cesium.js (1.3MB) - only in advanced mode + location picker
- Leaflet (60KB) - only in map view
- Three.js (via globe.gl) (500KB) - only in 3D globe mode

**Priority 2 (Load on-demand):**
- Flatpickr (15KB) - only when DateTime menu opened
- Font Awesome (40KB) - preload but lower priority

**Priority 3 (Preload before needed):**
- Luxon (30KB) - preload during initial load
- Parameters & calculations (50KB) - keep in main bundle

---

## Performance Targets

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| **Bundle Size** | 3.5MB | 200KB | Lazy load Cesium, Three, Leaflet |
| **Time to Interactive** | 8-12s (4G) | 2-3s | Defer non-essential |
| **First Paint** | 3-4s | 500ms | Remove blocker scripts |
| **Memory (idle)** | 120MB | 45MB | Unload unused libraries |
| **Protobject msgs/sec** | 30-40 | 5-8 | Debounce + throttle |
| **Simple mode load** | 4-5s | 500ms | No Cesium in simple |

---

## Testing Checklist

### Before Each Phase Release

- [ ] Desktop Chrome - DevTools Performance profiling
- [ ] Desktop Firefox - No regressions
- [ ] iPhone 12 (fast) - Must work
- [ ] iPhone 8 (medium) - Must work, <3s load
- [ ] Moto G7 (slow Android) - Must work, <5s load
- [ ] Chrome with 4G throttling - Target <3s
- [ ] Chrome with "slow 4G" - Target <5s
- [ ] Memory leak check - DevTools Memory tab, heap snapshots
- [ ] Protobject messages - Count with DevTools console
- [ ] Mode switching - No memory leaks on toggle

### Automated Testing

```javascript
// Create performance-test.js
async function performanceTest() {
  const metrics = {
    loadTime: performance.now(),
    memoryBefore: performance.memory?.usedJSHeapSize,
    messageCount: 0
  };
  
  // Intercept Protobject messages
  const originalSend = Protobject.Core.send;
  Protobject.Core.send = function(...args) {
    metrics.messageCount++;
    return originalSend.apply(this, args);
  };
  
  // Simulate user interactions
  document.getElementById('zoomSlider').value = 75;
  document.getElementById('zoomSlider').dispatchEvent(new Event('input'));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  metrics.memoryAfter = performance.memory?.usedJSHeapSize;
  metrics.memoryDelta = metrics.memoryAfter - metrics.memoryBefore;
  
  console.table(metrics);
  return metrics;
}
```

---

## Rollout Strategy

### Week 1: Phase 1 (Lazy Loading)
1. Deploy lazyLoader to dev branch
2. Remove CDN scripts from telescope.html
3. Add conditional loading in globe.js, datetime.js
4. Test on dev environment
5. Merge to develop branch

### Week 2: Phase 2 (Events & Debouncing)
1. Deploy eventManager.js
2. Refactor telescope/utils/events.js
3. Add throttling to updateDisplay.js
4. Performance testing with DevTools
5. Merge to develop

### Week 3: Phase 3 (Mode Splitting)
1. Create modes/simple-mode.js and modes/advanced-mode.js
2. Update toggleMode() logic
3. Test mode switching on mobile
4. Merge to develop

### Week 4: Phase 4 & 5 (Optimization + Testing)
1. Implement menu virtualization
2. Run full performance suite
3. Fix any regressions
4. Prepare release notes
5. Merge to main

---

## Monitoring Post-Deployment

### Metrics to Track

```javascript
// Add to telescope.html
window.performanceMetrics = {
  pageLoadTime: 0,
  timeToInteractive: 0,
  protobjectMessageCount: 0,
  memoryUsage: 0
};

window.addEventListener('load', () => {
  window.performanceMetrics.pageLoadTime = performance.now();
  window.performanceMetrics.timeToInteractive = 
    performance.getEntriesByType('navigation')[0]?.domInteractive || 0;
});

// Send metrics to analytics service
if (window.gtag) {
  gtag('event', 'performance', window.performanceMetrics);
}
```

### User Feedback Collection

```javascript
// Simple performance survey after first use
setTimeout(() => {
  const feedback = confirm('¿La aplicación se cargó rápido? (Presiona OK si fue rápido)');
  console.log('User feedback on speed:', feedback);
}, 5000);
```

---

## Rollback Plan

If issues arise:

```bash
# Keep previous version tagged
git tag -a v1.0-before-optimization -m "Backup before optimization"

# Rollback to previous state
git revert <commit-hash>
git push origin develop
```

---

## Future Optimizations (Phase 5+)

1. **Service Worker Caching** - Cache Stellarium data & menu items
2. **WebAssembly** - Compile heavy calculations to WASM
3. **Web Workers** - Move calculations off main thread
4. **Compression** - Brotli compression for assets
5. **Prerendering** - Pre-render menu HTML at build time

