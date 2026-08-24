/*
 * Prototipo mediado — enfoque, ocular y cámara por teclado USB.
 *
 * La placa se presenta como teclado y escribe una línea por lectura:
 *
 *   P:<0..1023>     posición del potenciómetro de enfoque   (A0)
 *   R:<0..1023>     valor del circuito del ocular           (A1)
 *   C:TRUE|FALSE    presencia de la cámara                  (D2, INPUT_PULLUP)
 *
 * PIN DE SEGURIDAD. Con D4 puenteado a GND la placa no teclea nada. Hace falta
 * porque un sketch de teclado que escribe sin parar deja el puerto inutilizable:
 * la ventana del gestor de arranque no alcanza para subir otro sketch, y encima
 * las pulsaciones caen sobre el IDE. Con el puente puesto, la placa se programa
 * como cualquier otra.
 *
 * Si la placa ya quedó inutilizable, está el sketch de rescate en
 * ../rescate/ junto al script que atrapa la ventana del gestor de arranque.
 */

#include <Keyboard.h>

const int PIN_POT = A0;
const int PIN_RES = A1;
const int PIN_CAM = 2;
const int PIN_SEGURO = 4;

// Cambio mínimo del ADC para emitir. Cada carácter son dos informes HID, así que
// una banda muerta chica con la entrada al aire llena el canal de ruido.
const int BANDA_MUERTA = 8;

const unsigned long ESPERA_INICIAL_MS = 5000;
const unsigned long PERIODO_MS = 20;

int ultimoPot = -1;
int ultimoRes = -1;
bool ultimaCam = false;
bool tecleando = false;

void setup() {
  pinMode(PIN_CAM, INPUT_PULLUP);
  pinMode(PIN_SEGURO, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);

  // Margen para desenchufar o poner el puente antes de la primera pulsación.
  delay(ESPERA_INICIAL_MS);

  // El puente se lee una vez, al arrancar: así el estado no cambia a mitad de
  // sesión por un contacto flojo.
  tecleando = digitalRead(PIN_SEGURO) == HIGH;
  if (tecleando) Keyboard.begin();
}

void loop() {
  if (!tecleando) {
    // Latido rápido: se ve desde afuera que está en modo seguro.
    digitalWrite(LED_BUILTIN, HIGH);
    delay(120);
    digitalWrite(LED_BUILTIN, LOW);
    delay(120);
    return;
  }

  int pot = analogRead(PIN_POT);
  int res = analogRead(PIN_RES);
  bool cam = digitalRead(PIN_CAM) == LOW;

  if (abs(pot - ultimoPot) > BANDA_MUERTA) {
    Keyboard.print("P:");
    Keyboard.print(pot);
    Keyboard.write(KEY_RETURN);
    ultimoPot = pot;
  }

  if (abs(res - ultimoRes) > BANDA_MUERTA) {
    Keyboard.print("R:");
    Keyboard.print(res);
    Keyboard.write(KEY_RETURN);
    ultimoRes = res;
  }

  if (cam != ultimaCam) {
    Keyboard.print("C:");
    Keyboard.print(cam ? "TRUE" : "FALSE");
    Keyboard.write(KEY_RETURN);
    ultimaCam = cam;
  }

  delay(PERIODO_MS);
}
