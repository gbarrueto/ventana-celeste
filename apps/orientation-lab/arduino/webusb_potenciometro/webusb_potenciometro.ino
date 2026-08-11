/*
 * Plan B — WebUSB.  Arduino Leonardo.
 *
 * Manda el valor como texto, igual que el sketch de serial, pero por una
 * interfaz WebUSB en vez de CDC. Sirve si Web Serial no existe en el
 * dispositivo pero WebUSB sí.
 *
 * Requiere la librería WebUSB de Arduino:
 *   Arduino IDE -> Gestor de librerías -> buscar "WebUSB" (Arduino)
 *
 * Es el más delicado de los tres: en algunos sistemas el driver CDC toma la
 * interfaz y el navegador no puede reclamarla. Si falla con "unable to claim
 * interface", no es el sketch — es el sistema quedándose con el dispositivo.
 *
 * Conexión: igual que los otros (5V / GND / A0).
 */

#include <WebUSB.h>

// La URL es la página de aterrizaje que el navegador puede ofrecer al conectar.
// No tiene que existir para que el enlace funcione.
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

  // La libreria descarta lo que se escriba mientras el navegador no se haya
  // anunciado (el equivalente a DTR). Sin este guard el sketch "anda" pero no
  // llega nada, que es indistinguible de un problema de hardware.
  if (!Salida) return;

  int valor = analogRead(PIN_POT);
  if (abs(valor - ultimoEnviado) < BANDA_MUERTA) return;
  ultimoEnviado = valor;

  Salida.print("P:");
  Salida.println(valor);
  Salida.flush();
}
