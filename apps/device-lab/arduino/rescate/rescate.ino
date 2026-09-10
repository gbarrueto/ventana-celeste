/*
 * Sketch de rescate para el Leonardo.
 *
 * No abre Keyboard ni escribe nada. Se carga cuando un sketch de teclado dejó
 * la placa inutilizable: si la placa teclea sin parar, el puerto queda ocupado y
 * la ventana del gestor de arranque no alcanza para subir otra cosa.
 *
 * Después de esto la placa vuelve a aparecer como puerto normal y se puede subir
 * cualquier sketch de la forma habitual.
 */

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Latido lento: confirma a la vista que esto es lo que está corriendo.
  digitalWrite(LED_BUILTIN, HIGH);
  delay(900);
  digitalWrite(LED_BUILTIN, LOW);
  delay(900);
}
