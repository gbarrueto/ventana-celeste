/*
 * Plan C — HID gamepad.  Arduino Leonardo.
 *
 * El potenciómetro se presenta como un eje analógico de joystick. Funciona sin
 * drivers y sin Web Serial, porque el sistema lo ve como un mando común.
 *
 * Requiere la librería "Joystick" de MHeironimus:
 *   Arduino IDE -> Gestor de librerías -> buscar "Joystick" (ArduinoJoystickLibrary)
 *
 * Conexión: igual que el sketch de serial (5V / GND / A0).
 */

#include <Joystick.h>

// Un solo eje: no hace falta simular botones ni sombrero.
Joystick_ Joystick(
  JOYSTICK_DEFAULT_REPORT_ID, JOYSTICK_TYPE_JOYSTICK,
  0, 0,                 // botones, hat switches
  true, false, false,   // ejes X, Y, Z
  false, false, false,  // rotaciones
  false, false, false, false, false
);

const int PIN_POT = A0;
const unsigned long INTERVALO_MS = 20;
const int BANDA_MUERTA = 4;

int ultimoEnviado = -1000;
unsigned long ultimoMs = 0;

void setup() {
  pinMode(PIN_POT, INPUT);
  Joystick.begin();
}

void loop() {
  unsigned long ahora = millis();
  if (ahora - ultimoMs < INTERVALO_MS) return;
  ultimoMs = ahora;

  int valor = analogRead(PIN_POT);
  if (abs(valor - ultimoEnviado) < BANDA_MUERTA) return;
  ultimoEnviado = valor;

  // El eje va de -32768 a 32767; el navegador lo entrega normalizado a -1..1.
  Joystick.setXAxis(map(valor, 0, 1023, -32768, 32767));
}
