# Despliegue en los dispositivos — stack y rutina

Documento para **decidir**. Compara las dos opciones que quedaron en pie para llevar la app a los
teléfonos y mantenerla actualizada. Se descartaron el envoltorio nativo (APK) y los add-ons de
Termux (Boot/Widget).

Aplica sobre todo a `dual-telescope`, pero la opción A sirve igual para `kiosk`.

## Comandos, de un vistazo

```bash
# --- desarrollo (nada de build/push/pull) ---
pnpm --filter @ventanaceleste/dual-telescope dev
#   sirve por HTTPS y monta el relay en el mismo origen
#   ocular : https://localhost:5173/           (localhost = contexto seguro)
#   guía   : https://<ip-de-la-PC>:5173/guide.html
#   fuente : SENSOR_SOURCE=guide pnpm ... dev

# --- publicar a los dispositivos ---
git push origin main                       # 1. primero el código
cd apps/dual-telescope
pnpm run pack:deploy                       # 2. arma deploy/
PUSH=1 pnpm run publish:deploy             # 3. publica la rama de deploy

# --- en el dispositivo ---
git clone --branch deploy/dual-telescope --single-branch --depth 1 <repo> ventana
cd ventana && ./start.sh                   # actualizar: PULL=1 ./start.sh
```

## Convención: `main` primero, deploy después

**Siempre `main` antes que la rama de deploy.** El script de publicación etiqueta el commit con
el revision de `main` del que salió (`deploy: dual-telescope desde <rev>`), y esa referencia sólo
sirve si ese commit existe en el remoto. Publicar primero deja un paquete que apunta a un commit
que nadie más tiene — justo cuando más se necesita saber qué versión está corriendo en el aparato.

No se publican al mismo tiempo a propósito: son dos decisiones distintas. Se puede querer avanzar
en `main` sin tocar lo que hay en el telescopio.

## Desarrollo: servir desde la PC, sin build ni pull

Construir, publicar y bajar en cada cambio no sirve para desarrollar. Para eso el dev server de
Vite sirve las dos páginas y **el relay va montado sobre él**.

Eso resuelve un problema que de otro modo bloquea todo: los sensores exigen **contexto seguro**,
así que la página tiene que ir por HTTPS — y una página HTTPS **no puede abrir un WebSocket en
claro** (mixed content). Compartiendo servidor, la página y el socket quedan en el mismo origen y
el socket es `wss://` sin configurar nada. El certificado es autofirmado: se acepta una vez por
dispositivo.

El teléfono con sensores tiene que abrir `https://localhost:5173/`, no la IP: sólo `localhost`
cuenta como contexto seguro sin certificado de confianza.

## Restricciones que mandan

1. **No depender de Internet.** Suele haber conexión — no es una salida al desierto — pero el
   sistema tiene que funcionar sin ella. O sea: se puede usar la red para *preparar* (clonar,
   instalar, traer catálogos), nunca para *operar*.
2. **Un teléfono hace de AP** y el otro se conecta a él.
3. **Hace falta un proceso servidor** en uno de los dispositivos: es el que sirve los estáticos y
   hace de relay WebSocket entre los dos roles.
4. **El teléfono no debería compilar.** El build en Android es lento y es la razón de que `kiosk`
   necesite subir el límite de memoria de Node (`--max-old-space-size=1536`).
5. **Contexto seguro para los sensores.** El dispositivo con sensores se sirve a sí mismo por
   `http://localhost`, que ya es contexto seguro. El otro no lleva sensores, así que puede recibir
   la página por HTTP plano (ver §5.1 de [`DUAL_TELESCOPE_PLAN.md`](DUAL_TELESCOPE_PLAN.md)).

---

## Opción A — Compilar en la PC, el dispositivo sólo baja el resultado

### Stack

| Dónde | Qué |
|---|---|
| PC | Node + pnpm, todo el toolchain, `vite build` |
| Dispositivo principal | **Sólo Node.** `ws` va embebido en el bundle; sin Vite, sin pnpm, sin `node_modules`, sin compilar |
| Transporte | `git pull` de un artefacto ya construido |

