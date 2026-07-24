export default class Telescope {
    constructor(name, type, aperture, focalLength) {
        this.name = name;
        this.type = type;
        this.aperture = aperture;
        this.focalLength = focalLength;

        this.eyepieceFocalLength = null;
        this.magnification = null;

        this.ra = null;
        this.dec = null;
        this.alt = null;
        this.az = null;
    }

    setEyepieceFocalLength(eyepieceFocalLength) {
        this.eyepieceFocalLength = eyepieceFocalLength;
        this.magnification = this.focalLength / this.eyepieceFocalLength;
    }

    setPosition(ra, dec) {
        this.ra = ra;
        this.dec = dec;
    }

    setAltAz(alt, az) {
        this.alt = alt;
        this.az = az;
    }

    getRaDec() {
        return { ra: this.ra, dec: this.dec };
    }

    getAltAz() {
        return { alt: this.alt, az: this.az };
    }
}

export function computeFovFromEyepiece(telescope, eyepieceFocalLength, projectionConstant = 100) {
    let newFov = projectionConstant / telescope.magnification;
    newFov = (newFov * Math.PI) / 180;
    return newFov;
}

export function createDefaultTelescope() {
    return new Telescope("Ventana Celeste", "reflector", 1200, 25);
}