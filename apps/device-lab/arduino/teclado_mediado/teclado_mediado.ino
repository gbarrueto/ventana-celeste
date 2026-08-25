/*
 * Prototipo mediado — enfoque, ocular y cámara por teclado USB.
 *
 * La placa se presenta como teclado y escribe una línea por lectura:
 *
 *   P:<0..1023>     posición del potenciómetro de enfoque   (A0)
 *   R:<0..1023>     valor del circuito del ocular           (A1)
 *   C:TRUE|FALSE    presencia de la cámara                  (D2, INPUT_PULLUP)
 *
 * El teclado del anfitrión tiene que estar en distribución inglesa. La librería
 * Keyboard envía códigos de tecla, no caracteres, así que con distribución
 * española el separador ':' llega como 'ñ'.
 *
 * Este sketch declara USB 2.0. Si alguna vez se compila con el core editado a
 * 2.1 —lo que piden las instrucciones de la librería WebUSB— Windows deja de
 * reconocer la placa. Ver el README.
 *
 * PIN DE SEGURIDAD. Con D4 puenteado a GND la placa no teclea nada, lo cual
 * permite programarla como cualquier otra.
 */

#include <Keyboard.h>

const int PIN_POT = A0;
const int PIN_RES = A1;
const int PIN_CAM = 2;
const int PIN_SEGURO = 4;

// Cambio mínimo del ADC para emitir. Cada carácter son dos informes HID, así que
// una banda muerta chica llena el canal con el temblor propio del conversor.
const int BANDA_MUERTA = 8;

// Diferencia máxima entre las dos sondas para dar un canal por conectado. Puede
// necesitar ajuste según la impedancia del circuito real.
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

// El conversor es uno solo, con un multiplexor y un condensador que retiene la
// muestra. Al cambiar de pin, ese condensador arrastra parte de la lectura
// anterior si la fuente tiene impedancia alta. Descartar la primera lectura le
// da tiempo a asentarse y evita que un canal contamine al otro.
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

// ¿Hay algo conectado a esta entrada?
//
// Una entrada al aire no tiene tensión definida: su lectura salta sola y la placa
// emite sin parar, que es ruido para el anfitrión y desgaste del canal HID.
//
// La prueba: forzar el pin a masa, soltarlo y medir; después forzarlo a 5 V,
// soltarlo y medir. Una fuente de baja impedancia —un potenciómetro, un divisor—
// recupera su tensión en microsegundos, así que las dos medidas convergen. Un pin
// al aire conserva la carga que se le dejó, así que las dos medidas quedan en
// extremos opuestos.
//
// Forzar brevemente un pin conectado a un divisor hace circular una corriente
// pequeña durante 200 us. Con resistencias de kilohmios es del orden del
// miliamperio y no molesta.
bool canalConectado(int pin) {
  int desdeBajo = leerTrasForzar(pin, false);
  int desdeAlto = leerTrasForzar(pin, true);
  return abs(desdeAlto - desdeBajo) < UMBRAL_CONEXION;
}

// Se revisa de forma periódica y no sólo al arrancar, porque el ocular se cambia
// durante el uso: hay que enterarse tanto de que apareció como de que se fue.
void revisarCanales() {
  bool antesPot = hayPot;
  bool antesRes = hayRes;
  hayPot = canalConectado(PIN_POT);
  hayRes = canalConectado(PIN_RES);
  // Al reaparecer un canal se olvida su último valor, para que la primera lectura
  // se emita en lugar de quedar tapada por la banda muerta.
  if (hayPot && !antesPot) ultimoPot = -1;
  if (hayRes && !antesRes) ultimoRes = -1;
}

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

  revisarCanales();
  ultimoChequeo = millis();
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
