---
name: docs-style
description: Estilo de redacción para la documentación de VentanaCeleste. Usar al escribir o editar cualquier .md del repo (docs/, README, ADR, comentarios largos de módulo). Define qué patrones de redacción están prohibidos y cómo estructurar un documento de referencia.
---

# Estilo de documentación

Documentación técnica de referencia. Clara, plana, directa. La audiencia es una persona
desarrolladora que necesita un dato concreto, no un recorrido.

## Idioma

Español neutro. Nunca voseo ni dialecto rioplatense: `configura`, no `configurá`; `aquí`, no `acá`.

## Patrones prohibidos

### Segunda persona

Es documentación, no una conversación. Nada de instrucciones dirigidas a un lector.

```
mal   No agregues los archivos del motor a assetsInclude.
mal   Si querés cambiar el FOV, escribí core.fov.
bien  Los archivos del motor no van en assetsInclude.
bien  El FOV se cambia con core.fov.
```

### "Afirmación: condición, explicación"

Los dos puntos que introducen una justificación de lo ya dicho.

```
mal   Es idempotente: si la página ya lo cargó, no hace nada.
bien  Inyecta el <script> si window.StelWebEngine no existe.
```

### "Afirmación. Explicación."

El ritmo de dos tiempos donde la segunda oración justifica a la primera.

```
mal   Existe para depurar desde la consola. No es la vía de acceso desde el código.
bien  Disponible en window.currentStelEngine para depuración desde consola.
```

### Narrativa de hallazgo

Una trampa se documenta como problema y efecto, no como el relato de haberla descubierto. Sin
"resulta que", "esto es importante porque", "swapping it broke X".

```
mal   El orden entre Gaia y DSS es significativo. Ambos se registran sobre el mismo
      módulo core.dss, y el módulo se queda con la última fuente agregada, así que si
      se invierten, Gaia reemplaza a DSS y no se renderiza nada.
bien  Gaia y DSS se registran sobre core.dss y el módulo conserva la última fuente
      agregada. Gaia va primero. Invertido, DSS no se renderiza y no hay error.
```

### La alternativa descartada

Una decisión se registra sola. Lo que se descartó ya está descartado y no es información: sólo hace
la frase más larga y deja al lector cargando una opción que no existe.

```
mal   Señales eléctricas leídas por el Arduino, no RFID.
bien  Señales eléctricas leídas por el Arduino.

mal   Se usa WebUSB en vez de Web Serial, que no está disponible en Android.
bien  Se usa WebUSB.
```

Distinto de un contraste que sí lleva información, como corregir una suposición probable
("la degeneración es física, no un defecto de la implementación") o precisar un comportamiento
("enruta por rol, no por identificador de conexión"). Ahí el segundo término es el que evita el
error.

Si la razón del descarte importa para no repetirlo, va al changelog o a un ADR, no a la referencia.

### Contexto a medias

Una afirmación incompleta es peor que ninguna. Si algo vale distinto según el entorno, el
documento lo dice completo o no lo menciona.

```
mal   Los catálogos se sirven por red. No hay copia local todavía.
bien  Los catálogos se sirven por red en web-app siempre, y en kiosk y dual-telescope
      durante desarrollo. En deploy, kiosk y dual-telescope los leen del equipo local.
      No están en el repo.
```

### Pendientes mezclados con la referencia

Un documento de referencia describe lo que existe. Los pendientes, decisiones abiertas y planes
van en un documento aparte. Sin "está pendiente", "todavía no", "en el futuro".

## Estructura

- Título, y debajo dos o tres líneas que digan qué es la cosa. Sin preámbulo.
- Encabezados por tema, no por narrativa.
- Tablas para todo lo enumerable: opciones, atributos, métodos, comparaciones entre apps.
- Bloques de código para lo que se copia y pega. Mínimos, sin comentarios decorativos.
- Trampas conocidas al final, en formato problema y efecto.

## Formato

- Sin emoji.
- Negrita sólo para el término que abre una entrada de lista. Nunca a mitad de oración para
  enfatizar.
- Sin signos de exclamación.
- Sin cierres de sección que resuman lo ya dicho.
- Unidades siempre explícitas: radianes, MJD, grados, metros.

## Verificación

Lo que se documenta se lee del código, no de documentación anterior. La documentación vieja del
repo está en `old-docs/` y sirve como material, no como fuente.
