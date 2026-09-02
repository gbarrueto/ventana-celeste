/*
 * Emulación de teclado USB (Arduino Leonardo) para enfoque, ocular y cámara.
 *
 * Formato de salida:
 *   P:<0..1023>     potenciómetro de enfoque (A0)
 *   R:<0..1023>     circuito del ocular      (A1)
 *   C:TRUE|FALSE    presencia de la cámara   (D2)
 *
 * Pin D4 a GND activa modo seguro (desactiva emulación de teclado).
 */

#include <Keyboard.h>

const int PIN_POT = A0;
const int PIN_RES = A1;
const int PIN_CAM = 2;
const int PIN_SEGURO = 4;

// Banda muerta ADC para evitar ruido en el canal HID.
const int BANDA_MUERTA = 8;

const int UMBRAL_CONEXION = 60;

const unsigned long ESPERA_INICIAL_MS = 5000;
const unsigned long PERIODO_MS = 20;
const unsigned long CHEQUEO_MS = 2000;

int ultimoPot = -1;
int ultimoRes = -1;
bool ultimaCam = false;
bool tecleando = false;
bool hayPot = false;
bool hayRes = false;
unsigned long ultimoChequeo = 0;

// Descarta la primera lectura para estabilizar el multiplexor ADC.
int leerAnalogico(int pin) {
  analogRead(pin);
  return analogRead(pin);
}

// Fuerza el pin a un extremo, lo suelta y mide enseguida.
int leerTrasForzar(int pin, bool alto) {
  pinMode(pin, OUTPUT);
  digitalWrite(pin, alto ? HIGH : LOW);
  delayMicroseconds(200);
  pinMode(pin, INPUT);
  delayMicroseconds(200);
  return analogRead(pin);
}

// Detecta si hay una carga conectada al pin analógico.
bool canalConectado(int pin) {
  int desdeBajo = leerTrasForzar(pin, false);
  int desdeAlto = leerTrasForzar(pin, true);
  return abs(desdeAlto - desdeBajo) < UMBRAL_CONEXION;
}

// Sondeo periódico de conexión de canales.
void revisarCanales() {
  bool antesPot = hayPot;
  bool antesRes = hayRes;
  hayPot = canalConectado(PIN_POT);
  hayRes = canalConectado(PIN_RES);
  if (hayPot && !antesPot) ultimoPot = -1;
  if (hayRes && !antesRes) ultimoRes = -1;
}

void setup() {
  pinMode(PIN_CAM, INPUT_PULLUP);
  pinMode(PIN_SEGURO, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);

  delay(ESPERA_INICIAL_MS);

  tecleando = digitalRead(PIN_SEGURO) == HIGH;
  if (tecleando) Keyboard.begin();

  revisarCanales();
  ultimoChequeo = millis();
}

void loop() {
  if (!tecleando) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(120);
    digitalWrite(LED_BUILTIN, LOW);
    delay(120);
    return;
  }

  if (millis() - ultimoChequeo >= CHEQUEO_MS) {
    revisarCanales();
    ultimoChequeo = millis();
  }

  if (hayPot) {
    int pot = leerAnalogico(PIN_POT);
    if (abs(pot - ultimoPot) > BANDA_MUERTA) {
      Keyboard.print("P:");
      Keyboard.print(pot);
      Keyboard.write(KEY_RETURN);
      ultimoPot = pot;
    }
  }

  if (hayRes) {
    int res = leerAnalogico(PIN_RES);
    if (abs(res - ultimoRes) > BANDA_MUERTA) {
      Keyboard.print("R:");
      Keyboard.print(res);
      Keyboard.write(KEY_RETURN);
      ultimoRes = res;
    }
  }

  bool cam = digitalRead(PIN_CAM) == LOW;
  if (cam != ultimaCam) {
    Keyboard.print("C:");
    Keyboard.print(cam ? "TRUE" : "FALSE");
    Keyboard.write(KEY_RETURN);
    ultimaCam = cam;
  }

  delay(PERIODO_MS);
}
