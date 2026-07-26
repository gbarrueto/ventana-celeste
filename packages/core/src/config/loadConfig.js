// Generic env-based config loader: picks a config module based on Vite's
// `import.meta.env.MODE`, without assuming specific mode names or file
// paths (those are app-specific — e.g. kiosk has a 'dev-device' mode that
// wouldn't make sense elsewhere).
//
// `loaders` maps a mode name to a dynamic-import thunk (so unused config
// files aren't bundled): { development: () => import('./config.dev.js') }

export async function loadConfig(loaders, { mode, fallbackMode = 'production', verbose = true } = {}) {
  const resolvedMode = mode ?? import.meta.env.MODE;
  const loader = loaders[resolvedMode] ?? loaders[fallbackMode];

  if (!loader) {
    throw new Error(`No config loader for mode "${resolvedMode}" and no fallback "${fallbackMode}"`);
  }
  if (verbose) {
    console.log(`Loading config for mode: ${resolvedMode}`);
  }

  const mod = await loader();
  return mod.default ?? mod;
}
