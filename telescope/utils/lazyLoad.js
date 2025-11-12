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