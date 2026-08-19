# VentanaCeleste

Telescopio simulado. Un dispositivo con sensores hace de tubo: al moverlo, la vista del cielo se
mueve con él. El cielo lo renderiza Stellarium Web Engine; el zoom, el enfoque y el cambio de ocular
llegan como entrada externa desde hardware.

Monorepo pnpm con cuatro prototipos y un paquete compartido.

## Ejes del proyecto

El proyecto se despliega en cuatro ejes, según quién opera el instrumento y dónde.

| Eje | Para | Estado |
|---|---|---|
| **No mediado** | Museo. La persona visitante usa el instrumento sola. | En pruebas. Ya probado en museo, en segunda fase iterativa. |
| **Mediado** | Eventos y exposiciones. Móvil y flexible, requiere una persona experta que guíe. | En desarrollo de un MVP para su primera prueba en museo. |
| **Hogar** | Distribuible y accesible. | Esbozo. Sin planificar. |
| **Educativo** | Colegios y educadores. | Esbozo. Sin planificar. |

## Aplicaciones

| App | Eje | Qué es | Dispositivos |
|---|---|---|---|
| `web-app` | Núcleo y demo del proyecto completo | Visor en pantalla grande, teléfono como tubo y control. Emparejado por QR. | 2, por WebRTC |
| `kiosk-standalone` | No mediado | Instalación fija. Sensores y pantalla en el mismo dispositivo, entrada por Arduino. | 1 |
| `dual-telescope` | Mediado | Un teléfono dentro del ocular, otro como tubo buscador. | 2, por WebSocket |
| `device-lab` | — | Banco de pruebas de sensores y hardware. No es un producto. | 1 |

`web-app` es el núcleo: la versión más completa y la que se muestra como demostración del proyecto
entero. Su trabajo actual es mantenimiento, búsqueda de bugs y mejoras de interfaz.

Los ejes de hogar y educativo no tienen todavía una app.

`packages/core` (`@ventanaceleste/core`) tiene lo compartido: motor, orientación, comunicación,
tiempo, óptica, conectores de hardware y configuración.

## Requisitos

- Node 20 o superior. Verificado con Node 24.
- pnpm 11.18, fijado en `packageManager`.
- Un teléfono Android para cualquier prueba con sensores. La Generic Sensor API no existe en
  escritorio.

Los catálogos de estrellas y las imágenes de survey se sirven por red. No están en el repo y no
hace falta descargarlos.

## Instalación

```bash
pnpm install
```

Instala todo el workspace. `core` es una dependencia de workspace sin build: las apps importan el
fuente.

## Comandos

```bash
pnpm --filter @ventanaceleste/web-app dev
pnpm --filter @ventanaceleste/kiosk-standalone dev
pnpm --filter @ventanaceleste/dual-telescope dev
pnpm --filter @ventanaceleste/device-lab dev

pnpm -r build          # compila las cuatro
```

`dual-telescope` sirve dos páginas y monta el relay sobre el mismo servidor:

| Rol | URL |
|---|---|
| Ocular | `https://localhost:5173/` |
| Guía | `https://<ip-de-la-PC>:5173/guide.html` |

Las dos las imprime el dev server al arrancar, con el rol al lado y resueltas al puerto real.

Publicación a los dispositivos, detallada en [docs/deployment.md](docs/deployment.md):

```bash
git push origin main
cd apps/dual-telescope
pnpm run pack:deploy
pnpm run publish:deploy -- --push
```

## Probar con un teléfono

Los sensores exigen contexto seguro. `http://localhost` cuenta; una IP de LAN por HTTP plano, no. De
ahí que las apps sirvan HTTPS en desarrollo con un certificado autofirmado que se acepta una vez por
dispositivo.

Dos condiciones que hacen perder tiempo cuando no se conocen:

- **El dev server tiene que correr nativo en el sistema operativo del host**, no dentro de WSL ni de
  una VM. Protobject empareja por origen, y bajo WSL el host no alcanza su propia IP LAN. Ver
  [ADR 0001](docs/adr/0001-protobject-peers-must-share-an-origin.md).
- **Algunos puntos de acceso aíslan a sus clientes entre sí.** Si un dispositivo llega al servidor y
  otro no, suele ser esto y no la app.
- **En `dual-telescope`, el guía va con algo de desfase durante el desarrollo.** No pasa en
  producción, donde la latencia es buena. La topología es otra: sirviendo desde la PC los dos
  teléfonos pasan por ella, en vez de por el que hace de punto de acceso.

## Convenciones

- **Documentación en español neutro**, sin voseo. El estilo de redacción está en
  `.claude/skills/docs-style/SKILL.md` y aplica a todo `.md` del repo.
- **Los documentos de referencia describen lo que existe.** Lo pendiente se sigue en el gestor de
  issues.
- **Nada específico de una máquina** en el repo: sin rutas absolutas, sin nombres de usuario, sin IPs
  de LAN. Se enuncia la restricción portable.
- **`main` se sube antes que cualquier rama de deploy.** El paquete publicado referencia el commit
  de `main` del que salió.
- Mensajes de commit en inglés, con prefijo de tipo y alcance: `fix(kiosk): …`.

## Documentación

[docs/README.md](docs/README.md) es el índice. Punto de entrada:
[docs/arquitectura.md](docs/arquitectura.md).

`old-docs/` contiene la documentación anterior, fuera de git. No es fuente: quedó desactualizada y
se reescribió leyendo el código.
