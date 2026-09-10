Circuitos Arduino Prototipo Mediado
Circuito 1: Potenciómetro lineal (Enfoque)
Objetivo: medir la posición del enfocador.
Utiliza 1 conexión a 5 V, 1 conexión a GND y 1 conexión al pin analógico A0.
El Arduino lee el valor mediante analogRead(A0), obteniendo un número entre 0 y 1023.
Cuando la posición cambia, envía el dato al computador con el formato:
P:valor


Circuito 2: Detección de resistencia (Ocular)
Objetivo: leer el valor entregado por el circuito asociado al ocular.
Utiliza 1 conexión a 5 V, 1 conexión a GND y 1 conexión al pin analógico A1.
El Arduino lee el valor mediante analogRead(A1).
Cuando el valor cambia, lo envía al computador con el formato:
R:valor

El código no interpreta ese número; simplemente lo envía al software para que sea procesado.

Circuito 3: Detección de conexión (Cámara)
Objetivo: detectar si la cámara está conectada.
Utiliza 1 conexión a GND y 1 conexión al pin digital D2.
El pin está configurado con INPUT_PULLUP, por lo que el Arduino detecta si la entrada cambia entre HIGH y LOW.
Cuando cambia el estado, envía:
C:TRUE

o
C:FALSE


Conexiones utilizadas
En total, el sistema utiliza:
Tipo de conexión
Cantidad
5 V
2
GND
3
Entrada analógica A0
1
Entrada analógica A1
1
Entrada digital D2
1

En conjunto, estos tres circuitos permiten que el Arduino Leonardo obtenga información del enfocador, del ocular y de la cámara, para luego transmitirla al computador mediante USB utilizando la librería Keyboard.

