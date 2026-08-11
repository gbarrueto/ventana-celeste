/*
 * Plan A — Web Serial (CDC).  Arduino Leonardo.
 *
 * Manda la posición del potenciómetro como texto, una lectura por línea.
 * Es el camino más simple: si Web Serial existe en el dispositivo, esto basta.
 *
 * Conexión del potenciómetro lineal (3 patas):
 *   extremo 1 -> 5V
 *   extremo 2 -> GND
 *   cursor    -> A0
 */

const int PIN_POT = A0;

// Cada cuánto se puede mandar, como mucho. 20 ms = 50 Hz, de sobra para un
// enfocador y lejos de saturar el canal.
const unsigned long INTERVALO_MS = 20;

// El ADC nunca está quieto: sin banda muerta se manda ruido constante y el valor
// tiembla en pantalla. 4 cuentas sobre 1024 es ~0,4% del recorrido.
const int BANDA_MUERTA = 4;

int ultimoEnviado = -1000;
unsigned long ultimoMs = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_POT, INPUT);
}

void loop() {
  unsigned long ahora = millis();
  if (ahora - ultimoMs < INTERVALO_MS) return;
  ultimoMs = ahora;

  int valor = analogRead(PIN_POT);            // 0..1023 en el Leonardo (10 bits)
  if (abs(valor - ultimoEnviado) < BANDA_MUERTA) return;
  ultimoEnviado = valor;

  // Prefijo para poder distinguirlo de cualquier otra cosa en el puerto.
  Serial.print("P:");
  Serial.println(valor);
}
