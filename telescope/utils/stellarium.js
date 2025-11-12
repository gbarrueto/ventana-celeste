import { updateStellariumView } from "../../util/stel.js";
import { eventManager } from "./eventManager.js";

const Orientation = {
  oldX: null,
  oldY: null,
  start(freq = 200) {
    this.freq = freq;
    this.initSensors();
  },
  initSensors() {
    if ("AbsoluteOrientationSensor" in window) {
      try {
        const sensor = new AbsoluteOrientationSensor({ frequency: 60 });
        sensor.addEventListener("reading", () =>
          this.calculateOrientation(sensor.quaternion)
        );
        sensor.start();
      } catch (error) {
        console.error("Sensor error:", error);
      }
    } else {
      console.error("AbsoluteOrientationSensor non supportato.");
    }
  },
  calculateOrientation(q) {
    if (!q) return;
    const [x, y, z, w] = q;
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));

    const fov = Math.exp(logFov);
    const sensitivity = Math.min(1, fov / 20);

    if (this.oldX === null || this.oldY === null) {
      this.oldX = yaw;
      this.oldY = pitch;
    }

    const adjustedYaw = unwrapAngle(yaw, this.oldX);

    this.oldX += (adjustedYaw - this.oldX) * sensitivity;
    this.oldY += (pitch - this.oldY) * sensitivity;

    // Throttle outgoing messages to index.html to avoid flooding
    try {
      eventManager.sendThrottledProtobject(
        { msg: "updateView", values: { h: this.oldX, v: this.oldY } },
        "index.html",
        ORIENTATION_SEND_MS
      );
    } catch (e) {
      Protobject.Core.send({
        msg: "updateView",
        values: { h: this.oldX, v: this.oldY },
      }).to("index.html");
    }

    // Locally update the guide/view at most once per animation frame
    if (!this._pendingRAF) {
      this._pendingRAF = true;
      requestAnimationFrame(() => {
        updateStellariumView({ h: this.oldX, v: this.oldY }); // para guia
        this._pendingRAF = false;
      });
    }
  },
};

Orientation.start();