El relay ya sirve `dist/`, así que el dispositivo no necesita nada más que ese directorio y
`node server/relay.js` — que es lo que hace `start.sh`.

### Sólo la app en el dispositivo, no el repo entero

Sí, esto lo resuelve — y se puede ir bastante más lejos que "una rama con el build".

El paquete de despliegue que arma `pnpm run pack:deploy` contiene exactamente tres cosas:

```
deploy/
├── dist/       la app ya construida
├── relay.mjs   el relay con `ws` embebido: un archivo, cero dependencias
└── start.sh    el arranque
```

**El dispositivo no necesita el repo, ni pnpm, ni `node_modules`, ni compilar. Sólo Node.**
Verificado corriéndolo desde una carpeta vacía sin `node_modules`: sirve los estáticos y responde
`/link-config`.

### Crear y actualizar la rama de deploy

`pnpm run publish:deploy` (en `apps/dual-telescope`) la crea la primera vez y la actualiza
después. Usa un **worktree aparte**, así que nunca toca el working tree actual: si algo falla en
el medio, no queda nada a medias en `main`.

```bash
pnpm run pack:deploy               # arma deploy/ desde el código actual
pnpm run publish:deploy            # commitea en deploy/dual-telescope
PUSH=1 pnpm run publish:deploy     # y además la sube
```

La rama es **huérfana**: no comparte ancestros con `main`, así que no arrastra la historia del
monorepo. Verificado sobre la rama recién creada — 9 archivos, sólo `dist/`, `relay.mjs` y
`start.sh`, sin nada de `src/`, `server/` ni `packages/`.

El script vacía la rama antes de copiar, de modo que borrar un archivo del paquete también lo
borra en la rama; y si no hay cambios respecto de la publicación anterior, no genera un commit
vacío.

Para que el dispositivo baje sólo eso:

```bash
# una vez, en el dispositivo
git clone --branch deploy/dual-telescope --single-branch --depth 1 <repo> ventana
# después, para actualizar
git pull --ff-only
```

Con `--single-branch` no se traen los objetos de las otras ramas, y con `--depth 1` tampoco el
historial. Si la rama de deploy es **huérfana** (`git checkout --orphan`), su historia es
independiente del repo principal, así que el clon es del tamaño del paquete y nada más.

Cada app tiene su propia rama de deploy, así que `kiosk` no arrastra `dual-telescope` ni al revés.

### Dónde vive el `dist`

Tres variantes, de menos a más ceremonia:

1. **Rama de deploy** (`deploy/dual-telescope`): la PC compila y commitea sólo `dist/` ahí. El
   dispositivo hace `git pull` de esa rama. Simple, versionado, sin herramientas nuevas.
2. **Release/artefacto** (tarball adjunto a un tag): más limpio para el repo principal, pero hay
   que descargar y descomprimir a mano. Sirve para preparar con calma, no para corregir algo en el
   momento.
3. **Copia directa** por USB o `scp` desde la PC. Sin Internet ni git en el medio; es la vía de
   escape cuando algo falla en el sitio.

Recomendada: **(1)**, con **(3)** como respaldo.

### Rutina de trabajo

```
PC:          editar → probar → pnpm run pack:deploy → publicar deploy/ en su rama
Dispositivo: PULL=1 ./start.sh
```

Es el mismo ciclo *push/pull* de hoy, con el build movido a la PC.

### A favor / en contra

- **A favor:** el dispositivo no necesita toolchain; arranque rápido; el ciclo de actualización no
  cambia respecto de lo que ya funciona; se puede volver a una versión anterior con git.
- **En contra:** hay que acordarse de compilar y publicar (un `dist` viejo es un bug confuso);
  agrega una rama o un paso de publicación.

---

## Opción B — Instalar la app como PWA

### Stack

Se suma al proyecto, no lo reemplaza: un `manifest.webmanifest` (nombre, íconos, `display:
standalone`, orientación) y un service worker que cachee los estáticos para que abra sin depender
de que el servidor conteste primero.

