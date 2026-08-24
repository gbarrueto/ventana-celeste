#include <Keyboard.h>

const int potPin = A0;
const int resPin = A1;
const int camPin = 2;

int lastPot = -1;
int lastRes = -1;
bool lastCam = false;

void setup() {

  delay(3000);

  Keyboard.begin();

  pinMode(camPin, INPUT_PULLUP);
}

void loop() {

  int potVal = analogRead(potPin);
  int resVal = analogRead(resPin);

  bool camState = digitalRead(camPin) == LOW;

  // POT
  if (abs(potVal - lastPot) > 5) {

    Keyboard.print("P:");
    Keyboard.print(potVal);
    Keyboard.write(KEY_RETURN);

    lastPot = potVal;
  }

  // RESISTENCIA
  if (abs(resVal - lastRes) > 5) {

    Keyboard.print("R:");
    Keyboard.print(resVal);
    Keyboard.write(KEY_RETURN);

    lastRes = resVal;
  }
  // CAMARA
  if (camState != lastCam) {

    Keyboard.print("C:");

    if (camState) {
      Keyboard.print("TRUE");
    } else {
      Keyboard.print("FALSE");
    }

    Keyboard.write(KEY_RETURN);

    lastCam = camState;
  }

  delay(20);
}