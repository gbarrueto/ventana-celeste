# Despliegue

Cómo se desarrolla, se publica y se arranca `dual-telescope` en los dispositivos. El esquema de
compilar en la PC y bajar sólo el resultado sirve igual para `kiosk-standalone`.

## Restricciones

1. El sistema opera sin Internet. La red se usa para preparar (clonar, instalar, traer catálogos),
   no para funcionar.
2. Un teléfono hace de punto de acceso y el otro se conecta a él.
3. Hace falta un proceso servidor en uno de los dispositivos: sirve los estáticos y hace de relay
   entre los dos roles.
4. El dispositivo no compila. El build en Android es lento y es la razón de que `kiosk` necesite
   `--max-old-space-size=1536`.
5. Los sensores exigen contexto seguro. El dispositivo con sensores se sirve a sí mismo por
   `http://localhost`, que ya lo es.

## Desarrollo

```bash
pnpm --filter @ventanaceleste/dual-telescope dev
```

Vite sirve las dos páginas por HTTPS y el relay va montado sobre el mismo servidor.

| Rol | URL |
|---|---|
| Ocular | `https://localhost:5173/` |
| Guía | `https://<ip-de-la-PC>:5173/guide.html` |

Las dos las imprime el dev server al arrancar, con el rol al lado y ya resueltas al puerto real:

```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://10.41.174.80:5173/
  ➜  Ocular : https://localhost:5173/
  ➜  Guía   : https://10.41.174.80:5173/guide.html
```

El teléfono con sensores abre `localhost`, no la IP: sólo `localhost` es contexto seguro sin un
certificado de confianza. El certificado de `@vitejs/plugin-basic-ssl` es autofirmado y se acepta
una vez por dispositivo.

Para invertir qué rol lleva los sensores:

```bash
SENSOR_SOURCE=guide pnpm --filter @ventanaceleste/dual-telescope dev
```

El relay comparte servidor con Vite porque una página HTTPS no puede abrir un WebSocket en claro.
Compartiendo origen, el socket es `wss://` sin configuración.

## Publicación

```bash
git push origin main                       # 1
cd apps/dual-telescope
pnpm run pack:deploy                       # 2
pnpm run publish:deploy -- --push          # 3
```

**`main` va primero.** El script de publicación etiqueta el commit con la revisión de `main` de la
que salió, y esa referencia sólo sirve si el commit existe en el remoto.

Los dos pasos son decisiones separadas a propósito: `main` puede avanzar sin cambiar lo que corre
en el telescopio.

### `pack:deploy`

Compila y arma `deploy/` con tres cosas:

```
deploy/
├── dist/       la app construida
├── relay.mjs   el relay con ws embebido, un archivo sin dependencias
└── start.sh    el arranque
```

esbuild empaqueta `server/relay.js` a ESM. El banner con `createRequire` es necesario porque `ws`
usa `require()` internamente.

### `publish:deploy`

Publica `deploy/` en la rama `deploy/dual-telescope`, que es huérfana: no comparte historia con
`main`, así que el clon en el dispositivo pesa lo que pesa el paquete.

Usa un worktree aparte en `.deploy-worktree`, de modo que el working tree actual nunca se toca.

La rama se vacía antes de copiar, así que borrar un archivo del paquete lo borra en la rama. Sin
cambios respecto de la publicación anterior no genera commit.

`--push` funciona en cualquier shell. `PUSH=1 pnpm run publish:deploy` sólo funciona en bash;
PowerShell no acepta la sintaxis `VAR=1 comando`.

Cada app tiene su propia rama de deploy.

## En el dispositivo

```bash
# una vez
git clone --branch deploy/dual-telescope --single-branch --depth 1 <repo> ventana
cd ventana && ./start.sh

# actualizar
PULL=1 ./start.sh
```

`--single-branch` evita traer los objetos de las otras ramas y `--depth 1` evita el historial.

### Variables de `start.sh`

| Variable | Por defecto | Qué hace |
|---|---|---|
| `SENSOR_SOURCE` | `ocular` | Qué rol lleva los sensores. |
| `PORT` | `8080` | Puerto del relay. |
| `PULL` | `0` | `1` hace `git pull --ff-only` antes de arrancar. |

El script no compila. Si falta `dist/`, aborta con un mensaje.

Usa `relay.mjs` si existe, y `server/relay.js` si se corre dentro del repo.

### Emparejar con el guía

El relay imprime al arrancar la URL de cada rol, con una línea por interfaz de red:

```
  Ocular (este equipo): http://localhost:8080/
  Guía (otro teléfono): http://192.168.43.1:8080/guide.html   [ap0]
```

Las direcciones salen de `os.networkInterfaces()` de Node. `ip route get` y `hostname -i` no
sirven: en Termux devuelven una dirección de loopback, inalcanzable desde el otro teléfono aunque
este equipo sea el punto de acceso.

El panel de depuración del ocular muestra esa misma URL como QR, que es la vía práctica en el
montaje. Con varias interfaces, tocar el QR recorre las direcciones: cuál alcanza al guía depende
de a qué red esté conectado.

El shebang es `#!/usr/bin/env bash`. La ruta absoluta de Termux sólo existe en Termux e impedía
correr el script en cualquier otro lado.

### Bit de ejecución en Windows

Con `core.filemode=false`, git no registra el permiso de ejecución y `start.sh` llega al
dispositivo sin él. Se marca una vez en el índice:

```bash
git update-index --chmod=+x apps/dual-telescope/start.sh
```

## Vías alternativas para el paquete

| Vía | Cuándo |
|---|---|
| Rama de deploy | Por defecto. Versionado, sin herramientas nuevas. |
| Copia por USB o `scp` | Respaldo en sitio, sin Internet ni git. |

## Aislamiento de clientes en el punto de acceso

Algunos puntos de acceso no dejan que dos clientes se comuniquen entre sí. El síntoma es que un
dispositivo alcanza al servidor y otro no, sin nada raro en la app.

En producción no aplica: el dispositivo principal es a la vez punto de acceso y servidor, así que
el tráfico va cliente contra punto de acceso.

En desarrollo sí aplica: sirviendo desde la PC con los teléfonos conectados a un teléfono que hace
de punto de acceso, la PC es otro cliente.

Salidas: usar un router en vez de un teléfono, probar con otro teléfono como punto de acceso, o
hacer que la PC sea el punto de acceso.

## Termux

El proceso servidor corre hoy en Termux, lanzado a mano con `start.sh`. Sacar Termux del todo
implicaría mover el relay a otro anfitrión, lo cual cambia la topología, no sólo el despliegue.
