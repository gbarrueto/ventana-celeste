/*
 * Transmisión de potenciómetro vía WebUSB (Arduino Leonardo).
 * Requiere librería WebUSB.
 */

#include <WebUSB.h>

WebUSB WebUSBSerial(1, "ventanaceleste.com/io");

#define Salida WebUSBSerial

const int PIN_POT = A0;
const unsigned long INTERVALO_MS = 20;
const int BANDA_MUERTA = 4;

int ultimoEnviado = -1000;
unsigned long ultimoMs = 0;

void setup() {
  Salida.begin(9600);
  pinMode(PIN_POT, INPUT);
}

void loop() {
  unsigned long ahora = millis();
  if (ahora - ultimoMs < INTERVALO_MS) return;
  ultimoMs = ahora;

  if (!Salida) return;

  int valor = analogRead(PIN_POT);
  if (abs(valor - ultimoEnviado) < BANDA_MUERTA) return;
  ultimoEnviado = valor;

  Salida.print("P:");
  Salida.println(valor);
  Salida.flush();
}
