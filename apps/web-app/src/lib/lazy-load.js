/**
 * Lazy CDN script loader with caching.
 * Replaces: telescope/utils/lazyLoad.js
 */

const cache = new Map();
const loading = new Map();

export async function loadCdnScript(name, src) {
  if (cache.has(name)) return cache.get(name);
  if (loading.has(name)) return loading.get(name);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.onload = () => {
      cache.set(name, window[name]);
      loading.delete(name);
      resolve(window[name]);
    };
    script.onerror = () => {
      loading.delete(name);
      reject(new Error(`Failed to load ${name} from ${src}`));
    };
    document.head.appendChild(script);
  });

  loading.set(name, promise);
  return promise;
}

export function loadCss(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    document.head.appendChild(link);
  });
}