### Qué cambia y qué no

- **Cambia:** ícono propio en la pantalla de inicio, pantalla completa sin barra del navegador,
  arranque de un toque. Se siente una app.
- **No cambia:** **sigue haciendo falta el relay corriendo.** Un PWA no reemplaza al servidor: la
  sincronización entre los dos teléfonos pasa por WebSocket. Tampoco reemplaza a la opción A —
  el código que el PWA cachea tiene que haber llegado de algún lado.

### ⚠️ La restricción que decide

**Un service worker requiere contexto seguro.** El principal se sirve a sí mismo por
`http://localhost`, que lo es → **puede instalarse como PWA**. El guía recibe la página por IP de
LAN sobre HTTP plano, que **no** lo es → **no puede instalarse como PWA de verdad**. Como mucho
consigue un acceso directo en la pantalla de inicio, que es un marcador, no una instalación.

Para que el guía también fuera PWA habría que servir HTTPS con certificado en una IP de LAN, o
sea `mkcert` y su CA instalada en los dos teléfonos. Es viable y offline, pero es infraestructura
nueva que hoy no hace falta para nada más.

### A favor / en contra

- **A favor:** mejor experiencia de uso; el caché del service worker vuelve el arranque más
  robusto ante un servidor que todavía no levantó.
- **En contra:** beneficio **asimétrico** — completo en el principal, parcial en el guía, salvo
  que se agregue HTTPS; y suma manifest + service worker que hay que mantener (un service worker
  mal invalidado sirve una versión vieja, que es justo el bug difícil de ver).

### Decisión: pospuesto

Como el proceso servidor hace falta igual, el PWA no evita ningún paso: es trabajo extra encima
de lo mismo. Se retoma más adelante, si la comodidad de uso lo justifica.

---

## Cómo se combinan

No son alternativas: **A resuelve cómo llega el código, B resuelve cómo se lanza.** Se pueden
adoptar en ese orden, y A vale la pena aunque B nunca se haga.

## Lo que ninguna de las dos resuelve

Las dos siguen necesitando **un proceso corriendo** en el dispositivo principal (restricción 3).
Hoy eso es Termux, lanzado a mano con `start.sh`. Si se quisiera sacar Termux del todo, habría que
mover el relay a otro anfitrión — por ejemplo un equipo chico dedicado tipo Raspberry Pi haciendo
de AP y servidor — lo cual cambia la topología del §2 de `Architecture.md`, no sólo el despliegue.

## ⚠️ Aislamiento de clientes en el AP

Observado en la práctica: **algunos puntos de acceso no dejan que dos clientes se hablen entre
sí.** Con un teléfono haciendo de AP, la PC y un segundo teléfono conectados a él, el segundo
teléfono no alcanzaba a `kiosk` servido desde la PC; cambiando el AP a otro teléfono, sí.

Es *client isolation* (o *AP isolation*), y conviene tenerlo presente porque afecta distinto a
cada escenario:

- **Producción: no molesta.** El dispositivo principal es a la vez AP y servidor, así que el
  tráfico va cliente↔AP, no cliente↔cliente. La topología del §2 de `Architecture.md` es inmune a
  esto por construcción.
- **Desarrollo: sí molesta.** Sirviendo desde la PC con los teléfonos en un AP-teléfono, la PC es
  *otro cliente* — exactamente el caso que se bloquea. Si un dispositivo no llega a la PC y otro
  sí, es esto y no la app.

Salidas: usar un router normal en vez de un teléfono como AP, probar con otro teléfono de AP (el
comportamiento varía por fabricante), o hacer que la PC sea el AP.

## Criterio para decidir

- ¿Actualizar sigue siendo tan simple como *push* en la PC y *pull* en el dispositivo? Si no, no
  vale la pena.
- ¿Se puede volver atrás rápido en el sitio, sin Internet?
- ¿La ganancia justifica el mantenimiento? Un service worker es código que puede fallar servando
  una versión vieja en silencio.
