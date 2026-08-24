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
 * ENTRADAS AL AIRE. Una entrada analógica sin nada conectado no tiene una
 * tensión definida y su lectura salta sola, así que la placa emite sin parar.
 * Medido: ese caudal durante la ventana de enumeración impide que Windows
 * reconozca la placa, y deja de reconocerla hasta que se le carga un sketch que
 * no emita. Por eso la lectura del ocular está apagada mientras su circuito no
 * exista.
 *
 * PIN DE SEGURIDAD. Con D4 puenteado a GND la placa no teclea nada, lo cual
 * permite programarla como cualquier otra. Si aun así quedó inutilizable, está
 * ../rescate/ con el sketch limpio y el script que lo carga.
 */

#include <Keyboard.h>

// Poner en 1 cuando el circuito del ocular esté armado. Con la entrada al aire,
// A1 sólo produce ruido, y ese ruido es suficiente para romper la enumeración.
#define LEER_OCULAR 0

const int PIN_POT = A0;
const int PIN_RES = A1;
const int PIN_CAM = 2;
const int PIN_SEGURO = 4;

// Cambio mínimo del ADC para emitir. Cada carácter son dos informes HID, así que
// una banda muerta chica llena el canal con el temblor propio del conversor.
const int BANDA_MUERTA = 8;

const unsigned long ESPERA_INICIAL_MS = 5000;
const unsigned long PERIODO_MS = 20;

int ultimoPot = -1;
int ultimoRes = -1;
bool ultimaCam = false;
bool tecleando = false;

// El conversor es uno solo, con un multiplexor y un condensador que retiene la
// muestra. Al cambiar de pin, ese condensador arrastra parte de la lectura
// anterior si la fuente tiene impedancia alta. Descartar la primera lectura le
// da tiempo a asentarse y evita que un canal contamine al otro.
int leerAnalogico(int pin) {
  analogRead(pin);
  return analogRead(pin);
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

  int pot = leerAnalogico(PIN_POT);
  if (abs(pot - ultimoPot) > BANDA_MUERTA) {
    Keyboard.print("P:");
    Keyboard.print(pot);
    Keyboard.write(KEY_RETURN);
    ultimoPot = pot;
  }

#if LEER_OCULAR
  int res = leerAnalogico(PIN_RES);
  if (abs(res - ultimoRes) > BANDA_MUERTA) {
    Keyboard.print("R:");
    Keyboard.print(res);
    Keyboard.write(KEY_RETURN);
    ultimoRes = res;
  }
#endif

  bool cam = digitalRead(PIN_CAM) == LOW;
  if (cam != ultimaCam) {
    Keyboard.print("C:");
    Keyboard.print(cam ? "TRUE" : "FALSE");
    Keyboard.write(KEY_RETURN);
    ultimaCam = cam;
  }

  delay(PERIODO_MS);
}
