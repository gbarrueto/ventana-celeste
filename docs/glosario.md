# Glosario

Términos de astronomía y de óptica que aparecen en el código y en el resto de la documentación.
Suficiente para leer `packages/core/src/telescope/` sin formación en el dominio.

## Coordenadas y tiempo

**Alt-az** (altura-acimut). Sistema de coordenadas relativo al observador. La **altura** es el
ángulo sobre el horizonte, de 0° a 90°. El **acimut** es el ángulo alrededor del horizonte. Es lo
que el motor llama `pitch` y `yaw`.

En el cenit, altura 90°, el acimut queda indefinido: todas las direcciones apuntan hacia abajo. La
degeneración es física, no un defecto de la implementación.

**Distancia cenital**. Complemento de la altura: 90° menos altura. Aparece en el cálculo de
magnitud límite porque mirar bajo, cerca del horizonte, atraviesa más atmósfera.

**ICRF**. Sistema de referencia celeste, fijo respecto de las estrellas. El motor convierte de ICRF
a alt-az con `convertFrame()`.

**MJD** (Modified Julian Date). Días transcurridos desde el 17 de noviembre de 1858, en punto
flotante. Es el formato del reloj del motor. Un día es 1.0, una hora es 1/24.

## Objetos y catálogos

**DSO** (Deep Sky Object). Objeto de cielo profundo: galaxias, nebulosas, cúmulos. Todo lo que no
sea una estrella individual o un cuerpo del sistema solar.

**Survey**. Relevamiento fotográfico del cielo completo, servido como mosaico de imágenes por
niveles de zoom. En el proyecto se usan dos: **DSS** (Digitized Sky Survey), imagen a color, y
**Gaia**, catálogo astrométrico.

**Cultura celeste** (skyculture). Conjunto de constelaciones de una tradición cultural. El proyecto
carga la occidental.

**MPC** (Minor Planet Center). Fuente de los elementos orbitales de asteroides y cometas.

## Óptica del instrumento

**Apertura**. Diámetro del espejo o de la lente principal, en milímetros. Determina cuánta luz
entra, y por lo tanto qué tan débil puede ser el objeto más tenue visible.

**Distancia focal**. Del telescopio y del ocular, en milímetros.

**Aumento**. Distancia focal del telescopio dividida por la del ocular. Un ocular de menor distancia
focal da más aumento y menos campo.

**FOV** (campo de visión). Cuánto cielo entra en la vista, en radianes en todo el código. Un FOV
chico es zoom alto.

**Pupila de salida**. Apertura dividida por aumento, en milímetros. Si supera la pupila del ojo, la
luz sobrante se desperdicia.

**Newtoniano**. Telescopio reflector con espejo secundario plano a 45°. Entrega la imagen rotada y
reflejada respecto de lo que se ve a ojo desnudo.

**Tubo guía** o buscador. Telescopio pequeño montado en paralelo al principal, con campo amplio,
usado para localizar el objeto antes de mirarlo por el ocular. Es el rol `guide` de
`dual-telescope`.

**Obstrucción central**. El espejo secundario de un reflector tapa parte de la apertura. En el
código es `DS`, entre 20 % y 35 % del diámetro según el tipo.

## Calidad del cielo

**Magnitud**. Escala de brillo, invertida y logarítmica: menor número es más brillante. La
diferencia de 1 magnitud es un factor de unas 2.5 veces en luminosidad.

**Magnitud límite**. La magnitud del objeto más débil visible en unas condiciones dadas. En el
código, `display_limit_mag` recorta lo que el motor dibuja.

**NELM** (Naked Eye Limiting Magnitude). Magnitud límite a ojo desnudo, sin telescopio. Es el punto
de partida del cálculo.

**SQM** (Sky Quality Meter). Brillo del fondo de cielo, en magnitudes por segundo de arco al
cuadrado. Más alto es cielo más oscuro. Un cielo excelente ronda 21.9; una ciudad, 18.

**Escala Bortle**. Escala de 1 a 9 de contaminación lumínica. 1 es cielo de sitio remoto, 9 es
centro urbano. Se deriva del SQM en `magToBortle()`.

**Extinción atmosférica**. Pérdida de luz al atravesar la atmósfera, en magnitudes por masa de aire.
Aumenta cerca del horizonte.

**Seeing**. Turbulencia atmosférica. Hace que las estrellas titilen y limita el detalle: por bueno
que sea el telescopio, la imagen no supera el disco que la atmósfera impone. Se mide como el
diámetro de ese disco, en segundos de arco.

En la aplicación, el seeing es un efecto visual sobre el canvas, distinto del desenfoque del
enfocador.

**Índice de color**. Diferencia de brillo de una estrella entre dos filtros. Indica su color, y por
lo tanto su temperatura.

## Instrumento simulado

**Ocular**. La lente por la que se mira. En `dual-telescope` es también el rol del teléfono montado
dentro del tubo.

**Punto de foco**. Posición del recorrido del enfocador en la que la imagen queda nítida. Depende
del ocular montado, así que cambiar de ocular obliga a reenfocar. Es la mecánica que el enfocador
del prototipo reproduce.

**Fuente de orientación**. Qué dispositivo lee los sensores y decide hacia dónde apunta el
instrumento. En `dual-telescope` lo fija el servidor, no la página.
