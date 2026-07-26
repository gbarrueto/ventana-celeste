# Migración a monorepo — proceso

Cómo se pasó de `abellinouc/abellinouc.github.io` (varias versiones de la app dispersas en
ramas) al monorepo pnpm actual. Documenta el **proceso y las decisiones**; el resultado
arquitectónico está en [`../CONTEXT.md`](../CONTEXT.md) y
[`../packages/core/README.md`](../packages/core/README.md), y el registro de cambios en
[`CHANGELOG.md`](CHANGELOG.md).

## 1. Punto de partida

El repo original tenía 5 ramas locales relevantes, que resultaron ser **dos líneas de
desarrollo reales**, no cinco versiones paralelas:

```
main (build compilado, no fuente)
├─→ StaticVersion (2026-02-27) ──┐
│                                 └─→ Migration (2026-05-09) ──→ localversion (2026-06-03, "prod")
└─→ svelte-app-ventanaceleste-com (código fuente, 2026-04-19)
```

| Rama | Qué era |
|---|---|
| `svelte-app-ventanaceleste-com` | Fuente de la App Principal. Svelte 5 (runes), Vite 6 multipágina (`index.html` + `telescope.html`), Protobject/WebRTC, más `Mapa.html`/`Pelota.html` como fuentes alternativas de orientación. Documentación muy completa en `context-for-ai.txt`. |
| `StaticVersion` | Prototipo original: un `index.html` monolítico en JS vanilla, sin build tool ni Svelte. Orientación inline con `Gyroscope` + `AbsoluteOrientationSensor`. Sin documentación de proyecto. |
| `Migration` | Reescritura de `StaticVersion` en Svelte 4 + Vite 5 (`Telescope.js`, `orientationController.js`, `arduinoBridge.js` — este último un stub que lanzaba `"Arduino bridge not implemented yet"`). |
| `localversion` | Continúa **directamente** sobre `Migration` (es ancestro directo, sin divergencia real). Agrega `wrangler.toml` para Cloudflare Workers y ajustes de calibración/zoom. Estado "prod" más reciente de esa línea. |
| `main` | Build compilado, no fuente. |

**Conclusión del análisis:** `main` y `Migration` no aportaban código que no estuviera ya —o
superado— en `svelte-app-ventanaceleste-com` y `localversion` respectivamente. Eran puntos
intermedios y artefactos de build, no versiones a preservar como apps.

## 2. Decisiones

- **pnpm workspaces** como herramienta de monorepo, con layout `apps/*` + `packages/*`.
  Motivo principal: las dos líneas tenían cada una su propia copia de
  `stellarium-web-engine.js`/`.wasm` y su propia inicialización del engine — duplicación real,
  no hipotética.
- **Solo dos ramas entran al monorepo:**
  - `apps/web-app` ← `svelte-app-ventanaceleste-com`
  - `apps/kiosk-standalone` ← `localversion`
  - Quedan fuera: `StaticVersion` y `Migration` (superadas por `localversion`) y `main` (build).
- **Preservar el historial real**, no aplanarlo.
- **Nada se modifica en el remoto original.** Todo lo nuevo va a un repo personal.

## 3. Ejecución

### Importación con historial

```bash
git subtree add --prefix=apps/web-app          svelte-app-ventanaceleste-com
git subtree add --prefix=apps/kiosk-standalone localversion
```

Sin `--squash`, para que cada app entre con su lineage completo. Verificado después: los 365
commits de `localversion` y toda su cadena `Migration` → `StaticVersion` siguen presentes.

> **Particularidad importante de `git subtree add` sin `--squash`:** el historial pre-merge
> conserva las rutas **originales** (sin el prefijo `apps/...`), así que `git log --follow`
> sobre la ruta nueva no lo encuentra. Para navegarlo:
> ```bash
> git log <merge-commit>^2 -- <ruta-original>   # p. ej. -- src/App.svelte
> git log --graph --all
> ```
> No se perdió nada; solo cambia cómo se accede.

### Purga de secretos

La rama `svelte-app-ventanaceleste-com` tenía **dos `.pem` versionados** (certificado + clave
privada autofirmados, nombrados según una IP de red local): eran para servir HTTPS en
desarrollo, necesario porque los sensores de orientación exigen contexto seguro. Por su nombre
casi seguro no eran secretos de producción, pero una clave privada es una clave privada, y
`subtree add` sin squash los habría importado **con todo su historial** al repo nuevo.

Se purgaron con `git filter-repo` antes de importar, de modo que nunca llegaron al monorepo:

```bash
git filter-repo --refs svelte-app-ventanaceleste-com \
  --to-subdirectory-filter apps/web-app --force
```

Fix relacionado: `apps/web-app/vite.config.js` dejó de leer esos `.pem` a mano y pasó a usar
[`@vitejs/plugin-basic-ssl`](https://github.com/vitejs/vite-plugin-basic-ssl), que genera el
certificado al vuelo — así no hace falta versionar ninguno.

### Ramas y remotos

- Las 5 ramas originales se **renombraron solo localmente** (`git branch -m`) con prefijo
  `legacy/`: `legacy/main`, `legacy/static-version`, `legacy/migration`, `legacy/localversion`,
  `legacy/web-app-source`.
- El remoto `abellinouc/abellinouc.github.io` **nunca se tocó** — sigue con sus branches
  intactos. Quedó configurado como `legacy-origin` para consulta.
- `origin` apunta a `gbarrueto/ventana-celeste.git`. Se pusheó **solo `main`**; las `legacy/*`
  quedaron locales a propósito.

## 4. Extracción de `@ventanaceleste/core`

Con las dos apps ya conviviendo, se extrajeron siete módulos a `packages/core` en orden de
autocontención (`time/` primero por ser el más aislado y el de mayor duplicación concreta,
`sync/`+`io/` al final por ser contratos delgados). El razonamiento de diseño previo está en
[`CORE_DESIGN.md`](CORE_DESIGN.md) y la arquitectura resultante en
[`../packages/core/README.md`](../packages/core/README.md).

La deduplicación destapó bugs reales que estaban escondidos en las copias divergentes —
conversiones MJD/JDN mezcladas, una fecha de prueba de 2040 olvidada, nombres `abs*` heredados
de un sensor que ya no se usaba. El detalle está en [`CHANGELOG.md`](CHANGELOG.md).

## 5. Estado de git

El historial del monorepo hasta la migración (8 commits, hasta `b123960`) está pusheado a
`origin/main`. **La extracción de `packages/core` y todo lo posterior sigue sin commitear** —
ver la sección de estado de git en [`CHANGELOG.md`](CHANGELOG.md).
